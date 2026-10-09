import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { formatThaiShortDate, formatThaiTime, thaiDateKey } from "@/lib/date";
import { getMeta } from "@/lib/site-data";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanza",
  description: "ข่าวที่มีผลต่อหุ้น S&P 500 สรุปเป็นภาษาไทย อัปเดตทุกชั่วโมง",
  robots: { index: false, follow: false }, // เว็บส่วนตัว ไม่ให้ search engine เก็บ
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#10161c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = getMeta();
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=Noto+Serif+Thai:wght@500;700&display=swap"
        />
      </head>
      <body>
        <header className="site-head">
          <div className="wrap head-row">
            <Link href="/" className="brand">
              Finanza
            </Link>
            <nav aria-label="เมนูหลัก" className="nav">
              <Link href="/">ข่าวล่าสุด</Link>
              <Link href="/daily">ข่าวด่วนรายวัน</Link>
            </nav>
            <p className="updated">
              {meta ? (
                <>
                  อัปเดต {formatThaiShortDate(thaiDateKey(meta.lastRunAt))} {formatThaiTime(meta.lastRunAt)} น.
                </>
              ) : (
                "ยังไม่เคยดึงข่าว"
              )}
            </p>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="wrap site-foot">
          <p>
            สรุปอัตโนมัติด้วย AI จาก RSS ของ Yahoo Finance, CNBC และ MarketWatch ใช้ติดตามข่าวส่วนตัว ไม่ใช่คำแนะนำการลงทุน
            กดหัวข่าวเพื่ออ่านต้นฉบับ
          </p>
        </footer>
      </body>
    </html>
  );
}
