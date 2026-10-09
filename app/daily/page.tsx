import Link from "next/link";
import { formatThaiLongDate } from "@/lib/date";
import { getAllDigests } from "@/lib/site-data";

export const dynamic = "force-static";
export const metadata = { title: "ข่าวด่วนรายวัน | Finanza" };

export default function DailyIndex() {
  const digests = getAllDigests();
  return (
    <section className="archive" aria-labelledby="archive-heading">
      <h1 id="archive-heading" className="page-title">
        ข่าวด่วนรายวัน
      </h1>
      <p className="today-sub">2 ข่าวที่มีผลต่อหุ้น S&amp;P 500 มากที่สุดของแต่ละวัน (ตามเวลาไทย)</p>
      {digests.length === 0 && <p className="empty">ยังไม่มีสรุปรายวัน จะเริ่มมีหลังตัวดึงข่าวทำงานรอบแรก</p>}
      <ol className="archive-list">
        {digests.map((d) => (
          <li key={d.date}>
            <Link href={`/daily/${d.date}`} className="archive-date">
              {formatThaiLongDate(d.date)}
            </Link>
            <ul>
              {d.top.map((it) => (
                <li key={it.id} className={`archive-item sent-${it.ai?.sentiment}`}>
                  {it.ai?.titleTh}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
