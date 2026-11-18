import type { ScannedItem } from "@/lib/skins";

const KEY_STORAGE = "so2_api_key";

export type Provider = "claude" | "groq";
export const DEFAULT_GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const lsGet = (k: string, d = "") => {
  try { return localStorage.getItem(k) ?? d; } catch { return d; }
};
const lsSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v.trim()); } catch {}
};

export type ScanSettings = { provider: Provider; claudeKey: string; groqKey: string; groqModel: string };
export const loadScanSettings = (): ScanSettings => ({
  provider: lsGet("so2_provider", "claude") === "groq" ? "groq" : "claude",
  claudeKey: lsGet(KEY_STORAGE),
  groqKey: lsGet("so2_groq_key"),
  groqModel: lsGet("so2_groq_model", DEFAULT_GROQ_MODEL) || DEFAULT_GROQ_MODEL,
});
export const saveScanSettings = (c: ScanSettings) => {
  lsSet("so2_provider", c.provider);
  lsSet(KEY_STORAGE, c.claudeKey);
  lsSet("so2_groq_key", c.groqKey);
  lsSet("so2_groq_model", c.groqModel);
};

export const getApiKey = () => {
  try { return localStorage.getItem(KEY_STORAGE) ?? ""; } catch { return ""; }
};
export const setApiKey = (k: string) => {
  try { localStorage.setItem(KEY_STORAGE, k.trim()); } catch {}
};

const PROMPT = `Bu Standoff 2 o'yinining inventar (inventory) skrinshoti.
Undagi har bir ko'rinib turgan skin/predmetni o'qib chiq. Faqat JSON massiv qaytar, boshqa matn yozma:
[{"weapon":"AKR","name":"Fire Drake","count":1,"box":[0.05,0.10,0.15,0.20]}]
Qoidalar:
- "weapon" — qurol nomi (AKR, M4, AWM, Karambit, ...), "name" — skin nomi.
- "count" — agar katakda "x2" kabi miqdor ko'rsatilgan bo'lsa shu son, aks holda 1.
- "box" — shu katak (rasm + yozuv) joylashgan to'rtburchak: [x, y, kenglik, balandlik], rasmning chap-yuqori burchagiga nisbatan 0 dan 1 gacha kasr sifatida.
- Faqat aniq o'qiy olgan predmetlarni qo'sh, taxmin qilma. Stiker, charm, graffiti, quti ham bo'lsa, weapon bo'sh qoldirib name'ga nomini yoz.`;

function parseItems(text: string): ScannedItem[] {
  const arr = text.match(/\[[\s\S]*\]/)?.[0];
  try {
    if (arr) return JSON.parse(arr);
    const obj = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return Array.isArray(obj.items) ? obj.items : [];
  } catch {
    throw new Error("AI javobini o'qib bo'lmadi, qayta urinib ko'ring.");
  }
}

/** Rasmni tanlangan AI (Claude yoki Groq) ga yuboradi. Backend kerak emas. */
export async function scanImage(base64: string, mediaType: string): Promise<ScannedItem[]> {
  const cfg = loadScanSettings();
  if (cfg.provider === "groq") return scanGroq(cfg, base64, mediaType);
  return scanClaude(base64, mediaType);
}

async function scanGroq(cfg: ScanSettings, base64: string, mediaType: string): Promise<ScannedItem[]> {
  if (!cfg.groqKey) throw new Error("Avval Groq API kalitni kiriting (yuqoridagi ⚙ tugma).");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.groqKey}` },
    body: JSON.stringify({
      model: cfg.groqModel,
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT + '\nJavobni {"items":[...]} ko\'rinishidagi JSON obyekt sifatida qaytar.' },
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
        ],
      }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq xatosi (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return parseItems(String(data.choices?.[0]?.message?.content ?? ""));
}

async function scanClaude(base64: string, mediaType: string): Promise<ScannedItem[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Avval API kalitni kiriting (yuqoridagi ⚙ tugma).");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    }),
  });
  if (!res.ok) {
    throw new Error(`AI xatosi (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
  return parseItems(text);
}
