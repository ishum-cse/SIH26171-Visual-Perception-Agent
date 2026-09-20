global.window = global;
global.document = {
  createElement: (tag) => ({
    width: 224, height: 224,
    getContext: () => ({
      putImageData: () => {}, drawImage: () => {},
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
    })
  })
};
global.chrome = { runtime: { getURL: (p) => p } };

require("../lib/vision.bundle.js");
require("../perception-fusion.js");

console.log("============================================================");
console.log("TESTING DETECTOR-TO-FUSION HANDOFF AND SPATIAL CONFIRMATION");
console.log("============================================================\n");

// 1. Simulate Google homepage screenshot (224x224)
const width = 224, height = 224;
const data = new Uint8ClampedArray(width * height * 4);
data.fill(255);

function drawBorderedRect(rx, ry, rw, rh, borderColor, fillColor) {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const idx = (y * width + x) * 4;
      const isBorder = (y === ry || y === ry + rh - 1 || x === rx || x === rx + rw - 1);
      const col = isBorder ? borderColor : fillColor;
      data[idx] = col[0];
      data[idx+1] = col[1];
      data[idx+2] = col[2];
    }
  }
}

// 1. Google search box (pill/rect with #dfe1e5 border)
drawBorderedRect(65, 70, 94, 10, [223, 225, 229], [255, 255, 255]);
// 2. Google Search button (#f8f9fa fill with subtle border)
drawBorderedRect(75, 90, 32, 8, [218, 220, 224], [248, 249, 250]);
// 3. I'm Feeling Lucky button (#f8f9fa fill)
drawBorderedRect(115, 90, 38, 8, [218, 220, 224], [248, 249, 250]);
// 4. Sign in button (#1a73e8 blue fill)
drawBorderedRect(185, 8, 26, 8, [26, 115, 232], [26, 115, 232]);

// Step 1: Detector
const tabViewport = { width: 1280, height: 800 };
const scaleX = tabViewport.width / 224;
const scaleY = tabViewport.height / 224;

const rawDetections = window.SIHVision.extractVisualDetections({ data, width, height }, {
  viewport: tabViewport,
  scaleX,
  scaleY
});
console.log(`[HANDOFF STEP 1] Detector: ${rawDetections.length} detections\n`);

// Step 2: Popup vision result
const visionResult = {
  classIndex: 21,
  confidence: 0.95,
  executionProvider: "wasm",
  modelName: "squeezenet1.1-7.onnx",
  detections: rawDetections,
  visualDetections: rawDetections,
  latencyMs: 35,
  status: "completed"
};
console.log(`[HANDOFF STEP 2] Popup vision result: ${visionResult.detections.length} detections\n`);

// Step 3 & 4: DOM Elements & Fusion
// Synthesize Google DOM elements on 1280x800 page:
const domElements = [
  { index: 0, label: "Search", type: "input", x: Math.round(65 * scaleX), y: Math.round(70 * scaleY), width: Math.round(94 * scaleX), height: Math.round(10 * scaleY), isVisible: true },
  { index: 1, label: "Google Search", type: "button", x: Math.round(75 * scaleX), y: Math.round(90 * scaleY), width: Math.round(32 * scaleX), height: Math.round(8 * scaleY), isVisible: true },
  { index: 2, label: "I'm Feeling Lucky", type: "button", x: Math.round(115 * scaleX), y: Math.round(90 * scaleY), width: Math.round(38 * scaleX), height: Math.round(8 * scaleY), isVisible: true },
  { index: 3, label: "Sign in", type: "button", x: Math.round(185 * scaleX), y: Math.round(8 * scaleY), width: Math.round(26 * scaleX), height: Math.round(8 * scaleY), isVisible: true },
  { index: 4, label: "About", type: "link", x: 20, y: 770, width: 40, height: 20, isVisible: true }
];

console.log(`[HANDOFF STEP 3] Calling buildLocalPerception with ${domElements.length} DOM elements and visionResult:`);
const fusedPerception = window.SIHFusion.buildLocalPerception(domElements, visionResult, {}, 0, null);

console.log(`\n[HANDOFF STEP 4] Fusion output:`);
const confirmedElements = fusedPerception.fusedElements.filter(e => e.isVisualConfirmed);
console.log(`  Total fused elements: ${fusedPerception.fusedElements.length}`);
console.log(`  Visually confirmed elements: ${confirmedElements.length}`);
confirmedElements.forEach((el) => {
  console.log(`    ✓ Confirmed [${el.label}]: score=${el.fusedConfidence}, method=${el.groundingMethod}`);
});

const assert = require('assert');
assert.strictEqual(fusedPerception.visualDetections.length, rawDetections.length, "All detector regions must reach perception object");
assert.ok(confirmedElements.length >= 3, "At least 3 visual elements must be confirmed on Google layout");
console.log("\n============================================================");
console.log("HANDOFF VERIFICATION SUCCESSFUL: DETECTIONS FULLY PRESERVED!");
console.log("============================================================");
