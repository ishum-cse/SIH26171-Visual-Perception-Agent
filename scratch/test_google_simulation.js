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
const extractVisualDetections = window.SIHVision.extractVisualDetections;

// Synthesize a 224x224 image simulating Google homepage:
// White background (255, 255, 255)
// Google Search input bar centered:
// In 1920x1080: search bar is ~580px wide, ~44px high at (670, 350).
// In 224x224: x ~ 65, y ~ 70, w ~ 94, h ~ 10.
// Border: #dfe1e5 (gray ~223). Inside: #ffffff (gray 255).
// Buttons: 'Google Search' and 'I\'m Feeling Lucky' at y ~ 90, h ~ 8, w ~ 32 and 38.
// Sign in button: top right at x ~ 185, y ~ 8, w ~ 26, h ~ 8, fill #1a73e8 (~100).

const width = 224;
const height = 224;
const data = new Uint8ClampedArray(width * height * 4);

// Fill white
for (let i = 0; i < width * height; i++) {
    data[i*4] = 255;
    data[i*4+1] = 255;
    data[i*4+2] = 255;
    data[i*4+3] = 255;
}

// Helper to draw rect
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

const results = extractVisualDetections({ data, width, height });
console.log('Final detection count on Google homepage simulation:', results.length);
console.log('Detected elements:');
results.forEach((r, idx) => {
    console.log('  [' + (idx+1) + '] subtype=' + r.subtype + ' bbox=' + JSON.stringify(r.bbox) + ' conf=' + r.confidence + ' source=' + r.source);
});
