"use client";

import { useState } from "react";

const MOKKY_URL = "https://75bd67ad7325d77f.mokky.dev";

type Props = {
  onLoginSuccess: (user: any) => void;
};

export default function Login({ onLoginSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"admin" | "worker">("worker");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Qaysi resursdan qidirish
      const endpoint = role === "admin" ? "admins" : "workers";

      const res = await fetch(
        `${MOKKY_URL}/${endpoint}?username=${username}&password=${password}`
      );
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const user = {
          ...data[0],
          role: role, // "admin" yoki "worker"
        };
        localStorage.setItem("user", JSON.stringify(user));
        onLoginSuccess(user);
      } else {
        setError("Login yoki parol noto'g'ri");
      }
    } catch (err) {
      setError("Server bilan bog'lanishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-8 shadow-xl"
      >
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Tizimga kirish
        </h1>

        {/* Rol tanlash */}
        <div className="mb-5 flex rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            onClick={() => setRole("worker")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              role === "worker"
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Ishchi
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              role === "admin"
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Admin
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-sm text-zinc-400">Login</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-blue-500"
            placeholder={role === "admin" ? "admin" : "ali"}
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm text-zinc-400">Parol</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white outline-none focus:border-blue-500"
            placeholder="••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Tekshirilmoqda..." : "Kirish"}
        </button>

        <div className="mt-5 space-y-1 text-center text-xs text-zinc-500">
          <p>
            Ishchi: <b>ali</b> / <b>1234</b>
          </p>
          <p>
            Admin: <b>admin</b> / <b>123456ad</b>
          </p>
        </div>
      </form>
    </div>
  );
}
