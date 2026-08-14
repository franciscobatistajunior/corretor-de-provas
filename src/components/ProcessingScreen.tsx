import { useEffect, useRef } from "react";
import { runPipelineInWorker } from "../lib/cv/cvWorkerClient";
import type { OmrResult } from "../lib/cv/types";

interface ProcessingScreenProps {
  capturedImageDataUrl: string;
  totalQuestions: number;
  onSuccess: (result: OmrResult, debugImageUrl: string) => void;
  onError: (message: string) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem capturada."));
    img.src = src;
  });
}

function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a pré-visualização (canvas indisponível).");
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ProcessingScreen({ capturedImageDataUrl, totalQuestions, onSuccess, onError }: ProcessingScreenProps) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const img = await loadImage(capturedImageDataUrl);
        if (cancelled) return;

        // Drawing to a canvas to read pixels is cheap and stays on the main
        // thread; the actual OpenCV work (detection/homography/warp/read)
        // runs inside a Worker via runPipelineInWorker so it can't freeze
        // the UI, no matter how long OpenCV.js takes to load/compile.
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Não foi possível processar a imagem (canvas indisponível).");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const output = await runPipelineInWorker(imageData, totalQuestions);
        if (cancelled) return;

        onSuccess(output.result, imageDataToDataUrl(output.warpedImageData));
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível processar a foto. Tire outra foto e tente novamente.";
        onError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [capturedImageDataUrl, totalQuestions, onSuccess, onError]);

  return (
    <section className="panel">
      <h2>3. Processando</h2>
      <img
        src={capturedImageDataUrl}
        alt="Foto capturada do cartão-resposta"
        style={{ maxWidth: "100%", borderRadius: 12 }}
      />
      <p className="hint">Detectando marcadores, alinhando e lendo as respostas…</p>
    </section>
  );
}
