import Parser from "rss-parser";
import { FINNHUB_CATEGORIES, type FeedSource } from "../config/sources.ts";
import { canonicalUrl, stripHtml } from "./normalize.ts";

export interface RawArticle {
  url: string;
  title: string;
  description?: string;
  source: string;
  feed: string;
  publishedAt: string;
}

const UA = "Mozilla/5.0 (compatible; FinanzaBot/0.1; personal news reader)";
const parser = new Parser();

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function parseRss(xml: string, feed: FeedSource, now = new Date()): Promise<RawArticle[]> {
  let parsed;
  try {
    parsed = await parser.parseString(xml);
  } catch {
    // feed จริงบางทีมี & เปล่า ๆ ที่ทำให้ XML พัง → escape แล้วลองใหม่
    parsed = await parser.parseString(xml.replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;"));
  }
  const out: RawArticle[] = [];
  for (const item of parsed.items ?? []) {
    const title = stripHtml(item.title);
    const link = item.link ?? (typeof item.guid === "string" && item.guid.startsWith("http") ? item.guid : undefined);
    if (!title || !link) continue;
    const dateStr = item.isoDate ?? item.pubDate;
    const published = dateStr ? new Date(dateStr) : now;
    out.push({
      url: canonicalUrl(link),
      title,
      description: stripHtml(item.contentSnippet ?? item.content ?? item.summary)?.slice(0, 600),
      source: feed.source,
      feed: feed.id,
      publishedAt: (isNaN(published.getTime()) ? now : published).toISOString(),
    });
  }
  return out;
}

export async function fetchRssFeed(feed: FeedSource): Promise<RawArticle[]> {
  // สำหรับทดสอบแบบ offline: อ่าน <dir>/<feed.id>.xml แทนการยิง network
  const fixtureDir = process.env.FINANZA_FEED_FIXTURE_DIR;
  const xml = fixtureDir
    ? await import("node:fs/promises").then((fs) => fs.readFile(`${fixtureDir}/${feed.id}.xml`, "utf8"))
    : await fetchText(feed.url);
  return parseRss(xml, feed);
}

interface FinnhubNews {
  headline: string;
  summary: string;
  url: string;
  source: string;
  datetime: number; // unix seconds
}

export async function fetchFinnhub(apiKey: string): Promise<{ articles: RawArticle[]; failed: string[] }> {
  const articles: RawArticle[] = [];
  const failed: string[] = [];
  for (const cat of FINNHUB_CATEGORIES) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/news?category=${cat}`, {
        headers: { "X-Finnhub-Token": apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FinnhubNews[];
      for (const n of data) {
        if (!n.headline || !n.url) continue;
        articles.push({
          url: canonicalUrl(n.url),
          title: n.headline.trim(),
          description: n.summary?.slice(0, 600) || undefined,
          source: n.source || "Finnhub",
          feed: `finnhub-${cat}`,
          publishedAt: new Date(n.datetime * 1000).toISOString(),
        });
      }
    } catch (e) {
      failed.push(`finnhub-${cat}: ${(e as Error).message}`);
    }
  }
  return { articles, failed };
}
