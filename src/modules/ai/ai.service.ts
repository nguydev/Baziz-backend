/**
 * AI Service
 * Handles portfolio context building, Exa Search, and Vercel AI Gateway calls.
 * All external API secrets stay server-side.
 */

import mongoose from 'mongoose';
import axios from 'axios';
import Property from '../property/property.model';
import { getLandlordSummary } from '../rent-payment/rent-payment.service';
import logger from '../../config/logger';

const TOOLKIT_URL = process.env.RORK_TOOLKIT_URL || 'https://toolkit.rork.com';
const TOOLKIT_SECRET = process.env.RORK_TOOLKIT_SECRET_KEY || '';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string;
  highlights?: string[];
}

// ─── 1. Portfolio Context Builder ────────────────────────────────────────────

export const buildPortfolioContext = async (landlordId: string): Promise<string> => {
  try {
    const landlordObjectId = new mongoose.Types.ObjectId(landlordId);

    const [properties, paymentSummary] = await Promise.all([
      Property.find({ landlordId: landlordObjectId, isActive: true })
        .select('propertyName streetAddress city postcode purchasePrice monthlyMortgagePayment units')
        .lean(),
      getLandlordSummary(landlordId),
    ]);

    if (properties.length === 0) {
      return "The landlord's portfolio is currently empty. No properties exist yet.";
    }

    let totalPortfolioValue = 0;
    let totalMortgageDebt = 0;
    let totalMonthlyRent = 0;
    let vacantUnitsCount = 0;
    let occupiedUnitsCount = 0;
    const propertyLines: string[] = [];

    for (const prop of properties) {
      const pPrice = prop.purchasePrice || 0;
      totalPortfolioValue += pPrice;

      const monthlyMortgage = prop.monthlyMortgagePayment || 0;
      totalMortgageDebt += monthlyMortgage * 12 * 20;

      const propUnits = Array.isArray(prop.units) ? prop.units : [];
      let propMonthlyRent = 0;
      let propOccupiedCount = 0;

      for (const unit of propUnits) {
        propMonthlyRent += unit.rentAmount || 0;
        if (unit.isOccupied) { occupiedUnitsCount++; propOccupiedCount++; }
        else { vacantUnitsCount++; }
      }

      totalMonthlyRent += propMonthlyRent;
      const propYield = pPrice > 0 ? ((propMonthlyRent * 12) / pPrice) * 100 : 0;
      const status = propOccupiedCount === propUnits.length ? 'Fully Occupied' : propOccupiedCount === 0 ? 'Vacant' : 'Partially Occupied';

      propertyLines.push(
        `- **${prop.propertyName}**: ${prop.streetAddress}, ${prop.city}, ${prop.postcode}. ` +
        `Purchase Price: £${pPrice.toLocaleString()}, Monthly Rent: £${propMonthlyRent.toLocaleString()}, ` +
        `Monthly Mortgage: £${monthlyMortgage.toLocaleString()}, Gross Yield: ${propYield.toFixed(2)}%, Status: ${status}`
      );
    }

    let context = `LANDLORD PORTFOLIO CONTEXT:\n`;
    context += `- Total Properties: ${properties.length}\n`;
    context += `- Occupied Units: ${occupiedUnitsCount}, Vacant Units: ${vacantUnitsCount}\n`;
    context += `- Total Portfolio Value: £${totalPortfolioValue.toLocaleString()}\n`;
    context += `- Estimated Total Mortgage Debt: £${totalMortgageDebt.toLocaleString()}\n`;
    context += `- Total Rent: £${totalMonthlyRent.toLocaleString()}/month (£${(totalMonthlyRent * 12).toLocaleString()}/year)\n`;
    context += `- Collected Payments: £${paymentSummary.collected.amount.toLocaleString()}\n`;
    context += `- Pending Payments: ${paymentSummary.pending.count} (£${paymentSummary.pending.amount.toLocaleString()})\n`;
    context += `- Overdue Payments: ${paymentSummary.overdue.count} (£${paymentSummary.overdue.amount.toLocaleString()})\n\n`;
    context += `PER-PROPERTY BREAKDOWN:\n`;
    context += propertyLines.join('\n') + '\n';

    return context;
  } catch (err) {
    logger.error('buildPortfolioContext error:', err);
    return 'Error fetching landlord portfolio data. Treat the portfolio as empty.';
  }
};

// ─── 2. News Query Keyword Detection ─────────────────────────────────────────

export const isNewsQuery = (text: string): boolean => {
  const lower = text.toLowerCase();
  const keywords = [
    'news', 'latest', 'update', 'today', 'this week', 'this month', 'recent',
    'market update', 'property market', 'housing market', 'interest rate',
    'bank of england', 'base rate', 'mortgage rate', 'regulation',
    'renters reform', 'renters rights', 'section 21', 'eviction', 'legislation',
    'stamp duty', 'sdlt', 'budget', 'tax change', 'housing policy', 'breaking',
    '2025', '2026',
  ];
  return keywords.some((kw) => lower.includes(kw));
};

// ─── 3. Exa News Search ───────────────────────────────────────────────────────

export const searchPropertyNews = async (query: string): Promise<ExaResult[]> => {
  if (!TOOLKIT_SECRET) {
    logger.warn('RORK_TOOLKIT_SECRET_KEY not set — returning mock news results.');
    return getMockNewsArticles();
  }

  const searchQuery = query.toLowerCase().includes('news')
    ? `UK property market news ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`
    : `UK property ${query}`;

  const response = await axios.post(
    `${TOOLKIT_URL}/v2/exa/search`,
    { query: searchQuery, type: 'auto', numResults: 6, contents: { highlights: true } },
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOOLKIT_SECRET}` } }
  );

  return (response.data?.results || []) as ExaResult[];
};

// ─── 4. Vercel AI Gateway Chat Completions ────────────────────────────────────

export const callVercelAI = async (
  messages: ChatMessage[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> => {
  if (!TOOLKIT_SECRET) {
    logger.warn('RORK_TOOLKIT_SECRET_KEY not set — returning mock AI response.');
    return getMockAIResponse(messages);
  }

  const response = await axios.post(
    `${TOOLKIT_URL}/v2/vercel/v1/chat/completions`,
    {
      model: 'openai/gpt-4.1-mini',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 800,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOOLKIT_SECRET}`,
      },
    }
  );

  return response.data?.choices?.[0]?.message?.content || '';
};

// ─── 5. Vercel AI Transcription ───────────────────────────────────────────────

export const transcribeAudio = async (base64Audio: string, mediaType = 'audio/m4a'): Promise<string> => {
  if (!TOOLKIT_SECRET) {
    return 'Voice transcription unavailable: RORK_TOOLKIT_SECRET_KEY not configured.';
  }

  const response = await axios.post(
    `${TOOLKIT_URL}/v2/vercel/v4/ai/transcription-model`,
    { audio: base64Audio, mediaType },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOOLKIT_SECRET}`,
        'ai-model-id': 'openai/whisper-large-v3',
        'ai-gateway-protocol-version': '0.0.1',
      },
    }
  );

  return response.data?.text || '';
};

// ─── Mock Fallbacks ───────────────────────────────────────────────────────────

function getMockNewsArticles(): ExaResult[] {
  return [
    {
      title: "Renters' Rights Bill: Key changes for landlords in 2026",
      url: 'https://www.gov.uk/government/publications/renters-rights-bill',
      publishedDate: new Date().toISOString(),
      highlights: ['Section 21 no-fault evictions abolished.', 'New mandatory landlord ombudsman introduced.'],
    },
    {
      title: 'UK House Price Index: Q2 2026 Analysis',
      url: 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/housepriceindex',
      publishedDate: new Date().toISOString(),
      highlights: ['Average UK house prices rose 1.8% in Q2 2026.', 'Buy-to-let yields strongest in North East.'],
    },
    {
      title: 'Bank of England holds base rate at 4.25%',
      url: 'https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes',
      publishedDate: new Date().toISOString(),
      highlights: ['Rate held steady.', '5-year fixed mortgage rates stabilizing around 4.5%.'],
    },
  ];
}

function getMockAIResponse(messages: ChatMessage[]): string {
  const lastMsg = [...messages].reverse().find((m: ChatMessage) => m.role === 'user')?.content?.toLowerCase() || '';
  if (lastMsg.includes('yield')) return 'To calculate your gross yield: (Annual Rent / Purchase Price) × 100. For example, £12,000/year on a £200,000 property = 6% gross yield.';
  if (lastMsg.includes('income') || lastMsg.includes('rent')) return 'Your total rental income is calculated from all occupied units across your portfolio.';
  return "Hello! I'm your Propertera AI Assistant. I can answer questions about your portfolio, UK tax rules, stamp duty, yields, and property market news. How can I help?";
}
