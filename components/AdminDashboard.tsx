"use client";

import { useEffect, useState } from "react";

const MOKKY_URL = "https://75bd67ad7325d77f.mokky.dev";

export default function AdminDashboard() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
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
      // Avval yuzini o'chiramiz
      const facesRes = await fetch(`${MOKKY_URL}/faces?worker_id=${id}`);
      const faces = await facesRes.json();
      if (Array.isArray(faces)) {
        for (const f of faces) {
          await fetch(`${MOKKY_URL}/faces/${f.id}`, { method: "DELETE" });
        }
      }

      // Keyin xodimni o'chiramiz
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              {showAddForm ? "Yopish" : "+ Yangi xodim"}
            </button>
            <button
              onClick={loadData}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600"
            >
              Yangilash
            </button>
          </div>
        </div>

        {/* Yangi xodim formasi */}
        {showAddForm && (
          <form
            onSubmit={handleAddWorker}
            className="mb-8 rounded-xl border border-zinc-700 bg-zinc-900 p-6"
          >
            <h2 className="mb-4 text-lg font-semibold">Yangi xodim qo‘shish</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                placeholder="To‘liq ism *"
                value={newWorker.name}
                onChange={(e) =>
                  setNewWorker({ ...newWorker, name: e.target.value })
                }
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 outline-none focus:border-blue-500"
                required
              />
              <input
                placeholder="Lavozim"
                value={newWorker.position}
                onChange={(e) =>
                  setNewWorker({ ...newWorker, position: e.target.value })
                }
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 outline-none focus:border-blue-500"
              />
              <input
                placeholder="Bo‘lim"
                value={newWorker.department}
                onChange={(e) =>
                  setNewWorker({ ...newWorker, department: e.target.value })
                }
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 outline-none focus:border-blue-500"
              />
              <input
                placeholder="Telefon"
                value={newWorker.phone}
                onChange={(e) =>
                  setNewWorker({ ...newWorker, phone: e.target.value })
                }
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 outline-none focus:border-blue-500"
              />
              <input
                placeholder="Login *"
                value={newWorker.username}
                onChange={(e) =>
                  setNewWorker({ ...newWorker, username: e.target.value })
                }
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 outline-none focus:border-blue-500"
                required
              />
              <input
                placeholder="Parol *"
                type="password"
                value={newWorker.password}
                onChange={(e) =>
                  setNewWorker({ ...newWorker, password: e.target.value })
                }
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 outline-none focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="mt-4 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {adding ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </form>
        )}

        {/* Statistika */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Bugungi kelganlar</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">
              {todayRecords.length}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Jami jarima</p>
            <p className="mt-1 text-3xl font-bold text-red-400">
              {totalFine.toLocaleString()} so'm
            </p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Shu oy jarimasi</p>
            <p className="mt-1 text-3xl font-bold text-orange-400">
              {monthFine.toLocaleString()} so'm
            </p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Xodimlar</p>
            <p className="mt-1 text-3xl font-bold text-blue-400">
              {workers.length}
            </p>
          </div>
        </div>

        {/* Oy tanlash */}
        <div className="mb-6 flex items-center gap-3">
          <label className="text-sm text-zinc-400">Oy bo‘yicha:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm outline-none"
          />
        </div>

        {/* Bugungi davomat */}
        <div className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">
            Bugungi davomat ({today})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="p-3">Xodim</th>
                  <th className="p-3">Kelish</th>
                  <th className="p-3">Chiqish</th>
                  <th className="p-3">Kechikish</th>
                  <th className="p-3">Jarima</th>
                  <th className="p-3">Holat</th>
                </tr>
              </thead>
              <tbody>
                {todayRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-zinc-500">
                      Bugun hali hech kim kelmagan
                    </td>
                  </tr>
                ) : (
                  todayRecords.map((a) => (
                    <tr key={a.id} className="border-t border-zinc-800">
                      <td className="p-3 font-medium">
                        {getWorkerName(a.worker_id)}
                      </td>
                      <td className="p-3">{a.check_in}</td>
                      <td className="p-3">{a.check_out || "—"}</td>
                      <td className="p-3">{a.late_minutes} daq</td>
                      <td className="p-3 text-red-400">
                        {a.fine > 0 ? `${a.fine.toLocaleString()} so'm` : "—"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            a.status === "late"
                              ? "bg-red-900/60 text-red-300"
                              : "bg-emerald-900/60 text-emerald-300"
                          }`}
                        >
                          {a.status === "late" ? "Kechikdi" : "O'z vaqtida"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Xodimlar ro'yxati + o'chirish */}
        <div className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Xodimlar ro‘yxati</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Ism</th>
                  <th className="p-3">Lavozim</th>
                  <th className="p-3">Login</th>
                  <th className="p-3">Amal</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id} className="border-t border-zinc-800">
                    <td className="p-3">{w.id}</td>
                    <td className="p-3 font-medium">{w.name}</td>
                    <td className="p-3">{w.position || "—"}</td>
                    <td className="p-3">{w.username || "—"}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleDeleteWorker(w.id, w.name)}
                        className="rounded bg-red-600/80 px-3 py-1 text-xs hover:bg-red-600"
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

        {/* Tanlangan oy yozuvlari */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">
            {selectedMonth} oyi — jami jarima:{" "}
            <span className="text-orange-400">
              {monthFine.toLocaleString()} so'm
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="p-3">Sana</th>
                  <th className="p-3">Xodim</th>
                  <th className="p-3">Kelish</th>
                  <th className="p-3">Chiqish</th>
                  <th className="p-3">Jarima</th>
                </tr>
              </thead>
              <tbody>
                {monthRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zinc-500">
                      Bu oyda yozuv yo‘q
                    </td>
                  </tr>
                ) : (
                  [...monthRecords].reverse().map((a) => (
                    <tr key={a.id} className="border-t border-zinc-800">
                      <td className="p-3">{a.date}</td>
                      <td className="p-3">{getWorkerName(a.worker_id)}</td>
                      <td className="p-3">{a.check_in}</td>
                      <td className="p-3">{a.check_out || "—"}</td>
                      <td className="p-3 text-red-400">
                        {a.fine > 0 ? `${a.fine.toLocaleString()} so'm` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
