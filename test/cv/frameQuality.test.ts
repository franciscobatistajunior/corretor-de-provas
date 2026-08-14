import { describe, expect, it } from "vitest";
import { evaluateFrameQuality } from "../../src/lib/cv/frameQuality";
import type { DetectedMarkers } from "../../src/lib/cv/markerDetection";

const FRAME_W = 640;
const FRAME_H = 800;

function squareCorners(minX: number, minY: number, maxX: number, maxY: number): DetectedMarkers {
  return {
    cornerTopLeft: { x: minX, y: minY },
    cornerTopRight: { x: maxX, y: minY },
    cornerBottomLeft: { x: minX, y: maxY },
    cornerBottomRight: { x: maxX, y: maxY },
  };
}

describe("evaluateFrameQuality", () => {
  it("reports no-markers when a corner is missing", () => {
    const markers: DetectedMarkers = { cornerTopLeft: { x: 10, y: 10 } };
    expect(evaluateFrameQuality(markers, FRAME_W, FRAME_H)).toBe("no-markers");
  });

  it("accepts a well-framed, untilted, centered sheet", () => {
    const markers = squareCorners(60, 80, 580, 720);
    expect(evaluateFrameQuality(markers, FRAME_W, FRAME_H)).toBe("good");
  });

  it("flags a sheet that only fills a small part of the frame as too-far", () => {
    const markers = squareCorners(260, 340, 380, 460);
    expect(evaluateFrameQuality(markers, FRAME_W, FRAME_H)).toBe("too-far");
  });

  it("flags a sheet whose corners touch the frame edge as too-close", () => {
    const markers = squareCorners(0, 0, 640, 800);
    expect(evaluateFrameQuality(markers, FRAME_W, FRAME_H)).toBe("too-close");
  });

  it("flags a rotated sheet as tilted even when well framed and centered", () => {
    const markers: DetectedMarkers = {
      cornerTopLeft: { x: 60, y: 200 },
      cornerTopRight: { x: 480, y: 80 },
      cornerBottomLeft: { x: 160, y: 720 },
      cornerBottomRight: { x: 580, y: 600 },
    };
    expect(evaluateFrameQuality(markers, FRAME_W, FRAME_H)).toBe("tilted");
  });

  it("tolerates a small tilt within the allowed margin", () => {
    const markers: DetectedMarkers = {
      cornerTopLeft: { x: 60, y: 84 },
      cornerTopRight: { x: 580, y: 76 },
      cornerBottomLeft: { x: 68, y: 720 },
      cornerBottomRight: { x: 588, y: 712 },
    };
    expect(evaluateFrameQuality(markers, FRAME_W, FRAME_H)).toBe("good");
  });
});
