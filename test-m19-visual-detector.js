/**
 * test-m19-visual-detector.js
 * Verification test suite for Milestone 19.1: Local Visual UI Element Detection Foundation
 */

const assert = require("assert");
const path = require("path");

console.log("============================================================");
console.log("RUNNING MILESTONE 19.1 LOCAL VISUAL UI DETECTOR VERIFICATION");
console.log("============================================================\n");

// Set up minimal browser environment mock for vision.bundle.js
global.window = global;
global.document = {
  createElement: (tag) => {
    return {
      width: 224,
      height: 224,
      getContext: () => ({
        putImageData: () => {},
        drawImage: () => {},
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
      })
    };
  }
};
global.chrome = {
  runtime: {
    getURL: (p) => path.resolve(__dirname, p)
  }
};

require("./lib/vision.bundle.js");

// [TEST 1] Interface & Exports Check
console.log("[TEST 1] Checking window.SIHVision exports");
assert.strictEqual(typeof window.SIHVision, "object", "window.SIHVision must be defined");
assert.strictEqual(typeof window.SIHVision.extractVisualDetections, "function", "extractVisualDetections must be a function");
console.log("  ✓ window.SIHVision.extractVisualDetections correctly exported\n");

// Helper to construct synthetic UI images with known shapes
function createSyntheticUIPage(width = 224, height = 224) {
  const data = new Uint8ClampedArray(width * height * 4);
  // Neutral light-gray background (245, 245, 245)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 245;
    data[i + 1] = 245;
    data[i + 2] = 245;
    data[i + 3] = 255;
  }

  function drawBox(x, y, w, h, r, g, b, borderR = null, borderG = null, borderB = null) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 4;
          const isBorder = (dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1);
          if (isBorder && borderR !== null) {
            data[idx] = borderR;
            data[idx + 1] = borderG;
            data[idx + 2] = borderB;
          } else {
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
          }
        }
      }
    }
  }

  // 1. Container / Card (x=20, y=20, w=180, h=180)
  drawBox(20, 20, 180, 180, 255, 255, 255, 200, 200, 200);

  // 2. Input Field inside card (x=35, y=45, w=150, h=26)
  drawBox(35, 45, 150, 26, 250, 250, 250, 160, 160, 160);

  // 3. Primary Button (x=35, y=90, w=80, h=30)
  drawBox(35, 90, 80, 30, 24, 119, 242, 16, 90, 190);

  // 4. Chip / Tag (x=125, y=95, w=44, h=20)
  drawBox(125, 95, 44, 20, 225, 235, 248, 170, 195, 230);

  return { data, width, height };
}

// [TEST 2] Output Schema Validation
console.log("[TEST 2] Validating M19.1 output schema");
const testImg = createSyntheticUIPage();
const detections = window.SIHVision.extractVisualDetections(testImg);

assert(Array.isArray(detections), "Detections must be an array");
assert(detections.length > 0, "Detector should detect candidates in synthetic UI page");

const VALID_SUBTYPES = new Set(["button-like", "input-like", "card-like", "chip-like", "region"]);

detections.forEach((d, idx) => {
  assert.strictEqual(d.type, "visual-region", `Item ${idx} type must be 'visual-region'`);
  assert(VALID_SUBTYPES.has(d.subtype), `Item ${idx} subtype '${d.subtype}' must be valid`);
  assert.strictEqual(d.source, "local-visual-detector", `Item ${idx} source must be 'local-visual-detector'`);
  assert(typeof d.confidence === "number" && d.confidence >= 0.0 && d.confidence <= 1.0, `Item ${idx} confidence must be in [0, 1]`);
  assert(d.bbox && typeof d.bbox === "object", `Item ${idx} must contain bbox`);
  assert(typeof d.bbox.x === "number" && typeof d.bbox.y === "number", `Item ${idx} bbox must have numeric x, y`);
  assert(typeof d.bbox.width === "number" && typeof d.bbox.height === "number", `Item ${idx} bbox must have numeric width, height`);
  assert(d.bbox.width > 0 && d.bbox.height > 0, `Item ${idx} bbox must have positive dimensions`);
});
console.log(`  ✓ All ${detections.length} detections strictly conform to M19.1 visual-region schema\n`);

// [TEST 3] Subtype Differentiation
console.log("[TEST 3] Verifying subtype candidate classification");
const subtypesFound = new Set(detections.map(d => d.subtype));
console.log("  Detected subtypes:", Array.from(subtypesFound).join(", "));
assert(subtypesFound.has("button-like") || subtypesFound.has("input-like") || subtypesFound.has("card-like"), "Should identify primary UI element subtypes");
console.log("  ✓ Subtype differentiation functioning as expected\n");

// [TEST 4] Robustness against Malformed / Empty Inputs
console.log("[TEST 4] Checking input safety (fail-closed, no errors)");
assert.deepStrictEqual(window.SIHVision.extractVisualDetections(null), []);
assert.deepStrictEqual(window.SIHVision.extractVisualDetections(undefined), []);
assert.deepStrictEqual(window.SIHVision.extractVisualDetections({}), []);
assert.deepStrictEqual(window.SIHVision.extractVisualDetections({ width: 5, height: 5, data: new Uint8ClampedArray(100) }), []);
console.log("  ✓ Null, undefined, empty, and undersized inputs safely return []\n");

// [TEST 5] Determinism Verification
console.log("[TEST 5] Verifying 100% deterministic reproducibility");
const runA = window.SIHVision.extractVisualDetections(testImg);
const runB = window.SIHVision.extractVisualDetections(testImg);
assert.deepStrictEqual(runA, runB, "Identical inputs must produce identical outputs bit-for-bit");
console.log("  ✓ Determinism verified: two successive runs produced identical detection structures\n");

// [TEST 6] Exclusion Regions / Agent Overlay Handling
console.log("[TEST 6] Verifying exclusion regions / agent overlay ignoring");
const buttonCand = detections.find(d => d.subtype === "button-like") || detections[0];
const overlayBbox = {
  x: buttonCand.bbox.x - 2,
  y: buttonCand.bbox.y - 2,
  width: buttonCand.bbox.width + 4,
  height: buttonCand.bbox.height + 4
};
const filteredDetections = window.SIHVision.extractVisualDetections(testImg, { overlayBbox });
const matchedExcluded = filteredDetections.find(d => {
  const xO = Math.max(0, Math.min(d.bbox.x + d.bbox.width, overlayBbox.x + overlayBbox.width) - Math.max(d.bbox.x, overlayBbox.x));
  const yO = Math.max(0, Math.min(d.bbox.y + d.bbox.height, overlayBbox.y + overlayBbox.height) - Math.max(d.bbox.y, overlayBbox.y));
  return (xO * yO) > 0.6 * (d.bbox.width * d.bbox.height);
});
assert.strictEqual(matchedExcluded, undefined, "Element in exclusion region must be ignored");
console.log("  ✓ Exclusion region correctly ignored\n");

// [TEST 7] Bounded Limits on Detection Count
console.log("[TEST 7] Verifying detection count limits");
const limited = window.SIHVision.extractVisualDetections(testImg, { limit: 2 });
assert.strictEqual(limited.length, Math.min(2, detections.length));
console.log(`  ✓ Output limit enforced cleanly (requested 2, got ${limited.length})\n`);

// [TEST 8] Performance Benchmark
console.log("[TEST 8] Execution latency benchmark");
const t0 = performance.now();
for (let i = 0; i < 20; i++) {
  window.SIHVision.extractVisualDetections(testImg);
}
const avgMs = (performance.now() - t0) / 20;
console.log(`  ✓ Average execution time over 20 iterations: ${avgMs.toFixed(2)} ms (well within extension threshold)`);
assert(avgMs < 35, "Detection must be fast (< 35 ms)");

console.log("\n============================================================");
console.log("ALL MILESTONE 19.1 VISUAL DETECTOR TESTS PASSED CLEANLY!");
console.log("============================================================\n");
