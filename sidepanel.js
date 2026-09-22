/**
 * sidepanel.js - Dedicated Side Panel Controller for SIH 2026 Visual Perception Agent
 *
 * ARCHITECTURAL CONTRACT:
 * Single Source of Truth: All agent perception, OCR, SqueezeNet vision classification,
 * DOM fusion, task planning, grounding, safety gate, execution, and verification logic
 * reside centrally in popup.js.
 *
 * This file serves as the dedicated side-panel entry point, initializing any
 * side-panel-specific lifecycle listeners and telemetry while delegating the full agent workflow
 * to popup.js to eliminate logic divergence.
 */

(() => {
  "use strict";

  console.log("[SIH26171] Side Panel container initialized (persistent on-device agent)");

  // Marker indicating the agent is running in Chrome Side Panel context
  window.isSidePanel = true;

  // Track active tab changes to log context awareness when user switches tabs
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      console.log("[SIH26171][SIDEPANEL] Active browser tab changed:", activeInfo.tabId);
    });
  }
})();
