import type { ScannedItem } from "@/lib/skins";

const KEY_STORAGE = "so2_api_key";

export const getApiKey = () => {
  try { return localStorage.getItem(KEY_STORAGE) ?? ""; } catch { return ""; }
};
export const setApiKey = (k: string) => {
  try { localStorage.setItem(KEY_STORAGE, k.trim()); } catch {}
};

const PROMPT = `Bu Standoff 2 o'yinining inventar (inventory) skrinshoti.
Undagi har bir ko'rinib turgan skin/predmetni o'qib chiq. Faqat JSON massiv qaytar, boshqa matn yozma:
[{"weapon":"AKR","name":"Fire Drake","count":1}]
Qoidalar:
- "weapon" — qurol nomi (AKR, M4, AWM, Karambit, ...), "name" — skin nomi.
- "count" — agar katakda "x2" kabi miqdor ko'rsatilgan bo'lsa shu son, aks holda 1.
- Faqat aniq o'qiy olgan predmetlarni qo'sh, taxmin qilma. Stiker, charm, graffiti, quti ham bo'lsa, weapon bo'sh qoldirib name'ga nomini yoz.`;

/** Rasmni to'g'ridan-to'g'ri Claude'ga yuboradi (backend kerak emas). */
export async function scanImage(base64: string, mediaType: string): Promise<ScannedItem[]> {
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
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  try {
    return JSON.parse(json ?? "[]");
  } catch {
    throw new Error("AI javobini o'qib bo'lmadi, qayta urinib ko'ring.");
  }
}
