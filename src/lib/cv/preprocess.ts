import type { Cv, CvMat } from "../opencv/types";

/**
 * Converts a color/RGBA photo into a solid-blob-friendly binary image:
 * grayscale -> blur -> adaptive threshold (foreground = white) -> morphological
 * close to solidify the marker squares. Used for marker (blob) detection,
 * not for bubble fill reading (which reads grayscale values directly on the
 * warped image instead of a binarized one).
 */
export function toMarkerBinary(cv: Cv, src: CvMat): CvMat {
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const binary = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 35, 10);
    const closed = new cv.Mat();
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);
    return closed;
  } finally {
    gray.delete();
    blurred.delete();
    binary.delete();
    kernel.delete();
  }
}

/** Grayscale conversion used before Otsu thresholding / fill-ratio sampling. */
export function toGray(cv: Cv, src: CvMat): CvMat {
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  return gray;
}

/** Computes the Otsu threshold value for a grayscale image without mutating it. */
export function computeOtsuThreshold(cv: Cv, gray: CvMat): number {
  const dummy = new cv.Mat();
  try {
    return cv.threshold(gray, dummy, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
  } finally {
    dummy.delete();
  }
}
