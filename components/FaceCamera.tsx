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
          ctx.strokeStyle = isMatch ? "#00ff00" : "#ff0000";
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          const text = isMatch ? `${myFace.name} ✓` : "Noma'lum";
          ctx.font = "bold 18px Arial";
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = isMatch ? "#00ff00" : "#ff0000";
          ctx.fillRect(box.x, Math.max(box.y - 28, 0), tw + 12, 28);
          ctx.fillStyle = "#000";
          ctx.fillText(text, box.x + 6, Math.max(box.y - 8, 20));

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
    <main className="flex min-h-screen flex-col items-center gap-4 bg-zinc-950 p-4 text-white">
      <h1 className="text-2xl font-bold">Ishxona Davomat</h1>
      <p className="text-center text-lg text-emerald-400">{result}</p>

      {/* Bugungi holat */}
      {todayRecord && (
        <div className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
          Bugun: <b>{todayRecord.check_in}</b>
          {todayRecord.check_out
            ? ` → ${todayRecord.check_out}`
            : " (hali ketmagan)"}
          {todayRecord.fine > 0 && (
            <span className="ml-2 text-red-400">
              Jarima: {todayRecord.fine} so'm
            </span>
          )}
        </div>
      )}

      <div className="relative w-full max-w-[640px] overflow-hidden rounded-xl border border-zinc-700">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onPlay={handleVideoPlay}
          className="block h-auto w-full"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute left-0 top-0 h-full w-full"
        />
      </div>

      {needFaceRegistration ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-amber-400">
            Birinchi marta tizimga kirdingiz.
            <br />
            Yuzingizni ro‘yxatdan o‘tkazing.
          </p>
          <button
            onClick={saveMyFace}
            disabled={!modelsLoaded || saving}
            className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saqlanmoqda..." : "Yuzimni saqlash"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-zinc-400">
            Kameraga qarang — avtomatik check-in / check-out
          </p>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600"
          >
            {showHistory ? "Kamerani ko‘rsatish" : "Mening tarixim"}
          </button>
        </div>
      )}

      {myFace && (
        <div className="flex flex-col items-center gap-2">
          <img
            src={myFace.image}
            alt={myFace.name}
            className="h-16 w-16 rounded-full border-2 border-emerald-500 object-cover"
          />
          <p className="text-sm">{myFace.name}</p>
        </div>
      )}

      {/* O'z tarixi */}
      {showHistory && (
        <div className="mt-4 w-full max-w-lg overflow-x-auto rounded-xl border border-zinc-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800">
              <tr>
                <th className="p-3">Sana</th>
                <th className="p-3">Kelish</th>
                <th className="p-3">Chiqish</th>
                <th className="p-3">Jarima</th>
              </tr>
            </thead>
            <tbody>
              {myHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-zinc-500">
                    Hali yozuv yo‘q
                  </td>
                </tr>
              ) : (
                [...myHistory].reverse().map((a) => (
                  <tr key={a.id} className="border-t border-zinc-800">
                    <td className="p-3">{a.date}</td>
                    <td className="p-3">{a.check_in}</td>
                    <td className="p-3">{a.check_out || "—"}</td>
                    <td className="p-3 text-red-400">
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
