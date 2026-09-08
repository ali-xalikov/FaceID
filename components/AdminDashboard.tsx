"use client";

import { useEffect, useState } from "react";

const MOKKY_URL = "https://75bd67ad7325d77f.mokky.dev";

export default function AdminDashboard() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "today" | "workers" | "history"
  >("overview");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // "2026-09"
  );

  const [newWorker, setNewWorker] = useState({
    name: "",
    position: "",
    department: "",
    phone: "",
    username: "",
    password: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [attRes, workersRes] = await Promise.all([
        fetch(`${MOKKY_URL}/attendance`),
        fetch(`${MOKKY_URL}/workers`),
      ]);
      const attData = await attRes.json();
      const workersData = await workersRes.json();
      setAttendance(Array.isArray(attData) ? attData : []);
      setWorkers(Array.isArray(workersData) ? workersData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Tashkent",
  });
  const todayRecords = attendance.filter((a) => a.date === today);
  const totalFine = attendance.reduce((sum, a) => sum + (a.fine || 0), 0);

  // Oy bo'yicha filtr
  const monthRecords = attendance.filter((a) =>
    a.date?.startsWith(selectedMonth)
  );
  const monthFine = monthRecords.reduce((sum, a) => sum + (a.fine || 0), 0);

  const getWorkerName = (id: number) => {
    const w = workers.find((w) => w.id === id);
    return w ? w.name : `ID: ${id}`;
  };

  // =========================
  // YANGI XODIM
  // =========================
  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorker.name || !newWorker.username || !newWorker.password) {
      alert("Ism, login va parol majburiy");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`${MOKKY_URL}/workers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newWorker, salary: 0 }),
      });
      if (res.ok) {
        alert("Xodim qo‘shildi");
        setNewWorker({
          name: "",
          position: "",
          department: "",
          phone: "",
          username: "",
          password: "",
        });
        setShowAddForm(false);
        await loadData();
      } else {
        alert("Xatolik");
      }
    } catch {
      alert("Server xatosi");
    } finally {
      setAdding(false);
    }
  };

  // =========================
  // XODIMNI O'CHIRISH
  // =========================
  const handleDeleteWorker = async (id: number, name: string) => {
    if (
      !confirm(
        `"${name}" ni o‘chirishni tasdiqlaysizmi?\nBu amalni qaytarib bo‘lmaydi.`
      )
    )
      return;

    try {
      const facesRes = await fetch(`${MOKKY_URL}/faces?worker_id=${id}`);
      const faces = await facesRes.json();
      if (Array.isArray(faces)) {
        for (const f of faces) {
          await fetch(`${MOKKY_URL}/faces/${f.id}`, { method: "DELETE" });
        }
      }

      const res = await fetch(`${MOKKY_URL}/workers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert("Xodim o‘chirildi");
        await loadData();
      } else {
        alert("O‘chirishda xatolik");
      }
    } catch (e) {
      console.error(e);
      alert("Xatolik yuz berdi");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        <div className="flex items-center space-x-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
          <span className="font-medium text-sm">Yuklanmoqda...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Chap Yon Menyu (Sidebar) */}
      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800/80 bg-zinc-900/50 p-4">
        <div className="flex items-center gap-3 px-3 py-4 border-b border-zinc-800/60 mb-6">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            A
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">Control Panel</h2>
            <p className="text-xs text-zinc-400">Admin Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "overview"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
            }`}
          >
            <span>📊</span> Umumiy ko'rinish
          </button>
          <button
            onClick={() => setActiveTab("today")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "today"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
            }`}
          >
            <span>📅</span> Bugungi davomat
          </button>
          <button
            onClick={() => setActiveTab("workers")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "workers"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
            }`}
          >
            <span>👥</span> Xodimlar
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "history"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
            }`}
          >
            <span>📜</span> Oylik hisobot
          </button>
        </nav>

        <div className="border-t border-zinc-800/60 pt-4 mt-auto">
          <div className="rounded-xl bg-zinc-950/60 p-3 border border-zinc-800/60">
            <p className="text-xs text-zinc-400">Tizim holati</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-medium text-emerald-400">
                Faol (Mokky API)
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Asosiy Tarkib (Main Content) */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header Panel */}
        <header className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/30 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* Mobil Menyular Tugmasi */}
            <div className="md:hidden flex gap-2 overflow-x-auto py-1">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  activeTab === "overview"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Umumiy
              </button>
              <button
                onClick={() => setActiveTab("today")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  activeTab === "today"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Davomat
              </button>
              <button
                onClick={() => setActiveTab("workers")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  activeTab === "workers"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Xodimlar
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  activeTab === "history"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Hisobot
              </button>
            </div>
            <h1 className="hidden md:block text-xl font-bold text-white">
              {activeTab === "overview" && "Umumiy ko'rinish"}
              {activeTab === "today" && "Bugungi davomat"}
              {activeTab === "workers" && "Xodimlar ro'yxati"}
              {activeTab === "history" && "Oylik hisobotlar"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.98]"
            >
              <span>+</span>{" "}
              <span className="hidden sm:inline">Yangi xodim</span>
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 px-3.5 py-2 text-sm font-medium text-zinc-300 shadow-sm transition-all hover:bg-zinc-800 hover:text-white"
            >
              🔄
            </button>
          </div>
        </header>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          {/* Yangi xodim formasi */}
          {showAddForm && (
            <form
              onSubmit={handleAddWorker}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Yangi xodim biriktirish
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-sm"
                >
                  ✕ Yopish
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <input
                  placeholder="To‘liq ism *"
                  value={newWorker.name}
                  onChange={(e) =>
                    setNewWorker({ ...newWorker, name: e.target.value })
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
                <input
                  placeholder="Lavozim"
                  value={newWorker.position}
                  onChange={(e) =>
                    setNewWorker({ ...newWorker, position: e.target.value })
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <input
                  placeholder="Bo‘lim"
                  value={newWorker.department}
                  onChange={(e) =>
                    setNewWorker({ ...newWorker, department: e.target.value })
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <input
                  placeholder="Telefon"
                  value={newWorker.phone}
                  onChange={(e) =>
                    setNewWorker({ ...newWorker, phone: e.target.value })
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <input
                  placeholder="Login *"
                  value={newWorker.username}
                  onChange={(e) =>
                    setNewWorker({ ...newWorker, username: e.target.value })
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
                <input
                  placeholder="Parol *"
                  type="password"
                  value={newWorker.password}
                  onChange={(e) =>
                    setNewWorker({ ...newWorker, password: e.target.value })
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
                >
                  {adding ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          )}

          {/* Tab 1: Overview */}
          {(activeTab === "overview" || activeTab === "today") && (
            <>
              {/* Statistika Kartochkalari */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Bugungi kelganlar
                  </p>
                  <p className="mt-2 text-3xl font-extrabold text-emerald-400">
                    {todayRecords.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Jami jarima
                  </p>
                  <p className="mt-2 text-3xl font-extrabold text-red-400">
                    {totalFine.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      so'm
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Shu oy jarimasi
                  </p>
                  <p className="mt-2 text-3xl font-extrabold text-amber-400">
                    {monthFine.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      so'm
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Jami Xodimlar
                  </p>
                  <p className="mt-2 text-3xl font-extrabold text-sky-400">
                    {workers.length}
                  </p>
                </div>
              </div>

              {/* Bugungi davomat jadvali */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
                <h2 className="mb-4 text-lg font-semibold text-white">
                  Bugungi davomat{" "}
                  <span className="text-sm font-normal text-zinc-400">
                    ({today})
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                      <tr>
                        <th className="py-3 px-4 font-medium">Xodim</th>
                        <th className="py-3 px-4 font-medium">Kelish</th>
                        <th className="py-3 px-4 font-medium">Chiqish</th>
                        <th className="py-3 px-4 font-medium">Kechikish</th>
                        <th className="py-3 px-4 font-medium">Jarima</th>
                        <th className="py-3 px-4 font-medium">Holat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {todayRecords.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center text-zinc-500"
                          >
                            Bugun hali hech kim kelmagan
                          </td>
                        </tr>
                      ) : (
                        todayRecords.map((a) => (
                          <tr
                            key={a.id}
                            className="transition-colors hover:bg-zinc-800/30"
                          >
                            <td className="py-3.5 px-4 font-medium text-white">
                              {getWorkerName(a.worker_id)}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-300">
                              {a.check_in}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-300">
                              {a.check_out || "—"}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-300">
                              {a.late_minutes} daq
                            </td>
                            <td className="py-3.5 px-4 font-medium text-red-400">
                              {a.fine > 0
                                ? `${a.fine.toLocaleString()} so'm`
                                : "—"}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  a.status === "late"
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {a.status === "late"
                                  ? "Kechikdi"
                                  : "O'z vaqtida"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Tab 2: Workers */}
          {(activeTab === "overview" || activeTab === "workers") && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Xodimlar ro‘yxati
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">ID</th>
                      <th className="py-3 px-4 font-medium">Ism</th>
                      <th className="py-3 px-4 font-medium">Lavozim</th>
                      <th className="py-3 px-4 font-medium">Login</th>
                      <th className="py-3 px-4 font-medium text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {workers.map((w) => (
                      <tr
                        key={w.id}
                        className="transition-colors hover:bg-zinc-800/30"
                      >
                        <td className="py-3.5 px-4 text-zinc-400">#{w.id}</td>
                        <td className="py-3.5 px-4 font-medium text-white">
                          {w.name}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300">
                          {w.position || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300">
                          {w.username || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteWorker(w.id, w.name)}
                            className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1 text-xs font-medium text-red-400 transition-all hover:bg-red-500 hover:text-white"
                          >
                            O‘chirish
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: History */}
          {(activeTab === "overview" || activeTab === "history") && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-white">
                  {selectedMonth} oyi hisoboti — jami:{" "}
                  <span className="text-amber-400 font-bold">
                    {monthFine.toLocaleString()} so'm
                  </span>
                </h2>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Sana</th>
                      <th className="py-3 px-4 font-medium">Xodim</th>
                      <th className="py-3 px-4 font-medium">Kelish</th>
                      <th className="py-3 px-4 font-medium">Chiqish</th>
                      <th className="py-3 px-4 font-medium">Jarima</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {monthRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-center text-zinc-500"
                        >
                          Bu oyda yozuv yo‘q
                        </td>
                      </tr>
                    ) : (
                      [...monthRecords].reverse().map((a) => (
                        <tr
                          key={a.id}
                          className="transition-colors hover:bg-zinc-800/30"
                        >
                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-400">
                            {a.date}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-white">
                            {getWorkerName(a.worker_id)}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-300">
                            {a.check_in}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-300">
                            {a.check_out || "—"}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-red-400">
                            {a.fine > 0
                              ? `${a.fine.toLocaleString()} so'm`
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
