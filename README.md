# Finanza

เว็บส่วนตัวสำหรับดูข่าวที่มีผลต่อหุ้น S&P 500 สรุปเป็นภาษาไทย อัปเดตทุกชั่วโมง และคัด **2 ข่าวที่สำคัญที่สุดของวัน** ไว้ในโฟลเดอร์ [`ข่าวด่วนรายวัน/`](./ข่าวด่วนรายวัน)

- ไม่มี database: ข่าวเก็บเป็นไฟล์ JSON ใน repo (`data/`) แล้ว GitHub Actions commit กลับทุกชั่วโมง
- ไม่มีค่าใช้จ่าย: RSS ฟรี (Yahoo Finance, CNBC, MarketWatch) + Gemini API free tier + GitHub Actions + Vercel Hobby
- หน้าเว็บเป็น static ทั้งหมด → เร็ว และไม่ต้องเก็บ API key ไว้บน Vercel

ดูการออกแบบใน [`docs/DESIGN.md`](./docs/DESIGN.md)

---

## ทดลองในเครื่อง

ต้องมี Node.js 22 ขึ้นไป

```bash
npm install
npm run fetch:mock   # ทดสอบ pipeline โดยไม่เรียก LLM (ข้อความสรุปจะเป็นข้อความจำลอง)
npm run dev          # เปิด http://localhost:3000
```

ใช้ LLM จริง:

```bash
cp .env.example .env     # แล้วใส่ GEMINI_API_KEY (ขอฟรีที่ https://aistudio.google.com/apikey)
npm run fetch
```

> ถ้ารัน `fetch:mock` ไปแล้ว ให้ลบข้อมูลจำลองก่อน push: `rm -rf data/news/*.json data/daily/*.json data/meta.json ข่าวด่วนรายวัน/2*.md`

คำสั่งอื่น: `npm test` (unit test), `npm run typecheck`, `npm run update-sp500`

---

## ขึ้น GitHub (private) + Vercel

### 1. สร้าง repo private แล้ว push

```bash
cd ~/my_project/finanza
git init -b main
git add .
git commit -m "Initial commit"

# วิธี A: ใช้ GitHub CLI
gh repo create finanza --private --source=. --push

# วิธี B: สร้าง repo ชื่อ finanza (Private) ที่ https://github.com/new แล้ว
git remote add origin https://github.com/<username>/finanza.git
git push -u origin main
```

### 2. ใส่ API key เป็น GitHub Secret

repo → **Settings → Secrets and variables → Actions → New repository secret**

| Name | ค่า | จำเป็น |
|---|---|---|
| `GEMINI_API_KEY` | key จาก Google AI Studio | ✔ |
| `FINNHUB_API_KEY` | key ฟรีจาก finnhub.io (ได้ข่าวเพิ่ม) | ไม่บังคับ |
| `ANTHROPIC_API_KEY` | ถ้าจะใช้ Claude แทน (ตั้ง Variable `LLM_PROVIDER=anthropic`) | ไม่บังคับ |

หรือใช้ CLI: `gh secret set GEMINI_API_KEY`

### 3. รันตัวดึงข่าวครั้งแรก

repo → **Actions → Fetch news → Run workflow**
รอ 1–3 นาที จะมี commit `news: ...` เข้ามา พร้อมไฟล์ใน `data/` และ `ข่าวด่วนรายวัน/`
หลังจากนั้นจะรันเองทุกชั่วโมง

### 4. Deploy บน Vercel

1. https://vercel.com/new → **Import** repo `finanza` (ครั้งแรกต้องให้สิทธิ์ Vercel เข้าถึง repo)
2. Framework จะตรวจเจอ Next.js เอง ไม่ต้องตั้ง Environment Variables
3. กด **Deploy**

ทุกครั้งที่ Actions commit ข่าวใหม่ Vercel จะ build ใหม่อัตโนมัติ (ประมาณ 24 ครั้ง/วัน ต่ำกว่าเพดาน 100 ครั้ง/วันของ Hobby)

---

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| Vercel ขึ้น "Deployment blocked" | Hobby + repo private deploy ได้เฉพาะ commit ของเจ้าของบัญชี workflow ตั้งผู้ commit เป็นเจ้าของ repo ให้แล้ว ถ้ายังติด ให้เช็คว่าบัญชี Vercel เชื่อมกับ GitHub บัญชีเดียวกับเจ้าของ repo |
| Actions fail ที่ `git push` | Settings → Actions → General → Workflow permissions → เลือก **Read and write permissions** |
| Actions fail "ต้องตั้ง GEMINI_API_KEY" | ยังไม่ได้ใส่ secret (ขั้นที่ 2) |
| Gemini error 404 model not found | Google เปลี่ยนชื่อรุ่น → ตั้ง Variable `GEMINI_MODEL` เป็นรุ่น Flash-Lite ล่าสุดที่เห็นใน AI Studio |
| Gemini error 429 | เกินโควตาฟรี ข่าวที่ค้างจะถูกสรุปในรอบถัดไปเอง (ลอง 3 ครั้งต่อข่าว) |
| feed บางแหล่งหาย | ดู `data/meta.json` → `failedFeeds` แล้วแก้ URL ใน `config/sources.ts` |

**โควตา GitHub Actions:** repo private ได้ 2,000 นาที/เดือน งานนี้ใช้ราว 1 นาที/รอบ ≈ 720–900 นาที/เดือน
