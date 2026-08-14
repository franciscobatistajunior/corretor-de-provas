import type { Cv, CvMat } from "../opencv/types";
import { getCalibrationPoints } from "../sheetLayout";
import type { DetectedMarkers } from "./markerDetection";

export interface HomographyResult {
  /** 3x3 perspective transform mapping detected marker px -> canonical px. Caller must delete(). */
  matrix: CvMat;
  pointCount: number;
}

/**
 * Solves for the homography mapping the photographed (possibly tilted)
 * marker positions onto their known calibrated positions in a canonical,
 * top-down canvas at `pxPerMm` scale. Uses every marker that was detected
 * (4 to 8), not just the 4 corners — cv.findHomography's RANSAC fit
 * degrades gracefully as correspondences are added or missing.
 */
export function computeHomography(
  cv: Cv,
  totalQuestions: number,
  detected: DetectedMarkers,
  pxPerMm: number
): HomographyResult | null {
  const calibration = getCalibrationPoints(totalQuestions);

  const srcFlat: number[] = [];
  const dstFlat: number[] = [];

  for (const point of calibration) {
    const found = detected[point.id];
    if (!found) continue;
    srcFlat.push(found.x, found.y);
    dstFlat.push(point.xMm * pxPerMm, point.yMm * pxPerMm);
  }

  const pointCount = srcFlat.length / 2;
  if (pointCount < 4) {
    return null;
  }

  const srcMat = cv.matFromArray(pointCount, 1, cv.CV_32FC2, srcFlat);
  const dstMat = cv.matFromArray(pointCount, 1, cv.CV_32FC2, dstFlat);

  try {
    const reprojThresholdPx = 3 * pxPerMm;
    const matrix = cv.findHomography(srcMat, dstMat, cv.RANSAC, reprojThresholdPx);
    if (!matrix || matrix.rows === 0) {
      return null;
    }
    return { matrix, pointCount };
  } finally {
    srcMat.delete();
    dstMat.delete();
  }
}
