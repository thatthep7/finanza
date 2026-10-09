import type { TickerImpact } from "@/lib/types";

const ARROW = { up: "▲", down: "▼", neutral: "■" } as const;
const LABEL = { up: "ขึ้น", down: "ลง", neutral: "ทรงตัว" } as const;

export function Tickers({ tickers, size = "sm" }: { tickers: TickerImpact[]; size?: "sm" | "lg" }) {
  if (tickers.length === 0) return <span className={`tickers tickers-${size} macro`}>ทั้งตลาด</span>;
  return (
    <ul className={`tickers tickers-${size}`} aria-label="หุ้นที่เกี่ยวข้อง">
      {tickers.map((t) => (
        <li key={t.symbol} className={`ticker dir-${t.direction}`} title={`${t.symbol} แนวโน้ม${LABEL[t.direction]}`}>
          {t.symbol}
          <span aria-hidden="true"> {ARROW[t.direction]}</span>
          <span className="sr-only">{LABEL[t.direction]}</span>
        </li>
      ))}
    </ul>
  );
}

export function Importance({ value }: { value: number }) {
  return (
    <span className="importance" title={`ความสำคัญ ${value} จาก 10`}>
      <span className="meter" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < value ? "on" : ""} />
        ))}
      </span>
      <span className="importance-num">{value}/10</span>
    </span>
  );
}
