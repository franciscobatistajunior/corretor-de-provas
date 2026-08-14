/**
 * One-time (re-run whenever the generator's layout changes) calibration
 * script: opens the real gerador-de-gabarito HTML in headless Chromium,
 * one preset at a time, and reads getBoundingClientRect() of the 8 physical
 * markers and every A-E bubble. This measures the ACTUAL rendered geometry
 * instead of hand-deriving it from the CSS box model (which is fragile —
 * a hand calculation done during planning for this project already produced
 * two slightly different numbers for the column pitch).
 *
 * Output: src/lib/sheetLayout.data.ts, consumed by src/lib/sheetLayout.ts.
 *
 * Run with: npm run calibrate
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SheetPresetLayout, SheetMarkers } from "../src/lib/sheetLayout.types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sibling project — see the plan for why the generator's HTML is the source
// of truth for sheet geometry instead of re-deriving it by hand.
const GENERATOR_HTML_PATH = path.resolve(
  __dirname,
  "../../gerador-de-gabarito/gerador-de-gabarito/index.html"
);

const OUTPUT_PATH = path.resolve(__dirname, "../src/lib/sheetLayout.data.ts");

const PRESETS = [5, 8, 10, 20, 30, 50] as const;

// A4 printable content area (page size 210x297mm minus the @page 10mm
// margin on every side), converted to CSS px at the fixed 96px/inch ratio
// CSS always uses regardless of print DPI: 25.4mm / 96px = 1in.
const PX_PER_MM = 96 / 25.4;
const CONTENT_WIDTH_MM = 210 - 20;
const CONTENT_HEIGHT_MM = 297 - 20;
const VIEWPORT_WIDTH = Math.round(CONTENT_WIDTH_MM * PX_PER_MM);
const VIEWPORT_HEIGHT = Math.round(CONTENT_HEIGHT_MM * PX_PER_MM);

const MEASURE_SHEET_SCRIPT = `
(function () {
  function rectCenterPx(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function markerEl(selector) {
    var el = document.querySelector(selector);
    if (!el) throw new Error("Marcador não encontrado: " + selector);
    return rectCenterPx(el);
  }

  var markers = {
    cornerTopLeft: markerEl(".corner-top-left"),
    cornerTopRight: markerEl(".corner-top-right"),
    cornerBottomLeft: markerEl(".corner-bottom-left"),
    cornerBottomRight: markerEl(".corner-bottom-right"),
    midTop: markerEl(".marker-mid-top"),
    midBottom: markerEl(".marker-mid-bottom"),
    midLeft: markerEl(".marker-mid-left"),
    midRight: markerEl(".marker-mid-right")
  };

  var letters = ["A", "B", "C", "D", "E"];
  var questionItems = Array.from(document.querySelectorAll(".question-item"));
  var questions = questionItems.map(function (item, index) {
    var bubbleEls = Array.from(item.querySelectorAll(".alt"));
    return {
      question: index + 1,
      bubbles: bubbleEls.map(function (el, letterIndex) {
        var center = rectCenterPx(el);
        return { letter: letters[letterIndex], x: center.x, y: center.y };
      })
    };
  });

  return { markers: markers, questions: questions };
})()
`;

interface PxPoint {
  x: number;
  y: number;
}

interface MeasuredSheet {
  markers: Record<keyof SheetMarkers, PxPoint>;
  questions: { question: number; bubbles: { letter: string; x: number; y: number }[] }[];
}

function toMm(px: number): number {
  return Math.round((px / PX_PER_MM) * 100) / 100;
}

async function main() {
  if (!existsSync(GENERATOR_HTML_PATH)) {
    throw new Error(
      `Não encontrei o gerador de gabarito em ${GENERATOR_HTML_PATH}. ` +
        `Ajuste GENERATOR_HTML_PATH em scripts/calibrateSheetLayout.ts se o projeto foi movido.`
    );
  }

  console.log(`Abrindo ${GENERATOR_HTML_PATH} (viewport ${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}px)...`);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
  });
  await page.goto(pathToFileURL(GENERATOR_HTML_PATH).href, { timeout: 15000 });
  console.log("Página carregada.");

  const layouts: Record<number, SheetPresetLayout> = {};

  for (const preset of PRESETS) {
    // The controls panel (including #questionCount) is hidden by the
    // print stylesheet (`.panel:not(.preview-card) { display: none }`), so
    // the select must be interacted with under screen media, then switched
    // to print media just for measuring the sheet.
    await page.emulateMedia({ media: "screen" });
    await page.selectOption("#questionCount", String(preset));
    await page.emulateMedia({ media: "print" });
    // handleGenerate() runs synchronously off the 'change' event, but give
    // layout a tick to settle before measuring.
    await page.waitForTimeout(50);

    // Passed as a raw string (not a TS function reference) so it reaches
    // the page untouched by esbuild/tsx — a compiled function reference
    // here gets an esbuild-injected `__name(...)` helper call baked into
    // its source that only exists in this file's own module scope, and
    // Playwright's evaluate() serializes just the function body via
    // toString(), which throws `ReferenceError: __name is not defined`
    // once it runs standalone inside the page.
    const measured = await page.evaluate<MeasuredSheet>(MEASURE_SHEET_SCRIPT);

    const toMarkerPoint = (p: PxPoint) => ({ xMm: toMm(p.x), yMm: toMm(p.y) });

    layouts[preset] = {
      totalQuestions: preset,
      markers: {
        cornerTopLeft: toMarkerPoint(measured.markers.cornerTopLeft),
        cornerTopRight: toMarkerPoint(measured.markers.cornerTopRight),
        cornerBottomLeft: toMarkerPoint(measured.markers.cornerBottomLeft),
        cornerBottomRight: toMarkerPoint(measured.markers.cornerBottomRight),
        midTop: toMarkerPoint(measured.markers.midTop),
        midBottom: toMarkerPoint(measured.markers.midBottom),
        midLeft: toMarkerPoint(measured.markers.midLeft),
        midRight: toMarkerPoint(measured.markers.midRight),
      },
      questions: measured.questions.map((q) => ({
        question: q.question,
        bubbles: q.bubbles.map((b) => ({ letter: b.letter, xMm: toMm(b.x), yMm: toMm(b.y) })),
      })),
    };

    console.log(`Preset ${preset}: ${measured.questions.length} questões medidas.`);
  }

  await browser.close();

  const fileContents = `// GERADO AUTOMATICAMENTE por scripts/calibrateSheetLayout.ts — não edite à mão.
// Rode \`npm run calibrate\` de novo se o layout do gerador-de-gabarito mudar.
import type { SheetPresetLayout } from "./sheetLayout.types";

export const SHEET_PRESET_LAYOUTS: Record<number, SheetPresetLayout> = ${JSON.stringify(
    layouts,
    null,
    2
  )};
`;

  await writeFile(OUTPUT_PATH, fileContents, "utf-8");
  console.log(`\nEscrito em ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
