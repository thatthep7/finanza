import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { buildDigest, pickTopTwo, renderDailyMarkdown } from "../lib/daily.ts";
import { addDays, thaiDateKey } from "../lib/date.ts";
import { parseRss } from "../lib/feeds.ts";
import type { LlmClient } from "../lib/llm.ts";
import { canonicalUrl, makeId, normalizeSymbol, titleSimilarity } from "../lib/normalize.ts";
import { summarizeBatch } from "../lib/summarize.ts";
import type { DayFile, NewsItem } from "../lib/types.ts";
import { mergeArticles } from "../scripts/fetch-news.ts";

const NOW = new Date("2026-10-09T20:00:00Z"); // 03:00 น. วันที่ 10 ต.ค. เวลาไทย
const fixture = (n: string) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

test("thaiDateKey ใช้เวลาไทย", () => {
  assert.equal(thaiDateKey("2026-10-09T16:59:00Z"), "2026-10-09");
  assert.equal(thaiDateKey("2026-10-09T17:00:00Z"), "2026-10-10");
  assert.equal(addDays("2026-10-01", -1), "2026-09-30");
});

test("canonicalUrl ตัด tracking params แต่เก็บ id", () => {
  assert.equal(canonicalUrl("http://WWW.CNBC.com/a.html?utm_source=rss&mod=x#top"), "https://www.cnbc.com/a.html");
  assert.equal(canonicalUrl("https://x.com/story?id=5&utm_medium=y"), "https://x.com/story?id=5");
  assert.equal(makeId("https://a.com/x?utm_source=1"), makeId("https://a.com/x"));
});

test("titleSimilarity จับข่าวเรื่องเดียวกัน", () => {
  assert.ok(titleSimilarity("Nvidia shares jump after record data center revenue", "Nvidia shares jump after record data center revenue, stock hits high") >= 0.6);
  assert.ok(titleSimilarity("Nvidia shares jump", "Fed minutes show officials split") < 0.2);
});

test("normalizeSymbol", () => {
  assert.equal(normalizeSymbol("$brk-b"), "BRK.B");
});

test("parseRss: Yahoo ไม่มี description, CNBC มี HTML", async () => {
  const y = await parseRss(fixture("yahoo.xml"), { id: "yahoo-top", source: "Yahoo Finance", url: "" });
  assert.equal(y.length, 2);
  assert.equal(y[0].url, "https://finance.yahoo.com/news/nvidia-shares-jump-123.html");
  assert.equal(y[0].description, undefined);
  const c = await parseRss(fixture("cnbc.xml"), { id: "cnbc-top", source: "CNBC", url: "" });
  assert.equal(c[0].description, "The chipmaker reported revenue above estimates.");
  assert.equal(c[0].url, "https://www.cnbc.com/2026/10/09/nvidia-earnings.html");
});

async function rawAll() {
  return [
    ...(await parseRss(fixture("yahoo.xml"), { id: "yahoo-top", source: "Yahoo Finance", url: "" })),
    ...(await parseRss(fixture("cnbc.xml"), { id: "cnbc-top", source: "CNBC", url: "" })),
  ];
}

function emptyDays(): Map<string, DayFile> {
  const today = thaiDateKey(NOW);
  return new Map(
    [addDays(today, -2), addDays(today, -1), today].map((k) => [k, { date: k, updatedAt: "", items: [] }]),
  );
}

test("mergeArticles: รวมข่าวซ้ำข้ามสำนัก และรันซ้ำไม่เพิ่ม", async () => {
  const days = emptyDays();
  const first = mergeArticles(await rawAll(), days, NOW);
  assert.equal(first.newItems.length, 3); // nvidia (รวม 2 สำนัก), retire, fed
  const nvda = first.newItems.find((i) => i.title.startsWith("Nvidia"))!;
  assert.equal(nvda.source, "Yahoo Finance");
  assert.deepEqual(nvda.alsoReportedBy.map((r) => r.source), ["CNBC"]);
  // Fed 18:00Z = 01:00 วันที่ 10 เวลาไทย
  assert.ok(days.get("2026-10-10")!.items.some((i) => i.title.startsWith("Fed")));

  const second = mergeArticles(await rawAll(), days, NOW);
  assert.equal(second.newItems.length, 0);
  assert.equal(nvda.alsoReportedBy.length, 1);
});

test("mergeArticles: ตัดข่าวเก่ากว่า MAX_AGE_HOURS", async () => {
  const days = emptyDays();
  const later = new Date("2026-10-11T12:00:00Z");
  const res = mergeArticles(await rawAll(), days, later);
  assert.equal(res.newItems.length, 0);
});

function item(id: string, over: Partial<NewsItem> = {}): NewsItem {
  return {
    id, url: `https://x.com/${id}`, title: `t ${id}`, source: "X", feed: "f",
    publishedAt: "2026-10-09T10:00:00Z", fetchedAt: "2026-10-09T10:00:00Z",
    alsoReportedBy: [], status: "pending", attempts: 0, ...over,
  };
}

const fakeLlm = (text: string): LlmClient => ({ name: "fake", model: "m", complete: async () => text });

test("summarizeBatch: กรองหุ้นนอก S&P 500, irrelevant, และ id ที่หาย", async () => {
  const items = [item("a"), item("b"), item("c")];
  const reply = "```json\n" + JSON.stringify({
    results: [
      { id: "a", relevant: true, titleTh: "หัวข่าว", summaryTh: "สรุป", impactTh: "ผล", category: "earnings", importance: 8.6, sentiment: "bullish",
        tickers: [{ symbol: "nvda", direction: "up" }, { symbol: "ARM", direction: "up" }, { symbol: "NVDA", direction: "up" }] },
      { id: "b", relevant: false },
    ],
  }) + "\n```";
  const n = await summarizeBatch(fakeLlm(reply), items, new Set(["NVDA"]));
  assert.equal(n, 2);
  assert.equal(items[0].status, "done");
  assert.deepEqual(items[0].ai!.tickers, [{ symbol: "NVDA", direction: "up" }]);
  assert.equal(items[0].ai!.importance, 9);
  assert.equal(items[1].status, "irrelevant");
  assert.equal(items[2].status, "pending"); // ลองใหม่รอบหน้า
  assert.equal(items[2].attempts, 1);
});

test("summarizeBatch: JSON พัง → pending แล้ว failed หลัง 3 ครั้ง", async () => {
  const it = item("z");
  for (let i = 0; i < 3; i++) await summarizeBatch(fakeLlm("not json"), [it], new Set());
  assert.equal(it.status, "failed");
});

test("pickTopTwo + markdown", () => {
  const ai = (importance: number) => ({
    titleTh: `ข่าว ${importance}`, summaryTh: "สรุป", impactTh: "ผล", category: "macro" as const,
    importance, sentiment: "neutral" as const, tickers: [], model: "m",
  });
  const items = [
    item("1", { status: "done", ai: ai(6) }),
    item("2", { status: "done", ai: ai(9) }),
    item("3", { status: "done", ai: ai(6), alsoReportedBy: [{ source: "A", url: "u" }] }),
    item("4", { status: "irrelevant" }),
  ];
  assert.deepEqual(pickTopTwo(items).map((i) => i.id), ["2", "3"]);
  const d = buildDigest("2026-10-09", items, NOW);
  assert.equal(d.consideredCount, 3);
  const md = renderDailyMarkdown(d);
  assert.match(md, /# ข่าวด่วนรายวัน: วันศุกร์ที่ 9 ตุลาคม 2569/);
  assert.match(md, /## 1\. ข่าว 9/);
  assert.match(md, /ทั้งตลาด/);
});

test("parseRss: ทนต่อ & ที่ไม่ได้ escape", async () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title><link>https://a.com</link><description>d</description><item><title>S&P 500 hits record</title><link>https://a.com/1?a=1&b=2</link><pubDate>Fri, 09 Oct 2026 13:00:00 GMT</pubDate></item></channel></rss>`;
  const r = await parseRss(xml, { id: "t", source: "T", url: "" });
  assert.equal(r[0].title, "S&P 500 hits record");
});
