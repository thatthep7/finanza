import fs from "node:fs";
import path from "node:path";
import type { DailyDigest, DayFile, Meta } from "./types.ts";

const ROOT = process.env.FINANZA_ROOT ?? process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const NEWS_DIR = path.join(DATA_DIR, "news");
export const DAILY_DIR = path.join(DATA_DIR, "daily");
/** โฟลเดอร์ markdown สำหรับคนอ่าน (เปิดบน GitHub ได้เลย) */
export const DAILY_MD_DIR = path.join(ROOT, "ข่าวด่วนรายวัน");

const DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
}

function listKeys(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((f) => DATE_FILE.exec(f)?.[1])
    .filter((k): k is string => Boolean(k))
    .sort()
    .reverse();
}

export const readDay = (date: string) => readJson<DayFile>(path.join(NEWS_DIR, `${date}.json`));
export const writeDay = (day: DayFile) => writeJson(path.join(NEWS_DIR, `${day.date}.json`), day);
export const listDayKeys = () => listKeys(NEWS_DIR);
export const deleteDay = (date: string) => fs.rmSync(path.join(NEWS_DIR, `${date}.json`), { force: true });

export const readDaily = (date: string) => readJson<DailyDigest>(path.join(DAILY_DIR, `${date}.json`));
export const writeDaily = (d: DailyDigest) => writeJson(path.join(DAILY_DIR, `${d.date}.json`), d);
export const listDailyKeys = () => listKeys(DAILY_DIR);

export function writeDailyMarkdown(date: string, md: string) {
  fs.mkdirSync(DAILY_MD_DIR, { recursive: true });
  fs.writeFileSync(path.join(DAILY_MD_DIR, `${date}.md`), md);
}

export const readMeta = () => readJson<Meta>(path.join(DATA_DIR, "meta.json"));
export const writeMeta = (m: Meta) => writeJson(path.join(DATA_DIR, "meta.json"), m);

export function readSp500(): { symbol: string; name: string; sector: string }[] {
  return readJson(path.join(DATA_DIR, "sp500.json")) ?? [];
}
