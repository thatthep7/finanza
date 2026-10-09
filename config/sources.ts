export interface FeedSource {
  id: string;
  source: string; // ชื่อที่แสดงบนเว็บ
  url: string;
}

/**
 * RSS ฟรีทั้งหมด — เพิ่ม/ลบได้ตามต้องการ
 * ถ้า feed ไหนล่มหรือเปลี่ยน URL ตัวดึงจะข้ามไปและบันทึกไว้ใน data/meta.json
 */
export const RSS_FEEDS: FeedSource[] = [
  { id: "yahoo-top", source: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
  { id: "cnbc-top", source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114" },
  { id: "cnbc-finance", source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664" },
  { id: "cnbc-earnings", source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135" },
  { id: "cnbc-economy", source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258" },
  { id: "mw-top", source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { id: "mw-pulse", source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse" },
];

/** Finnhub (ใช้เมื่อมี FINNHUB_API_KEY) */
export const FINNHUB_CATEGORIES = ["general", "merger"] as const;

/** ไม่สนข่าวที่เก่ากว่านี้ (ชั่วโมง) */
export const MAX_AGE_HOURS = 36;
/** จำนวนข่าวสูงสุดที่ส่งให้ LLM ต่อรอบ (ที่เหลือรอรอบถัดไป) */
export const MAX_SUMMARIZE_PER_RUN = 60;
/** ข่าวต่อ 1 request ของ LLM */
export const LLM_BATCH_SIZE = 12;
/** เก็บไฟล์ data/news ย้อนหลังกี่วัน (ข่าวด่วนรายวันเก็บถาวร) */
export const RETENTION_DAYS = 30;
