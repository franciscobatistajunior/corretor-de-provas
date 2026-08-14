/**
 * Hand-rolled, intentionally partial typings for opencv.js — only the
 * handful of classes/functions this app actually calls. The real
 * `public/opencv/opencv.js` exposes a much larger API with no official
 * TypeScript types; extend this file if the CV pipeline needs more of it.
 */
export interface CvSize {
  width: number;
  height: number;
}

export interface CvPoint {
  x: number;
  y: number;
}

export interface CvMat {
  delete(): void;
  rows: number;
  cols: number;
  data: Uint8Array;
  data32F: Float32Array;
  clone(): CvMat;
}

export interface CvMatVector {
  size(): number;
  get(index: number): CvMat;
  delete(): void;
}

export interface CvRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Cv {
  Mat: {
    new (): CvMat;
    new (rows: number, cols: number, type: number): CvMat;
  };
  MatVector: { new (): CvMatVector };
  Size: { new (width: number, height: number): CvSize };
  Point: { new (x: number, y: number): CvPoint };

  CV_8UC1: number;
  CV_8UC4: number;
  CV_32FC2: number;
  COLOR_RGBA2GRAY: number;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;
  THRESH_BINARY_INV: number;
  THRESH_BINARY: number;
  THRESH_OTSU: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  MORPH_CLOSE: number;
  MORPH_RECT: number;
  HOUGH_GRADIENT: number;
  RANSAC: number;
  INTER_AREA: number;

  matFromImageData(imageData: ImageData): CvMat;
  matFromArray(rows: number, cols: number, type: number, array: number[]): CvMat;

  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  GaussianBlur(src: CvMat, dst: CvMat, ksize: CvSize, sigmaX: number): void;
  threshold(src: CvMat, dst: CvMat, thresh: number, maxval: number, type: number): number;
  adaptiveThreshold(
    src: CvMat,
    dst: CvMat,
    maxValue: number,
    adaptiveMethod: number,
    thresholdType: number,
    blockSize: number,
    C: number
  ): void;
  morphologyEx(src: CvMat, dst: CvMat, op: number, kernel: CvMat): void;
  getStructuringElement(shape: number, ksize: CvSize): CvMat;
  resize(src: CvMat, dst: CvMat, dsize: CvSize, fx: number, fy: number, interpolation: number): void;
  findContours(
    src: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number
  ): void;
  contourArea(contour: CvMat): number;
  boundingRect(contour: CvMat): CvRect;
  HoughCircles(
    src: CvMat,
    circles: CvMat,
    method: number,
    dp: number,
    minDist: number,
    param1: number,
    param2: number,
    minRadius: number,
    maxRadius: number
  ): void;
  findHomography(srcPoints: CvMat, dstPoints: CvMat, method: number, ransacReprojThreshold: number): CvMat;
  getPerspectiveTransform(srcPoints: CvMat, dstPoints: CvMat): CvMat;
  warpPerspective(src: CvMat, dst: CvMat, transform: CvMat, dsize: CvSize): void;

  onRuntimeInitialized: (() => void) | undefined;
}
