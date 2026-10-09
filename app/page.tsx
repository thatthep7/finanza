import Link from "next/link";
import { NewsFeed } from "@/components/NewsFeed";
import { TopStory } from "@/components/TopStory";
import { formatThaiLongDate } from "@/lib/date";
import { getLatestDigest, getLatestItems } from "@/lib/site-data";

export const dynamic = "force-static";

export default function HomePage() {
  const digest = getLatestDigest();
  const items = getLatestItems();

  return (
    <>
      <section className="today" aria-labelledby="today-heading">
        <h1 id="today-heading" className="today-date">
          {digest ? formatThaiLongDate(digest.date) : "ข่าวด่วนรายวัน"}
        </h1>
        <p className="today-sub">
          {digest && digest.top.length > 0 ? (
            <>
              2 ข่าวที่มีผลต่อหุ้น S&amp;P 500 มากที่สุด คัดจาก {digest.consideredCount} ข่าว{" "}
              <Link href={`/daily/${digest.date}`}>ดูฉบับเต็ม</Link>
            </>
          ) : (
            "ข่าวสำคัญ 2 อันดับแรกของวันจะขึ้นที่นี่หลังตัวดึงข่าวทำงาน"
          )}
        </p>
        {digest && digest.top.length > 0 && (
          <div className="top-grid">
            {digest.top.map((it, i) => (
              <TopStory key={it.id} item={it} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      <NewsFeed items={items} />
    </>
  );
}
