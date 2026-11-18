import type { Skin } from "@/lib/skins";

export type SyncConfig = { projectId: string; apiKey: string; code: string };

const CFG_KEY = "so2_sync_cfg";

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { projectId: "", apiKey: "", code: "" };
}
export function saveSyncConfig(c: SyncConfig) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {}
}

export function randomCode(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

function docUrl(c: SyncConfig) {
  if (!c.projectId || !c.apiKey || c.code.length < 8)
    throw new Error("Firebase sozlamalari to'liq emas (Project ID, API key, sinxron kod).");
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(c.projectId)}/databases/(default)/documents/bases/${encodeURIComponent(c.code)}`;
}

async function fail(res: Response): Promise<never> {
  const t = await res.text();
  if (res.status === 403) throw new Error("Ruxsat yo'q (403). Firestore qoidalarini (rules) tekshiring.");
  throw new Error(`Bulut xatosi (${res.status}): ${t.slice(0, 160)}`);
}

/** Bazani bulutga yozadi (bitta hujjat sifatida). */
export async function pushSkins(c: SyncConfig, skins: Skin[]) {
  const res = await fetch(`${docUrl(c)}?key=${encodeURIComponent(c.apiKey)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fields: {
        data: { stringValue: JSON.stringify(skins) },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) await fail(res);
}

/** Buluttagi bazani oladi; hali yo'q bo'lsa null. */
export async function pullSkins(c: SyncConfig): Promise<Skin[] | null> {
  const res = await fetch(`${docUrl(c)}?key=${encodeURIComponent(c.apiKey)}`);
  if (res.status === 404) return null;
  if (!res.ok) await fail(res);
  const json = await res.json();
  const arr = JSON.parse(json.fields?.data?.stringValue ?? "[]");
  return Array.isArray(arr) ? arr : null;
}
