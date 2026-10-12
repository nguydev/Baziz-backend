import axios from 'axios';
import logger from '../../config/logger';
import { callVercelAI } from './ai.service';

const TOOLKIT_URL = process.env.RORK_TOOLKIT_URL || 'https://toolkit.rork.com';
const TOOLKIT_SECRET = process.env.RORK_TOOLKIT_SECRET_KEY || '';

export interface CGTRateSet {
  allowance: number;
  basicRate: number;
  higherRate: number;
  basicRateBand: number;
  source: string;
  lastUpdated: string;
  isLive: boolean;
}

export interface IHTRateSet {
  nilRateBand: number;
  residenceNilRateBand: number;
  ihtRate: number;
  coupleCombinedThreshold: number;
  source: string;
  lastUpdated: string;
  isLive: boolean;
}

const extractJSON = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

const searchExa = async (query: string, numResults = 5): Promise<any[]> => {
  if (!TOOLKIT_SECRET) {
    logger.warn('RORK_TOOLKIT_SECRET_KEY not set — searchExa returning empty.');
    return [];
  }

  const response = await axios.post(
    `${TOOLKIT_URL}/v2/exa/search`,
    { query, type: 'auto', numResults, contents: { highlights: true } },
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOOLKIT_SECRET}` } }
  );

  return response.data?.results || [];
};

// Bundled Fallback CGT Rates
export const getBundledCGTRates = (taxYear: string): CGTRateSet => {
  const is2023 = taxYear.includes('2023') || taxYear.startsWith('23');
  return {
    allowance: is2023 ? 6000 : 3000,
    basicRate: 0.18,
    higherRate: 0.24,
    basicRateBand: 50270,
    source: 'https://www.gov.uk/capital-gains-tax/rates',
    lastUpdated: is2023 ? '2023-04-06' : '2024-04-06',
    isLive: false,
  };
};

// Bundled Fallback IHT Rates
export const getBundledIHTRates = (): IHTRateSet => {
  return {
    nilRateBand: 325000,
    residenceNilRateBand: 175000,
    ihtRate: 0.40,
    coupleCombinedThreshold: 1000000,
    source: 'https://www.gov.uk/inheritance-tax/work-out-inheritance-tax-due',
    lastUpdated: '2024-04-06',
    isLive: false,
  };
};

export const fetchCGTRates = async (taxYear: string): Promise<CGTRateSet> => {
  const fallback = getBundledCGTRates(taxYear);

  if (!TOOLKIT_SECRET) {
    logger.warn('RORK_TOOLKIT_SECRET_KEY not set — using bundled rates for CGT.');
    return fallback;
  }

  try {
    const query = `UK Capital Gains Tax rates residential property ${taxYear} HMRC gov.uk allowance`;
    const searchResults = await searchExa(query, 5);

    if (searchResults.length === 0) {
      logger.warn('Exa search returned no results for CGT rates — using bundled fallback.');
      return fallback;
    }

    const resultsString = searchResults
      .map((r, i) => `[Result ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nHighlights: ${r.highlights?.join(' ') || ''}\n`)
      .join('\n');

    const systemPrompt = 'You are a precise UK tax data extractor. Return only valid JSON, no markdown or explanation.';
    const userPrompt = `Scraped UK tax pages search results:\n${resultsString}\n\n` +
      `Extract the CGT rates for residential property in the tax year ${taxYear}. ` +
      `Return a single JSON object matching these exact keys (values must be numbers for amounts/rates, string for source and lastUpdated):\n` +
      `{\n` +
      `  "allowance": number,\n` +
      `  "basicRate": number (cgt rate in decimal, e.g. 0.18),\n` +
      `  "higherRate": number (cgt rate in decimal, e.g. 0.24),\n` +
      `  "basicRateBand": number (amount, typically 50270),\n` +
      `  "source": string (HMRC URL),\n` +
      `  "lastUpdated": string (YYYY-MM-DD or readable date)\n` +
      `}`;

    const rawAI = await callVercelAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0, max_tokens: 300 }
    );

    const cleanAI = extractJSON(rawAI);
    const parsed = JSON.parse(cleanAI);

    // Validate type and values
    const allowance = Number(parsed.allowance);
    const basicRate = Number(parsed.basicRate);
    const higherRate = Number(parsed.higherRate);
    const basicRateBand = Number(parsed.basicRateBand);

    if (
      isNaN(allowance) || allowance <= 0 ||
      isNaN(basicRate) || basicRate <= 0 ||
      isNaN(higherRate) || higherRate <= 0 ||
      isNaN(basicRateBand) || basicRateBand <= 0
    ) {
      throw new Error('Type validation failed: extracted numerical values are invalid or zero');
    }

    return {
      allowance,
      basicRate,
      higherRate,
      basicRateBand,
      source: parsed.source || fallback.source,
      lastUpdated: parsed.lastUpdated || fallback.lastUpdated,
      isLive: true,
    };
  } catch (err) {
    logger.error('Failed to fetch/extract live CGT rates:', err);
    return fallback;
  }
};

export const fetchIHTRates = async (): Promise<IHTRateSet> => {
  const fallback = getBundledIHTRates();

  if (!TOOLKIT_SECRET) {
    logger.warn('RORK_TOOLKIT_SECRET_KEY not set — using bundled rates for IHT.');
    return fallback;
  }

  try {
    const query = 'UK Inheritance Tax thresholds nil rate band residence nil rate band 2026 HMRC gov.uk';
    const searchResults = await searchExa(query, 5);

    if (searchResults.length === 0) {
      logger.warn('Exa search returned no results for IHT rates — using bundled fallback.');
      return fallback;
    }

    const resultsString = searchResults
      .map((r, i) => `[Result ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nHighlights: ${r.highlights?.join(' ') || ''}\n`)
      .join('\n');

    const systemPrompt = 'You are a precise UK tax data extractor. Return only valid JSON, no markdown or explanation.';
    const userPrompt = `Scraped UK inheritance tax search results:\n${resultsString}\n\n` +
      `Extract the Inheritance Tax (IHT) thresholds. ` +
      `Return a single JSON object matching these exact keys (values must be numbers for thresholds/rates, string for source and lastUpdated):\n` +
      `{\n` +
      `  "nilRateBand": number (typically 325000),\n` +
      `  "residenceNilRateBand": number (typically 175000),\n` +
      `  "ihtRate": number (iht rate in decimal, typically 0.40),\n` +
      `  "coupleCombinedThreshold": number (typically 1000000),\n` +
      `  "source": string (HMRC URL),\n` +
      `  "lastUpdated": string (YYYY-MM-DD or readable date)\n` +
      `}`;

    const rawAI = await callVercelAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0, max_tokens: 300 }
    );

    const cleanAI = extractJSON(rawAI);
    const parsed = JSON.parse(cleanAI);

    // Validate type and values
    const nilRateBand = Number(parsed.nilRateBand);
    const residenceNilRateBand = Number(parsed.residenceNilRateBand);
    const ihtRate = Number(parsed.ihtRate);
    const coupleCombinedThreshold = Number(parsed.coupleCombinedThreshold);

    if (
      isNaN(nilRateBand) || nilRateBand <= 0 ||
      isNaN(residenceNilRateBand) || residenceNilRateBand <= 0 ||
      isNaN(ihtRate) || ihtRate <= 0 ||
      isNaN(coupleCombinedThreshold) || coupleCombinedThreshold <= 0
    ) {
      throw new Error('Type validation failed: extracted numerical values are invalid or zero');
    }

    return {
      nilRateBand,
      residenceNilRateBand,
      ihtRate,
      coupleCombinedThreshold,
      source: parsed.source || fallback.source,
      lastUpdated: parsed.lastUpdated || fallback.lastUpdated,
      isLive: true,
    };
  } catch (err) {
    logger.error('Failed to fetch/extract live IHT rates:', err);
    return fallback;
  }
};
