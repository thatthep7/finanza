export const TZ = "Asia/Bangkok";

/** วันที่ตามเวลาไทยในรูป YYYY-MM-DD */
export function thaiDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "วันศุกร์ที่ 9 ตุลาคม 2569" */
export function formatThaiLongDate(dateKey: string): string {
  // เที่ยงวันเวลาไทย กันวันเลื่อนจาก timezone
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** "9 ต.ค. 2569" */
export function formatThaiShortDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "21:07" */
export function formatThaiTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** ชั่วโมงเวลาไทย 0–23 ใช้จัดกลุ่มข่าว */
export function thaiHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(
      new Date(iso),
    ),
  ) % 24;
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return thaiDateKey(d);
}
