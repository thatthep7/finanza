import "server-only";
import { listDailyKeys, listDayKeys, readDaily, readDay, readMeta } from "./store.ts";
import type { DailyDigest, NewsItem } from "./types.ts";

/** ข่าวที่สรุปแล้วจาก 2 วันล่าสุด ใหม่สุดก่อน */
export function getLatestItems(limit = 200): NewsItem[] {
  return listDayKeys()
    .slice(0, 2)
    .flatMap((k) => readDay(k)?.items ?? [])
    .filter((it) => it.status === "done" && it.ai)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export function getLatestDigest(): DailyDigest | null {
  const key = listDailyKeys()[0];
  return key ? readDaily(key) : null;
}

export function getDigest(date: string): DailyDigest | null {
  return readDaily(date);
}

export function getAllDigests(): DailyDigest[] {
  return listDailyKeys()
    .map((k) => readDaily(k))
    .filter((d): d is DailyDigest => d !== null);
}

export function getDailyKeys(): string[] {
  return listDailyKeys();
}

export function getMeta() {
  return readMeta();
}
