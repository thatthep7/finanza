import { z } from "zod";
import type { LlmClient } from "./llm.ts";
import { normalizeSymbol } from "./normalize.ts";
import type { AiSummary, NewsItem } from "./types.ts";

export const PROMPT_VERSION = "v1";

const SYSTEM = `You are a senior US equities news editor writing for Thai retail investors who follow the S&P 500.
For each article you receive (headline and maybe a short description), return one result object.

Rules:
- "relevant": true only if the news can plausibly move US stock prices: S&P 500 companies, sectors, or macro (Fed, rates, inflation, jobs, GDP, tariffs, oil, bond yields, major geopolitics). Personal-finance advice, lifestyle, non-US local news, generic "stocks to buy" listicles => false.
- Write "titleTh" (a concise Thai headline, max ~90 chars), "summaryTh" (2–3 Thai sentences of the facts only), "impactTh" (1 Thai sentence: why it matters for which stocks/sectors).
- Keep company names, tickers, and terms such as EPS, Fed, CPI in English. Do not invent numbers that are not in the input.
- "importance" 1–10:
  9–10 = moves the whole S&P 500 (Fed decision, CPI/jobs surprise, major tariff/policy shock, index move >2%) or a shock at a top-10 company (earnings/guidance surprise, mega M&A >$20B).
  7–8 = important for a large company or a whole sector (earnings beat/miss, guidance change, major lawsuit or regulation, CEO exit, big M&A).
  4–6 = notable company news (analyst rating change, product launch, partnership).
  1–3 = minor, opinion pieces, recaps without new information.
- "sentiment": bullish | bearish | mixed | neutral (for the affected stocks overall).
- "tickers": S&P 500 tickers directly affected, each with "direction": up | down | neutral. Use [] for pure macro news. Use class-share format like BRK.B.
- "category": one of macro, earnings, guidance, m_and_a, analyst, regulation, legal, product, management, market, other.

Respond with JSON only: {"results":[{"id","relevant","titleTh","summaryTh","impactTh","category","importance","sentiment","tickers":[{"symbol","direction"}]}]}`;

const ResultSchema = z.object({
  id: z.string(),
  relevant: z.boolean(),
  titleTh: z.string().default(""),
  summaryTh: z.string().default(""),
  impactTh: z.string().default(""),
  category: z
    .enum(["macro", "earnings", "guidance", "m_and_a", "analyst", "regulation", "legal", "product", "management", "market", "other"])
    .catch("other"),
  importance: z.coerce.number().min(1).max(10).catch(3),
  sentiment: z.enum(["bullish", "bearish", "mixed", "neutral"]).catch("neutral"),
  tickers: z
    .array(z.object({ symbol: z.string(), direction: z.enum(["up", "down", "neutral"]).catch("neutral") }))
    .catch([]),
});
const ResponseSchema = z.object({ results: z.array(z.unknown()) });

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

/**
 * สรุปข่าวชุดหนึ่ง แก้ไข item ในที่ (status/ai/attempts)
 * คืนจำนวนที่สรุปสำเร็จ
 */
export async function summarizeBatch(
  llm: LlmClient,
  items: NewsItem[],
  sp500: Set<string>,
): Promise<number> {
  const payload = items.map((it) => ({
    id: it.id,
    source: it.source,
    title: it.title,
    description: it.description?.slice(0, 400),
  }));
  const user = `Articles:\n${JSON.stringify(payload)}`;

  let raw: unknown;
  try {
    raw = extractJson(await llm.complete(SYSTEM, user));
  } catch (e) {
    for (const it of items) markFailed(it);
    console.warn(`  LLM batch failed: ${(e as Error).message}`);
    return 0;
  }

  const parsed = ResponseSchema.safeParse(raw);
  const byId = new Map<string, z.infer<typeof ResultSchema>>();
  if (parsed.success) {
    for (const r of parsed.data.results) {
      const ok = ResultSchema.safeParse(r);
      if (ok.success) byId.set(ok.data.id, ok.data);
    }
  }

  let done = 0;
  for (const it of items) {
    const r = byId.get(it.id);
    if (!r) {
      markFailed(it);
      continue;
    }
    it.attempts += 1;
    if (!r.relevant) {
      it.status = "irrelevant";
      it.ai = undefined;
      done++;
      continue;
    }
    const seen = new Set<string>();
    const tickers = r.tickers
      .map((t) => ({ symbol: normalizeSymbol(t.symbol), direction: t.direction }))
      .filter((t) => sp500.has(t.symbol) && !seen.has(t.symbol) && seen.add(t.symbol));
    const ai: AiSummary = {
      titleTh: r.titleTh || it.title,
      summaryTh: r.summaryTh,
      impactTh: r.impactTh,
      category: r.category,
      importance: Math.round(r.importance),
      sentiment: r.sentiment,
      tickers,
      model: `${llm.name}:${llm.model}:${PROMPT_VERSION}`,
    };
    it.ai = ai;
    it.status = "done";
    done++;
  }
  return done;
}

function markFailed(it: NewsItem) {
  it.attempts += 1;
  it.status = it.attempts >= 3 ? "failed" : "pending";
}
