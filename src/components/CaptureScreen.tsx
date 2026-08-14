import { useEffect, useRef, useState } from "react";
import { detectMarkersInWorker } from "../lib/cv/cvWorkerClient";
import { evaluateFrameQuality, type FrameQuality } from "../lib/cv/frameQuality";

interface CaptureScreenProps {
  error: string | null;
  onPhotoCaptured: (dataUrl: string) => void;
  onBack: () => void;
}

type LiveStatus = "starting" | "no-camera" | Exclude<FrameQuality, "good"> | "stabilizing" | "captured";

const STABLE_MS = 500;
const DETECTION_INTERVAL_MS = 250;
const ANALYSIS_MAX_SIDE_PX = 640;
/** How long to hold the green "Capturado!" state on screen before handing
 * off to processing — purely a feedback pause, the frame itself was already
 * grabbed the instant the good framing was confirmed. */
const CAPTURED_FEEDBACK_MS = 400;

const STATUS_LABEL: Record<LiveStatus, string> = {
  starting: "Iniciando câmera…",
  "no-camera": "Câmera não disponível",
  "no-markers": "Procurando os marcadores do cartão…",
  tilted: "Endireite o cartão em relação à câmera",
  "too-far": "Aproxime a câmera do cartão",
  "too-close": "Afaste um pouco a câmera / mostre o cartão inteiro",
  stabilizing: "Mantenha assim…",
  captured: "Capturado!",
};

export function CaptureScreen({ error, onPhotoCaptured, onBack }: CaptureScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const stableStartRef = useRef<number | null>(null);
  const lastDetectionAtRef = useRef(0);
  const detectionInFlightRef = useRef(false);
  const capturedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<LiveStatus>("starting");

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStatus("no-markers");
        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      })
      .catch(() => {
        if (!cancelled) setStatus("no-camera");
      });

    return () => {
      cancelled = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyzeFrame() {
    if (capturedRef.current) return;

    const video = videoRef.current;
    const canvas = analysisCanvasRef.current;

    if (!video || !canvas || !video.videoWidth) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const now = performance.now();
    if (detectionInFlightRef.current || now - lastDetectionAtRef.current < DETECTION_INTERVAL_MS) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }
    lastDetectionAtRef.current = now;

    const scale = Math.min(1, ANALYSIS_MAX_SIDE_PX / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    detectionInFlightRef.current = true;
    try {
      // Runs in a Worker — see cvWorkerClient/cvWorker — so a slow/first-ever
      // OpenCV load can't freeze this preview or the rest of the page.
      const { markers } = await detectMarkersInWorker(imageData);
      if (capturedRef.current) return;

      const quality = evaluateFrameQuality(markers, canvas.width, canvas.height);

      if (quality === "good") {
        if (!stableStartRef.current) stableStartRef.current = now;
        const stableFor = now - stableStartRef.current;
        if (stableFor >= STABLE_MS) {
          triggerAutoCapture();
          return;
        }
        setStatus("stabilizing");
      } else {
        stableStartRef.current = null;
        setStatus(quality);
      }
    } catch {
      // Worker still starting up (or a transient error) — keep trying.
    } finally {
      detectionInFlightRef.current = false;
    }

    animationFrameRef.current = requestAnimationFrame(analyzeFrame);
  }

  /** Grabs the current video frame onto the (hidden) full-resolution capture
   * canvas and returns it as a JPEG data URL — shared by the automatic and
   * manual capture paths so both produce the same kind of photo. */
  function grabFrame(): string | null {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  function triggerAutoCapture() {
    if (capturedRef.current) return;
    capturedRef.current = true;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const dataUrl = grabFrame();
    if (!dataUrl) {
      capturedRef.current = false;
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    // Grab the frame the instant framing is confirmed good, but hold the
    // "Capturado!" feedback on screen briefly before handing off — otherwise
    // the screen would swap to processing too abruptly for the user to
    // register that the auto-capture actually fired.
    setStatus("captured");
    window.setTimeout(() => onPhotoCaptured(dataUrl), CAPTURED_FEEDBACK_MS);
  }

  function handleManualCapture() {
    if (capturedRef.current) return;
    capturedRef.current = true;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const dataUrl = grabFrame();
    if (dataUrl) {
      onPhotoCaptured(dataUrl);
    } else {
      capturedRef.current = false;
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPhotoCaptured(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <section className="panel">
      <h2>2. Capturar foto</h2>
      {error && <div className="callout error">{error}</div>}

      <div className="capture-frame" data-status={status}>
        <video ref={videoRef} autoPlay muted playsInline />
        <div className="capture-status-label">{STATUS_LABEL[status]}</div>
      </div>

      <p className="hint">
        Posicione o cartão-resposta inteiro dentro do enquadramento, reto e bem iluminado. A foto é tirada
        automaticamente quando os 4 marcadores dos cantos ficam bem enquadrados e estáveis por meio segundo.
      </p>

      <div className="actions">
        <button type="button" onClick={handleManualCapture}>
          Tirar foto agora
        </button>
        <button type="button" className="ghost" onClick={() => fileInputRef.current?.click()}>
          Enviar foto do computador
        </button>
        <button type="button" className="ghost" onClick={onBack}>
          Voltar
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />

      <canvas ref={analysisCanvasRef} style={{ display: "none" }} />
      <canvas ref={captureCanvasRef} style={{ display: "none" }} />
    </section>
  );
}
