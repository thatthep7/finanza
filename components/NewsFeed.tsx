"use client";

import { useMemo, useState } from "react";
import { formatThaiLongDate, formatThaiTime, thaiDateKey, thaiHour } from "@/lib/date";
import type { NewsItem } from "@/lib/types";
import { Importance, Tickers } from "./Tickers";

type DirFilter = "all" | "up" | "down";

const CATEGORY_TH: Record<string, string> = {
  macro: "เศรษฐกิจมหภาค",
  earnings: "ผลประกอบการ",
  guidance: "คาดการณ์บริษัท",
  m_and_a: "ควบรวมกิจการ",
  analyst: "นักวิเคราะห์",
  regulation: "กฎระเบียบ",
  legal: "คดีความ",
  product: "สินค้า",
  management: "ผู้บริหาร",
  market: "ภาวะตลาด",
  other: "อื่น ๆ",
};

function matchesDir(it: NewsItem, dir: DirFilter) {
  if (dir === "all") return true;
  const s = it.ai!.sentiment;
  if (dir === "up") return s === "bullish" || it.ai!.tickers.some((t) => t.direction === "up");
  return s === "bearish" || it.ai!.tickers.some((t) => t.direction === "down");
}

export function NewsFeed({ items }: { items: NewsItem[] }) {
  const [query, setQuery] = useState("");
  const [dir, setDir] = useState<DirFilter>("all");
  const [importantOnly, setImportantOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const ai = it.ai!;
      if (importantOnly && ai.importance < 7) return false;
      if (!matchesDir(it, dir)) return false;
      if (!q) return true;
      return (
        ai.tickers.some((t) => t.symbol.toLowerCase() === q.replace(/^\$/, "")) ||
        ai.titleTh.toLowerCase().includes(q) ||
        ai.summaryTh.toLowerCase().includes(q) ||
        it.title.toLowerCase().includes(q)
      );
    });
  }, [items, query, dir, importantOnly]);

  // จัดกลุ่ม: วัน → ชั่วโมง
  const groups = useMemo(() => {
    const out: { date: string; hours: { hour: number; items: NewsItem[] }[] }[] = [];
    for (const it of filtered) {
      const date = thaiDateKey(it.publishedAt);
      const hour = thaiHour(it.publishedAt);
      let d = out.at(-1);
      if (!d || d.date !== date) out.push((d = { date, hours: [] }));
      let h = d.hours.at(-1);
      if (!h || h.hour !== hour) d.hours.push((h = { hour, items: [] }));
      h.items.push(it);
    }
    return out;
  }, [filtered]);

  return (
    <section className="feed" aria-labelledby="feed-heading">
      <div className="feed-head">
        <h2 id="feed-heading">ข่าวล่าสุด</h2>
        <p className="feed-count" aria-live="polite">
          {filtered.length} จาก {items.length} ข่าว
        </p>
      </div>

      <div className="filters" role="search">
        <label className="search">
          <span className="sr-only">ค้นหาหุ้นหรือคำ</span>
          <input
            type="search"
            placeholder="ค้นหาหุ้นหรือคำ เช่น NVDA, Fed"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="segmented" role="radiogroup" aria-label="ทิศทาง">
          {(
            [
              ["all", "ทั้งหมด"],
              ["up", "ขาขึ้น"],
              ["down", "ขาลง"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={dir === v} className={`seg seg-${v}`} onClick={() => setDir(v)}>
              {label}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={importantOnly} onChange={(e) => setImportantOnly(e.target.checked)} />
          เฉพาะข่าวสำคัญ 7 ขึ้นไป
        </label>
      </div>

      {groups.length === 0 && (
        <p className="empty">
          {items.length === 0
            ? "ยังไม่มีข่าวที่สรุปแล้ว ข่าวจะเข้ามาหลังตัวดึงข่าวทำงานรอบแรก"
            : "ไม่มีข่าวตรงกับตัวกรองนี้ ลองล้างคำค้นหรือเลือก “ทั้งหมด”"}
        </p>
      )}

      {groups.map((g) => (
        <div key={g.date} className="day-group">
          <h3 className="day-label">{formatThaiLongDate(g.date)}</h3>
          {g.hours.map((h) => (
            <div key={h.hour} className="hour-group">
              <h4 className="hour-label">{String(h.hour).padStart(2, "0")}:00 น.</h4>
              <ol className="items">
                {h.items.map((it) => (
                  <FeedItem key={it.id} it={it} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function FeedItem({ it }: { it: NewsItem }) {
  const ai = it.ai!;
  return (
    <li className={`item sent-${ai.sentiment}`}>
      <time className="item-time" dateTime={it.publishedAt}>
        {formatThaiTime(it.publishedAt)}
      </time>
      <div className="item-body">
        <h5 className="item-title">
          <a href={it.url} target="_blank" rel="noopener noreferrer">
            {ai.titleTh}
          </a>
        </h5>
        <p className="item-summary">{ai.summaryTh}</p>
        {ai.impactTh && (
          <p className="impact">
            <strong>ผลต่อหุ้น</strong> {ai.impactTh}
          </p>
        )}
        <div className="item-foot">
          <Tickers tickers={ai.tickers} />
          <Importance value={ai.importance} />
          <span className="item-cat">{CATEGORY_TH[ai.category] ?? ai.category}</span>
          <span className="item-source">
            {it.source}
            {it.alsoReportedBy.length > 0 && ` และอีก ${it.alsoReportedBy.length} สำนัก`}
          </span>
        </div>
      </div>
    </li>
  );
}
