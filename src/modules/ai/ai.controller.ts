import type { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import * as aiService from "./ai.service";
import * as taxRateService from "./tax-rate.service";
import logger from "../../config/logger";

// POST /ai/chat

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = req.user!._id.toString();
  const { messages, isNews = false } = req.body as {
    messages: aiService.ChatMessage[];
    isNews: boolean;
  };

  // 1. Build portfolio context from real DB (server-side, secure)
  const portfolioContext = await aiService.buildPortfolioContext(landlordId);

  // 2. If it's a news query, fetch latest UK property news via Exa
  let sources: aiService.ExaResult[] = [];
  if (isNews) {
    try {
      const lastUserMsg =
        [...messages].reverse().find((m) => m.role === "user")?.content || "";
      sources = await aiService.searchPropertyNews(lastUserMsg);
    } catch (err) {
      logger.warn("Exa search failed, continuing without news sources:", err);
    }
  }

  // 3. Build system prompt
  const systemPrompt = `You are a UK property management expert AI assistant embedded in the Propertera landlord platform.
You specialise in: rental yields, cashflow analysis, ROI, EPC/gas/electrical compliance, HMO licensing, Right to Rent checks,
Stamp Duty Land Tax (SDLT), Land Transaction Tax (LTT), Land and Buildings Transaction Tax (LBTT),
Section 24 mortgage interest relief changes, Capital Gains Tax on property disposals, buy-to-let strategy, and UK property market analysis.
Always use £ for currency. Be concise, practical, and cite the landlord's actual property names when relevant.
Tolerate minor transcription errors from voice input — do not comment on spelling/grammar.

${portfolioContext}`;

  // 4. Assemble final messages for AI completions
  const fullMessages: aiService.ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (isNews && sources.length > 0) {
    const lastUserMsg =
      [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const sourcesBlock = sources
      .map(
        (s, i) =>
          `[${i + 1}] "${s.title}" — ${s.url} (${s.publishedDate ? new Date(s.publishedDate).toLocaleDateString("en-GB") : "recent"})`,
      )
      .join("\n");

    // Replace last user message with a structured synthesis prompt
    const priorMessages = messages.slice(0, -1);
    fullMessages.push(...priorMessages);
    fullMessages.push({
      role: "user",
      content: `The user is asking about property news: "${lastUserMsg}"\n\nHere are the latest UK property news articles found:\n${sourcesBlock}\n\nPlease synthesise these into:\n1. A 2–3 sentence summary of key headlines.\n2. Bullet-point main stories with source citations [1], [2], etc.\n3. A "What this means for you" section with practical implications for a landlord.`,
    });
  } else {
    fullMessages.push(...messages);
  }

  // 5. Call Vercel AI Gateway (server-side, secret never exposed to browser)
  const text = await aiService.callVercelAI(fullMessages, {
    temperature: isNews ? 0.5 : 0.7,
    max_tokens: isNews ? 700 : 900,
  });

  res.status(200).json(
    ApiResponse.ok("AI response generated", {
      text,
      sources: isNews ? sources : undefined,
    }),
  );
});

// ─── POST /ai/transcribe ───────────────────────────────────────────────────────

export const transcribe = asyncHandler(async (req: Request, res: Response) => {
  const { base64Audio, mediaType = "audio/m4a" } = req.body as {
    base64Audio: string;
    mediaType?: string;
  };

  const text = await aiService.transcribeAudio(base64Audio, mediaType);

  res.status(200).json(ApiResponse.ok("Transcription complete", { text }));
});

// GET /ai/tax-rates/cgt
export const getCGTRates = asyncHandler(async (req: Request, res: Response) => {
  const taxYear = (req.query.year as string) || '2026/27';
  const rates = await taxRateService.fetchCGTRates(taxYear);
  res.status(200).json(ApiResponse.ok('CGT rates retrieved successfully', rates));
});

// GET /ai/tax-rates/iht
export const getIHTRates = asyncHandler(async (req: Request, res: Response) => {
  const rates = await taxRateService.fetchIHTRates();
  res.status(200).json(ApiResponse.ok('IHT rates retrieved successfully', rates));
});
