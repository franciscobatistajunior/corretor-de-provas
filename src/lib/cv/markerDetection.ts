import type { Cv, CvMat } from "../opencv/types";
import type { MarkerId } from "../sheetLayout";

export interface PxPoint {
  x: number;
  y: number;
}

interface Candidate extends PxPoint {
  area: number;
}

const MIN_AREA_PX = 20;
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 1.6;
const MIN_EXTENT = 0.6;

/** Finds solid, roughly-square blobs in a binary image — candidates for the 8 physical markers. */
export function findSquareBlobCandidates(cv: Cv, binary: CvMat): Candidate[] {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  const candidates: Candidate[] = [];
  try {
    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      try {
        const area = cv.contourArea(contour);
        if (area < MIN_AREA_PX) continue;

        const rect = cv.boundingRect(contour);
        const aspect = rect.width / rect.height;
        const extent = area / (rect.width * rect.height);
        if (aspect >= MIN_ASPECT && aspect <= MAX_ASPECT && extent >= MIN_EXTENT) {
          candidates.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, area });
        }
      } finally {
        contour.delete();
      }
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }

  return candidates;
}

export type DetectedMarkers = Partial<Record<MarkerId, PxPoint>>;

export interface MarkerDetectionResult {
  markers: DetectedMarkers;
  foundCorners: number;
}

/**
 * Classifies blob candidates into the 8 known marker roles using two facts
 * about the physical sheet: corner markers (11mm) are larger than mid-edge
 * markers (8mm), and each marker's position relative to the overall
 * centroid tells us which corner/edge it is (see sheetLayout for the
 * calibrated geometry this assumes).
 */
export function classifyMarkers(candidates: Candidate[]): MarkerDetectionResult {
  if (candidates.length < 4) {
    return { markers: {}, foundCorners: 0 };
  }

  const sorted = [...candidates].sort((a, b) => b.area - a.area);
  const cornerCandidates = sorted.slice(0, 4);
  const midCandidates = sorted.slice(4, 8);

  const centroid = {
    x: cornerCandidates.reduce((sum, c) => sum + c.x, 0) / cornerCandidates.length,
    y: cornerCandidates.reduce((sum, c) => sum + c.y, 0) / cornerCandidates.length,
  };

  const markers: DetectedMarkers = {};
  let foundCorners = 0;

  for (const candidate of cornerCandidates) {
    const isLeft = candidate.x < centroid.x;
    const isTop = candidate.y < centroid.y;
    const id: MarkerId = isTop
      ? isLeft
        ? "cornerTopLeft"
        : "cornerTopRight"
      : isLeft
        ? "cornerBottomLeft"
        : "cornerBottomRight";
    if (!markers[id]) {
      markers[id] = { x: candidate.x, y: candidate.y };
      foundCorners += 1;
    }
  }

  for (const candidate of midCandidates) {
    const dx = candidate.x - centroid.x;
    const dy = candidate.y - centroid.y;
    const id: MarkerId = Math.abs(dx) < Math.abs(dy) ? (dy < 0 ? "midTop" : "midBottom") : dx < 0 ? "midLeft" : "midRight";
    if (!markers[id]) {
      markers[id] = { x: candidate.x, y: candidate.y };
    }
  }

  return { markers, foundCorners };
}
