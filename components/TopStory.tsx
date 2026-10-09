import { formatThaiTime } from "@/lib/date";
import type { NewsItem } from "@/lib/types";
import { Importance, Tickers } from "./Tickers";

export function TopStory({ item, rank }: { item: NewsItem; rank: number }) {
  const ai = item.ai!;
  return (
    <article className={`top-story sent-${ai.sentiment}`} aria-labelledby={`top-${item.id}`}>
      <div className="top-meta">
        <span className="top-rank">อันดับ {rank}</span>
        <Importance value={ai.importance} />
      </div>
      <h3 id={`top-${item.id}`} className="top-title">
        <a href={item.url} target="_blank" rel="noopener noreferrer">
          {ai.titleTh}
        </a>
      </h3>
      <Tickers tickers={ai.tickers} size="lg" />
      <p className="top-summary">{ai.summaryTh}</p>
      <p className="impact">
        <strong>ผลต่อหุ้น</strong> {ai.impactTh}
      </p>
      <p className="byline">
        {item.source} เวลา {formatThaiTime(item.publishedAt)} น.
        {item.alsoReportedBy.length > 0 && <> และอีก {item.alsoReportedBy.length} สำนัก</>}
      </p>
    </article>
  );
}
