/**
 * ตัวเรียก LLM แบบไม่ใช้ SDK (fetch ตรง) — เปลี่ยน provider ได้ด้วย env LLM_PROVIDER
 */
export interface LlmClient {
  name: string;
  model: string;
  /** คืนข้อความ JSON */
  complete(system: string, user: string): Promise<string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postWithRetry(url: string, init: RequestInit, label: string): Promise<unknown> {
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(90_000) }).catch((e: Error) => {
      lastErr = e;
      return undefined;
    });
    if (res?.ok) return res.json();
    if (res) {
      const body = await res.text();
      lastErr = new Error(`${label} HTTP ${res.status}: ${body.slice(0, 300)}`);
      // 4xx อื่นที่ไม่ใช่ rate limit = ตั้งค่าผิด ไม่ต้อง retry
      if (res.status < 500 && res.status !== 429) throw lastErr;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 5000);
    } else {
      await sleep(2 ** attempt * 3000);
    }
  }
  throw lastErr ?? new Error(`${label} failed`);
}

function geminiClient(apiKey: string, model: string): LlmClient {
  return {
    name: "gemini",
    model,
    async complete(system, user) {
      const data = (await postWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
        },
        "Gemini",
      )) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
      if (!text) throw new Error("Gemini: empty response");
      return text;
    },
  };
}

function anthropicClient(apiKey: string, model: string): LlmClient {
  return {
    name: "anthropic",
    model,
    async complete(system, user) {
      const data = (await postWithRetry(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 8000,
            temperature: 0.2,
            system,
            messages: [{ role: "user", content: user }],
          }),
        },
        "Anthropic",
      )) as { content?: { type: string; text?: string }[] };
      const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
      if (!text) throw new Error("Anthropic: empty response");
      return text;
    },
  };
}

/** ไม่เรียก API — ใช้ทดสอบ pipeline/หน้าเว็บ */
function mockClient(): LlmClient {
  return {
    name: "mock",
    model: "mock",
    async complete(_system, user) {
      const input = JSON.parse(user.slice(user.indexOf("["))) as { id: string; title: string }[];
      return JSON.stringify({
        results: input.map((a, i) => {
          const h = [...a.id].reduce((s, c) => s + c.charCodeAt(0), 0);
          const up = h % 3 !== 0;
          return {
            id: a.id,
            relevant: h % 7 !== 0,
            titleTh: `[ทดสอบ] ${a.title}`,
            summaryTh: "ข้อความสรุปจำลองสำหรับทดสอบหน้าเว็บ ยังไม่ได้เรียก LLM จริง ตั้งค่า GEMINI_API_KEY เพื่อสรุปข่าวจริง",
            impactTh: up ? "อาจหนุนราคาหุ้นในระยะสั้น" : "อาจกดดันราคาหุ้นในระยะสั้น",
            category: "market",
            importance: (h % 10) + 1,
            sentiment: up ? "bullish" : "bearish",
            tickers: [{ symbol: ["AAPL", "NVDA", "MSFT", "AMZN", "TSLA"][(h + i) % 5], direction: up ? "up" : "down" }],
          };
        }),
      });
    },
  };
}

export function createLlmClient(env = process.env): LlmClient {
  const provider = (env.LLM_PROVIDER ?? "gemini").toLowerCase();
  if (provider === "mock") return mockClient();
  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ต้องตั้ง ANTHROPIC_API_KEY");
    return anthropicClient(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || "claude-haiku-5-5");
  }
  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("ต้องตั้ง GEMINI_API_KEY (ขอฟรีที่ https://aistudio.google.com/apikey) หรือใช้ LLM_PROVIDER=mock");
    return geminiClient(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-3.5-flash-lite");
  }
  throw new Error(`LLM_PROVIDER ไม่รู้จัก: ${provider}`);
}
