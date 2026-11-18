"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ScannedItem,
  type Skin,
  findMatches,
  loadSkins,
  makeId,
  parseBulk,
  saveSkins,
} from "@/lib/skins";
import { type SyncConfig, loadSyncConfig, pullSkins, pushSkins, randomCode, saveSyncConfig } from "@/lib/sync";
import { getApiKey, scanImage, setApiKey } from "@/lib/scan";

type Row = {
  key: number;
  read: string; // AI o'qigan nom
  skinId: string; // tanlangan skin ("" = topilmadi)
  count: number;
  candidates: Skin[];
  auto: boolean;
};

const fmt = (n: number) => n.toLocaleString("ru-RU");
const label = (s: Skin) => (s.weapon ? `${s.weapon} | ${s.name}` : s.name);

async function fileToBase64(file: File): Promise<{ data: string; type: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.9);
  return { data: url.split(",")[1], type: "image/jpeg" };
}

export default function SkinsPage() {
  const [skins, setSkins] = useState<Skin[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"calc" | "db">("calc");
  const [rows, setRows] = useState<Row[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [cfg, setCfg] = useState<SyncConfig>({ url: "", anonKey: "", code: "" });
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    setSkins(loadSkins());
    setKeyInput(getApiKey());
    setCfg(loadSyncConfig());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveSkins(skins);
  }, [skins, ready]);

  const byId = useMemo(() => new Map(skins.map((s) => [s.id, s])), [skins]);
  const total = rows.reduce(
    (sum, r) => sum + (byId.get(r.skinId)?.price ?? 0) * r.count,
    0,
  );
  const unknown = rows.filter((r) => !r.skinId).length;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    setRows([]);
    setPreview(URL.createObjectURL(file));
    try {
      const { data, type } = await fileToBase64(file);
      const items: ScannedItem[] = await scanImage(data, type);
      setRows(
        items.map((it, i) => {
          const m = findMatches(skins, it.weapon ?? "", it.name ?? "");
          const best = m[0];
          const auto = !!best && best.score >= 0.75;
          return {
            key: i,
            read: [it.weapon, it.name].filter(Boolean).join(" | "),
            skinId: auto ? best.skin.id : "",
            count: Math.max(1, Number(it.count) || 1),
            candidates: m.map((x) => x.skin),
            auto,
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSync(kind: "push" | "pull") {
    setSyncMsg("...");
    try {
      saveSyncConfig(cfg);
      if (kind === "push") {
        await pushSkins(cfg, skins);
        setSyncMsg(`✔ ${skins.length} ta skin bulutga yuklandi`);
      } else {
        const remote = await pullSkins(cfg);
        if (!remote) return setSyncMsg("Bulutda baza hali yo'q. Avval boshqa qurilmadan yuklang.");
        if (!confirm(`Buluttagi ${remote.length} ta skin shu qurilmadagi ${skins.length} tasining o'rniga yoziladi. Davom etasizmi?`)) return setSyncMsg("");
        setSkins(() => remote);
        setSyncMsg(`✔ ${remote.length} ta skin buluttan olindi`);
      }
    } catch (e) {
      setSyncMsg("✖ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const patch = (key: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p, auto: false } : r)));

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-zinc-950 px-4 py-6 text-zinc-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Standoff 2 — Inventar narxi</h1>
        <button onClick={() => setShowKey((v) => !v)} className="text-xl" aria-label="Sozlamalar">⚙</button>
        <nav className="flex gap-1 rounded-lg bg-zinc-900 p-1 text-sm">
          {(["calc", "db"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 ${tab === t ? "bg-amber-500 font-semibold text-black" : "text-zinc-400"}`}
            >
              {t === "calc" ? "Hisoblash" : `Skinlar bazasi (${skins.length})`}
            </button>
          ))}
        </nav>
      </header>

      {showKey && (
        <div className="mb-4 rounded-xl bg-zinc-900 p-4">
          <p className="mb-2 text-sm text-zinc-400">Anthropic API kalit (faqat shu qurilmada saqlanadi)</p>
          <div className="flex gap-2">
            <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..." className="min-w-0 flex-1 rounded bg-zinc-800 p-2 text-sm" />
            <button onClick={() => { setApiKey(keyInput); setShowKey(false); }}
              className="rounded bg-amber-500 px-4 text-sm font-semibold text-black">Saqlash</button>
          </div>

          <p className="mb-2 mt-5 text-sm text-zinc-400">Bulut sinxronlash (Supabase)</p>
          <div className="space-y-2">
            <input value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value.trim() })}
              placeholder="Supabase Project URL (https://xxxx.supabase.co)" className="w-full rounded bg-zinc-800 p-2 text-sm" />
            <input value={cfg.anonKey} onChange={(e) => setCfg({ ...cfg, anonKey: e.target.value.trim() })}
              placeholder="Supabase anon (public) key" className="w-full rounded bg-zinc-800 p-2 text-sm" />
            <div className="flex gap-2">
              <input value={cfg.code} onChange={(e) => setCfg({ ...cfg, code: e.target.value.trim() })}
                placeholder="Sinxron kod (barcha qurilmada bir xil)" className="min-w-0 flex-1 rounded bg-zinc-800 p-2 text-sm" />
              <button onClick={() => setCfg({ ...cfg, code: randomCode() })} className="rounded bg-zinc-800 px-3 text-sm">Yangi kod</button>
            </div>
            <div className="flex gap-2 text-sm">
              <button onClick={() => runSync("push")} className="flex-1 rounded bg-amber-500 py-2 font-semibold text-black">⬆ Bulutga yuklash</button>
              <button onClick={() => runSync("pull")} className="flex-1 rounded bg-zinc-800 py-2">⬇ Buluttan olish</button>
            </div>
            {syncMsg && <p className="text-sm text-zinc-300">{syncMsg}</p>}
          </div>
        </div>
      )}

      {tab === "calc" ? (
        <section className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center hover:border-amber-500">
            <span className="text-lg">Inventar skrinshotini yuklang</span>
            <span className="mt-1 text-sm text-zinc-500">
              bosing yoki rasmni tanlang
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>

          {busy && <p className="text-amber-400">Rasm o&apos;qilmoqda...</p>}
          {error && (
            <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>
          )}

          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Inventar" className="max-h-64 rounded-lg" />
          )}

          {rows.length > 0 && (
            <>
              <div className="rounded-xl bg-amber-500 p-5 text-black">
                <p className="text-sm font-medium">Jami qiymat</p>
                <p className="text-4xl font-extrabold">{fmt(total)} G</p>
                {unknown > 0 && (
                  <p className="mt-1 text-sm">
                    {unknown} ta skin bazadan topilmadi — quyida tanlang yoki bazaga
                    qo&apos;shing.
                  </p>
                )}
              </div>
              <ul className="divide-y divide-zinc-800 rounded-xl bg-zinc-900">
                {rows.map((r) => {
                  const skin = byId.get(r.skinId);
                  return (
                    <li key={r.key} className="flex flex-wrap items-center gap-3 p-3">
                      <div className="min-w-40 flex-1">
                        <p className="text-xs text-zinc-500">O&apos;qildi: {r.read}</p>
                        <select
                          value={r.skinId}
                          onChange={(e) => patch(r.key, { skinId: e.target.value })}
                          className={`mt-1 w-full rounded bg-zinc-800 p-1.5 text-sm ${skin ? "" : "ring-1 ring-red-500"}`}
                        >
                          <option value="">— topilmadi —</option>
                          {r.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {label(c)}
                            </option>
                          ))}
                          {skins
                            .filter((s) => !r.candidates.some((c) => c.id === s.id))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {label(s)}
                              </option>
                            ))}
                        </select>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={r.count}
                        onChange={(e) =>
                          patch(r.key, { count: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="w-16 rounded bg-zinc-800 p-1.5 text-center text-sm"
                      />
                      <span className="w-28 text-right font-semibold text-amber-400">
                        {skin ? `${fmt(skin.price * r.count)} G` : "—"}
                      </span>
                      <button
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        className="text-zinc-500 hover:text-red-400"
                        aria-label="O'chirish"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : (
        <SkinDb skins={skins} setSkins={setSkins} />
      )}
    </main>
  );
}

function SkinDb({
  skins,
  setSkins,
}: {
  skins: Skin[];
  setSkins: (fn: (s: Skin[]) => Skin[]) => void;
}) {
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState("");
  const [form, setForm] = useState({ weapon: "", name: "", price: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = skins.filter((s) => label(s).toLowerCase().includes(q.toLowerCase()));

  function upsert(items: Omit<Skin, "id">[]) {
    setSkins((cur) => {
      const map = new Map(cur.map((s) => [s.id, s]));
      for (const it of items) {
        const id = makeId(it.weapon, it.name);
        map.set(id, { ...it, id });
      }
      return [...map.values()];
    });
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">Bitta skin qo&apos;shish</h2>
        <div className="flex flex-wrap gap-2">
          <input placeholder="Qurol (AKR)" value={form.weapon}
            onChange={(e) => setForm({ ...form, weapon: e.target.value })}
            className="w-32 rounded bg-zinc-800 p-2 text-sm" />
          <input placeholder="Skin nomi (Fire Drake)" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="min-w-40 flex-1 rounded bg-zinc-800 p-2 text-sm" />
          <input placeholder="Narx (gold)" type="number" value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-32 rounded bg-zinc-800 p-2 text-sm" />
          <button
            onClick={() => {
              const price = Number(form.price);
              if (!form.name.trim() || !price) return;
              upsert([{ weapon: form.weapon.trim(), name: form.name.trim(), price }]);
              setForm({ weapon: form.weapon, name: "", price: "" });
            }}
            className="rounded bg-amber-500 px-4 text-sm font-semibold text-black"
          >
            Qo&apos;shish
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-zinc-900 p-4">
        <h2 className="mb-1 font-semibold">Ko&apos;pchilik qo&apos;shish (ro&apos;yxat yopishtirish)</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Har qatorda bittadan: <code>AKR | Fire Drake 5000</code> yoki{" "}
          <code>AKR | Fire Drake ; 5000</code>. Bor skin bo&apos;lsa narxi yangilanadi.
        </p>
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5}
          className="w-full rounded bg-zinc-800 p-2 font-mono text-sm" />
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => { upsert(parseBulk(bulk)); setBulk(""); }}
            className="rounded bg-amber-500 px-4 py-1.5 font-semibold text-black"
          >
            Ro&apos;yxatni qo&apos;shish
          </button>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(skins, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "skins.json";
              a.click();
            }}
            className="rounded bg-zinc-800 px-4 py-1.5"
          >
            JSON yuklab olish
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded bg-zinc-800 px-4 py-1.5">
            JSON import
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const arr = JSON.parse(await f.text());
                upsert(arr.filter((x: Skin) => x?.name && x?.price).map((x: Skin) => ({
                  weapon: x.weapon ?? "", name: x.name, price: Number(x.price),
                })));
              } catch { alert("JSON noto'g'ri"); }
              e.target.value = "";
            }} />
        </div>
      </div>

      <div>
        <input placeholder="Qidirish..." value={q} onChange={(e) => setQ(e.target.value)}
          className="mb-2 w-full rounded bg-zinc-900 p-2 text-sm" />
        <ul className="max-h-[28rem] divide-y divide-zinc-800 overflow-y-auto rounded-xl bg-zinc-900">
          {shown.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-2.5 text-sm">
              <span className="flex-1">{label(s)}</span>
              <input type="number" value={s.price}
                onChange={(e) => setSkins((cur) => cur.map((x) => x.id === s.id ? { ...x, price: Number(e.target.value) || 0 } : x))}
                className="w-28 rounded bg-zinc-800 p-1 text-right" />
              <span className="text-zinc-500">G</span>
              <button onClick={() => setSkins((cur) => cur.filter((x) => x.id !== s.id))}
                className="text-zinc-500 hover:text-red-400" aria-label="O'chirish">✕</button>
            </li>
          ))}
          {shown.length === 0 && <li className="p-4 text-center text-zinc-500">Hech narsa topilmadi</li>}
        </ul>
      </div>
    </section>
  );
}
