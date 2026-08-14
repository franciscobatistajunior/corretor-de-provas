import type { Cv, CvMat } from "../opencv/types";
import { toMarkerBinary, toGray, computeOtsuThreshold } from "./preprocess";
import { findSquareBlobCandidates, classifyMarkers, type DetectedMarkers } from "./markerDetection";
import { computeHomography } from "./homography";
import { getExpectedBubbles } from "./bubbleDetection";
import { sampleFillRatio, decideAnswer } from "./fillReading";
import type { OmrResult, OmrQuestionResult } from "./types";

/** Canonical canvas scale and size — matches the printable content area
 * measured by scripts/calibrateSheetLayout.ts (A4 minus the @page 10mm
 * margin on every side), not the full physical page. */
export const CANONICAL_PX_PER_MM = 6;
export const SHEET_CONTENT_WIDTH_MM = 190;
export const SHEET_CONTENT_HEIGHT_MM = 277;

const BUBBLE_SAMPLE_RADIUS_MM = 1.1; // printed bubble radius is ~1.85mm; sample inside the ring
const MARKER_DETECTION_MAX_SIDE_PX = 1200;

export class OmrPipelineError extends Error {}

export interface OmrPipelineDebugInfo {
  detectedMarkers: DetectedMarkers;
  foundCorners: number;
  /** Raw pixels of the aligned, top-down sheet — no DOM/canvas dependency,
   * so this runs the same inside a Worker as on the main thread. Callers
   * that want to display it draw this onto a real <canvas> themselves. */
  warpedImageData: ImageData;
}

export interface OmrPipelineOutput {
  result: OmrResult;
  debug: OmrPipelineDebugInfo;
}

export function runOmrPipeline(cv: Cv, photoImageData: ImageData, totalQuestions: number): OmrPipelineOutput {
  const photo = cv.matFromImageData(photoImageData);
  const owned: CvMat[] = [photo];
  function track(mat: CvMat): CvMat {
    owned.push(mat);
    return mat;
  }

  try {
    // 1. Marker/blob detection runs on a downscaled copy — the markers are
    // large and detection is resolution-tolerant, so this keeps the
    // expensive contour pass cheap without sacrificing warp/read precision
    // (those still use the full-resolution photo).
    const longSide = Math.max(photo.cols, photo.rows);
    const scale = longSide > MARKER_DETECTION_MAX_SIDE_PX ? MARKER_DETECTION_MAX_SIDE_PX / longSide : 1;

    let detectionMat = photo;
    if (scale !== 1) {
      detectionMat = track(new cv.Mat());
      cv.resize(
        photo,
        detectionMat,
        new cv.Size(Math.round(photo.cols * scale), Math.round(photo.rows * scale)),
        0,
        0,
        cv.INTER_AREA
      );
    }

    const binary = track(toMarkerBinary(cv, detectionMat));
    const candidates = findSquareBlobCandidates(cv, binary).map((c) => ({
      x: c.x / scale,
      y: c.y / scale,
      area: c.area / (scale * scale),
    }));

    const { markers, foundCorners } = classifyMarkers(candidates);
    if (foundCorners < 4) {
      throw new OmrPipelineError(
        "Não foi possível encontrar os 4 marcadores de canto. Tire a foto novamente com o cartão inteiro visível e bem iluminado."
      );
    }

    // 2. Homography from the detected (photographed) markers to their
    // known calibrated positions in canonical canvas pixels.
    const homography = computeHomography(cv, totalQuestions, markers, CANONICAL_PX_PER_MM);
    if (!homography) {
      throw new OmrPipelineError(
        "Não foi possível alinhar a foto do cartão-resposta. Tire a foto novamente mantendo o cartão reto em frente à câmera."
      );
    }
    track(homography.matrix);

    // 3. Warp the full-resolution color photo onto the canonical, top-down canvas.
    const canonicalSize = new cv.Size(
      Math.round(SHEET_CONTENT_WIDTH_MM * CANONICAL_PX_PER_MM),
      Math.round(SHEET_CONTENT_HEIGHT_MM * CANONICAL_PX_PER_MM)
    );
    const warped = track(new cv.Mat());
    cv.warpPerspective(photo, warped, homography.matrix, canonicalSize);

    // 4. Grayscale + a threshold computed once per photo (Otsu), so overall
    // lighting/exposure doesn't need a hardcoded brightness assumption.
    const warpedGray = track(toGray(cv, warped));
    const darkThreshold = computeOtsuThreshold(cv, warpedGray);

    // 5. Sample every expected bubble — positions come straight from the
    // calibrated layout (bubbleDetection.ts), not from re-detecting the
    // grid in this photo.
    const radiusPx = BUBBLE_SAMPLE_RADIUS_MM * CANONICAL_PX_PER_MM;
    const expectedBubbles = getExpectedBubbles(totalQuestions, CANONICAL_PX_PER_MM);

    const perQuestion: OmrQuestionResult[] = [];
    const warnings: string[] = [];

    for (let question = 1; question <= totalQuestions; question += 1) {
      const bubbles = expectedBubbles.filter((b) => b.question === question);
      const fillRatios = bubbles.map((b) => sampleFillRatio(warpedGray, b.xPx, b.yPx, radiusPx, darkThreshold));
      const decision = decideAnswer(fillRatios);

      if (decision.ambiguous) {
        warnings.push(`Questão ${question}: duas marcações detectadas (dupla marcação).`);
      }
      if (decision.lowConfidence) {
        warnings.push(`Questão ${question}: leitura de baixa confiança, confira manualmente.`);
      }

      perQuestion.push({
        question,
        letter: decision.letter,
        fillRatios,
        ambiguous: decision.ambiguous,
        lowConfidence: decision.lowConfidence,
      });
    }

    const result: OmrResult = {
      studentAnswers: perQuestion.map((q) => q.letter),
      perQuestion,
      warnings,
    };

    // warped is CV_8UC4 (RGBA, inherited from the source photo Mat), which
    // is exactly ImageData's pixel layout — no canvas needed to expose it.
    const warpedImageData = new ImageData(new Uint8ClampedArray(warped.data), warped.cols, warped.rows);

    return {
      result,
      debug: {
        detectedMarkers: markers,
        foundCorners,
        warpedImageData,
      },
    };
  } finally {
    for (const mat of owned) mat.delete();
  }
}
