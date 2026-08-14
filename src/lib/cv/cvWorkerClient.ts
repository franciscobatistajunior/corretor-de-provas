import type { OmrResult } from "./types";
import type { DetectedMarkers } from "./markerDetection";

/**
 * Main-thread client for src/workers/cvWorker.ts. All OpenCV.js work
 * (loading the WASM module, every Mat operation) happens inside the
 * worker; this module only ever sends/receives plain data (ImageData,
 * numbers, strings) and never touches `cv` directly.
 */

const worker = new Worker(new URL("../../workers/cvWorker.ts", import.meta.url), { type: "module" });

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

const pending = new Map<number, PendingRequest<unknown>>();
let nextId = 1;

worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; error?: string } & Record<string, unknown>>) => {
  const { id, ok, error, ...rest } = event.data;
  const request = pending.get(id);
  if (!request) return;
  pending.delete(id);

  if (ok) {
    request.resolve(rest);
  } else {
    request.reject(new Error(error ?? "Erro desconhecido no worker de visão computacional."));
  }
};

worker.onerror = (event: ErrorEvent) => {
  const error = new Error(event.message || "Erro no worker de visão computacional.");
  for (const request of pending.values()) {
    request.reject(error);
  }
  pending.clear();
};

function send<T>(message: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    worker.postMessage({ id, ...message }, transfer);
  });
}

/** Kicks off loading opencv.js in the worker ahead of time (call as soon as the app starts). */
export function preloadOpenCv(): Promise<void> {
  return send<void>({ type: "preload" });
}

export function detectMarkersInWorker(
  imageData: ImageData
): Promise<{ foundCorners: number; markers: DetectedMarkers }> {
  return send<{ foundCorners: number; markers: DetectedMarkers }>(
    { type: "detectMarkers", imageData },
    [imageData.data.buffer]
  );
}

export interface RunPipelineWorkerResult {
  result: OmrResult;
  foundCorners: number;
  warpedImageData: ImageData;
}

export function runPipelineInWorker(imageData: ImageData, totalQuestions: number): Promise<RunPipelineWorkerResult> {
  return send<RunPipelineWorkerResult>({ type: "runPipeline", imageData, totalQuestions }, [imageData.data.buffer]);
}
