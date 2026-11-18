export type Skin = {
  id: string;
  weapon: string; // masalan: AKR
  name: string; // masalan: Fire Drake
  price: number; // marketplace narxi (gold)
  image?: string; // kichik rasm (data URL), skrinshotdan saqlanadi
};

export type ScannedItem = {
  weapon: string;
  name: string;
  count: number;
  box?: [number, number, number, number]; // [x, y, w, h], 0..1 nisbatda
};

export const STORAGE_KEY = "so2_skins_v1";

// NAMUNA ma'lumotlar — narxlar taxminiy. Haqiqiy bazani "Skinlar bazasi" bo'limida to'ldiring.
export const SEED_SKINS: Omit<Skin, "id">[] = [
  { weapon: "AKR", name: "Fire Drake", price: 5000 },
  { weapon: "M4", name: "Royal Dragon", price: 4000 },
  { weapon: "AWM", name: "Dragon Glass", price: 9000 },
  { weapon: "Butterfly Knife", name: "Fade", price: 25000 },
  { weapon: "Karambit", name: "Scratch", price: 12000 },
];

export const makeId = (weapon: string, name: string) =>
  normalize(`${weapon} ${name}`).replace(/\s+/g, "-");

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[|_\-–—]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const ta = new Set(a.split(" "));
  const tb = new Set(b.split(" "));
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  const jac = inter / (ta.size + tb.size - inter);
  return Math.max(lev, jac);
}

export type Match = { skin: Skin; score: number };

/** Skrinshotdan o'qilgan nomga eng yaqin skinlarni qaytaradi. */
export function findMatches(
  skins: Skin[],
  weapon: string,
  name: string,
  limit = 5,
): Match[] {
  const q = normalize(`${weapon} ${name}`);
  const qName = normalize(name);
  return skins
    .map((skin) => {
      const full = similarity(q, normalize(`${skin.weapon} ${skin.name}`));
      const nameOnly = similarity(qName, normalize(skin.name));
      const weaponOk =
        similarity(normalize(weapon), normalize(skin.weapon)) >= 0.7;
      const score = Math.max(full, weaponOk ? nameOnly : nameOnly * 0.8);
      return { skin, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** "AKR | Fire Drake ; 5000" ko'rinishidagi qatorlarni o'qiydi. */
export function parseBulk(text: string): Omit<Skin, "id">[] {
  const out: Omit<Skin, "id">[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // oxirgi raqam = narx
    const m = line.match(/^(.*?)[\s;,:\t]+([\d][\d\s.,]*)\s*(?:g|gold)?$/i);
    if (!m) continue;
    const price = Number(m[2].replace(/[\s.,]/g, ""));
    const label = m[1].replace(/[;,:\t]+$/, "").trim();
    if (!price || !label) continue;
    const parts = label.split("|").map((p) => p.trim());
    const weapon = parts.length > 1 ? parts[0] : "";
    const name = parts.length > 1 ? parts.slice(1).join(" | ") : label;
    out.push({ weapon, name, price });
  }
  return out;
}

export function loadSkins(): Skin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Skin[];
  } catch {}
  return SEED_SKINS.map((s) => ({ ...s, id: makeId(s.weapon, s.name) }));
}

export function saveSkins(skins: Skin[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skins));
  } catch {}
}
