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
import { type Provider, type ScanSettings, DEFAULT_GROQ_MODEL, loadScanSettings, saveScanSettings, scanImage } from "@/lib/scan";
import { cropThumb, fileThumb, prepareImage } from "@/lib/image";
import { type UpdateInfo, BUILD_ID, checkUpdate } from "@/lib/update";

type Row = {
  key: number;
  read: string; // AI o'qigan nom
  skinId: string; // tanlangan skin ("" = topilmadi)
  count: number;
  candidates: Skin[];
  auto: boolean;
  thumb: string; // skrinshotdan qirqilgan rasm
  weapon: string;
  name: string;
  price: string; // yangi skin qo'shish uchun
};

const fmt = (n: number) => n.toLocaleString("ru-RU");
const label = (s: Skin) => (s.weapon ? `${s.weapon} | ${s.name}` : s.name);

export default function SkinsApp() {
  const [skins, setSkins] = useState<Skin[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"calc" | "db">("calc");
  const [rows, setRows] = useState<Row[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [scan, setScan] = useState<ScanSettings>({ provider: "claude", claudeKey: "", groqKey: "", groqModel: DEFAULT_GROQ_MODEL });
  const [cfg, setCfg] = useState<SyncConfig>({ url: "", anonKey: "", code: "" });
  const [syncMsg, setSyncMsg] = useState("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const fromCloud = useRef(true); // keyingi o'zgarish foydalanuvchidan emas (yuklash/bulut)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = (v?: boolean) => {
    try {
      if (v === undefined) return localStorage.getItem("so2_dirty") === "1";
      localStorage.setItem("so2_dirty", v ? "1" : "0");
    } catch {}
    return !!v;
  };

  useEffect(() => {
    setSkins(loadSkins());
    setScan(loadScanSettings());
    const c = loadSyncConfig();
    setCfg(c);
    setReady(true);
    checkUpdate().then(setUpdate);
    if (c.code) void syncNow(c, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Har o'zgarishda lokal saqlash; foydalanuvchi o'zgartirsa bulutga avtomatik yuborish
  useEffect(() => {
    if (!ready) return;
    saveSkins(skins);
    if (fromCloud.current) {
      fromCloud.current = false;
      return;
    }
    dirty(true);
    const c = loadSyncConfig();
    if (!c.code) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushSkins(c, skins)
        .then(() => { dirty(false); setSyncMsg("✔ Bulutga saqlandi"); })
        .catch((e) => setSyncMsg("✖ " + (e instanceof Error ? e.message : String(e))));
    }, 2000);
  }, [skins, ready]);

  /** O'zgarish yo'q bo'lsa buluttan oladi, o'zgarish bor bo'lsa buluttga yuboradi. */
  async function syncNow(c: SyncConfig, quiet = false) {
    if (!c.code) return setSyncMsg("Avval ⚙ da sinxron kodni kiriting.");
    setSyncMsg("🔄 ...");
    try {
      const local = loadSkins();
      if (dirty()) {
        await pushSkins(c, local);
        dirty(false);
        return setSyncMsg("✔ Bulutga saqlandi");
      }
      const remote = await pullSkins(c);
      if (!remote) {
        if (local.length) await pushSkins(c, local);
        return setSyncMsg("✔ Bulut bo'sh edi — baza yuklandi");
      }
      if (JSON.stringify(remote) !== JSON.stringify(local)) {
        fromCloud.current = true;
        setSkins(remote);
        setSyncMsg(`✔ Yangilandi: ${remote.length} ta skin`);
      } else setSyncMsg(quiet ? "" : "✔ Hammasi yangi");
    } catch (e) {
      setSyncMsg(quiet ? "" : "✖ " + (e instanceof Error ? e.message : String(e)));
    }
  }

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
      const { data, type, bmp } = await prepareImage(file);
      const items: ScannedItem[] = await scanImage(data, type);
      setRows(
        items.map((it, i) => {
          const weapon = it.weapon ?? "";
          const name = it.name ?? "";
          const m = findMatches(skins, weapon, name);
          const best = m[0];
          const auto = !!best && best.score >= 0.75;
          return {
            key: i,
            read: [weapon, name].filter(Boolean).join(" | "),
            skinId: auto ? best.skin.id : "",
            count: Math.max(1, Number(it.count) || 1),
            candidates: m.map((x) => x.skin),
            auto,
            thumb: cropThumb(bmp, it.box),
            weapon,
            name,
            price: "",
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Topilmagan skinni skrinshotdagi rasmi bilan bazaga qo'shadi. */
  function addFromRow(r: Row) {
    const price = Number(r.price);
    if (!r.name.trim() || !price) return setError("Skin nomi va narxini kiriting.");
    setError("");
    const id = makeId(r.weapon.trim(), r.name.trim());
    const skin: Skin = { id, weapon: r.weapon.trim(), name: r.name.trim(), price, image: r.thumb || undefined };
    setSkins((cur) => [...cur.filter((x) => x.id !== id), skin]);
    setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, skinId: id, candidates: [skin, ...x.candidates] } : x)));
  }

  function saveImage(r: Row) {
    if (!r.thumb) return;
    setSkins((cur) => cur.map((x) => (x.id === r.skinId ? { ...x, image: r.thumb } : x)));
  }

  async function runSync(kind: "push" | "pull") {
    setSyncMsg("...");
    try {
      saveSyncConfig(cfg);
      if (kind === "push") {
        await pushSkins(cfg, skins);
        dirty(false);
        setSyncMsg(`✔ ${skins.length} ta skin bulutga yuklandi`);
      } else {
        const remote = await pullSkins(cfg);
        if (!remote) return setSyncMsg("Bulutda baza hali yo'q. Avval boshqa qurilmadan yuklang.");
        if (!confirm(`Buluttagi ${remote.length} ta skin shu qurilmadagi ${skins.length} tasining o'rniga yoziladi. Davom etasizmi?`)) return setSyncMsg("");
        fromCloud.current = true;
        setSkins(() => remote);
        dirty(false);
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
      {update && (
        <a href={update.url} className="mb-4 block rounded-xl bg-emerald-600 p-3 text-center text-sm font-semibold text-white">
          ⬇ Yangi versiya bor — yuklab olish uchun bosing
        </a>
      )}

      <header className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold sm:text-2xl">Standoff 2 — Inventar narxi</h1>
          <div className="flex gap-3 text-xl">
            <button onClick={() => syncNow(loadSyncConfig())} aria-label="Yangilash">🔄</button>
            <button onClick={() => setShowKey((v) => !v)} aria-label="Sozlamalar">⚙</button>
          </div>
        </div>
        {syncMsg && <p className="text-xs text-zinc-400">{syncMsg}</p>}
        <nav className="flex gap-1 rounded-lg bg-zinc-900 p-1 text-sm">
          {(["calc", "db"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 ${tab === t ? "bg-amber-500 font-semibold text-black" : "text-zinc-400"}`}
            >
              {t === "calc" ? "Hisoblash" : `Skinlar bazasi (${skins.length})`}
            </button>
          ))}
        </nav>
      </header>

      {showKey && (
        <div className="mb-4 rounded-xl bg-zinc-900 p-4">
          <p className="mb-3 text-xs text-zinc-500">Versiya: {BUILD_ID.slice(0, 7)}</p>
          <p className="mb-2 text-sm text-zinc-400">Rasm o&apos;qish uchun AI (faqat shu qurilmada saqlanadi)</p>
          <div className="mb-2 flex gap-1 rounded-lg bg-zinc-800 p-1 text-sm">
            {(["claude", "groq"] as Provider[]).map((p) => (
              <button key={p} onClick={() => setScan({ ...scan, provider: p })}
                className={`flex-1 rounded-md py-1.5 ${scan.provider === p ? "bg-amber-500 font-semibold text-black" : "text-zinc-400"}`}>
                {p === "claude" ? "Claude (aniqroq)" : "Groq (bepul)"}
              </button>
            ))}
          </div>
          {scan.provider === "claude" ? (
            <input type="password" value={scan.claudeKey} onChange={(e) => setScan({ ...scan, claudeKey: e.target.value })}
              placeholder="Anthropic key: sk-ant-..." className="w-full rounded bg-zinc-800 p-2 text-sm" />
          ) : (
            <div className="space-y-2">
              <input type="password" value={scan.groqKey} onChange={(e) => setScan({ ...scan, groqKey: e.target.value })}
                placeholder="Groq key: gsk_..." className="w-full rounded bg-zinc-800 p-2 text-sm" />
              <input value={scan.groqModel} onChange={(e) => setScan({ ...scan, groqModel: e.target.value })}
                placeholder="Model" className="w-full rounded bg-zinc-800 p-2 text-xs" />
            </div>
          )}
          <button onClick={() => { saveScanSettings(scan); setSyncMsg("✔ AI sozlamalari saqlandi"); }}
            className="mt-2 w-full rounded bg-amber-500 py-2 text-sm font-semibold text-black">Saqlash</button>

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
                    <li key={r.key} className="p-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex gap-1">
                          {r.thumb && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.thumb} alt="skrinshotdan" title="Skrinshotdan" className="h-14 w-14 rounded bg-zinc-800 object-contain" />
                          )}
                          {skin?.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={skin.image} alt="bazadan" title="Bazadan" className="h-14 w-14 rounded bg-zinc-800 object-contain ring-1 ring-emerald-600" />
                          )}
                        </div>
                        <div className="min-w-40 flex-1">
                          <p className="text-xs text-zinc-500">O&apos;qildi: {r.read}</p>
                          <select
                            value={r.skinId}
                            onChange={(e) => patch(r.key, { skinId: e.target.value })}
                            className={`mt-1 w-full rounded bg-zinc-800 p-1.5 text-sm ${skin ? "" : "ring-1 ring-red-500"}`}
                          >
                            <option value="">— bazada yo&apos;q —</option>
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
                      </div>

                      {!skin && (
                        <div className="mt-2 flex flex-wrap gap-2 rounded-lg bg-zinc-800/60 p-2 text-sm">
                          <input value={r.weapon} onChange={(e) => patch(r.key, { weapon: e.target.value })}
                            placeholder="Qurol" className="w-24 rounded bg-zinc-800 p-1.5" />
                          <input value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })}
                            placeholder="Skin nomi" className="min-w-28 flex-1 rounded bg-zinc-800 p-1.5" />
                          <input value={r.price} type="number" onChange={(e) => patch(r.key, { price: e.target.value })}
                            placeholder="Narx (G)" className="w-24 rounded bg-zinc-800 p-1.5" />
                          <button onClick={() => addFromRow(r)} className="rounded bg-amber-500 px-3 font-semibold text-black">
                            ＋ Bazaga qo&apos;shish
                          </button>
                        </div>
                      )}
                      {skin && !skin.image && r.thumb && (
                        <button onClick={() => saveImage(r)} className="mt-2 text-xs text-amber-400">
                          📷 Skrinshotdagi rasmni bazaga saqlash
                        </button>
                      )}
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
  const [formImg, setFormImg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = skins.filter((s) => label(s).toLowerCase().includes(q.toLowerCase()));

  function upsert(items: Omit<Skin, "id">[]) {
    setSkins((cur) => {
      const map = new Map(cur.map((s) => [s.id, s]));
      for (const it of items) {
        const id = makeId(it.weapon, it.name);
        map.set(id, { ...map.get(id), ...it, id });
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
          <label className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded bg-zinc-800" title="Rasm (ixtiyoriy)">
            {formImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={formImg} alt="" className="h-full w-full object-contain" />
            ) : (
              "📷"
            )}
            <input type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setFormImg(await fileThumb(f));
              }} />
          </label>
          <button
            onClick={() => {
              const price = Number(form.price);
              if (!form.name.trim() || !price) return;
              upsert([{ weapon: form.weapon.trim(), name: form.name.trim(), price, ...(formImg ? { image: formImg } : {}) }]);
              setForm({ weapon: form.weapon, name: "", price: "" });
              setFormImg("");
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
              <label className="cursor-pointer" title="Rasm qo'yish">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" className="h-9 w-9 rounded bg-zinc-800 object-contain" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded bg-zinc-800 text-zinc-500">📷</span>
                )}
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    const image = await fileThumb(f);
                    if (image) setSkins((cur) => cur.map((x) => (x.id === s.id ? { ...x, image } : x)));
                  }} />
              </label>
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
