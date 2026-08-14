import type { DetectedMarkers } from "./markerDetection";

/**
 * Why a good `foundCorners >= 4` isn't enough to auto-capture: the 4 corner
 * markers can be detected while the sheet is still badly skewed or too far
 * away to read reliably. This scores the *geometry* of those corners against
 * the analysis frame to decide whether the shot is actually good enough.
 */
export type FrameQuality = "no-markers" | "tilted" | "too-far" | "too-close" | "good";

const MAX_TILT_DEG = 12;
/** Corner bounding box must span at least this fraction of the frame, in
 * both axes, or the sheet is too small/far to read reliably. */
const MIN_SPAN_RATIO = 0.5;
/** Any corner sitting within this fraction of the frame edge suggests the
 * sheet is clipped by the frame — user is too close / not fully framed. */
const EDGE_MARGIN_RATIO = 0.02;

function angleFromHorizontalDeg(dx: number, dy: number): number {
  return Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
}

function angleFromVerticalDeg(dx: number, dy: number): number {
  return Math.abs(90 - Math.abs((Math.atan2(dy, dx) * 180) / Math.PI));
}

export function evaluateFrameQuality(
  markers: DetectedMarkers,
  frameWidth: number,
  frameHeight: number
): FrameQuality {
  const { cornerTopLeft: tl, cornerTopRight: tr, cornerBottomLeft: bl, cornerBottomRight: br } = markers;
  if (!tl || !tr || !bl || !br) return "no-markers";

  const topTilt = angleFromHorizontalDeg(tr.x - tl.x, tr.y - tl.y);
  const bottomTilt = angleFromHorizontalDeg(br.x - bl.x, br.y - bl.y);
  const leftTilt = angleFromVerticalDeg(bl.x - tl.x, bl.y - tl.y);
  const rightTilt = angleFromVerticalDeg(br.x - tr.x, br.y - tr.y);
  if (Math.max(topTilt, bottomTilt, leftTilt, rightTilt) > MAX_TILT_DEG) {
    return "tilted";
  }

  const minX = Math.min(tl.x, tr.x, bl.x, br.x);
  const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
  const minY = Math.min(tl.y, tr.y, bl.y, br.y);
  const maxY = Math.max(tl.y, tr.y, bl.y, br.y);

  const widthRatio = (maxX - minX) / frameWidth;
  const heightRatio = (maxY - minY) / frameHeight;
  if (Math.min(widthRatio, heightRatio) < MIN_SPAN_RATIO) {
    return "too-far";
  }

  const marginX = frameWidth * EDGE_MARGIN_RATIO;
  const marginY = frameHeight * EDGE_MARGIN_RATIO;
  if (minX < marginX || minY < marginY || maxX > frameWidth - marginX || maxY > frameHeight - marginY) {
    return "too-close";
  }

  return "good";
}
