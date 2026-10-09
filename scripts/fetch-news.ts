/**
 * ดึงข่าว → ตัดซ้ำ → สรุปไทยด้วย LLM → เขียนไฟล์ JSON/Markdown
 * รันทุกชั่วโมงโดย GitHub Actions (.github/workflows/fetch-news.yml)
 *   npm run fetch        ใช้ LLM จริง (ต้องมี GEMINI_API_KEY)
 *   npm run fetch:mock   ไม่เรียก LLM ใช้ทดสอบ
 */
import { pathToFileURL } from "node:url";
import {
  LLM_BATCH_SIZE,
  MAX_AGE_HOURS,
  MAX_SUMMARIZE_PER_RUN,
  RETENTION_DAYS,
  RSS_FEEDS,
} from "../config/sources.ts";
import { buildDigest, renderDailyMarkdown } from "../lib/daily.ts";
import { addDays, thaiDateKey } from "../lib/date.ts";
import { fetchFinnhub, fetchRssFeed, type RawArticle } from "../lib/feeds.ts";
import { createLlmClient } from "../lib/llm.ts";
import { makeId, SAME_STORY_THRESHOLD, titleSimilarity } from "../lib/normalize.ts";
import {
  deleteDay,
  listDayKeys,
  readDay,
  readSp500,
  writeDaily,
  writeDailyMarkdown,
  writeDay,
  writeMeta,
} from "../lib/store.ts";
import { summarizeBatch } from "../lib/summarize.ts";
import type { DayFile, NewsItem } from "../lib/types.ts";

const HOUR = 3_600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface MergeResult {
  newItems: NewsItem[];
  dirtyDays: Set<string>;
}

/** รวมข่าวดิบเข้ากับไฟล์รายวันที่มีอยู่ (แก้ไข days ในที่) */
export function mergeArticles(raw: RawArticle[], days: Map<string, DayFile>, now: Date): MergeResult {
  const all: NewsItem[] = [...days.values()].flatMap((d) => d.items);
  const byId = new Map(all.map((it) => [it.id, it]));
  const dirtyDays = new Set<string>();
  const newItems: NewsItem[] = [];

  const sorted = [...raw].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  for (const r of sorted) {
    const published = new Date(Math.min(new Date(r.publishedAt).getTime(), now.getTime()));
    if (now.getTime() - published.getTime() > MAX_AGE_HOURS * HOUR) continue;
    const id = makeId(r.url);
    if (byId.has(id)) continue;

    // ข่าวเรื่องเดียวกันจากหลายสำนัก → รวมเป็นชิ้นเดียว
    const dup = all.find(
      (it) =>
        Math.abs(new Date(it.publishedAt).getTime() - published.getTime()) < 24 * HOUR &&
        titleSimilarity(it.title, r.title) >= SAME_STORY_THRESHOLD,
    );
    if (dup) {
      byId.set(id, dup);
      if (dup.source !== r.source && !dup.alsoReportedBy.some((x) => x.url === r.url)) {
        dup.alsoReportedBy.push({ source: r.source, url: r.url });
        dirtyDays.add(thaiDateKey(dup.publishedAt));
      }
      continue;
    }

    const dayKey = thaiDateKey(published);
    const day = days.get(dayKey);
    if (!day) continue;
    const item: NewsItem = {
      id,
      url: r.url,
      title: r.title,
      description: r.description,
      source: r.source,
      feed: r.feed,
      publishedAt: published.toISOString(),
      fetchedAt: now.toISOString(),
      alsoReportedBy: [],
      status: "pending",
      attempts: 0,
    };
    day.items.push(item);
    all.push(item);
    byId.set(id, item);
    newItems.push(item);
    dirtyDays.add(dayKey);
  }
  return { newItems, dirtyDays };
}

async function main() {
  // โหลด .env ตอนรันในเครื่อง (บน GitHub Actions ใช้ secrets แทน) — ไม่ทับค่าที่ตั้งไว้แล้ว
  try {
    process.loadEnvFile();
  } catch {
    /* ไม่มี .env ก็ไม่เป็นไร */
  }
  const now = new Date();
  const llm = createLlmClient();
  const sp500 = new Set(readSp500().map((s) => s.symbol));
  if (sp500.size === 0) throw new Error("data/sp500.json ว่าง — รัน npm run update-sp500");
  console.log(`Finanza fetch @ ${now.toISOString()} (LLM: ${llm.name}/${llm.model})`);

  // 1) ดึงข่าวทุกแหล่งพร้อมกัน feed ไหนพังข้ามไป
  const failedFeeds: string[] = [];
  const raw: RawArticle[] = [];
  const settled = await Promise.allSettled(RSS_FEEDS.map((f) => fetchRssFeed(f)));
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      raw.push(...s.value);
      console.log(`  ${RSS_FEEDS[i].id}: ${s.value.length}`);
    } else {
      failedFeeds.push(`${RSS_FEEDS[i].id}: ${(s.reason as Error).message}`);
      console.warn(`  ${RSS_FEEDS[i].id}: FAILED ${(s.reason as Error).message}`);
    }
  });
  if (process.env.FINNHUB_API_KEY) {
    const fh = await fetchFinnhub(process.env.FINNHUB_API_KEY);
    raw.push(...fh.articles);
    failedFeeds.push(...fh.failed);
    console.log(`  finnhub: ${fh.articles.length}`);
  }
  if (raw.length === 0) throw new Error(`ดึงข่าวไม่ได้เลยสักแหล่ง: ${failedFeeds.join("; ")}`);

  // 2) โหลดไฟล์ 3 วันล่าสุด (ครอบคลุมช่วง MAX_AGE_HOURS) แล้วรวมข่าวใหม่
  const today = thaiDateKey(now);
  const days = new Map<string, DayFile>();
  for (const key of [addDays(today, -2), addDays(today, -1), today]) {
    days.set(key, readDay(key) ?? { date: key, updatedAt: now.toISOString(), items: [] });
  }
  const { newItems, dirtyDays } = mergeArticles(raw, days, now);
  console.log(`  ดึงได้ ${raw.length} ข่าว, ใหม่ ${newItems.length}`);

  // 3) สรุปไทย: ข่าวที่ยังไม่สรุป ใหม่สุดก่อน
  const pending = [...days.values()]
    .flatMap((d) => d.items)
    .filter((it) => it.status === "pending")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_SUMMARIZE_PER_RUN);
  let summarized = 0;
  for (let i = 0; i < pending.length; i += LLM_BATCH_SIZE) {
    const batch = pending.slice(i, i + LLM_BATCH_SIZE);
    summarized += await summarizeBatch(llm, batch, sp500);
    for (const it of batch) dirtyDays.add(thaiDateKey(it.publishedAt));
    // เว้นช่วงกัน rate limit ของ free tier
    if (llm.name !== "mock" && i + LLM_BATCH_SIZE < pending.length) await sleep(5000);
  }
  console.log(`  สรุปแล้ว ${summarized}/${pending.length}`);

  // 4) เขียนไฟล์เฉพาะวันที่เปลี่ยน + ข่าวด่วนรายวัน (top 2)
  for (const key of dirtyDays) {
    const day = days.get(key);
    if (!day) continue;
    day.items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    day.updatedAt = now.toISOString();
    writeDay(day);
    const digest = buildDigest(key, day.items, now);
    writeDaily(digest);
    writeDailyMarkdown(key, renderDailyMarkdown(digest));
    console.log(`  ${key}: ${day.items.length} ข่าว, top: ${digest.top.map((t) => t.ai?.importance).join(", ")}`);
  }

  // 5) ลบไฟล์ข่าวดิบที่เก่าเกิน RETENTION_DAYS (ข่าวด่วนรายวันเก็บถาวร)
  const cutoff = addDays(today, -RETENTION_DAYS);
  for (const key of listDayKeys()) if (key < cutoff) deleteDay(key);

  writeMeta({
    lastRunAt: now.toISOString(),
    lastRun: { fetched: raw.length, newItems: newItems.length, summarized, failedFeeds, provider: `${llm.name}:${llm.model}` },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
