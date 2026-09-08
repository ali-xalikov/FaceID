"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

const MOKKY_URL = "https://75bd67ad7325d77f.mokky.dev";
const WORK_START = "08:00";
const WORK_END = "17:00";
const FINE_PER_MINUTE = 100;

type SavedFace = {
  id?: number;
  name: string;
  worker_id: number;
  image: string;
  descriptor: number[];
};

type AttendanceRecord = {
  id?: number;
  worker_id: number;
  date: string;
  check_in: string;
  check_out: string | null;
  late_minutes: number;
  fine: number;
  status: string;
  note: string;
};

type Props = {
  currentUser?: any;
};

export default function FaceCamera({ currentUser }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRecognizedRef = useRef<string | null>(null);
  const checkInLockRef = useRef(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [myFace, setMyFace] = useState<SavedFace | null>(null);
  const [result, setResult] = useState("Model yuklanmoqda...");
  const [saving, setSaving] = useState(false);
  const [needFaceRegistration, setNeedFaceRegistration] = useState(false);
  const [myHistory, setMyHistory] = useState<AttendanceRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  // =========================
  // MODELLARNI YUKLASH
  // =========================
  useEffect(() => {
    const loadModels = async () => {
      try {
        setResult("Yuz aniqlash modeli yuklanmoqda...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        setModelsLoaded(true);
        setResult("Kamera ishga tushmoqda...");
      } catch (error) {
        setResult("❌ Modelni yuklab bo'lmadi");
      }
    };
    loadModels();
  }, []);

  // =========================
  // YUZNI SERVERDAN OLISH
  // =========================
  useEffect(() => {
    if (!currentUser || currentUser.role === "admin") return;

    const loadMyFace = async () => {
      try {
        const res = await fetch(
          `${MOKKY_URL}/faces?worker_id=${currentUser.id}`
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setMyFace(data[0]);
          setNeedFaceRegistration(false);
        } else {
          setNeedFaceRegistration(true);
          setResult("Avval yuzingizni ro'yxatdan o'tkazing");
        }
      } catch (e) {
        console.error(e);
        setNeedFaceRegistration(true);
      }
    };

    loadMyFace();
    loadMyHistory();
  }, [currentUser]);

  // =========================
  // O'Z TARIXINI YUKLASH
  // =========================
  const loadMyHistory = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${MOKKY_URL}/attendance?worker_id=${currentUser.id}`
      );
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setMyHistory(list);

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Tashkent",
      });
      const todayRec = list.find((a: any) => a.date === today) || null;
      setTodayRecord(todayRec);
    } catch (e) {
      console.error(e);
    }
  };

  // =========================
  // KAMERA
  // =========================
  useEffect(() => {
    if (!modelsLoaded) return;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setResult("❌ Kameraga ruxsat berilmadi");
      }
    };

    startCamera();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [modelsLoaded]);

  // =========================
  // KECHIKISH HISOBI
  // =========================
  const calculateLate = (checkIn: string) => {
    const [h, m] = checkIn.split(":").map(Number);
    const checkInMin = h * 60 + m;
    const [sh, sm] = WORK_START.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const lateMinutes = Math.max(0, checkInMin - startMin);
    return {
      late_minutes: lateMinutes,
      fine: lateMinutes * FINE_PER_MINUTE,
      status: lateMinutes > 0 ? "late" : "on_time",
    };
  };

  const getUzTime = () => {
    const now = new Date();
    const uz = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Tashkent" })
    );
    return {
      date: uz.toLocaleDateString("en-CA"),
      time: uz.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    };
  };

  // =========================
  // CHECK-IN / CHECK-OUT
  // =========================
  const doCheckInOrOut = async () => {
    if (!myFace || checkInLockRef.current) return;
    checkInLockRef.current = true;

    try {
      const { date, time } = getUzTime();

      // Bugungi yozuv bormi?
      const resCheck = await fetch(
        `${MOKKY_URL}/attendance?worker_id=${myFace.worker_id}&date=${date}`
      );
      const existing = await resCheck.json();

      if (Array.isArray(existing) && existing.length > 0) {
        const record = existing[0];

        // Agar check_out yo'q bo'lsa — chiqish yozamiz
        if (!record.check_out) {
          const res = await fetch(`${MOKKY_URL}/attendance/${record.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ check_out: time }),
          });

          if (res.ok) {
            setResult(`${myFace.name} — Chiqish qayd etildi (${time})`);
            speak("Chiqish qayd etildi");
            await loadMyHistory();
          }
        } else {
          setResult(
            `Bugun allaqachon kelgan va ketgan (${record.check_in} - ${record.check_out})`
          );
        }
        return;
      }

      // Yangi check-in
      const late = calculateLate(time);
      const record = {
        worker_id: myFace.worker_id,
        date,
        check_in: time,
        check_out: null,
        late_minutes: late.late_minutes,
        fine: late.fine,
        status: late.status,
        note: "",
      };

      const res = await fetch(`${MOKKY_URL}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });

      if (res.ok) {
        const msg =
          late.late_minutes > 0
            ? `${myFace.name} — KECHIKDI! ${late.late_minutes} daq, jarima: ${late.fine} so'm`
            : `${myFace.name} — O'z vaqtida keldi ✓`;
        setResult(msg);
        speak(msg);
        await loadMyHistory();
      }
    } catch (e) {
      console.error(e);
      setResult("Xatolik yuz berdi");
    } finally {
      setTimeout(() => {
        checkInLockRef.current = false;
      }, 4000);
    }
  };

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "uz-UZ";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  // =========================
  // YUZ TANISH
  // =========================
  const handleVideoPlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    faceapi.matchDimensions(canvas, displaySize);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || needFaceRegistration || !myFace) return;

      try {
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

        let recognized = false;

        for (const detection of resized) {
          const box = detection.detection.box;
          const dist = faceapi.euclideanDistance(
            new Float32Array(myFace.descriptor),
            detection.descriptor
          );

          const isMatch = dist < 0.5;
          ctx.strokeStyle = isMatch ? "#3ED598" : "#F0665A";
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          const text = isMatch ? `${myFace.name} ✓` : "Noma'lum";
          ctx.font = "600 16px 'Space Grotesk', sans-serif";
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = isMatch ? "#3ED598" : "#F0665A";
          ctx.fillRect(box.x, Math.max(box.y - 26, 0), tw + 14, 26);
          ctx.fillStyle = "#0B0D10";
          ctx.fillText(text, box.x + 7, Math.max(box.y - 7, 18));

          if (isMatch) {
            recognized = true;
            if (lastRecognizedRef.current !== String(myFace.worker_id)) {
              lastRecognizedRef.current = String(myFace.worker_id);
              doCheckInOrOut();
            }
          }
        }

        if (!recognized) {
          lastRecognizedRef.current = null;
          if (detections.length === 0) setResult("Yuz kutilmoqda...");
        }
      } catch (e) {
        console.error(e);
      }
    }, 250);
  };

  // =========================
  // YUZNI SAQLASH (SERVERGA)
  // =========================
  const saveMyFace = async () => {
    if (!currentUser) return;
    const video = videoRef.current;
    if (!video) return;
    setSaving(true);

    try {
      const detection = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        alert("Yuz topilmadi");
        setSaving(false);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const image = canvas.toDataURL("image/jpeg", 0.6);

      const faceData = {
        name: currentUser.name,
        worker_id: currentUser.id,
        image,
        descriptor: Array.from(detection.descriptor),
      };

      // Agar oldin bo'lsa o'chiramiz
      const oldRes = await fetch(
        `${MOKKY_URL}/faces?worker_id=${currentUser.id}`
      );
      const oldData = await oldRes.json();
      if (Array.isArray(oldData) && oldData.length > 0) {
        await fetch(`${MOKKY_URL}/faces/${oldData[0].id}`, {
          method: "DELETE",
        });
      }

      const res = await fetch(`${MOKKY_URL}/faces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(faceData),
      });

      if (res.ok) {
        const saved = await res.json();
        setMyFace(saved);
        setNeedFaceRegistration(false);
        setResult("Yuz muvaffaqiyatli saqlandi ✓");
        speak("Yuzingiz saqlandi");
      } else {
        alert("Saqlashda xatolik");
      }
    } catch (e) {
      console.error(e);
      alert("Xatolik");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <main className="fc-root flex min-h-screen flex-col items-center gap-6 px-4 py-8">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap");

        .fc-root {
          background: radial-gradient(
            ellipse 120% 80% at 50% -10%,
            #1a1e24 0%,
            #0b0d10 55%
          );
          color: #edeff2;
          font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        }
        .fc-mono {
          font-family: "JetBrains Mono", ui-monospace, monospace;
        }
        @keyframes fc-scan {
          0% {
            transform: translateY(0%);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100%);
            opacity: 0;
          }
        }
        .fc-scanline {
          animation: fc-scan 3.2s ease-in-out infinite;
        }
        @keyframes fc-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.35;
          }
        }
        .fc-pulse {
          animation: fc-pulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <header className="flex w-full max-w-[640px] items-center justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">Davomat</p>
          <p className="text-sm text-[#8A909B]">
            Kirish va chiqishni yuz orqali qayd eting
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#2A2F36] bg-[#15181C] px-3 py-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              modelsLoaded ? "bg-[#3ED598] fc-pulse" : "bg-[#8A909B]"
            }`}
          />
          <span className="fc-mono text-xs text-[#8A909B]">
            {modelsLoaded ? "tayyor" : "yuklanmoqda"}
          </span>
        </div>
      </header>

      {/* Status readout */}
      <div className="w-full max-w-[640px] rounded-2xl border border-[#2A2F36] bg-[#15181C] px-5 py-4">
        <p className="fc-mono text-[15px] leading-relaxed text-[#3ED598]">
          {result}
        </p>
      </div>

      {/* Bugungi holat */}
      {todayRecord && (
        <div className="flex w-full max-w-[640px] items-center justify-between rounded-2xl border border-dashed border-[#2A2F36] bg-[#0F1216] px-5 py-3">
          <div className="flex items-center gap-3 fc-mono text-sm">
            <span className="text-[#8A909B]">Bugun</span>
            <span className="font-medium text-[#EDEFF2]">
              {todayRecord.check_in}
            </span>
            <span className="text-[#4A505A]">→</span>
            <span className="font-medium text-[#EDEFF2]">
              {todayRecord.check_out || "hali ketmagan"}
            </span>
          </div>
          {todayRecord.fine > 0 && (
            <span className="fc-mono rounded-full bg-[#F0665A]/10 px-3 py-1 text-xs font-medium text-[#F0665A]">
              {todayRecord.fine} so'm jarima
            </span>
          )}
        </div>
      )}

      {/* Camera frame */}
      <div className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#2A2F36] bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onPlay={handleVideoPlay}
          className="block h-auto w-full opacity-95"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute left-0 top-0 h-full w-full"
        />

        {/* corner brackets */}
        <div className="pointer-events-none absolute inset-3">
          <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-[#C9963E]/70" />
          <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-[#C9963E]/70" />
          <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-[#C9963E]/70" />
          <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-[#C9963E]/70" />
        </div>

        {/* scan line, only while waiting for a match */}
        {!needFaceRegistration && myFace && (
          <div className="pointer-events-none absolute inset-x-3 top-3 bottom-3 overflow-hidden">
            <div className="fc-scanline h-px w-full bg-gradient-to-r from-transparent via-[#C9963E] to-transparent" />
          </div>
        )}
      </div>

      {needFaceRegistration ? (
        <div className="flex w-full max-w-[640px] flex-col items-center gap-4 rounded-2xl border border-[#2A2F36] bg-[#15181C] px-6 py-6 text-center">
          <p className="text-[#C9963E]">
            Birinchi marta tizimga kirdingiz. Yuzingizni ro'yxatdan o'tkazing.
          </p>
          <button
            onClick={saveMyFace}
            disabled={!modelsLoaded || saving}
            className="rounded-full bg-[#C9963E] px-6 py-3 font-semibold text-[#0B0D10] transition-colors hover:bg-[#DBA84E] disabled:opacity-40"
          >
            {saving ? "Saqlanmoqda..." : "Yuzimni saqlash"}
          </button>
        </div>
      ) : (
        <div className="flex w-full max-w-[640px] items-center justify-between">
          <p className="text-sm text-[#8A909B]">
            Kameraga qarang — kirish va chiqish avtomatik qayd etiladi
          </p>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="whitespace-nowrap rounded-full border border-[#2A2F36] bg-[#15181C] px-4 py-2 text-sm text-[#EDEFF2] transition-colors hover:border-[#C9963E]/60"
          >
            {showHistory ? "Kamerani ko'rsatish" : "Mening tarixim"}
          </button>
        </div>
      )}

      {myFace && (
        <div className="flex w-full max-w-[640px] items-center gap-3 rounded-2xl border border-[#2A2F36] bg-[#15181C] px-4 py-3">
          <img
            src={myFace.image}
            alt={myFace.name}
            className="h-12 w-12 rounded-full border-2 border-[#3ED598] object-cover"
          />
          <div>
            <p className="text-sm font-medium">{myFace.name}</p>
            <p className="fc-mono text-xs text-[#8A909B]">
              ID {myFace.worker_id}
            </p>
          </div>
        </div>
      )}

      {/* O'z tarixi */}
      {showHistory && (
        <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#2A2F36] bg-[#15181C]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#2A2F36] text-[#8A909B]">
                <th className="px-4 py-3 font-medium">Sana</th>
                <th className="px-4 py-3 font-medium">Kelish</th>
                <th className="px-4 py-3 font-medium">Chiqish</th>
                <th className="px-4 py-3 text-right font-medium">Jarima</th>
              </tr>
            </thead>
            <tbody className="fc-mono">
              {myHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-[#8A909B]"
                  >
                    Hali yozuv yo'q
                  </td>
                </tr>
              ) : (
                [...myHistory].reverse().map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[#1E2126] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-[#8A909B]">{a.date}</td>
                    <td className="px-4 py-3">{a.check_in}</td>
                    <td className="px-4 py-3">{a.check_out || "—"}</td>
                    <td className="px-4 py-3 text-right text-[#F0665A]">
                      {a.fine > 0 ? `${a.fine} so'm` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
