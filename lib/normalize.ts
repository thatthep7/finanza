import { createHash } from "node:crypto";

/** query param ที่ใช้ระบุบทความจริง — นอกนั้นตัดทิ้ง (utm_*, mod, .tsrc ฯลฯ) */
const KEEP_PARAMS = new Set(["id", "p", "story", "article"]);

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    for (const key of [...u.searchParams.keys()]) {
      if (!KEEP_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    u.protocol = "https:";
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function makeId(url: string): string {
  return createHash("sha1").update(canonicalUrl(url)).digest("hex").slice(0, 12);
}

export function stripHtml(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const text = s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "at", "by", "with",
  "is", "are", "as", "its", "it", "from", "after", "be", "this", "that", "says",
]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/['’]s\b/g, "")
      .replace(/[^a-z0-9$%. ]+/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^\.+|\.+$/g, ""))
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

/** Jaccard similarity ของคำในหัวข่าว 0–1 */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** ถือว่าเป็นข่าวเรื่องเดียวกัน */
export const SAME_STORY_THRESHOLD = 0.6;

export function normalizeSymbol(s: string): string {
  return s.trim().toUpperCase().replace(/^\$/, "").replace(/-/g, ".");
}
