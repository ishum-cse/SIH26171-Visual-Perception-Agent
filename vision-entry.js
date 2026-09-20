/**
 * vision-entry.js - Milestone 9: On-device Visual Perception Foundation
 * 
 * Uses on-device ONNX Runtime Web (WASM) to run computer vision models directly in
 * the browser context without sending raw screenshots or pixels to any cloud server.
 * 
 * Technical Architecture & Contracts:
 * 1. Active Classification Model: squeezenet1.1-7.onnx (4.95 MB)
 *    - Input: Tensor "data", shape [1, 3, 224, 224], Float32, NCHW, ImageNet mean/std normalized
 *    - Output: Tensor "squeezenet0_flatten0_reshape0", shape [1, 1000] logits -> stable softmax
 * 
 * 2. Pluggable UI Object Detection Model Contract (ui-detector.onnx):
 *    - Expected Filename: "ui-detector.onnx" (in extension root or lib/)
 *    - Input: Tensor "images", shape [1, 3, 640, 640] or [1, 3, 320, 320], Float32 RGB [0, 1]
 *    - Output: Tensor "output0", shape [1, num_anchors, 6] -> [x, y, w, h, conf, class_id]
 *    - Classes: ["button", "input", "link", "text", "icon", "checkbox", "select"]
 * 
 * Privacy & Security Guarantees:
 * - 100% on-device WebAssembly execution.
 * - Zero network exfiltration of raw visual pixels or screenshots.
 */

import * as ort from "onnxruntime-web";

// Configure WASM asset resolution within Chrome Extension MV3
ort.env.wasm.wasmPaths = chrome.runtime.getURL("lib/");
ort.env.wasm.numThreads = 1; // Strict single-threading for extension popup environment
ort.env.wasm.proxy = false;

let session = null;
let sessionLoadingPromise = null;
let activeModelName = "squeezenet1.1-7.onnx";

/**
 * Loads the local ONNX vision model inside the browser.
 * Caches the compiled InferenceSession to avoid redundant compilations.
 * 
 * @returns {Promise<ort.InferenceSession>}
 */
async function loadVisionModel() {
    if (session) return session;
    if (sessionLoadingPromise) return sessionLoadingPromise;

    sessionLoadingPromise = (async () => {
        try {
            console.log(`[SIH26171][VISION] Loading local ONNX model: ${activeModelName}...`);
            const modelUrl = chrome.runtime.getURL(activeModelName);
            
            session = await ort.InferenceSession.create(
                modelUrl,
                {
                    executionProviders: ["wasm"]
                }
            );

            console.log(`[SIH26171][VISION] Model loaded successfully: ${activeModelName} (Execution Provider: wasm)`);
            sessionLoadingPromise = null;
            return session;
        } catch (err) {
            console.warn(`[SIH26171][VISION] Primary model load notice (${err.message}). Falling back to DOM perception`);
            sessionLoadingPromise = null;
            throw err;
        }
    })();

    return sessionLoadingPromise;
}

/**
 * Preprocesses visual image data into a normalized Float32 NCHW tensor.
 * Standard ImageNet normalization: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225].
 * 
 * @param {ImageData|HTMLCanvasElement|Image} imageData 
 * @param {number} size 
 * @returns {ort.Tensor}
 */
function preprocessVisualInput(imageData, size = 224) {
    let pixels;
    if (imageData && imageData.data && imageData.width === size && imageData.height === size) {
        pixels = imageData.data;
    } else {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (imageData instanceof ImageData) {
            ctx.putImageData(imageData, 0, 0);
        } else if (imageData && (imageData.width || imageData.naturalWidth)) {
            ctx.drawImage(imageData, 0, 0, size, size);
        }
        pixels = ctx.getImageData(0, 0, size, size).data;
    }

    const input = new Float32Array(1 * 3 * size * size);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    const channelSize = size * size;

    for (let i = 0; i < channelSize; i++) {
        const pixel = i * 4;
        const r = pixels[pixel] / 255;
        const g = pixels[pixel + 1] / 255;
        const b = pixels[pixel + 2] / 255;

        input[i] = (r - mean[0]) / std[0];
        input[channelSize + i] = (g - mean[1]) / std[1];
        input[2 * channelSize + i] = (b - mean[2]) / std[2];
    }

    return new ort.Tensor("float32", input, [1, 3, size, size]);
}

/**
 * Milestone 19.1: Deterministic, lightweight browser-local visual UI region detector.
 * Detects visually distinguishable rectangular UI regions using lightweight image processing
 * (edge contrast, rectangular contours, connected-component fill regions, and aspect ratio cues).
 *
 * Produces visual evidence candidates: button-like, input-like, card-like, chip-like, region
 * (Visual evidence only; not semantically guaranteed).
 *
 * Output format:
 * {
 *   type: "visual-region",
 *   subtype: "button-like" | "input-like" | "card-like" | "chip-like" | "region",
 *   bbox: { x, y, width, height },
 *   confidence: number,
 *   source: "local-visual-detector",
 *   label: string
 * }
 *
 * @param {ImageData|HTMLCanvasElement|Object} imageData 
 * @param {Object} [options={}] - Optional detector configuration (scale, viewport, exclusions)
 * @returns {Array<Object>} Array of visual detection descriptors
 */
function extractVisualDetections(imageData, options = {}) {
    if (!imageData) return [];

    let pixels = null;
    let width = 0;
    let height = 0;

    if (imageData.data && typeof imageData.width === "number" && typeof imageData.height === "number") {
        pixels = imageData.data;
        width = imageData.width;
        height = imageData.height;
    } else if (typeof document !== "undefined" && imageData && (
        typeof imageData.getContext === "function" ||
        (typeof HTMLCanvasElement !== "undefined" && imageData instanceof HTMLCanvasElement) ||
        (typeof HTMLImageElement !== "undefined" && imageData instanceof HTMLImageElement)
    )) {
        try {
            const canvas = document.createElement("canvas");
            width = imageData.width || imageData.naturalWidth || 224;
            height = imageData.height || imageData.naturalHeight || 224;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(imageData, 0, 0, width, height);
                const imgData = ctx.getImageData(0, 0, width, height);
                pixels = imgData.data;
            }
        } catch (_) {
            return [];
        }
    }

    if (!pixels || width < 16 || height < 16) return [];

    const totalPixels = width * height;

    // Coordinate scaling parameters (preserves coordinate system compatibility)
    const scaleX = (options.scaleX && options.scaleX > 0)
        ? options.scaleX
        : ((options.viewport && options.viewport.width && width > 0) ? options.viewport.width / width : 1.0);
    const scaleY = (options.scaleY && options.scaleY > 0)
        ? options.scaleY
        : ((options.viewport && options.viewport.height && height > 0) ? options.viewport.height / height : 1.0);

    // M18 Agent overlay and custom region exclusion
    const excludeRegions = Array.isArray(options.excludeRegions)
        ? options.excludeRegions
        : (options.overlayBbox ? [options.overlayBbox] : []);

    // 1. Grayscale luminance buffer (fast integer weighting)
    const gray = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
        const p = i * 4;
        gray[i] = (pixels[p] * 77 + pixels[p + 1] * 150 + pixels[p + 2] * 29) >> 8;
    }

    // 2. Spatial edge gradients for horizontal and vertical boundaries
    const edgeH = new Uint8Array(totalPixels);
    const edgeV = new Uint8Array(totalPixels);

    // Sensitive edge threshold (>= 8) to capture subtle borders (e.g. Google search bar, light buttons)
    for (let y = 1; y < height - 1; y++) {
        const rowOffset = y * width;
        for (let x = 1; x < width - 1; x++) {
            const idx = rowOffset + x;
            const dy = Math.abs(gray[idx + width] - gray[idx - width]);
            const dx = Math.abs(gray[idx + 1] - gray[idx - 1]);
            if (dy >= 8) edgeH[idx] = dy;
            if (dx >= 8) edgeV[idx] = dx;
        }
    }

    const rawCandidates = [];

    // Helper: test if candidate intersects with any excluded region (e.g. agent overlay)
    const isExcluded = (bx, by, bw, bh) => {
        if (excludeRegions.length === 0) return false;
        for (let exIdx = 0; exIdx < excludeRegions.length; exIdx++) {
            const ex = excludeRegions[exIdx];
            if (!ex) continue;
            const exX = Math.round(ex.x / scaleX);
            const exY = Math.round(ex.y / scaleY);
            const exW = Math.round(ex.width / scaleX);
            const exH = Math.round(ex.height / scaleY);
            const xO = Math.max(0, Math.min(bx + bw, exX + exW) - Math.max(bx, exX));
            const yO = Math.max(0, Math.min(by + bh, exY + exH) - Math.max(by, exY));
            if (xO > 0 && yO > 0 && (xO * yO) > 0.40 * (bw * bh)) {
                return true;
            }
        }
        return false;
    };

    // 3. Scan horizontal edge segments
    const minSegLen = Math.max(8, Math.round(width * 0.04));
    const hSegments = [];
    for (let y = 1; y < height - 1; y++) {
        let startX = -1;
        let gap = 0;
        const rowOffset = y * width;

        for (let x = 1; x < width - 1; x++) {
            if (edgeH[rowOffset + x] > 0) {
                if (startX === -1) startX = x;
                gap = 0;
            } else if (startX !== -1) {
                gap++;
                if (gap > 4 || x === width - 2) {
                    const endX = x - gap;
                    const len = endX - startX + 1;
                    if (len >= minSegLen) {
                        hSegments.push({ y, x1: startX, x2: endX, len });
                    }
                    startX = -1;
                    gap = 0;
                }
            }
        }
    }

    // 4. Scan vertical edge segments
    const minVSegLen = Math.max(4, Math.round(height * 0.02));
    const vSegments = [];
    for (let x = 1; x < width - 1; x++) {
        let startY = -1;
        let gap = 0;

        for (let y = 1; y < height - 1; y++) {
            if (edgeV[y * width + x] > 0) {
                if (startY === -1) startY = y;
                gap = 0;
            } else if (startY !== -1) {
                gap++;
                if (gap > 4 || y === height - 2) {
                    const endY = y - gap;
                    const len = endY - startY + 1;
                    if (len >= minVSegLen) {
                        vSegments.push({ x, y1: startY, y2: endY, len });
                    }
                    startY = -1;
                    gap = 0;
                }
            }
        }
    }

    // 5. Match horizontal & vertical edge segments into rectangular boundaries
    let edgePairCount = 0;
    const maxSegmentPairs = Math.min(hSegments.length, 160);
    for (let i = 0; i < maxSegmentPairs; i++) {
        const top = hSegments[i];
        for (let j = i + 1; j < maxSegmentPairs; j++) {
            const bottom = hSegments[j];
            const h = bottom.y - top.y;
            // Height threshold: from 4px up to 90% of image height
            if (h < 4 || h > height * 0.90) continue;

            const overlapX1 = Math.max(top.x1, bottom.x1);
            const overlapX2 = Math.min(top.x2, bottom.x2);
            const w = overlapX2 - overlapX1;

            if (w < minSegLen || w > width * 0.95) continue;

            // Allow corner tolerance (rounded corners, search pills)
            const maxDiffX = Math.max(8, Math.round(w * 0.15));
            const leftAligned = Math.abs(top.x1 - bottom.x1) <= maxDiffX;
            const rightAligned = Math.abs(top.x2 - bottom.x2) <= maxDiffX;

            if (leftAligned && rightAligned) {
                const bx = Math.min(top.x1, bottom.x1);
                const by = top.y;
                const bw = Math.max(top.x2, bottom.x2) - bx;
                const bh = h;

                if (isExcluded(bx, by, bw, bh)) continue;

                // Check vertical edge continuity
                let hasLeftV = false;
                let hasRightV = false;

                for (let vIdx = 0; vIdx < vSegments.length; vIdx++) {
                    const v = vSegments[vIdx];
                    if (!hasLeftV && Math.abs(v.x - bx) <= 6 && v.y1 <= by + 6 && v.y2 >= by + bh - 6) {
                        hasLeftV = true;
                    }
                    if (!hasRightV && Math.abs(v.x - (bx + bw)) <= 6 && v.y1 <= by + 6 && v.y2 >= by + bh - 6) {
                        hasRightV = true;
                    }
                    if (hasLeftV && hasRightV) break;
                }

                const aspectRatio = bw / bh;
                let subtype = "region";

                if (bw >= width * 0.25 && bh >= height * 0.20 && aspectRatio >= 0.4 && aspectRatio <= 3.5) {
                    subtype = "card-like";
                } else if (aspectRatio >= 3.0 && bw >= Math.round(width * 0.20) && bh >= 5 && bh <= 45) {
                    subtype = "input-like";
                } else if (bw <= 120 && bh <= 35 && aspectRatio >= 1.0 && aspectRatio <= 5.5) {
                    subtype = "button-like";
                } else if (bw <= 75 && bh <= 18 && aspectRatio >= 1.0 && aspectRatio <= 4.0) {
                    subtype = "chip-like";
                }

                const edgeCompleteness = (hasLeftV ? 0.15 : 0) + (hasRightV ? 0.15 : 0);
                const conf = Math.min(0.98, Math.max(0.55, 0.60 + edgeCompleteness + (subtype !== "region" ? 0.08 : 0)));

                rawCandidates.push({
                    type: "visual-region",
                    subtype,
                    label: `${subtype.replace("-", " ")}`,
                    bbox: {
                        x: Math.round(bx * scaleX),
                        y: Math.round(by * scaleY),
                        width: Math.round(bw * scaleX),
                        height: Math.round(bh * scaleY)
                    },
                    confidence: Math.round(conf * 100) / 100,
                    source: "local-visual-detector"
                });
                edgePairCount++;
            }
        }
    }

    // 6. Connected component filled region & contrast box detector (solid buttons, chips, badges, inputs)
    let fillRegionCount = 0;
    const blockSize = Math.max(2, Math.min(4, Math.floor(Math.min(width, height) / 50)));
    const gridW = Math.floor(width / blockSize);
    const gridH = Math.floor(height / blockSize);
    const gridLum = new Float32Array(gridW * gridH);

    for (let gy = 0; gy < gridH; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
            let sumLum = 0;
            let count = 0;
            const startX = gx * blockSize;
            const startY = gy * blockSize;

            for (let dy = 0; dy < blockSize && (startY + dy) < height; dy++) {
                for (let dx = 0; dx < blockSize && (startX + dx) < width; dx++) {
                    const idx = ((startY + dy) * width + (startX + dx)) * 4;
                    sumLum += (pixels[idx] * 77 + pixels[idx + 1] * 150 + pixels[idx + 2] * 29) >> 8;
                    count++;
                }
            }
            gridLum[gy * gridW + gx] = count > 0 ? sumLum / count : 0;
        }
    }

    const visited = new Uint8Array(gridW * gridH);
    const queueX = new Int32Array(gridW * gridH);
    const queueY = new Int32Array(gridW * gridH);
    const maxDiff = 15.0;

    for (let gy = 0; gy < gridH; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
            const startIdx = gy * gridW + gx;
            if (visited[startIdx]) continue;

            const baseLum = gridLum[startIdx];
            let head = 0;
            let tail = 0;
            queueX[tail] = gx;
            queueY[tail] = gy;
            tail++;
            visited[startIdx] = 1;

            let minX = gx;
            let maxX = gx;
            let minY = gy;
            let maxY = gy;
            let cellCount = 0;

            while (head < tail) {
                const cx = queueX[head++];
                cellCount++;

                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (queueY[head - 1] < minY) minY = queueY[head - 1];
                if (queueY[head - 1] > maxY) maxY = queueY[head - 1];

                const cy = queueY[head - 1];
                const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];

                for (let n = 0; n < 4; n++) {
                    const nx = neighbors[n][0];
                    const ny = neighbors[n][1];
                    if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
                        const nIdx = ny * gridW + nx;
                        if (!visited[nIdx]) {
                            if (Math.abs(gridLum[nIdx] - baseLum) <= maxDiff) {
                                visited[nIdx] = 1;
                                queueX[tail] = nx;
                                queueY[tail] = ny;
                                tail++;
                            }
                        }
                    }
                }
            }

            const bx = minX * blockSize;
            const by = minY * blockSize;
            const bw = (maxX - minX + 1) * blockSize;
            const bh = (maxY - minY + 1) * blockSize;
            const rectangularity = (cellCount * blockSize * blockSize) / Math.max(1, bw * bh);

            // Sensitive size thresholds (minimum width 10px, height 4px)
            if (bw < 10 || bh < 4) continue;
            if (bw >= width * 0.95 && bh >= height * 0.95) continue;
            if (rectangularity < 0.45) continue;
            if (isExcluded(bx, by, bw, bh)) continue;

            // Measure boundary contrast against outer perimeter
            let outerSum = 0;
            let outerCount = 0;
            for (let x = Math.max(0, minX - 1); x <= Math.min(gridW - 1, maxX + 1); x++) {
                if (minY > 0) { outerSum += gridLum[(minY - 1) * gridW + x]; outerCount++; }
                if (maxY < gridH - 1) { outerSum += gridLum[(maxY + 1) * gridW + x]; outerCount++; }
            }
            for (let y = minY; y <= maxY; y++) {
                if (minX > 0) { outerSum += gridLum[y * gridW + (minX - 1)]; outerCount++; }
                if (maxX < gridW - 1) { outerSum += gridLum[y * gridW + (maxX + 1)]; outerCount++; }
            }

            const avgOuter = outerCount > 0 ? outerSum / outerCount : 128;
            const contrast = Math.abs(baseLum - avgOuter);

            // Check perimeter edge gradient (enables subtle bordered elements with matching interior fill to pass)
            let borderEdgeSum = 0;
            let borderEdgeCount = 0;
            for (let x = bx; x < bx + bw && x < width; x += 2) {
                if (by > 0) { borderEdgeSum += edgeH[by * width + x]; borderEdgeCount++; }
                if (by + bh < height) { borderEdgeSum += edgeH[(by + bh - 1) * width + x]; borderEdgeCount++; }
            }
            const avgBorderEdge = borderEdgeCount > 0 ? borderEdgeSum / borderEdgeCount : 0;

            // Sensitive threshold: either luminance contrast >= 5 OR perimeter edge gradient >= 5
            if (contrast < 5 && avgBorderEdge < 5) continue;

            const aspectRatio = bw / bh;
            let subtype = "region";

            if (bw >= width * 0.25 && bh >= height * 0.20 && aspectRatio >= 0.4 && aspectRatio <= 3.5) {
                subtype = "card-like";
            } else if (aspectRatio >= 3.0 && bw >= Math.round(width * 0.20) && bh >= 5 && bh <= 45) {
                subtype = "input-like";
            } else if (bw <= 120 && bh <= 35 && aspectRatio >= 1.0 && aspectRatio <= 5.5) {
                subtype = "button-like";
            } else if (bw <= 75 && bh <= 18 && aspectRatio >= 1.0 && aspectRatio <= 4.0) {
                subtype = "chip-like";
            }

            const signalStrength = Math.max(contrast / 50.0, avgBorderEdge / 30.0);
            const conf = Math.min(0.98, Math.max(0.50, 0.50 + Math.min(0.30, signalStrength) + (rectangularity > 0.70 ? 0.10 : 0) + (subtype !== "region" ? 0.08 : 0)));

            rawCandidates.push({
                type: "visual-region",
                subtype,
                label: `${subtype.replace("-", " ")}`,
                bbox: {
                    x: Math.round(bx * scaleX),
                    y: Math.round(by * scaleY),
                    width: Math.round(bw * scaleX),
                    height: Math.round(bh * scaleY)
                },
                confidence: Math.round(conf * 100) / 100,
                source: "local-visual-detector"
            });
            fillRegionCount++;
        }
    }

    // 7. Non-Maximum Suppression (NMS) & Deduplication
    rawCandidates.sort((a, b) => b.confidence - a.confidence);
    const deduplicated = [];

    for (let cIdx = 0; cIdx < rawCandidates.length; cIdx++) {
        const cand = rawCandidates[cIdx];
        let duplicate = false;

        for (let kIdx = 0; kIdx < deduplicated.length; kIdx++) {
            const kept = deduplicated[kIdx];
            const xOverlap = Math.max(0, Math.min(cand.bbox.x + cand.bbox.width, kept.bbox.x + kept.bbox.width) - Math.max(cand.bbox.x, kept.bbox.x));
            const yOverlap = Math.max(0, Math.min(cand.bbox.y + cand.bbox.height, kept.bbox.y + kept.bbox.height) - Math.max(cand.bbox.y, kept.bbox.y));
            const intersectionArea = xOverlap * yOverlap;

            if (intersectionArea > 0) {
                const areaA = cand.bbox.width * cand.bbox.height;
                const areaB = kept.bbox.width * kept.bbox.height;
                const iou = intersectionArea / (areaA + areaB - intersectionArea);
                const ioMin = intersectionArea / Math.min(areaA, areaB);

                // Deduplicate if IoU > 0.40 or if one box is substantially contained inside another (ioMin > 0.70)
                if (iou > 0.40 || ioMin > 0.70) {
                    duplicate = true;
                    break;
                }
            }
        }

        if (!duplicate) {
            deduplicated.push(cand);
        }
    }

    // 8. Bounded limit to prevent context explosion (sensible ceiling of 30)
    const maxLimit = (typeof options.limit === "number" && options.limit > 0) ? options.limit : 30;
    const finalDetections = deduplicated.slice(0, maxLimit);

    // Diagnostic console telemetry for real-world validation
    console.log(`[SIH26171][VISION-DETECTOR] Input dimensions: ${width}x${height}`);
    console.log(`[SIH26171][VISION-DETECTOR] Edge segments: ${hSegments.length} H, ${vSegments.length} V`);
    console.log(`[SIH26171][VISION-DETECTOR] Raw candidates generated: ${rawCandidates.length} (paired edges: ${edgePairCount}, filled regions: ${fillRegionCount})`);
    console.log(`[SIH26171][VISION-DETECTOR] Detections after NMS deduplication: ${finalDetections.length}`);

    return finalDetections;
}

/**
 * Runs on-device visual inference and returns structured detections and classification.
 * 
 * @param {ImageData|HTMLCanvasElement} imageData - Resized image or canvas
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Detection results, classification, latency and execution provider
 */
async function runVisionInference(imageData, options = {}) {
    const t0 = performance.now();
    console.log("[SIH26171][VISION] Inference started");

    const model = await loadVisionModel();
    const size = 224;
    const tensor = preprocessVisualInput(imageData, size);
    const inputName = model.inputNames[0];

    const results = await model.run({
        [inputName]: tensor
    });

    const outputName = model.outputNames[0];
    const output = results[outputName].data;

    let bestIndex = 0;
    let maxLogit = -Infinity;

    for (let i = 0; i < output.length; i++) {
        if (output[i] > output[bestIndex]) {
            bestIndex = i;
        }
        if (output[i] > maxLogit) {
            maxLogit = output[i];
        }
    }

    // Numerically stable softmax for bounded probabilities [0, 1]
    let sumExp = 0;
    for (let i = 0; i < output.length; i++) {
        sumExp += Math.exp(output[i] - maxLogit);
    }
    const topProb = sumExp > 0 ? (Math.exp(output[bestIndex] - maxLogit) / sumExp) : 0;
    const boundedConfidence = Math.max(0.0, Math.min(1.0, topProb));

    // Extract visual detections from visual representation
    const detections = extractVisualDetections(imageData, options);
    const latencyMs = Math.round(performance.now() - t0);

    console.log(`[SIH26171][VISION] Inference completed in ${latencyMs} ms (Top Class: ${bestIndex}, Confidence: ${(boundedConfidence * 100).toFixed(1)}%)`);
    console.log(`[SIH26171][VISION] Visual detections: ${detections.length}`);
    console.log(`[SIH26171][VISION] Detector handoff: ${detections.length} detections`);

    return {
        classIndex: bestIndex,
        confidence: boundedConfidence,
        executionProvider: "wasm",
        modelName: activeModelName,
        detections: detections,
        visualDetections: detections,
        latencyMs: latencyMs,
        status: "completed"
    };
}

if (typeof window !== "undefined") {
    window.SIHVision = {
        loadVisionModel,
        runVisionInference,
        preprocessVisualInput,
        extractVisualDetections
    };
}
if (typeof globalThis !== "undefined") {
    globalThis.SIHVision = {
        loadVisionModel,
        runVisionInference,
        preprocessVisualInput,
        extractVisualDetections
    };
}