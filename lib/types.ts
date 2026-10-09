export type Direction = "up" | "down" | "neutral";
export type Sentiment = "bullish" | "bearish" | "mixed" | "neutral";
export type Category =
  | "macro"
  | "earnings"
  | "guidance"
  | "m_and_a"
  | "analyst"
  | "regulation"
  | "legal"
  | "product"
  | "management"
  | "market"
  | "other";

export type ItemStatus = "pending" | "done" | "irrelevant" | "failed";

export interface TickerImpact {
  symbol: string;
  direction: Direction;
}

export interface AiSummary {
  titleTh: string;
  summaryTh: string;
  impactTh: string;
  category: Category;
  /** 1–10: ผลต่อตลาด/หุ้น */
  importance: number;
  sentiment: Sentiment;
  /** เฉพาะหุ้นที่อยู่ใน S&P 500 */
  tickers: TickerImpact[];
  model: string;
}

export interface SourceRef {
  source: string;
  url: string;
}

export interface NewsItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  source: string;
  feed: string;
  publishedAt: string; // ISO UTC
  fetchedAt: string; // ISO UTC
  alsoReportedBy: SourceRef[];
  status: ItemStatus;
  attempts: number;
  ai?: AiSummary;
}

/** data/news/YYYY-MM-DD.json — ข่าวทั้งหมดของวันนั้น (ตามเวลาไทย) ใช้เป็นทั้งคลังและ cache */
export interface DayFile {
  date: string;
  updatedAt: string;
  items: NewsItem[];
}

/** data/daily/YYYY-MM-DD.json — 2 ข่าวสำคัญที่สุดของวัน */
export interface DailyDigest {
  date: string;
  updatedAt: string;
  consideredCount: number;
  top: NewsItem[];
}

export interface Meta {
  lastRunAt: string;
  lastRun: {
    fetched: number;
    newItems: number;
    summarized: number;
    failedFeeds: string[];
    provider: string;
  };
}
