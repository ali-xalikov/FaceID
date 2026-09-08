"use client";

import { useEffect, useState } from "react";
import FaceCamera from "@/components/FaceCamera";
import Login from "@/components/Login";
import AdminDashboard from "@/components/AdminDashboard";

export default function Page() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Yuklanmoqda...
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <div className="relative min-h-screen">
      {/* Yuqori panel */}
      <div className="absolute right-4 top-4 z-50 flex items-center gap-3 rounded-xl bg-zinc-900/90 px-4 py-2 backdrop-blur">
        <div className="text-right">
          <p className="text-sm font-medium text-white">
            {user.name || user.username}
          </p>
          <p className="text-xs text-zinc-400">
            {user.role === "admin" ? "Admin" : "Ishchi"}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-red-600/80 px-3 py-1.5 text-sm text-white hover:bg-red-600"
        >
          Chiqish
        </button>
      </div>

      {/* Rolga qarab sahifa */}
      {user.role === "admin" ? (
        <AdminDashboard />
      ) : (
        <FaceCamera currentUser={user} />
      )}
    </div>
  );
}
