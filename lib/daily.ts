import { formatThaiLongDate, formatThaiTime } from "./date.ts";
import type { DailyDigest, NewsItem } from "./types.ts";

/** คะแนนจัดอันดับ: ความสำคัญจาก LLM เป็นหลัก + จำนวนสำนักที่รายงานเรื่องเดียวกัน */
export function rankScore(it: NewsItem): number {
  const importance = it.ai?.importance ?? 0;
  const coverage = Math.min(it.alsoReportedBy.length, 3);
  return importance * 10 + coverage * 3;
}

export function pickTopTwo(items: NewsItem[]): NewsItem[] {
  return items
    .filter((it) => it.status === "done" && it.ai)
    .sort((a, b) => rankScore(b) - rankScore(a) || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 2);
}

export function buildDigest(date: string, items: NewsItem[], now = new Date()): DailyDigest {
  return {
    date,
    updatedAt: now.toISOString(),
    consideredCount: items.filter((it) => it.status === "done").length,
    top: pickTopTwo(items),
  };
}

const ARROW = { up: "▲", down: "▼", neutral: "■" } as const;

export function renderDailyMarkdown(d: DailyDigest): string {
  const lines: string[] = [
    `# ข่าวด่วนรายวัน: ${formatThaiLongDate(d.date)}`,
    "",
    `> 2 ข่าวที่มีผลต่อหุ้น S&P 500 มากที่สุด คัดจาก ${d.consideredCount} ข่าว อัปเดตล่าสุด ${formatThaiTime(d.updatedAt)} น. (เวลาไทย)`,
    "",
  ];
  if (d.top.length === 0) {
    lines.push("_ยังไม่มีข่าวที่สรุปแล้วสำหรับวันนี้_", "");
  }
  d.top.forEach((it, i) => {
    const ai = it.ai!;
    const tickers = ai.tickers.length
      ? ai.tickers.map((t) => `${t.symbol} ${ARROW[t.direction]}`).join(", ")
      : "ทั้งตลาด";
    lines.push(
      `## ${i + 1}. ${ai.titleTh}`,
      "",
      `- **หุ้นที่เกี่ยวข้อง:** ${tickers}`,
      `- **ความสำคัญ:** ${ai.importance}/10`,
      `- **เวลา:** ${formatThaiTime(it.publishedAt)} น.`,
      "",
      ai.summaryTh,
      "",
      `**ผลต่อหุ้น:** ${ai.impactTh}`,
      "",
      `ต้นฉบับ: [${it.title}](${it.url}) (${it.source})` +
        (it.alsoReportedBy.length ? `, รายงานโดย ${it.alsoReportedBy.map((r) => `[${r.source}](${r.url})`).join(", ")}` : ""),
      "",
    );
  });
  lines.push("---", "", "_สรุปอัตโนมัติด้วย AI เพื่อการติดตามข่าวส่วนตัว ไม่ใช่คำแนะนำการลงทุน_", "");
  return lines.join("\n");
}
