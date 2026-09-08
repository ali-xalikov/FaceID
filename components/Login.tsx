"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

const MOKKY_URL = "https://75bd67ad7325d77f.mokky.dev";

type Props = {
  onLoginSuccess: (user: any) => void;
};

export default function Login({ onLoginSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "worker">("worker");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "face">("credentials");
  const [tempUser, setTempUser] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceStatus, setFaceStatus] = useState("Model yuklanmoqda...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        setModelsLoaded(true);
        setFaceStatus("Kameraga qarang");
      } catch {
        setFaceStatus("Model yuklanmadi");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (step !== "face" || !modelsLoaded) return;
    let stream: MediaStream | null = null;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setFaceStatus("Kameraga ruxsat berilmadi");
      }
    };
    start();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [step, modelsLoaded]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = role === "admin" ? "admins" : "workers";
      const res = await fetch(
        `${MOKKY_URL}/${endpoint}?username=${username}&password=${password}`
      );
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        setError("Login yoki parol noto‘g‘ri");
        setLoading(false);
        return;
      }

      const user = { ...data[0], role };
      // Admin bo'lsa to'g'ridan-to'g'ri kiradi
      if (role === "admin") {
        localStorage.setItem("user", JSON.stringify(user));
        onLoginSuccess(user);
        return;
      }

      // Ishchi bo'lsa yuz tekshirishga o'tadi
      setTempUser(user);
      setStep("face");
    } catch {
      setError("Server xatosi");
    } finally {
      setLoading(false);
    }
  };

  const handleVideoPlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !tempUser) return;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    faceapi.matchDimensions(canvas, displaySize);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;

      try {
        const faceRes = await fetch(
          `${MOKKY_URL}/faces?worker_id=${tempUser.id}`
        );
        const faces = await faceRes.json();

        // Yuz hali yo'q bo'lsa — birinchi marta ruxsat
        if (!Array.isArray(faces) || faces.length === 0) {
          setFaceStatus("Yuz topilmadi — birinchi marta kirish");
          localStorage.setItem("user", JSON.stringify(tempUser));
          setTimeout(() => onLoginSuccess(tempUser), 800);
          return;
        }

        const savedFace = faces[0];
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.5,
            })
          )
          .withFaceLandmarks()
          .withFaceDescriptors();

        const resized = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let matched = false;

        for (const det of resized) {
          const box = det.detection.box;
          const dist = faceapi.euclideanDistance(
            new Float32Array(savedFace.descriptor),
            det.descriptor
          );
          const isMatch = dist < 0.5;

          ctx.strokeStyle = isMatch ? "#22c55e" : "#ef4444";
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          if (isMatch) {
            matched = true;
            setFaceStatus("Yuz tasdiqlandi ✓");
            if (intervalRef.current) clearInterval(intervalRef.current);
            localStorage.setItem("user", JSON.stringify(tempUser));
            setTimeout(() => onLoginSuccess(tempUser), 700);
            break;
          }
        }

        if (!matched && detections.length === 0) {
          setFaceStatus("Yuzingizni kameraga ko‘rsating");
        } else if (!matched) {
          setFaceStatus("Yuz mos kelmadi");
        }
      } catch (e) {
        console.error(e);
      }
    }, 400);
  };

  // =========================
  // FACE STEP UI
  // =========================
  if (step === "face") {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f1c]">
        {/* Background grid + glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.15)_0%,_transparent_70%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: `linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 w-full max-w-md rounded-3xl border border-blue-500/20 bg-[#0d1526]/90 p-8 shadow-[0_0_60px_rgba(59,130,246,0.15)] backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 text-xl">
              🔐
            </div>
            <h2 className="text-xl font-bold text-white">Yuz tekshiruvi</h2>
            <p className="mt-1 text-sm text-zinc-400">{tempUser?.name}</p>
          </div>

          <div className="relative mb-5 overflow-hidden rounded-2xl border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onPlay={handleVideoPlay}
              className="block w-full"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>

          <p className="mb-5 text-center text-sm font-medium text-blue-400">
            {faceStatus}
          </p>

          <button
            onClick={() => {
              setStep("credentials");
              setTempUser(null);
            }}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 py-3 text-sm text-zinc-300 transition hover:bg-zinc-700"
          >
            ← Orqaga
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // LOGIN UI
  // =========================
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f1c]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12)_0%,_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(99,102,241,0.08)_0%,_transparent_50%)]" />

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Network dots (decorative) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-blue-400/40"
            style={{
              top: `${15 + ((i * 7) % 70)}%`,
              left: `${10 + ((i * 11) % 80)}%`,
            }}
          />
        ))}
      </div>

      <form
        onSubmit={handleCredentials}
        className="relative z-10 w-full max-w-[400px] rounded-3xl border border-blue-500/20 bg-[#0d1526]/85 p-8 shadow-[0_0_80px_rgba(59,130,246,0.12)] backdrop-blur-2xl"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Davomat <span className="text-blue-400">Vision</span>
          </h1>
          <p className="mt-1 text-xs text-zinc-500">Face Attendance System</p>
        </div>

        <h2 className="mb-1 text-lg font-semibold text-white">
          Tizimga kirish
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          Hisobingizga kiring va davomatni boshqaring
        </p>

        {/* Role switch */}
        <div className="mb-5 flex rounded-xl bg-zinc-800/60 p-1">
          <button
            type="button"
            onClick={() => setRole("worker")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
              role === "worker"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Ishchi
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
              role === "admin"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Admin
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Login
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-800/40 px-4 py-3.5 text-white placeholder-zinc-600 outline-none transition focus:border-blue-500 focus:bg-zinc-800/60 focus:ring-2 focus:ring-blue-500/20"
            placeholder={role === "admin" ? "admin" : "ali"}
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Parol
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-800/40 px-4 py-3.5 text-white placeholder-zinc-600 outline-none transition focus:border-blue-500 focus:bg-zinc-800/60 focus:ring-2 focus:ring-blue-500/20"
            placeholder="Parolingizni kiriting"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-500 hover:to-blue-400 disabled:opacity-50"
        >
          {loading ? "Tekshirilmoqda..." : "Kirish →"}
        </button>

        <div className="mt-6 space-y-1 border-t border-zinc-800 pt-5 text-center text-xs text-zinc-500">
          <p>
            Ishchi: <span className="text-zinc-300">ali / 1234</span>
          </p>
          <p>
            Admin: <span className="text-zinc-300">admin / 123456</span>
          </p>
        </div>
      </form>
    </div>
  );
}
