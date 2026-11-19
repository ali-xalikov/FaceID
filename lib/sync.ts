import type { Skin } from "@/lib/skins";

export type SyncConfig = { url: string; anonKey: string; code: string };

const CFG_KEY = "so2_sync_supabase";

// Ochiq (public) anon kalit — xavfsizlik SQL funksiyalar va RLS orqali ta'minlangan.
const DEFAULT_CFG: SyncConfig = {
  url: "https://gvvueaqwwowvovjhemcb.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2dnVlYXF3d293dm92amhlbWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwMjI4NTksImV4cCI6MjExMDU5ODg1OX0.cS7WMxQLH6Jjlkl49PInORDsE1g2ZLmw05C7-7d2Zgw",
  code: "3y3c6w0e326v3x1v682j", // avtomatik sinxron kodi (qo'lda kiritish shart emas)
};

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...DEFAULT_CFG, ...saved, code: saved.code || DEFAULT_CFG.code };
    }
  } catch {}
  return DEFAULT_CFG;
}
export function saveSyncConfig(c: SyncConfig) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {}
}

export function randomCode(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

async function rpc(c: SyncConfig, fn: string, body: object): Promise<unknown> {
  if (!c.url || !c.anonKey || c.code.length < 8)
    throw new Error("Supabase sozlamalari to'liq emas (URL, anon key, sinxron kod).");
  const base = c.url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: c.anonKey,
      authorization: `Bearer ${c.anonKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 404) throw new Error("Funksiya topilmadi (404). SQL skriptini Supabase'da ishga tushirdingizmi?");
    if (res.status === 401 || res.status === 403) throw new Error("Ruxsat yo'q: anon key noto'g'ri bo'lishi mumkin.");
    throw new Error(`Bulut xatosi (${res.status}): ${t.slice(0, 160)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Bazani bulutga yozadi. */
export async function pushSkins(c: SyncConfig, skins: Skin[]) {
  await rpc(c, "put_base", { p_code: c.code, p_data: skins });
}

/** Buluttagi bazani oladi; hali yo'q bo'lsa null. */
export async function pullSkins(c: SyncConfig): Promise<Skin[] | null> {
  const data = await rpc(c, "get_base", { p_code: c.code });
  return Array.isArray(data) ? (data as Skin[]) : null;
}
