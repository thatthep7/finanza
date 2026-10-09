/** อัปเดตรายชื่อ S&P 500 จาก github.com/datasets/s-and-p-500-companies → data/sp500.json */
import fs from "node:fs";
import path from "node:path";

const URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (c === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const res = await fetch(URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const [header, ...lines] = (await res.text()).trim().split(/\r?\n/);
const cols = parseCsvLine(header);
const iSym = cols.indexOf("Symbol"), iName = cols.indexOf("Security"), iSector = cols.indexOf("GICS Sector");
const rows = lines.map(parseCsvLine).map((c) => ({ symbol: c[iSym], name: c[iName], sector: c[iSector] }));
if (rows.length < 490) throw new Error(`ได้แค่ ${rows.length} แถว ผิดปกติ`);
fs.writeFileSync(path.join(process.cwd(), "data", "sp500.json"), JSON.stringify(rows, null, 0) + "\n");
console.log(`บันทึก ${rows.length} บริษัท`);
