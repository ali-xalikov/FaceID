import type { ScannedItem } from "@/lib/skins";
import { loadSyncConfig } from "@/lib/sync";

const KEY_STORAGE = "so2_api_key";

export type Provider = "cloud" | "claude" | "groq";
export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
const OLD_GROQ_MODELS = ["meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"];

const lsGet = (k: string, d = "") => {
  try { return localStorage.getItem(k) ?? d; } catch { return d; }
};
const lsSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v.trim()); } catch {}
};

export type ScanSettings = { provider: Provider; claudeKey: string; groqKey: string; groqModel: string };
export const loadScanSettings = (): ScanSettings => ({
  provider: ((p) => (p === "claude" || p === "groq" ? p : "cloud"))(lsGet("so2_provider", "cloud")),
  claudeKey: lsGet(KEY_STORAGE),
  groqKey: lsGet("so2_groq_key"),
  groqModel: (() => {
    const m = lsGet("so2_groq_model", DEFAULT_GROQ_MODEL);
    return !m || OLD_GROQ_MODELS.includes(m) ? DEFAULT_GROQ_MODEL : m; // o'chirilgan modellarni almashtiradi
  })(),
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
Inventarda nomlar odatda shunday yoziladi: Butterfly "Starfall", M4A1 "Lincoln", AKR "Tag King" — ya'ni qurol nomi, keyin qo'shtirnoq ichida skin nomi.
Qoidalar:
- Agar katakda to'q sariq "ST" belgisi (StatTrak) bo'lsa, skin nomi oxiriga " ST" qo'sh (masalan "Genesis ST"). Kubik/zar belgisini e'tiborga olma.
- "S1", "S2", "S3" bilan boshlangan qurollarni shunday qoldir (masalan weapon: "S2 AKR12", name: "Year of the Horse").
- "weapon" — qurol nomi (AKR, M4, AWM, Karambit, ...), "name" — skin nomi.
- "count" — agar katakda "x2" kabi miqdor ko'rsatilgan bo'lsa shu son, aks holda 1.
- "box" — shu katak (rasm + yozuv) joylashgan to'rtburchak: [x, y, kenglik, balandlik], rasmning chap-yuqori burchagiga nisbatan 0 dan 1 gacha kasr sifatida.
- Faqat aniq o'qiy olgan predmetlarni qo'sh, taxmin qilma. Stiker, charm, graffiti, quti ham bo'lsa, weapon bo'sh qoldirib name'ga nomini yoz.`;

const GROQ_SUFFIX = '\nJavobni {"items":[...]} ko\'rinishidagi JSON obyekt sifatida qaytar.';

function parseItems(raw: string): ScannedItem[] {
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
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
  if (cfg.provider === "claude") return scanClaude(base64, mediaType);
  return scanCloud(base64, mediaType);
}

/** Supabase Edge Function orqali (Groq kaliti serverda, telefonda kalit kerak emas). */
async function scanCloud(base64: string, mediaType: string): Promise<ScannedItem[]> {
  const c = loadSyncConfig();
  const res = await fetch(`${c.url.replace(/\/+$/, "")}/functions/v1/scan`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: c.anonKey,
      authorization: `Bearer ${c.anonKey}`,
    },
    body: JSON.stringify({ image: base64, mediaType, prompt: PROMPT + GROQ_SUFFIX }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (t.includes("GROQ_API_KEY")) throw new Error("Serverda Groq kaliti hali o'rnatilmagan (Supabase → Edge Functions → Secrets).");
    throw new Error(`Bulut AI xatosi (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return parseItems(String(data.choices?.[0]?.message?.content ?? ""));
}

async function scanGroq(cfg: ScanSettings, base64: string, mediaType: string): Promise<ScannedItem[]> {
  if (!cfg.groqKey) throw new Error("Avval Groq API kalitni kiriting (yuqoridagi ⚙ tugma).");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.groqKey}` },
    body: JSON.stringify({
      model: cfg.groqModel,
      temperature: 0,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT + GROQ_SUFFIX },
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
