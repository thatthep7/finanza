import Link from "next/link";
import { notFound } from "next/navigation";
import { TopStory } from "@/components/TopStory";
import { formatThaiLongDate, formatThaiTime } from "@/lib/date";
import { getDailyKeys, getDigest } from "@/lib/site-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDailyKeys().map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return { title: `ข่าวด่วน ${formatThaiLongDate(date)} | Finanza` };
}

export default async function DailyPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const digest = getDigest(date);
  if (!digest) notFound();
  return (
    <section className="today" aria-labelledby="day-heading">
      <p className="crumb">
        <Link href="/daily">ข่าวด่วนรายวัน</Link>
      </p>
      <h1 id="day-heading" className="today-date">
        {formatThaiLongDate(digest.date)}
      </h1>
      <p className="today-sub">
        คัดจาก {digest.consideredCount} ข่าว อัปเดตล่าสุด {formatThaiTime(digest.updatedAt)} น.
      </p>
      {digest.top.length === 0 ? (
        <p className="empty">วันนี้ยังไม่มีข่าวที่สรุปแล้ว</p>
      ) : (
        <div className="top-grid">
          {digest.top.map((it, i) => (
            <TopStory key={it.id} item={it} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
