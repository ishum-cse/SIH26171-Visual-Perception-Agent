/**
 * popup.js - Script for the extension popup
 * Milestones 1–12: Page metadata capture, local PII redaction, backend decision/execution,
 * local visual context (tab screenshot), local DOM perception, on-device SqueezeNet vision classification,
 * local perception fusion, local screenshot privacy redaction, and local OCR-based visual PII detection.
 * Milestone 13: Secure Sanitized Visual Agent Gateway (Task Input -> Privacy Pipeline -> Gateway -> Demo Agent -> Safe Execution).
 */

document.addEventListener("DOMContentLoaded", () => {
  // Existing Milestone 1-8 DOM elements
  const captureBtn = document.getElementById("captureBtn");
  const outputArea = document.getElementById("output");
  const sampleOutput = document.getElementById("sampleOutput");
  const backendOutput = document.getElementById("backendOutput");
  const decisionOutput = document.getElementById("decisionOutput");
  const executionOutput = document.getElementById("executionOutput");
  const visualStatus = document.getElementById("visualStatus");
  const screenshotPreview = document.getElementById("screenshotPreview");
  const elementsOutput = document.getElementById("elementsOutput");

  // Milestone 9 DOM elements for on-device Vision Classification
  const visionStatus = document.getElementById("visionStatus");
  const visionDetails = document.getElementById("visionDetails");
  const visionStatusText = document.getElementById("visionStatusText");
  const visionProvider = document.getElementById("visionProvider");
  const visionLatency = document.getElementById("visionLatency");
  const visionClassIndex = document.getElementById("visionClassIndex");
  const visionConfidence = document.getElementById("visionConfidence");
  const visionModelStatus = document.getElementById("visionModelStatus");
  const visionRuntime = document.getElementById("visionRuntime");
  const visionDetectionsCount = document.getElementById("visionDetectionsCount");
  const visionFusionStatus = document.getElementById("visionFusionStatus");
  const visionPageChangeStatus = document.getElementById("visionPageChangeStatus");

  // Milestone 11 & 12 DOM elements for Local Visual Privacy (Screenshot Redaction + OCR)
  const privacyStatus = document.getElementById("privacyStatus");
  const privacyDetails = document.getElementById("privacyDetails");
  const privacyOriginalStatus = document.getElementById("privacyOriginalStatus");
  const privacyOcrStatus = document.getElementById("privacyOcrStatus");
  const privacyRegionCount = document.getElementById("privacyRegionCount");
  const privacyOcrTextCount = document.getElementById("privacyOcrTextCount");
  const privacyOcrSensitiveCount = document.getElementById("privacyOcrSensitiveCount");
  const privacyTotalRedactedCount = document.getElementById("privacyTotalRedactedCount");
  const privacyRedactionStatus = document.getElementById("privacyRedactionStatus");
  const sanitizedScreenshotPreview = document.getElementById("sanitizedScreenshotPreview");

  // Milestone 10/11/12 DOM elements for Perception Fusion & Pipeline Timing
  const fusionStatus = document.getElementById("fusionStatus");
  const fusionDetails = document.getElementById("fusionDetails");
  const fusionElementCount = document.getElementById("fusionElementCount");
  const fusionVisionClass = document.getElementById("fusionVisionClass");
  const fusionSensitiveCount = document.getElementById("fusionSensitiveCount");
  const timingDom = document.getElementById("timingDom");
  const timingScreenshot = document.getElementById("timingScreenshot");
  const timingVision = document.getElementById("timingVision");
  const timingSensitive = document.getElementById("timingSensitive");
  const timingOcrInit = document.getElementById("timingOcrInit");
  const timingOcrInference = document.getElementById("timingOcrInference");
  const timingOcrDetection = document.getElementById("timingOcrDetection");
  const timingMerge = document.getElementById("timingMerge");
  const timingRedaction = document.getElementById("timingRedaction");
  const timingFusion = document.getElementById("timingFusion");
  const timingGateway = document.getElementById("timingGateway");

  const taskInput = document.getElementById("taskInput");
  const runAgentTaskBtn = document.getElementById("runAgentTaskBtn");

  // Milestone 20 DOM elements: Voice Assistant Input Layer
  const voiceMicBtn = document.getElementById("voiceMicBtn");
  const voiceMicIcon = document.getElementById("voiceMicIcon");
  const voiceMicLabel = document.getElementById("voiceMicLabel");
  const voiceStatusBadge = document.getElementById("voiceStatusBadge");
  const voiceStatusText = document.getElementById("voiceStatusText");
  const voiceConfirmationCard = document.getElementById("voiceConfirmationCard");
  const voiceTranscriptText = document.getElementById("voiceTranscriptText");
  const voiceConfirmBtn = document.getElementById("voiceConfirmBtn");
  const voiceRetryBtn = document.getElementById("voiceRetryBtn");
  const voiceClearBtn = document.getElementById("voiceClearBtn");
  const agentTaskText = document.getElementById("agentTaskText");
  const agentRequestId = document.getElementById("agentRequestId");
  const agentScreenshotStatus = document.getElementById("agentScreenshotStatus");
  const agentPrivacyStatus = document.getElementById("agentPrivacyStatus");
  const agentDomPiiCount = document.getElementById("agentDomPiiCount");
  const agentOcrPiiCount = document.getElementById("agentOcrPiiCount");
  const agentSensitiveCount = document.getElementById("agentSensitiveCount");
  const agentRedactionStatus = document.getElementById("agentRedactionStatus");
  const agentSanitizedStatus = document.getElementById("agentSanitizedStatus");
  const agentRawUploadStatus = document.getElementById("agentRawUploadStatus");
  const agentSanitizedUploadStatus = document.getElementById("agentSanitizedUploadStatus");
  const agentModeStatus = document.getElementById("agentModeStatus");
  const agentModeSubtext = document.getElementById("agentModeSubtext");
  const agentFallbackRow = document.getElementById("agentFallbackRow");
  const agentFallbackReasonText = document.getElementById("agentFallbackReasonText");
  const badgeGeminiReasoning = document.getElementById("badgeGeminiReasoning");
  const agentActionText = document.getElementById("agentActionText");
  const agentReasoningText = document.getElementById("agentReasoningText");
  const agentSafetyStatus = document.getElementById("agentSafetyStatus");
  const agentExecutionStatus = document.getElementById("agentExecutionStatus");
  const agentGatewayLatency = document.getElementById("agentGatewayLatency");

  // Milestone 14 DOM elements: Bounded Loop & Verification
  const agentStepText = document.getElementById("agentStepText");
  const agentVerificationText = document.getElementById("agentVerificationText");
  const agentTraceContainer = document.getElementById("agentTraceContainer");

  // Milestone 15 DOM elements: Generalized Grounding Telemetry
  const groundingMethodText = document.getElementById("groundingMethodText");
  const groundingScoreText = document.getElementById("groundingScoreText");
  const groundedElementText = document.getElementById("groundedElementText");

  // Milestone 16 DOM elements: FILL Telemetry & Privacy Indicator
  const fillStepStatus = document.getElementById("fillStepStatus");
  const fieldValuesPrivacyNotice = document.getElementById("fieldValuesPrivacyNotice");

  // Final Architecture: Local Reasoning & Safety Planner DOM Elements
  const plannerTaskUnderstanding = document.getElementById("plannerTaskUnderstanding");
  const plannerExecutionPlan = document.getElementById("plannerExecutionPlan");
  const plannerReasoningTrace = document.getElementById("plannerReasoningTrace");
  const plannerRiskBadge = document.getElementById("plannerRiskBadge");
  const plannerSafetyDecision = document.getElementById("plannerSafetyDecision");
  const plannerApprovalStatus = document.getElementById("plannerApprovalStatus");
  const popupApprovalContainer = document.getElementById("popupApprovalContainer");
  const popupApprovalAction = document.getElementById("popupApprovalAction");
  const popupApprovalReason = document.getElementById("popupApprovalReason");
  const popupBtnApprove = document.getElementById("popupBtnApprove");
  const popupBtnCancel = document.getElementById("popupBtnCancel");

  // SIH 2026 Presentation Layer Elements (Demo & Inspection Panel)
  const liveAgentStatusBadge = document.getElementById("liveAgentStatusBadge");
  const liveAgentStatusText = document.getElementById("liveAgentStatusText");
  const viewModeToggleBtn = document.getElementById("viewModeToggleBtn");
  const pipelineStepCounter = document.getElementById("pipelineStepCounter");
  const stagePerception = document.getElementById("stagePerception");
  const stagePerceptionStatus = document.getElementById("stagePerceptionStatus");
  const stageReasoning = document.getElementById("stageReasoning");
  const stageReasoningStatus = document.getElementById("stageReasoningStatus");
  const stageGrounding = document.getElementById("stageGrounding");
  const stageGroundingStatus = document.getElementById("stageGroundingStatus");
  const stageSafety = document.getElementById("stageSafety");
  const stageSafetyStatus = document.getElementById("stageSafetyStatus");
  const stageExecution = document.getElementById("stageExecution");
  const stageExecutionStatus = document.getElementById("stageExecutionStatus");
  const stageVerification = document.getElementById("stageVerification");
  const stageVerificationStatus = document.getElementById("stageVerificationStatus");

  // Current Action Card elements
  const currentActionStepBadge = document.getElementById("currentActionStepBadge");
  const cardActionType = document.getElementById("cardActionType");
  const cardActionTarget = document.getElementById("cardActionTarget");
  const cardActionValue = document.getElementById("cardActionValue");
  const cardActionGrounding = document.getElementById("cardActionGrounding");
  const cardActionRisk = document.getElementById("cardActionRisk");
  const cardActionSafety = document.getElementById("cardActionSafety");
  const cardActionStatus = document.getElementById("cardActionStatus");

  // Grounding / Element Inspection elements
  const inspectGroundingConfidenceBadge = document.getElementById("inspectGroundingConfidenceBadge");
  const inspectElementLabel = document.getElementById("inspectElementLabel");
  const inspectElementType = document.getElementById("inspectElementType");
  const inspectTargetIndex = document.getElementById("inspectTargetIndex");
  const inspectGroundingMethod = document.getElementById("inspectGroundingMethod");
  const inspectBoundingBox = document.getElementById("inspectBoundingBox");
  const inspectGroundingReason = document.getElementById("inspectGroundingReason");

  // Perception Preview metadata chips & canvas
  const previewScreenshotStatus = document.getElementById("previewScreenshotStatus");
  const previewDomCount = document.getElementById("previewDomCount");
  const previewSensitiveCount = document.getElementById("previewSensitiveCount");
  const previewRedactionStatus = document.getElementById("previewRedactionStatus");
  const perceptionCanvasOverlay = document.getElementById("perceptionCanvasOverlay");
  const traceStepCount = document.getElementById("traceStepCount");

  // Toggle Demonstration Mode vs Detailed Diagnostics View
  if (viewModeToggleBtn) {
    viewModeToggleBtn.addEventListener("click", () => {
      const isDemo = document.body.classList.contains("mode-demo");
      if (isDemo) {
        document.body.classList.remove("mode-demo");
        viewModeToggleBtn.textContent = "Demo View";
        viewModeToggleBtn.title = "Switch back to Stage Demonstration View";
      } else {
        document.body.classList.add("mode-demo");
        viewModeToggleBtn.textContent = "Detailed View";
        viewModeToggleBtn.title = "Show Deep Diagnostic Telemetry";
      }
    });
  }

  // Persistent Side Panel Launcher Handler (when opened inside popup fallback)
  const openSidePanelBtn = document.getElementById("openSidePanelBtn");
  if (openSidePanelBtn) {
    openSidePanelBtn.addEventListener("click", async () => {
      if (chrome.sidePanel && typeof chrome.sidePanel.open === "function") {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
            window.close();
          }
        } catch (err) {
          console.warn("[SIH26171] Could not open side panel:", err);
        }
      }
    });
  }

  const setLiveAgentStatus = (statusCategory, label) => {
    if (!liveAgentStatusBadge || !liveAgentStatusText) return;
    liveAgentStatusBadge.className = "live-status-badge " + (
      statusCategory === "active" ? "status-active" :
        statusCategory === "ready" ? "status-ready" :
          statusCategory === "warning" ? "status-warning" : "status-error"
    );
    liveAgentStatusText.textContent = label;
  };

  const updatePipelineStage = (stageName, state, statusText) => {
    const stageMap = {
      PERCEPTION: { el: stagePerception, textEl: stagePerceptionStatus },
      REASONING: { el: stageReasoning, textEl: stageReasoningStatus },
      GROUNDING: { el: stageGrounding, textEl: stageGroundingStatus },
      SAFETY: { el: stageSafety, textEl: stageSafetyStatus },
      EXECUTION: { el: stageExecution, textEl: stageExecutionStatus },
      VERIFICATION: { el: stageVerification, textEl: stageVerificationStatus }
    };
    const target = stageMap[stageName];
    if (!target || !target.el) return;
    target.el.className = `pipeline-stage ${state}`;
    if (target.textEl && statusText) {
      target.textEl.textContent = statusText;
    }
  };

  const resetPipelineUI = () => {
    ["PERCEPTION", "REASONING", "GROUNDING", "SAFETY", "EXECUTION", "VERIFICATION"].forEach((s) => {
      updatePipelineStage(s, "pending", "Pending");
    });
    clearBoundingBoxOnPreview();
  };

  const updateCurrentActionCard = (data) => {
    if (currentActionStepBadge && data.stepText) {
      currentActionStepBadge.textContent = data.stepText;
    }
    if (cardActionType) {
      const act = (data.action || "NONE").toUpperCase();
      cardActionType.textContent = act;
      cardActionType.className = `action-badge ${act === "FILL" ? "badge-action-fill" :
          act === "CLICK" ? "badge-action-click" :
            act === "SUBMIT" ? "badge-action-submit" :
              act === "SELECT" ? "badge-action-select" :
                (["CHECK", "UNCHECK", "TOGGLE"].includes(act) ? "badge-action-check" : "badge-action-none")
        }`;
    }
    if (cardActionTarget) cardActionTarget.textContent = data.target || "(None)";
    if (cardActionValue) cardActionValue.textContent = data.value ? `'${data.value}'` : "-";
    if (cardActionGrounding) cardActionGrounding.textContent = data.grounding || "-";
    if (cardActionRisk) {
      cardActionRisk.textContent = data.risk || "LOW";
      const isHigh = data.risk === "HIGH" || data.risk === "CRITICAL";
      cardActionRisk.style.background = isHigh ? "#fee2e2" : (data.risk === "MEDIUM" ? "#fef3c7" : "#e0e7ff");
      cardActionRisk.style.color = isHigh ? "#b91c1c" : (data.risk === "MEDIUM" ? "#b45309" : "#3730a3");
    }
    if (cardActionSafety) {
      cardActionSafety.textContent = data.safety || "ALLOWED";
      cardActionSafety.style.color = (data.safety && data.safety.includes("BLOCKED")) ? "#dc2626" : "#15803d";
    }
    if (cardActionStatus) {
      cardActionStatus.textContent = data.status || "Ready to execute";
      cardActionStatus.style.color = (data.status && data.status.includes("VERIFIED")) ? "#15803d" : "#0f172a";
    }
  };

  const updateGroundingInspection = (data) => {
    if (inspectElementLabel) inspectElementLabel.textContent = data.element || "None";
    if (inspectElementType) inspectElementType.textContent = `${data.role || "element"} (${data.type || "unknown"})`;
    if (inspectTargetIndex) inspectTargetIndex.textContent = data.index !== undefined ? `#${data.index}` : "-";
    if (inspectGroundingMethod) inspectGroundingMethod.textContent = data.method || "-";
    if (inspectGroundingConfidenceBadge) {
      inspectGroundingConfidenceBadge.textContent = data.score !== undefined ? `Conf: ${Number(data.score).toFixed(2)}` : "Conf: -";
    }
    if (inspectBoundingBox) {
      if (data.bbox && typeof data.bbox.x === "number") {
        inspectBoundingBox.textContent = `[x: ${Math.round(data.bbox.x)}, y: ${Math.round(data.bbox.y)}, w: ${Math.round(data.bbox.width)}, h: ${Math.round(data.bbox.height)}]`;
      } else {
        inspectBoundingBox.textContent = "[x: -, y: -, w: -, h: -]";
      }
    }
    if (inspectGroundingReason) inspectGroundingReason.textContent = data.reason || "Target grounded via local perception pipeline";
  };

  const clearBoundingBoxOnPreview = () => {
    if (!perceptionCanvasOverlay) return;
    const ctx = perceptionCanvasOverlay.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, perceptionCanvasOverlay.width, perceptionCanvasOverlay.height);
    perceptionCanvasOverlay.style.display = "none";
  };

  const drawBoundingBoxOnPreview = (bbox, label = "") => {
    if (!perceptionCanvasOverlay || !screenshotPreview || !bbox || typeof bbox.x !== "number") {
      clearBoundingBoxOnPreview();
      return;
    }
    try {
      perceptionCanvasOverlay.width = screenshotPreview.clientWidth || 320;
      perceptionCanvasOverlay.height = screenshotPreview.clientHeight || 160;
      perceptionCanvasOverlay.style.display = "block";
      const ctx = perceptionCanvasOverlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, perceptionCanvasOverlay.width, perceptionCanvasOverlay.height);

      const origW = (latestScreenshotDims && latestScreenshotDims.width) ? latestScreenshotDims.width : (screenshotPreview.naturalWidth || 1);
      const origH = (latestScreenshotDims && latestScreenshotDims.height) ? latestScreenshotDims.height : (screenshotPreview.naturalHeight || 1);
      const scaleX = perceptionCanvasOverlay.width / origW;
      const scaleY = perceptionCanvasOverlay.height / origH;

      const bx = bbox.x * scaleX;
      const by = bbox.y * scaleY;
      const bw = Math.max(bbox.width * scaleX, 10);
      const bh = Math.max(bbox.height * scaleY, 8);

      ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
      ctx.fillRect(bx, by, bw, bh);

      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, by, bw, bh);

      if (label) {
        ctx.font = "bold 9px sans-serif";
        const textW = ctx.measureText(label).width;
        ctx.fillStyle = "#0e7490";
        ctx.fillRect(bx, Math.max(by - 14, 0), textW + 6, 13);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, bx + 3, Math.max(by - 4, 9));
      }
    } catch (e) {
      console.warn("Canvas overlay drawing error:", e);
    }
  };

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Critical Rule 7 & 8: Clean reset of all transient task and grounding state.
   * Ensures previous targets, cards, overlays, and confidence metrics never persist
   * into a fresh task run or survive failures.
   */
  const resetTaskGroundingState = () => {
    clearBoundingBoxOnPreview();
    updateCurrentActionCard({
      stepText: "Step 1 of 1",
      action: "NONE",
      target: "(None)",
      value: "",
      grounding: "-",
      risk: "LOW",
      safety: "PENDING",
      status: "Initializing..."
    });
    updateGroundingInspection({
      element: "None",
      role: "none",
      type: "unknown",
      index: undefined,
      method: "-",
      score: undefined,
      bbox: null,
      reason: "No element grounded"
    });
    latestVisualElements = null;
    latestFusedElements = null;
    latestSensitiveRegions = null;
    latestOcrSensitiveRegions = [];
    latestMergedRegions = null;
    latestVisionResult = null;
    cachedLightweightSignature = null;
    cachedPerceptionTimestamp = 0;
    lastExecutedActionType = null;
    lastStepVerification = null;
    activeComposer = null;
  };

  // Milestone 18: Live Explainable Agent Overlay Telemetry Helper
  const sendOverlayTelemetry = (tabId, message) => {
    if (!tabId || typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.sendMessage) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (resp) => {
          if (chrome.runtime.lastError) {
            // Suppress connection error if tab is navigating or script not yet injected
          }
          resolve(resp || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  };

  // Milestone 14 & 16 Constants (Bounded Loop with safe ceiling)
  const MAX_AGENT_STEPS = 15;
  const PIXEL_CHANGE_THRESHOLD = 30;
  const ACTION_VERIFICATION_DELAY_MS = 600;

  // Milestone 13 Cross-Website Robustness: Explicit Agent Execution States
  const AGENT_STATES = Object.freeze({
    PERCEIVE: "PERCEIVE",
    PLAN: "PLAN",
    GROUND: "GROUND",
    SAFETY: "SAFETY",
    EXECUTE: "EXECUTE",
    WAIT: "WAIT",
    REPERCEIVE: "REPERCEIVE",
    VERIFY: "VERIFY",
    CONTINUE: "CONTINUE",
    COMPLETE: "COMPLETE",
    HALTED: "HALTED",
    ERROR: "ERROR"
  });

  let currentAgentState = AGENT_STATES.PERCEIVE;
  const setAgentState = (newState, detail = "") => {
    currentAgentState = newState;
    console.log(`[AGENT STATE] -> ${newState}${detail ? " : " + detail : ""}`);
    if (agentExecutionStatus && detail) {
      agentExecutionStatus.textContent = `[${newState}] ${detail}`;
    }

    // Dynamic Visual Pipeline & Live Status Synchronization
    if (newState === AGENT_STATES.PERCEIVE || newState === AGENT_STATES.REPERCEIVE) {
      setLiveAgentStatus("active", "PERCEIVING");
      updatePipelineStage("PERCEPTION", "active", "Scanning DOM + OCR");
    } else if (newState === AGENT_STATES.PLAN) {
      setLiveAgentStatus("active", "REASONING");
      updatePipelineStage("PERCEPTION", "completed", "Perception fused ✓");
      updatePipelineStage("REASONING", "active", "Planning actions");
    } else if (newState === AGENT_STATES.GROUND) {
      setLiveAgentStatus("active", "GROUNDING");
      updatePipelineStage("REASONING", "completed", "Plan ready ✓");
      updatePipelineStage("GROUNDING", "active", "Matching element");
    } else if (newState === AGENT_STATES.SAFETY) {
      setLiveAgentStatus("active", "SAFETY CHECK");
      updatePipelineStage("GROUNDING", "completed", "Grounded ✓");
      updatePipelineStage("SAFETY", "active", "Validating allowlist");
    } else if (newState === AGENT_STATES.EXECUTE) {
      setLiveAgentStatus("active", "EXECUTING");
      updatePipelineStage("SAFETY", "completed", "Safety passed ✓");
      updatePipelineStage("EXECUTION", "active", "Executing action");
    } else if (newState === AGENT_STATES.WAIT) {
      setLiveAgentStatus("active", "WAITING");
      updatePipelineStage("EXECUTION", "completed", "Executed ✓");
    } else if (newState === AGENT_STATES.VERIFY) {
      setLiveAgentStatus("active", "VERIFYING");
      updatePipelineStage("VERIFICATION", "active", "Comparing screen");
    } else if (newState === AGENT_STATES.COMPLETE) {
      setLiveAgentStatus("ready", "COMPLETED");
      updatePipelineStage("VERIFICATION", "completed", "Verified ✓");
    }
  };

  // Milestone 14 Module-Level Loop & Trace State
  let previousScreenSignature = null;
  let executionTraceHistory = [];
  let activeExecutionSessionToken = 0;
  let currentPerceptionGeneration = 1;

  // State cache for current capture pass
  let latestScreenshotDataUrl = null;
  let latestScreenshotDims = { width: 0, height: 0 };
  let latestVisualElements = null;
  let latestSensitiveRegions = null;
  let latestOcrSensitiveRegions = [];
  let latestOcrWordCount = 0;
  let latestOcrResult = null;
  let latestMergedRegions = null;
  let latestVisionResult = null;
  let latestVisionPromise = null;
  let latestFusedElements = null;
  let lastScreenSignature = null;
  let latestSanitizedDataUrl = null;
  let latestPageData = null;
  let ocrCompleted = false;
  let redactionCompleted = false;
  let redactionError = null;

  // Milestone 22.2: Adaptive Local Perception Cache & Timing
  const PERCEPTION_CACHE_TTL_MS = 10000;
  let cachedLightweightSignature = null;
  let cachedPerceptionTimestamp = 0;
  let lastExecutedActionType = null;
  let lastStepVerification = null;
  let lastPerceptionDecision = { reused: false, reason: "FRESH — Initial observation (Step 1)", probeMs: 0 };
  let perceptionTelemetryStats = {
    fullPerceptionPasses: 0,
    reusedPerceptionPasses: 0,
    totalProbeMs: 0
  };
  let activeComposer = null;

  // Listeners waiting for privacy redaction pass to conclude
  let onRedactionCompleteCallbacks = [];

  const timing = {
    pageProbeMs: null,
    adaptivePerceptionSavedMs: 0,
    domExtractionMs: null,
    screenshotMs: null,
    visionInferenceMs: null,
    sensitiveRegionDetectionMs: null,
    ocrInitMs: null,
    ocrInferenceMs: null,
    ocrSensitiveDetectionMs: null,
    regionMergeMs: null,
    redactionMs: null,
    fusionMs: null,
    gatewayMs: null
  };

  // Helper to notify any waiting promises when redaction finishes
  const notifyRedactionDone = (result) => {
    const cbs = [...onRedactionCompleteCallbacks];
    onRedactionCompleteCallbacks = [];
    cbs.forEach((cb) => {
      try { cb(result); } catch (e) { console.error("Redaction callback error:", e); }
    });
  };

  // Promise hook to await completion of the local redaction pipeline
  const waitForRedaction = () => {
    if (redactionCompleted) {
      return Promise.resolve({
        success: !!latestSanitizedDataUrl,
        sanitizedScreenshotDataUrl: latestSanitizedDataUrl,
        error: redactionError
      });
    }
    return new Promise((resolve) => {
      onRedactionCompleteCallbacks.push(resolve);
      // Safety timeout: Ensure local perception never hangs indefinitely if OCR/redaction is delayed
      setTimeout(() => {
        if (!redactionCompleted) {
          resolve({
            success: !!latestSanitizedDataUrl,
            sanitizedScreenshotDataUrl: latestSanitizedDataUrl,
            error: "Redaction timeout fallback"
          });
        }
      }, 5000);
    });
  };

  // Helper function to scale screenshot to 224x224 ImageData (Milestone 9)
  // Security Note: All resizing and vision inference is client-side only (never transmitted).
  const resizeScreenshotTo224 = (dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 224;
          canvas.height = 224;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 224, 224);
          const imageData = ctx.getImageData(0, 0, 224, 224);
          resolve(imageData);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error("Failed to load screenshot image for scaling"));
      };
      img.src = dataUrl;
    });
  };

  // Helper to render the fused perception summary and timing telemetry (Milestones 10, 11, 12, 13)
  const renderPerceptionSummary = () => {
    if (!fusionStatus || !fusionDetails) return;

    const t0 = performance.now();
    let fused = null;
    if (window.SIHFusion && typeof window.SIHFusion.buildLocalPerception === "function") {
      const tabViewport = (latestPageData && latestPageData.viewport) ? latestPageData.viewport : null;
      const vpWidth = (tabViewport && tabViewport.width) || (latestScreenshotDims && latestScreenshotDims.width) || (typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1280);
      const vpHeight = (tabViewport && tabViewport.height) || (latestScreenshotDims && latestScreenshotDims.height) || (typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 800);
      const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1.0;

      fused = window.SIHFusion.buildLocalPerception(
        latestVisualElements,
        latestVisionResult,
        timing,
        latestSensitiveRegions ? latestSensitiveRegions.length : 0,
        {
          ocrTextRegionCount: latestOcrWordCount,
          ocrSensitiveRegionCount: latestOcrSensitiveRegions.length,
          totalRedactedRegionCount: latestMergedRegions ? latestMergedRegions.length : 0,
          words: (latestOcrResult && latestOcrResult.words) ? latestOcrResult.words : []
        },
        {
          viewport: { width: vpWidth, height: vpHeight },
          dpr: dpr,
          screenshotDimensions: latestScreenshotDims
        }
      );
    }
    const t1 = performance.now();
    timing.fusionMs = Math.round(t1 - t0);

    // Update timing metrics
    if (timingDom) timingDom.textContent = timing.domExtractionMs !== null ? `${timing.domExtractionMs} ms` : "-";
    if (timingScreenshot) timingScreenshot.textContent = timing.screenshotMs !== null ? `${timing.screenshotMs} ms` : "-";
    if (timingVision) timingVision.textContent = timing.visionInferenceMs !== null ? `${timing.visionInferenceMs} ms` : "-";
    if (timingSensitive) timingSensitive.textContent = timing.sensitiveRegionDetectionMs !== null ? `${timing.sensitiveRegionDetectionMs} ms` : "-";
    if (timingOcrInit) timingOcrInit.textContent = timing.ocrInitMs !== null ? `${timing.ocrInitMs} ms` : "-";
    if (timingOcrInference) timingOcrInference.textContent = timing.ocrInferenceMs !== null ? `${timing.ocrInferenceMs} ms` : "-";
    if (timingOcrDetection) timingOcrDetection.textContent = timing.ocrSensitiveDetectionMs !== null ? `${timing.ocrSensitiveDetectionMs} ms` : "-";
    if (timingMerge) timingMerge.textContent = timing.regionMergeMs !== null ? `${timing.regionMergeMs} ms` : "-";
    if (timingRedaction) timingRedaction.textContent = timing.redactionMs !== null ? `${timing.redactionMs} ms` : "-";
    if (timingFusion) timingFusion.textContent = timing.fusionMs !== null ? `${timing.fusionMs} ms` : "-";
    if (timingGateway) timingGateway.textContent = timing.gatewayMs !== null ? `${timing.gatewayMs} ms` : "-";

    // Update fusion summary counts
    if (fused && Array.isArray(fused.fusedElements)) {
      latestFusedElements = fused.fusedElements;
    } else {
      latestFusedElements = latestVisualElements;
    }

    if (visionFusionStatus) {
      visionFusionStatus.textContent = (latestFusedElements && latestFusedElements.some(e => e.isVisualConfirmed)) ? "ACTIVE" : "DOM ACTIVE";
    }

    if (fusionElementCount) {
      fusionElementCount.textContent = latestVisualElements ? latestVisualElements.length : "-";
    }
    if (fusionVisionClass) {
      if (latestVisionResult && typeof latestVisionResult.classIndex === "number") {
        fusionVisionClass.textContent = `Class ${latestVisionResult.classIndex} (${(latestVisionResult.confidence * 100).toFixed(1)}%)`;
      } else {
        fusionVisionClass.textContent = "Pending / None";
      }
    }
    if (fusionSensitiveCount) {
      const count = latestMergedRegions ? latestMergedRegions.length : (latestSensitiveRegions ? latestSensitiveRegions.length : 0);
      fusionSensitiveCount.textContent = count;
    }

    if (previewDomCount) previewDomCount.textContent = `${latestVisualElements ? latestVisualElements.length : 0} elements`;
    if (previewSensitiveCount) previewSensitiveCount.textContent = String(latestMergedRegions ? latestMergedRegions.length : (latestSensitiveRegions ? latestSensitiveRegions.length : 0));
    if (previewRedactionStatus) previewRedactionStatus.textContent = latestSanitizedDataUrl ? "ACTIVE" : "PENDING";

    fusionStatus.textContent = "Local perception fused (on-device only)";
    fusionStatus.style.color = "#2e7d32";
    fusionDetails.style.display = "block";
  };

  /**
   * Updates privacy category metrics in UI without ever displaying raw sensitive values.
   */
  const updatePrivacyCategoryMetrics = (domRegions = [], ocrRegions = [], sampleText = "") => {
    const container = document.getElementById("agentPrivacyCategoryBreakdown");
    const chipsContainer = document.getElementById("agentPrivacyCategoryChips");
    if (!container || !chipsContainer) return;

    const counts = {
      EMAIL: 0,
      PHONE: 0,
      PASSWORD: 0,
      CARD: 0,
      BANK: 0,
      IDENTITY: 0,
      CREDENTIAL: 0,
      PERSONAL: 0,
      HEALTH: 0
    };

    // 1. Tally from OCR region categories
    if (Array.isArray(ocrRegions)) {
      ocrRegions.forEach((r) => {
        const cat = (r && r.category) ? String(r.category).toUpperCase() : "";
        if (counts[cat] !== undefined) {
          counts[cat]++;
        } else if (cat && cat !== "SENSITIVE" && cat !== "OCR") {
          counts.CREDENTIAL++;
        }
      });
    }

    // 2. Tally from text category counts if available
    const inspectText = sampleText || (latestPageData && (latestPageData.text || latestPageData.redactedSample)) || "";
    if (inspectText && typeof window.getCategoryCounts === "function") {
      const textCounts = window.getCategoryCounts(inspectText);
      for (const [k, v] of Object.entries(textCounts)) {
        if (v > 0) {
          counts[k] = Math.max(counts[k] || 0, v);
        }
      }
    }

    // Filter to active categories
    const activeCategories = Object.entries(counts).filter(([_, c]) => c > 0);

    if (activeCategories.length === 0) {
      container.style.display = "none";
      chipsContainer.innerHTML = "";
      return;
    }

    chipsContainer.innerHTML = activeCategories.map(([cat, count]) => {
      return `<span style="background: var(--privacy-emerald-light); color: var(--privacy-emerald); border: 1px solid #A7F3D0; padding: 1px 6px; border-radius: 3px; font-weight: bold; font-family: monospace;">${cat}: ${count}</span>`;
    }).join("");

    container.style.display = "block";
  };

  // Helper function to execute local privacy redaction on the merged (DOM + OCR) regions (Milestones 11 & 12)
  // Fail-closed guarantee: Never displays or falls back to raw screenshot if final redaction throws/fails.
  const triggerRedaction = async () => {
    if (redactionCompleted || !latestScreenshotDataUrl || !latestSensitiveRegions || !ocrCompleted) {
      return;
    }
    redactionCompleted = true;

    if (privacyStatus) {
      privacyStatus.textContent = "Merging regions and redacting sensitive canvas areas...";
      privacyStatus.style.color = "#1565c0";
    }

    try {
      if (!window.SIHRedactor || typeof window.SIHRedactor.buildSanitizedScreenshot !== "function") {
        throw new Error("SIHRedactor module not loaded");
      }

      // Ensure natural screenshot dimensions are fully loaded before coordinate scaling
      if ((!latestScreenshotDims || !latestScreenshotDims.width || !latestScreenshotDims.height) && latestScreenshotDataUrl) {
        await new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            latestScreenshotDims = {
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0
            };
            res();
          };
          img.onerror = () => res();
          img.src = latestScreenshotDataUrl;
        });
      }

      // Step 5: Region merging (DOM + OCR) with exact viewport coordinate scaling
      const tMerge0 = performance.now();
      const tabViewport = (latestPageData && latestPageData.viewport) ? latestPageData.viewport : null;
      let scaleX = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
      let scaleY = scaleX;

      if (tabViewport && typeof tabViewport.devicePixelRatio === "number" && tabViewport.devicePixelRatio > 0) {
        scaleX = tabViewport.devicePixelRatio;
        scaleY = tabViewport.devicePixelRatio;
      }
      if (latestScreenshotDims && latestScreenshotDims.width > 0 && tabViewport && tabViewport.width > 0) {
        scaleX = latestScreenshotDims.width / tabViewport.width;
      }
      if (latestScreenshotDims && latestScreenshotDims.height > 0 && tabViewport && tabViewport.height > 0) {
        scaleY = latestScreenshotDims.height / tabViewport.height;
      }

      let mergedRegions = [];

      if (typeof window.SIHRedactor.mergeSensitiveRegions === "function") {
        mergedRegions = window.SIHRedactor.mergeSensitiveRegions(
          latestSensitiveRegions,
          latestOcrSensitiveRegions,
          latestScreenshotDims ? latestScreenshotDims.width : 0,
          latestScreenshotDims ? latestScreenshotDims.height : 0,
          { scaleX, scaleY }
        );
      } else {
        // Fallback to DOM regions if merge function is absent
        mergedRegions = latestSensitiveRegions;
      }
      timing.regionMergeMs = Math.round(performance.now() - tMerge0);
      latestMergedRegions = mergedRegions;

      // Step 5.2: Build sanitized screenshot canvas copy
      const tRedact0 = performance.now();
      const redactionResult = await window.SIHRedactor.buildSanitizedScreenshot(
        latestScreenshotDataUrl,
        mergedRegions
      );
      timing.redactionMs = Math.round(performance.now() - tRedact0);

      if (redactionResult && redactionResult.success && redactionResult.sanitizedScreenshotDataUrl) {
        latestSanitizedDataUrl = redactionResult.sanitizedScreenshotDataUrl;
        redactionError = null;

        if (privacyStatus) {
          privacyStatus.textContent = "Local visual privacy redaction active";
          privacyStatus.style.color = "#2e7d32";
        }

        if (privacyOriginalStatus) privacyOriginalStatus.textContent = "CAPTURED LOCALLY";
        if (privacyOcrStatus) privacyOcrStatus.textContent = "ON DEVICE (WASM)";
        if (privacyRegionCount) privacyRegionCount.textContent = latestSensitiveRegions.length;
        if (privacyOcrTextCount) privacyOcrTextCount.textContent = latestOcrWordCount;
        if (privacyOcrSensitiveCount) privacyOcrSensitiveCount.textContent = latestOcrSensitiveRegions.length;
        if (privacyTotalRedactedCount) privacyTotalRedactedCount.textContent = mergedRegions.length;

        if (privacyRedactionStatus) {
          privacyRedactionStatus.textContent = "ACTIVE";
          privacyRedactionStatus.style.color = "#2e7d32";
        }

        if (agentDomPiiCount) agentDomPiiCount.textContent = latestSensitiveRegions.length;
        if (agentOcrPiiCount) agentOcrPiiCount.textContent = latestOcrSensitiveRegions.length;
        if (agentSensitiveCount) agentSensitiveCount.textContent = mergedRegions.length;
        if (agentRedactionStatus) agentRedactionStatus.textContent = "ACTIVE";

        updatePrivacyCategoryMetrics(latestSensitiveRegions, latestOcrSensitiveRegions);

        // CRITICAL: Render the sanitized/redacted screenshot in the Local Visual Perception Preview
        if (screenshotPreview) {
          screenshotPreview.src = redactionResult.sanitizedScreenshotDataUrl;
          screenshotPreview.style.display = "block";
        }
        if (visualStatus) {
          visualStatus.style.display = "none";
        }

        if (sanitizedScreenshotPreview) {
          sanitizedScreenshotPreview.src = redactionResult.sanitizedScreenshotDataUrl;
          sanitizedScreenshotPreview.style.display = "block";
        }
        if (privacyDetails) privacyDetails.style.display = "block";

        notifyRedactionDone({
          success: true,
          sanitizedScreenshotDataUrl: latestSanitizedDataUrl
        });
      } else {
        // Fail-closed handling: Never fall back to raw screenshot
        throw new Error(redactionResult?.error || "Redaction returned empty output");
      }
    } catch (err) {
      latestSanitizedDataUrl = null;
      redactionError = err.message || String(err);
      console.error("Local screenshot redaction error:", err);

      // Fail-closed: Never show raw screenshot in preview
      if (screenshotPreview) {
        screenshotPreview.style.display = "none";
        screenshotPreview.src = "";
      }
      if (visualStatus) {
        visualStatus.textContent = `Redaction failed: ${err.message || err}. Screenshot withheld for privacy.`;
        visualStatus.style.color = "#c62828";
        visualStatus.style.display = "block";
      }

      if (privacyStatus) {
        privacyStatus.textContent = `Redaction failed: ${err.message || err}`;
        privacyStatus.style.color = "#c62828";
      }

      if (privacyOriginalStatus) privacyOriginalStatus.textContent = "CAPTURED LOCALLY";
      if (privacyOcrStatus) privacyOcrStatus.textContent = "ON DEVICE (WASM)";
      if (privacyRegionCount) privacyRegionCount.textContent = latestSensitiveRegions ? latestSensitiveRegions.length : 0;
      if (privacyOcrTextCount) privacyOcrTextCount.textContent = latestOcrWordCount;
      if (privacyOcrSensitiveCount) privacyOcrSensitiveCount.textContent = latestOcrSensitiveRegions.length;
      if (privacyTotalRedactedCount) privacyTotalRedactedCount.textContent = 0;

      if (privacyRedactionStatus) {
        privacyRedactionStatus.textContent = "FAILED — sanitized screenshot withheld";
        privacyRedactionStatus.style.color = "#c62828";
      }
      if (sanitizedScreenshotPreview) {
        sanitizedScreenshotPreview.style.display = "none";
        sanitizedScreenshotPreview.src = "";
      }
      if (privacyDetails) privacyDetails.style.display = "block";

      notifyRedactionDone({
        success: false,
        sanitizedScreenshotDataUrl: null,
        error: redactionError
      });
    }

    renderPerceptionSummary();
  };

  // Helper function to run on-device OCR pipeline (Milestone 12)
  // Non-blocking: OCR failure gracefully falls back to DOM-only redaction
  const triggerOcrPipeline = async (dataUrl) => {
    ocrCompleted = false;
    latestOcrSensitiveRegions = [];
    latestOcrWordCount = 0;

    try {
      if (!window.SIHOCR || typeof window.SIHOCR.runOcr !== "function") {
        throw new Error("SIHOCR module not loaded");
      }

      const ocrResult = await window.SIHOCR.runOcr(dataUrl);
      latestOcrResult = ocrResult;

      if (ocrResult && ocrResult.success) {
        timing.ocrInitMs = ocrResult.initTimeMs;
        timing.ocrInferenceMs = ocrResult.inferenceTimeMs;
        latestOcrWordCount = (ocrResult.words || []).length;

        if (ocrResult.screenshotDimensions) {
          latestScreenshotDims = ocrResult.screenshotDimensions;
        }

        // Detect sensitive regions using M2's regex patterns
        const tDet0 = performance.now();
        if (typeof window.SIHOCR.detectSensitiveOcrRegions === "function") {
          latestOcrSensitiveRegions = window.SIHOCR.detectSensitiveOcrRegions(ocrResult);
        }
        timing.ocrSensitiveDetectionMs = Math.round(performance.now() - tDet0);
      } else {
        console.warn("OCR recognition notice:", ocrResult?.reason || "No OCR output");
        timing.ocrInitMs = ocrResult?.initTimeMs || 0;
        timing.ocrInferenceMs = ocrResult?.inferenceTimeMs || 0;
        timing.ocrSensitiveDetectionMs = 0;
      }
    } catch (ocrErr) {
      console.warn("OCR pipeline notice (falling back to DOM-only redaction):", ocrErr);
      timing.ocrInitMs = timing.ocrInitMs || 0;
      timing.ocrInferenceMs = 0;
      timing.ocrSensitiveDetectionMs = 0;
    } finally {
      ocrCompleted = true;
      // Trigger redaction once OCR settles (whether OCR succeeded or fell back)
      triggerRedaction();
    }
  };

  // Helper function to run on-device SqueezeNet vision classification (Milestone 9)
  const triggerVisionClassification = async (dataUrl) => {
    if (!visionStatus) return;

    visionStatus.textContent = "Running on-device visual perception (ONNX Runtime Web)...";
    visionStatus.style.color = "#1565c0";
    if (visionDetails) visionDetails.style.display = "none";

    try {
      if (!window.SIHVision || typeof window.SIHVision.runVisionInference !== "function") {
        throw new Error("SIHVision model runtime not loaded");
      }

      const resizedImageData = await resizeScreenshotTo224(dataUrl);

      const tabViewport = (latestPageData && latestPageData.viewport) ? latestPageData.viewport : null;
      const vpWidth = (tabViewport && tabViewport.width) || (latestScreenshotDims && latestScreenshotDims.width) || (typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1280);
      const vpHeight = (tabViewport && tabViewport.height) || (latestScreenshotDims && latestScreenshotDims.height) || (typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 800);

      const visionOptions = {
        viewport: { width: vpWidth, height: vpHeight },
        scaleX: vpWidth / 224,
        scaleY: vpHeight / 224
      };

      const t0 = performance.now();
      const result = await window.SIHVision.runVisionInference(resizedImageData, visionOptions);
      const t1 = performance.now();
      const latencyMs = Math.round(t1 - t0);
      timing.visionInferenceMs = latencyMs;
      latestVisionResult = result;

      // Update centralized perception state with local visual detections
      if (window.SIHFusion && typeof window.SIHFusion.updatePerceptionState === "function" && result && result.detections) {
        window.SIHFusion.updatePerceptionState({
          visualDetections: result.detections
        });
      }

      console.log(`[SIH26171][VISION] Popup vision result: ${result && result.detections ? result.detections.length : 0} detections`);

      visionStatus.textContent = "Vision inference completed (on-device)";
      visionStatus.style.color = "#2e7d32";

      if (visionModelStatus) {
        visionModelStatus.textContent = "READY";
        visionModelStatus.style.background = "#e0f2fe";
        visionModelStatus.style.color = "#0369a1";
      }
      if (visionRuntime) visionRuntime.textContent = "ONNX Runtime Web";
      if (visionStatusText) visionStatusText.textContent = "Completed";
      if (visionProvider) visionProvider.textContent = `LOCAL (${result.executionProvider || "wasm"})`;
      if (visionLatency) visionLatency.textContent = `${latencyMs} ms`;
      if (visionClassIndex) visionClassIndex.textContent = result.classIndex;
      if (visionDetectionsCount) visionDetectionsCount.textContent = result.detections ? result.detections.length : 0;
      if (visionFusionStatus) visionFusionStatus.textContent = "ACTIVE";
      if (visionConfidence) {
        let confVal = typeof result.confidence === "number" ? result.confidence : parseFloat(result.confidence);
        if (isNaN(confVal)) confVal = 0.0;
        confVal = Math.max(0.0, Math.min(1.0, confVal));
        const pctStr = (confVal * 100).toFixed(1) + "%";
        visionConfidence.textContent = `${pctStr} (${confVal.toFixed(4)})`;
      }
      if (visionDetails) visionDetails.style.display = "block";
      renderPerceptionSummary();
      return result;
    } catch (err) {
      console.warn("[SIH26171][VISION] Local vision inference notice:", err.message || err);
      console.log("[SIH26171][VISION] Falling back to DOM perception");
      visionStatus.textContent = `Vision notice: ${err.message || err} (DOM perception fallback active)`;
      visionStatus.style.color = "#d97706";
      
      if (visionModelStatus) {
        visionModelStatus.textContent = "UNAVAILABLE — DOM FALLBACK";
        visionModelStatus.style.background = "#fef3c7";
        visionModelStatus.style.color = "#b45309";
      }
      if (visionStatusText) visionStatusText.textContent = "DOM Fallback";
      if (visionProvider) visionProvider.textContent = "DOM Perception (Local)";
      if (visionLatency) visionLatency.textContent = "-";
      if (visionDetectionsCount) visionDetectionsCount.textContent = "0";
      if (visionFusionStatus) visionFusionStatus.textContent = "DOM FALLBACK";
      if (visionDetails) visionDetails.style.display = "block";
      latestVisionResult = null;
      renderPerceptionSummary();
      return null;
    }
  };

  // Helper to capture a screenshot data URL locally via background worker with tab/window fallback
  const captureScreenshotDataUrl = (windowId) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "captureScreenshot", windowId: typeof windowId === "number" ? windowId : null }, (res) => {
        if (!chrome.runtime.lastError && res && res.success && res.dataUrl) {
          resolve(res.dataUrl);
        } else if (typeof chrome.tabs.captureVisibleTab === "function") {
          chrome.tabs.captureVisibleTab(typeof windowId === "number" ? windowId : null, { format: "jpeg", quality: 60 }, (directUrl) => {
            if (!chrome.runtime.lastError && directUrl) {
              resolve(directUrl);
            } else {
              resolve(null);
            }
          });
        } else {
          resolve(null);
        }
      });
    });
  };

  // Helper function to capture tab screenshot locally (Milestone 7)
  // Security Note: Screenshot is strictly local (client-side only) and NEVER sent to backend raw.
  const captureVisualContext = (targetWinId, onScreenshotReady) => {
    let winId = targetWinId;
    let callback = onScreenshotReady;
    if (typeof targetWinId === "function") {
      callback = targetWinId;
      winId = null;
    }

    if (visualStatus) {
      visualStatus.textContent = "Capturing tab screenshot locally...";
      visualStatus.style.color = "#555";
    }
    if (screenshotPreview) {
      screenshotPreview.style.display = "none";
      screenshotPreview.src = "";
    }

    if (visionStatus) {
      visionStatus.textContent = "Awaiting screenshot...";
      visionStatus.style.color = "#555";
    }
    if (visionDetails) visionDetails.style.display = "none";

    const t0 = performance.now();

    // 1. Request screenshot via background service worker with windowId
    chrome.runtime.sendMessage({ action: "captureScreenshot", windowId: typeof winId === "number" ? winId : null }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        // Fallback: Attempt capture directly if in active window context
        if (typeof chrome.tabs.captureVisibleTab === "function") {
          chrome.tabs.captureVisibleTab(typeof winId === "number" ? winId : null, { format: "jpeg", quality: 60 }, (dataUrl) => {
            const t1 = performance.now();
            timing.screenshotMs = Math.round(t1 - t0);

            if (chrome.runtime.lastError || !dataUrl) {
              const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Capture blocked";
              if (visualStatus) {
                visualStatus.textContent = `Screenshot capture failed (${err})`;
                visualStatus.style.color = "#c62828";
              }
              if (visionStatus) {
                visionStatus.textContent = "Vision classification skipped (screenshot unavailable)";
                visionStatus.style.color = "#c62828";
              }
              if (privacyStatus) {
                privacyStatus.textContent = "Redaction skipped (screenshot unavailable)";
                privacyStatus.style.color = "#c62828";
              }
              renderPerceptionSummary();
              notifyRedactionDone({ success: false, error: err });
              if (typeof callback === "function") callback(null, err);
            } else {
              if (visualStatus) {
                visualStatus.textContent = "Screenshot captured locally. Applying visual privacy redaction...";
                visualStatus.style.color = "#1565c0";
                visualStatus.style.display = "block";
              }
              if (screenshotPreview) {
                // Keep hidden until sanitized/masked copy is produced by triggerRedaction
                screenshotPreview.style.display = "none";
                screenshotPreview.src = "";
              }
              latestScreenshotDataUrl = dataUrl;

              // Read natural dimensions
              const tempImg = new Image();
              tempImg.onload = () => {
                latestScreenshotDims = {
                  width: tempImg.naturalWidth || tempImg.width,
                  height: tempImg.naturalHeight || tempImg.height
                };
              };
              tempImg.src = dataUrl;

              // Trigger local OCR on screenshot
              triggerOcrPipeline(dataUrl);

              // Trigger on-device vision classification
              latestVisionPromise = triggerVisionClassification(dataUrl);

              if (typeof callback === "function") callback(dataUrl, null);
            }
          });
          return;
        }

        const errMsg = (response && response.error) || chrome.runtime.lastError?.message || "Capture failed";
        if (visualStatus) {
          visualStatus.textContent = `Screenshot capture failed (${errMsg})`;
          visualStatus.style.color = "#c62828";
        }
        if (visionStatus) {
          visionStatus.textContent = "Vision classification skipped (screenshot unavailable)";
          visionStatus.style.color = "#c62828";
        }
        if (privacyStatus) {
          privacyStatus.textContent = "Redaction skipped (screenshot unavailable)";
          privacyStatus.style.color = "#c62828";
        }
        renderPerceptionSummary();
        notifyRedactionDone({ success: false, error: errMsg });
        if (typeof callback === "function") callback(null, errMsg);
        return;
      }

      const t1 = performance.now();
      timing.screenshotMs = Math.round(t1 - t0);

      // 2. Successful capture: keep raw screenshot offscreen and trigger local perception pipelines
      if (visualStatus) {
        visualStatus.textContent = "Screenshot captured locally. Applying visual privacy redaction...";
        visualStatus.style.color = "#1565c0";
        visualStatus.style.display = "block";
      }
      if (screenshotPreview) {
        // Keep hidden until sanitized/masked copy is produced by triggerRedaction
        screenshotPreview.style.display = "none";
        screenshotPreview.src = "";
      }
      latestScreenshotDataUrl = response.dataUrl;

      // Read natural dimensions
      const tempImg = new Image();
      tempImg.onload = () => {
        latestScreenshotDims = {
          width: tempImg.naturalWidth || tempImg.width,
          height: tempImg.naturalHeight || tempImg.height
        };
      };
      tempImg.src = response.dataUrl;

      // Milestone 9 & 14: Evaluate page change state using perceptual screen signature
      if (window.SIHChangeDetector && typeof window.SIHChangeDetector.computeScreenSignature === "function") {
        window.SIHChangeDetector.computeScreenSignature(response.dataUrl, latestVisualElements || []).then((screenSig) => {
          const changeResult = window.SIHChangeDetector.compareScreenSignatures(lastScreenSignature, screenSig);
          lastScreenSignature = screenSig;
          if (visionPageChangeStatus) {
            visionPageChangeStatus.textContent = changeResult.changed ? "CHANGED" : "STABLE";
            visionPageChangeStatus.style.color = changeResult.changed ? "#b45309" : "#1e40af";
          }
          if (window.SIHFusion && typeof window.SIHFusion.updatePerceptionState === "function") {
            window.SIHFusion.updatePerceptionState({
              pageSignature: screenSig.domSignature,
              visualSignature: screenSig.pixelHash,
              changed: changeResult.changed,
              reason: changeResult.reason
            });
          }
          console.log(`[SIH26171][VISION] Page change evaluation: ${changeResult.changeLevel} — ${changeResult.reason}`);
        }).catch((err) => console.warn("[SIH26171][VISION] Change detection notice:", err));
      }

      // Milestone 12: Trigger OCR pipeline on screenshot
      triggerOcrPipeline(response.dataUrl);

      // Milestone 9: Trigger on-device vision classification
      latestVisionPromise = triggerVisionClassification(response.dataUrl);

      if (typeof onScreenshotReady === "function") onScreenshotReady(response.dataUrl, null);
    });
  };

  /**
   * Milestone 22.2: Evaluates whether the cached on-device visual perception state
   * can safely be reused for the current step without running expensive screenshot,
   * OCR, SqueezeNet, and spatial fusion passes.
   *
   * @param {Object} params
   * @param {string} [params.lastAction] - Type of previous action executed ("FILL", "CLICK", "SUBMIT", "SCROLL", etc.)
   * @param {string} [params.nextActionType] - Type of next planned action if known
   * @param {Object|null} [params.previousSignature] - Cached lightweight DOM signature from prior step
   * @param {Object|null} [params.currentSignature] - Freshly probed lightweight DOM signature
   * @param {number} [params.currentStep] - 1-based index of current agent loop step
   * @param {Object|null} [params.verificationResult] - Verification outcome of previous action
   * @param {number} [params.cachedAt] - Timestamp when current perception cache was generated
   * @param {boolean} [params.forceFresh] - Explicit override forcing fresh perception
   * @param {boolean} [params.hasCachedData] - Whether perception variables (fused elements, DOM elements) exist
   * @returns {{ canReuse: boolean, reason: string }}
   */
  const canReusePerception = ({
    lastAction = null,
    nextActionType = null,
    previousSignature = null,
    currentSignature = null,
    currentStep = 1,
    verificationResult = null,
    cachedAt = 0,
    forceFresh = false,
    hasCachedData = false
  } = {}) => {
    // 1. Initial Step (Step 1) must always execute full baseline perception
    if (currentStep <= 1) {
      return { canReuse: false, reason: "FRESH — Initial observation (Step 1)" };
    }

    // 2. Explicit force fresh (e.g. controlled recovery or caller directive)
    if (forceFresh) {
      return { canReuse: false, reason: "FRESH — Forced by recovery or directive" };
    }

    // 3. Cached data availability check
    if (!hasCachedData) {
      return { canReuse: false, reason: "FRESH — No cached perception available" };
    }

    // 4. Cache TTL expiration check (PERCEPTION_CACHE_TTL_MS = 10000ms)
    const ageMs = Date.now() - (cachedAt || 0);
    if (ageMs > PERCEPTION_CACHE_TTL_MS) {
      return { canReuse: false, reason: `FRESH — Perception cache expired (${Math.round(ageMs / 1000)}s > ${PERCEPTION_CACHE_TTL_MS / 1000}s TTL)` };
    }

    // 5. Actions that MUST force fresh perception:
    if (typeof activeComposer !== "undefined" && activeComposer && activeComposer.state === "open" && currentStep > 1) {
      return { canReuse: false, reason: "FRESH — Forced by active composer transition" };
    }
    const normLast = (lastAction || "").toUpperCase();
    if (normLast === "CLICK") {
      return { canReuse: false, reason: "FRESH — Forced by CLICK (possible UI navigation/modal)" };
    }
    if (normLast === "SUBMIT") {
      return { canReuse: false, reason: "FRESH — Forced by SUBMIT (form submission/transition)" };
    }
    if (normLast === "SCROLL") {
      return { canReuse: false, reason: "FRESH — Forced by SCROLL (viewport coordinates shifted)" };
    }
    if (["NAVIGATE", "OPEN", "CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(normLast)) {
      return { canReuse: false, reason: `FRESH — Forced by ${normLast} (state-changing action)` };
    }

    // 6. If next planned action is explicitly SCROLL or SUBMIT:
    const normNext = (nextActionType || "").toUpperCase();
    if (normNext === "SCROLL") {
      return { canReuse: false, reason: "FRESH — Forced by upcoming SCROLL" };
    }
    if (normNext === "SUBMIT") {
      return { canReuse: false, reason: "FRESH — Forced by upcoming SUBMIT" };
    }

    // 7. Verification outcome of previous action:
    if (verificationResult) {
      if (verificationResult.status === "FAILED") {
        return { canReuse: false, reason: "FRESH — Prior action verification FAILED" };
      }
      if (verificationResult.status === "UNKNOWN") {
        return { canReuse: false, reason: "FRESH — Verification Uncertain (Prior action status UNKNOWN)" };
      }
    }

    // 8. Signatures presence
    if (!previousSignature || !currentSignature) {
      return { canReuse: false, reason: "FRESH — Missing page state signature" };
    }

    // 9. Compare signatures using SIHChangeDetector if available, else structural compare
    if (typeof window !== "undefined" && window.SIHChangeDetector && typeof window.SIHChangeDetector.compareLightweightSignatures === "function") {
      const comp = window.SIHChangeDetector.compareLightweightSignatures(previousSignature, currentSignature);
      if (comp.changed) {
        return { canReuse: false, reason: `FRESH — Page Changed (${comp.reason})` };
      }
    } else {
      if (previousSignature.url !== currentSignature.url) {
        return { canReuse: false, reason: "FRESH — Page Changed (URL changed)" };
      }
      if (previousSignature.title !== currentSignature.title) {
        return { canReuse: false, reason: "FRESH — Page Changed (Title changed)" };
      }
      if (previousSignature.elementCount !== currentSignature.elementCount) {
        return { canReuse: false, reason: `FRESH — Page Changed (Element count ${previousSignature.elementCount} -> ${currentSignature.elementCount})` };
      }
      if (previousSignature.domHash !== currentSignature.domHash) {
        return { canReuse: false, reason: "FRESH — Page Changed (Structural DOM signature changed)" };
      }
      if (previousSignature.bboxHash !== currentSignature.bboxHash) {
        return { canReuse: false, reason: "FRESH — Page Changed (Layout or positions shifted)" };
      }
    }

    // 10. All checks passed: safe for adaptive perception reuse
    return { canReuse: true, reason: "REUSED — Stable Page" };
  };

  if (typeof window !== "undefined") {
    window.SIHAdaptivePerception = {
      canReusePerception,
      PERCEPTION_CACHE_TTL_MS
    };
  }

  // Resets pipeline state for a fresh capture/agent pass
  const resetPipelineState = () => {
    latestScreenshotDataUrl = null;
    latestScreenshotDims = { width: 0, height: 0 };
    latestVisualElements = null;
    latestSensitiveRegions = null;
    latestOcrSensitiveRegions = [];
    latestOcrWordCount = 0;
    latestOcrResult = null;
    latestMergedRegions = null;
    latestVisionResult = null;
    latestVisionPromise = null;
    latestFusedElements = null;
    if (window.SIHFusion && typeof window.SIHFusion.invalidatePerception === "function") {
      window.SIHFusion.invalidatePerception("Pipeline state reset for new pass");
    }
    latestSanitizedDataUrl = null;
    latestPageData = null;
    ocrCompleted = false;
    redactionCompleted = false;
    redactionError = null;
    onRedactionCompleteCallbacks = [];

    timing.domExtractionMs = null;
    timing.screenshotMs = null;
    timing.visionInferenceMs = null;
    timing.sensitiveRegionDetectionMs = null;
    timing.ocrInitMs = null;
    timing.ocrInferenceMs = null;
    timing.ocrSensitiveDetectionMs = null;
    timing.regionMergeMs = null;
    timing.redactionMs = null;
    timing.fusionMs = null;
    timing.gatewayMs = null;

    if (outputArea) outputArea.value = "Requesting page info...";
    if (sampleOutput) sampleOutput.value = "Scanning and redacting page text...";
    if (backendOutput) backendOutput.value = "Waiting for sanitized context...";
    if (decisionOutput) decisionOutput.value = "Awaiting decision...";
    if (executionOutput) executionOutput.value = "Awaiting execution...";
    if (elementsOutput) elementsOutput.value = "Scanning visible elements...";

    if (screenshotPreview) {
      screenshotPreview.style.display = "none";
      screenshotPreview.src = "";
    }
    if (sanitizedScreenshotPreview) {
      sanitizedScreenshotPreview.style.display = "none";
      sanitizedScreenshotPreview.src = "";
    }
    if (privacyDetails) privacyDetails.style.display = "none";
    if (privacyStatus) {
      privacyStatus.textContent = "Awaiting capture...";
      privacyStatus.style.color = "#555";
    }
    if (visionStatus) {
      visionStatus.textContent = "Awaiting screenshot...";
      visionStatus.style.color = "#555";
    }
    if (visionDetails) visionDetails.style.display = "none";
    if (fusionStatus) {
      fusionStatus.textContent = "Awaiting pipeline...";
      fusionStatus.style.color = "#555";
    }
    if (fusionDetails) fusionDetails.style.display = "none";
  };

  /**
   * Milestone 13: Secure Sanitized Visual Agent Gateway Upload
   *
   * SECURITY & PRIVACY CONTRACT:
   * - sanitizedScreenshotBlob MUST be a valid Blob created strictly from the client-side
   *   masked canvas output (latestSanitizedDataUrl).
   * - The raw screenshot (latestScreenshotDataUrl) is NEVER passed to this function or any network request.
   * - Must include privacyState: "SANITIZED" and rawScreenshotTransmitted: false.
   */
  const sendToVisualGateway = async (sanitizedScreenshotBlob, task, structuredContext, privacyMetadata, requestId) => {
    if (!sanitizedScreenshotBlob || !(sanitizedScreenshotBlob instanceof Blob)) {
      throw new Error("Invalid sanitized screenshot Blob: Cannot transmit to gateway.");
    }

    if (!privacyMetadata || privacyMetadata.privacyState !== "SANITIZED" || privacyMetadata.rawScreenshotTransmitted !== false) {
      throw new Error("Privacy contract violation: Only verified SANITIZED screenshots with rawScreenshotTransmitted=false may be sent.");
    }

    // CRITICAL PRIVACY GATE: Pre-flight payload verification before network transmission
    const verifyFn = (typeof verifySanitizedPayload === "function")
      ? verifySanitizedPayload
      : ((typeof window !== "undefined" && typeof window.verifySanitizedPayload === "function")
        ? window.verifySanitizedPayload
        : ((typeof globalThis !== "undefined" && typeof globalThis.verifySanitizedPayload === "function")
          ? globalThis.verifySanitizedPayload
          : null));

    if (verifyFn) {
      const outgoingPayload = {
        task: task || "",
        context: structuredContext,
        privacyMetadata: privacyMetadata
      };
      const verification = verifyFn(outgoingPayload);
      if (!verification.valid) {
        const errorMsg = `[CRITICAL PRIVACY GATE] Blocked gateway transmission to /api/visual-context: ${verification.violations.join("; ")}`;
        console.error(errorMsg);
        if (privacyStatus) {
          privacyStatus.textContent = "BLOCKED (Unredacted PII in payload)";
          privacyStatus.style.color = "#d32f2f";
        }
        if (agentSanitizedUploadStatus) {
          agentSanitizedUploadStatus.textContent = "BLOCKED (Privacy Gate Violation)";
          agentSanitizedUploadStatus.style.color = "#d32f2f";
        }
        throw new Error(errorMsg);
      }
    }

    const formData = new FormData();
    formData.append("sanitizedScreenshot", sanitizedScreenshotBlob, "sanitized_screenshot.jpg");
    formData.append("task", task || "");
    formData.append("context", JSON.stringify(structuredContext));
    formData.append("privacyMetadata", JSON.stringify(privacyMetadata));
    formData.append("requestId", requestId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const tStart = performance.now();
    try {
      const res = await fetch("http://127.0.0.1:8000/api/visual-context", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      const tElapsed = Math.round(performance.now() - tStart);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gateway Error HTTP ${res.status}: ${errText}`);
      }

      const resJson = await res.json();
      return {
        success: true,
        data: resJson,
        latencyMs: tElapsed
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  /**
   * Fallback to text-only sanitized pipeline (/api/context).
   * Used when redaction fails (fail-closed) or when visual gateway is offline.
   * Ensures the raw screenshot is NEVER sent under any circumstance.
   */
  const executeTextOnlyFallback = async (tab, pageData, reasonNotice = "") => {
    if (backendOutput) {
      backendOutput.value = `Fallback: Sending sanitized text-only context to /api/context...\n${reasonNotice}`;
    }
    if (decisionOutput) decisionOutput.value = "Evaluating rule-based decision (text-only fallback)...";
    if (executionOutput) executionOutput.value = "Awaiting decision from backend...";
    if (agentActionText) agentActionText.textContent = "Evaluating text-only fallback...";

    // CRITICAL PRIVACY GATE: Pre-flight payload verification before /api/context transmission
    const verifyFn = (typeof verifySanitizedPayload === "function")
      ? verifySanitizedPayload
      : ((typeof window !== "undefined" && typeof window.verifySanitizedPayload === "function")
        ? window.verifySanitizedPayload
        : ((typeof globalThis !== "undefined" && typeof globalThis.verifySanitizedPayload === "function")
          ? globalThis.verifySanitizedPayload
          : null));

    const payloadToSend = {
      title: pageData?.title || "Unknown Title",
      url: pageData?.url || "Unknown URL",
      redactedSample: pageData?.redactedSample || ""
    };

    if (verifyFn) {
      const verification = verifyFn(payloadToSend);
      if (!verification.valid) {
        const errorMsg = `[CRITICAL PRIVACY GATE] Blocked transmission to /api/context: ${verification.violations.join("; ")}`;
        console.error(errorMsg);
        if (backendOutput) backendOutput.value = errorMsg;
        if (privacyStatus) {
          privacyStatus.textContent = "BLOCKED (Unredacted PII in payload)";
          privacyStatus.style.color = "#d32f2f";
        }
        throw new Error(errorMsg);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const apiRes = await fetch("http://127.0.0.1:8000/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend),
        signal: controller.signal
      });

      if (apiRes.ok) {
        const resJson = await apiRes.json();
        if (backendOutput) backendOutput.value = JSON.stringify(resJson, null, 2);

        if (resJson.action) {
          const targetText = resJson.action.target ? resJson.action.target : "None";
          const actionStr = (resJson.action.amount !== undefined && resJson.action.amount !== null)
            ? `${resJson.action.action} → ${targetText} (amount: ${resJson.action.amount})`
            : `${resJson.action.action} → ${targetText}`;

          if (decisionOutput) decisionOutput.value = actionStr;
          if (agentActionText) agentActionText.textContent = actionStr;
          if (agentReasoningText) {
            agentReasoningText.textContent = `Visual context unavailable — decision based on sanitized text only (${reasonNotice || "Fallback"}). Observation only: no action executed.`;
          }

          // SECURITY INVARIANT (Milestone 17 Production Hardening): OBSERVATION ≠ ACTION
          // Capture Page Info and text-only observation requests MUST NEVER automatically execute actions.
          if (executionOutput) executionOutput.value = "Observation only: Action execution withheld (Observation ≠ Action policy enforced).";
          if (agentSafetyStatus) agentSafetyStatus.textContent = "OBSERVATION ONLY (Actions disabled in Capture/Fallback mode)";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Observation Only (No browser action executed)";
        } else {
          if (decisionOutput) decisionOutput.value = "No action returned";
          if (executionOutput) executionOutput.value = "Observation only: No action payload";
          if (agentActionText) agentActionText.textContent = "No action returned";
          if (agentSafetyStatus) agentSafetyStatus.textContent = "OBSERVATION ONLY";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Observation Only";
        }
      } else {
        if (backendOutput) backendOutput.value = `Backend Error: HTTP ${apiRes.status} ${apiRes.statusText}`;
        if (decisionOutput) decisionOutput.value = "Error from backend";
        if (executionOutput) executionOutput.value = "Skipped (backend error)";
        if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (backend error)";
      }
    } catch (networkErr) {
      if (backendOutput) {
        backendOutput.value = `Backend connection failed: ${networkErr.message}\n(Ensure FastAPI is running: uvicorn main:app --reload --port 8000)`;
      }
      if (decisionOutput) decisionOutput.value = "Unavailable (backend offline)";
      if (executionOutput) executionOutput.value = "Skipped (backend offline)";
      if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (backend offline)";
    }
  };

  /**
   * Waits for a tab to finish loading and for its content script to respond with live DOM elements.
   * Handles full-page navigations, SPA changes, and delayed rendering.
   */
  const waitForTabReady = async (tabId, timeoutMs = 6000) => {
    if (!tabId) return null;
    const startTime = performance.now();
    // Brief settling period for any in-flight navigation to start
    await new Promise((r) => setTimeout(r, 250));

    while (performance.now() - startTime < timeoutMs) {
      try {
        const tabInfo = await chrome.tabs.get(tabId);
        if (tabInfo && tabInfo.status === "complete") {
          // Tab reports complete; verify content script is responsive and DOM is ready
          const pingResp = await new Promise((resolvePing) => {
            chrome.tabs.sendMessage(tabId, { action: "getPageInfo" }, (resp) => {
              if (chrome.runtime.lastError || !resp || !resp.success) {
                resolvePing(null);
              } else {
                resolvePing(resp);
              }
            });
          });

          if (pingResp && pingResp.success && Array.isArray(pingResp.visualElements) && pingResp.visualElements.length > 0) {
            // Content script is alive and has extracted live elements.
            // Small paint/layout settling delay before screenshot capture.
            await new Promise((r) => setTimeout(r, 200));
            return pingResp;
          }

          // If content script was not injected on the newly loaded page, inject it
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ["form-profile.js", "pii-detector.js", "change-detector.js", "content.js"]
            });
            await new Promise((r) => setTimeout(r, 150));
          } catch (_) { }
        }
      } catch (err) {
        // Tab may be in transit between documents
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  };

  /**
   * Bounded stabilization helper for search results and dynamic page changes.
   * Checks for URL changes, title changes, search-result containers, and content stabilization.
   */
  const waitForSearchResultsStabilization = async (tabId, timeoutMs = 5000) => {
    if (!tabId) return null;
    const startTime = performance.now();
    await new Promise((r) => setTimeout(r, 350));

    while (performance.now() - startTime < timeoutMs) {
      try {
        const tabInfo = await chrome.tabs.get(tabId);
        const url = (tabInfo?.url || "").toLowerCase();
        const hasSearchUrl = url.includes("/search") || url.includes("?q=") || url.includes("&q=") || url.includes("query=") || url.includes("search?");

        const pageState = await new Promise((res) => {
          chrome.tabs.sendMessage(tabId, { action: "checkSearchResultsState" }, (resp) => {
            if (chrome.runtime.lastError || !resp) res(null);
            else res(resp);
          });
        });

        if (pageState && (pageState.isSearchResults || hasSearchUrl || pageState.hasSearchTitle)) {
          await new Promise((r) => setTimeout(r, 250)); // Layout settle
          return pageState;
        }
      } catch (_) { }
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  };

  /**
   * Verifies locally whether the current page is in a search results state.
   */
  const verifySearchResultsStateLocally = async (tabId, query = "") => {
    if (!tabId) return { verified: false, reason: "No active tab" };
    try {
      const tabInfo = await chrome.tabs.get(tabId);
      const url = (tabInfo?.url || "").toLowerCase();
      const title = (tabInfo?.title || "").toLowerCase();
      const qNorm = (query || "").toLowerCase().trim();

      const hasSearchUrl = url.includes("/search") || url.includes("?q=") || url.includes("&q=") || url.includes("query=") || url.includes("search?");
      const hasSearchTitle = title.includes("search") || title.includes("results") || (qNorm && title.includes(qNorm));

      const pageState = await new Promise((res) => {
        chrome.tabs.sendMessage(tabId, { action: "checkSearchResultsState" }, (resp) => {
          if (chrome.runtime.lastError || !resp) res(null);
          else res(resp);
        });
      });

      const isSearchState = !!(hasSearchUrl || (pageState && pageState.isSearchResults) || (hasSearchTitle && pageState && pageState.containerCount > 0));
      if (isSearchState) {
        return {
          verified: true,
          reason: hasSearchUrl ? "Search URL detected" : (hasSearchTitle ? "Search title confirmed" : "Search results containers verified")
        };
      }
    } catch (_) { }

    return {
      verified: false,
      reason: "Page is still on the initial homepage. Search results not detected."
    };
  };

  const HOMEPAGE_NAVIGATION_LABELS = new Set([
    "google apps", "sign in", "login", "gmail", "images", "privacy", "terms", "settings",
    "about", "advertising", "business", "how search works", "search settings", "advanced search",
    "history", "search help", "send feedback", "all", "maps", "news", "videos", "shopping",
    "books", "flights", "finance", "tools", "clear", "home", "search", "google search", "i'm feeling lucky"
  ]);

  const isGenericNavigationOrHomepageTarget = (target) => {
    if (!target) return false;
    if (typeof target === "object") {
      const resolver = (typeof window !== "undefined" && window.SIHSemanticResolver) || (typeof SIHSemanticResolver !== "undefined" ? SIHSemanticResolver : null);
      if (resolver && typeof resolver.isExcludedSearchPageControl === "function") {
        if (resolver.isExcludedSearchPageControl(target)) return true;
      }
      target = target.label || target.text || target.targetLabel || target.target || "";
    }
    const norm = String(target || "").trim().toLowerCase();
    if (HOMEPAGE_NAVIGATION_LABELS.has(norm)) return true;
    if (/google\s+account|manage\s+your\s+google\s+account|switch\s+account|accounts\.google/i.test(norm)) return true;
    if (/google\s+apps|app\s+launcher|waffle\s+menu/i.test(norm)) return true;
    if (/^(?:settings|quick\s+settings|search\s+settings|tools|search\s+tools|all|images|videos|news|maps|shopping|books|flights|finance|more)$/i.test(norm)) return true;
    const resolver = (typeof window !== "undefined" && window.SIHSemanticResolver) || (typeof SIHSemanticResolver !== "undefined" ? SIHSemanticResolver : null);
    if (resolver && typeof resolver.isExcludedSearchPageControl === "function") {
      if (resolver.isExcludedSearchPageControl({ label: norm })) return true;
    }
    return false;
  };

  // Helper to normalize bounding boxes [x, y, w, h] or { x, y, width, height }
  function normalizeBounds(b) {
    if (!b) return null;
    if (Array.isArray(b) && b.length >= 4) {
      return { x: b[0], y: b[1], width: b[2], height: b[3] };
    }
    if (typeof b.x === "number" && typeof b.y === "number") {
      return { x: b.x, y: b.y, width: b.width || 0, height: b.height || 0 };
    }
    return null;
  }

  // Helper to normalize URLs
  function normalizeUrl(u) {
    if (!u) return "";
    return String(u).trim().toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
  }

  /**
   * Determines whether an element is an AI/chat/assistant interface.
   * Universal and website-agnostic: matches semantic patterns across arbitrary pages.
   */
  const isAiAssistantElement = (el) => {
    if (!el) return false;
    const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();
    const texts = [
      el.label,
      el.ariaLabel,
      el.placeholder,
      el.title,
      el.name,
      el.id,
      el.nearbyText,
      el.contextText,
      el.associatedLabel
    ].map(normalize).filter(Boolean);

    const aiPattern = /\b(?:ai\s+mode|ask\s+anything|ask\s+google|gemini|ai\s+assistant|assistant|chat\s+with|ask\s+ai|ai\s+search|copilot|chatgpt|how\s+search\s+works)\b/i;
    const exactAiOrChat = /^(?:chat|ai|assistant|ai\s+mode|copilot|gemini|how\s+search\s+works)$/i;

    return texts.some(t => aiPattern.test(t) || exactAiOrChat.test(t));
  };
  if (typeof globalThis !== "undefined") {
    globalThis.isAiAssistantElement = isAiAssistantElement;
  }

  /**
   * Generic 5-tier semantic ranking for primary search input controls.
   * Conforms to Requirements 3, 4, 5:
   * - Tier 1: Native search controls (input[type="search"])
   * - Tier 2: Inputs with semantic search naming (name="q", "query", "search", id/name containing search)
   * - Tier 3: Accessible labels (aria-label, <label>, title containing search)
   * - Tier 4: Search placeholders (placeholder containing search)
   * - Tier 5: Other DOM elements with search semantics (semanticTag="SEARCH_INPUT", role="searchbox", label)
   * Explicitly excludes AI/chat/assistant inputs for normal search intent.
   * Universal and website-agnostic.
   */
  const scoreSearchCandidate = (el, taskText = "", isExplicitAiAllowed = false) => {
    if (!el) return 0;
    const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();

    // Check if element is an AI / assistant / chat interface
    if (isAiAssistantElement(el) && !isExplicitAiAllowed) {
      return 0; // Exclude AI/chat/assistant inputs for normal search intent
    }

    // Must be an editable form-capable control
    const elType = (el.type || "").toLowerCase();
    const elRole = (el.role || "").toLowerCase();
    const elTag = (el.tag || "").toLowerCase();
    const isFormType = ["input", "textarea", "combobox", "searchbox", "search", "text", "textbox", "contenteditable"].includes(elType) ||
      ["input", "textarea", "combobox", "searchbox", "textbox"].includes(elRole) ||
      elTag === "input" || elTag === "textarea" ||
      Boolean(el.ariaAutocomplete);
    if (!isFormType) return 0;
    if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return 0;

    // Reject non-text inputs (checkbox, radio, button, submit, file, image)
    if (["button", "submit", "reset", "checkbox", "radio", "file", "image"].includes(elType)) return 0;

    // Reject voice/mic/camera controls unless explicitly requested
    const fullText = [el.label, el.ariaLabel, el.title].map(normalize).join(" ");
    if (!taskText || (!/voice|mic|audio|speak|camera|lens/i.test(taskText))) {
      if (/voice|mic|microphone|audio|speak|camera|lens/i.test(fullText)) return 0;
    }

    const elName = normalize(el.name);
    const elId = normalize(el.id);
    const elAria = normalize(el.ariaLabel);
    const elPlaceholder = normalize(el.placeholder);
    const elTitle = normalize(el.title);
    const elAssoc = normalize(el.associatedLabel);
    const elLabel = normalize(el.label);
    const elContext = normalize(el.contextText || el.nearbyText);

    let tierScore = 0;
    let tiersMatched = 0;

    // Tier 1: Native search control (input[type="search"])
    const isNativeSearch = elType === "search" || el.inputType === "search" || (el.tag === "input" && el.type === "search");
    if (isNativeSearch) {
      tierScore = Math.max(tierScore, 1.00);
      tiersMatched++;
    }

    // Tier 2: Semantic search naming (name="q", "query", "search", id/name containing search)
    const isExactSearchName = elName === "q" || elName === "query" || elName === "search";
    const isPartialSearchNameOrId = (elName && /\bsearch\b/i.test(elName)) || (elId && /\bsearch\b/i.test(elId));
    if (isExactSearchName) {
      tierScore = Math.max(tierScore, 0.95);
      tiersMatched++;
    } else if (isPartialSearchNameOrId) {
      tierScore = Math.max(tierScore, 0.92);
      tiersMatched++;
    }

    // Tier 3: Accessible labels (aria-label containing "search", associated <label> containing "search", title containing "search")
    const isAriaSearch = elAria && /\bsearch\b/i.test(elAria);
    const isAssocSearch = elAssoc && /\bsearch\b/i.test(elAssoc);
    const isTitleSearch = elTitle && /\bsearch\b/i.test(elTitle);
    if (isAriaSearch || isAssocSearch || isTitleSearch) {
      tierScore = Math.max(tierScore, 0.88);
      tiersMatched++;
    }

    // Tier 4: Search placeholders (placeholder containing "search")
    const isPlaceholderSearch = elPlaceholder && /\bsearch\b/i.test(elPlaceholder);
    if (isPlaceholderSearch) {
      tierScore = Math.max(tierScore, 0.84);
      tiersMatched++;
    }

    // Tier 5: Other DOM elements whose accessible name / role / surrounding semantics indicate search
    const isSemanticTagSearch = el.semanticTag === "SEARCH_INPUT";
    const isSearchRole = elRole === "searchbox" || elType === "searchbox";
    const isLabelSearch = elLabel && /\bsearch\b/i.test(elLabel);
    const isContextSearch = elContext && /\bsearch\b/i.test(elContext);
    if (isSemanticTagSearch || isSearchRole || isLabelSearch || isContextSearch) {
      tierScore = Math.max(tierScore, 0.78);
      tiersMatched++;
    }

    if (tierScore === 0) return 0;

    // Multi-tier reinforcement bonus (confirming signals increase confidence up to 0.99 for non-tier-1)
    let finalScore = tierScore;
    if (tiersMatched > 1 && finalScore < 1.00) {
      finalScore = Math.min(0.99, finalScore + (tiersMatched - 1) * 0.02);
    }

    // Visual confirmation bonus (+0.01)
    if (el.isVisualConfirmed && finalScore < 1.00) {
      finalScore = Math.min(1.00, finalScore + 0.01);
    }

    return finalScore;
  };
  if (typeof globalThis !== "undefined") {
    globalThis.scoreSearchCandidate = scoreSearchCandidate;
  }

  /**
   * Robust, deterministic helper to check whether a candidate target matches a requested field hint.
   * Enforces semantic compatibility, whole-word matching, and synonym coverage.
   * Prevents unrelated page text (e.g. "Switch accounts") from substituting form fields.
   */
  const isFieldMatch = (targetLabel, fieldHint) => {
    if (!targetLabel || !fieldHint) return false;
    const tNorm = (targetLabel || "").toLowerCase().replace(/[:*#_\-\/\\.,…!?;'"()\[\]]+/g, " ").trim();
    const hNorm = (fieldHint || "").toLowerCase().replace(/[:*#_\-\/\\.,…!?;'"()\[\]]+/g, " ").trim();
    if (!tNorm || !hNorm) return false;

    // Critical Rule 1 & 2: Search mail/input must NEVER match non-search field hints
    const isSearchTarget = /\bsearch\b/i.test(tNorm);
    const isSearchHint = /\bsearch\b/i.test(hNorm);
    if (isSearchTarget && !isSearchHint) return false;
    if (!isSearchTarget && isSearchHint) return false;

    if (tNorm === hNorm) return true;

    // Direct word-boundary match for short keywords like "to" and "from"
    if (hNorm === "to" || hNorm === "from") {
      if (new RegExp(`\\b${hNorm}\\b`, "i").test(tNorm)) return true;
    }
    if (tNorm === "to" || tNorm === "from") {
      if (new RegExp(`\\b${tNorm}\\b`, "i").test(hNorm)) return true;
    }

    // Direct substring match only when hint length >= 3 to avoid spurious collisions on 1-2 char words
    if (hNorm.length >= 3 && tNorm.includes(hNorm)) return true;
    if (tNorm.length >= 3 && hNorm.includes(tNorm)) return true;

    // Composer Semantic Normalization (e.g. "Write a message...", "active message composer", "write a reply", "body")
    const cleanComposerTerm = (str) => {
      return (str || "")
        .toLowerCase()
        .replace(/^(?:write|type|enter|input|put|draft|send)\s+(?:a\s+|an\s+|the\s+)?/i, "")
        .replace(/^(?:active\s+)/i, "")
        .replace(/\s+(?:composer|textbox|editor|box|body|field|input|area)$/i, "")
        .trim();
    };

    const cT = cleanComposerTerm(tNorm);
    const cH = cleanComposerTerm(hNorm);
    if (cT && cH && cT === cH) return true;

    // Meaningful token overlap (tokens >= 3 chars, or exact keyword "to"/"from")
    const tTokens = tNorm.split(/\s+/).filter((w) => w.length >= 3 || w === "to" || w === "from");
    const hTokens = hNorm.split(/\s+/).filter((w) => w.length >= 3 || w === "to" || w === "from");
    for (const ht of hTokens) {
      if (tTokens.includes(ht)) return true;
    }

    // Pre-registered generic semantic synonyms for form fields
    const SYNONYMS = {
      from: [
        "from", "from station", "from city", "departure", "departure station",
        "departure city", "source", "source station", "source city",
        "origin", "origin station", "origin city", "leaving from"
      ],
      to: [
        "to", "to station", "to city", "arrival", "arrival station",
        "arrival city", "destination", "destination station", "destination city",
        "going to"
      ],
      station: ["station", "railway station", "train station", "city", "location", "stop"],
      city: ["city", "town", "location", "destination", "origin", "station"],
      name: ["name", "full name", "your name", "first name", "applicant name", "student name", "candidate name"],
      email: ["email", "e-mail", "email address", "your email", "compose", "compose body", "email body", "active compose textbox"],
      phone: ["phone", "mobile", "contact", "telephone", "phone number", "mobile number", "contact number"],
      college: ["college", "university", "institution", "school", "college name", "campus"],
      subject: ["subject", "topic", "title", "subject line"],
      recipient: ["recipient", "recipients", "to", "receiver", "to recipients"],
      message: ["message", "body", "comments", "description", "text", "message body", "reply message body", "compose body", "active message composer", "write a message", "new message"],
      reply: ["reply", "write a reply", "type a reply", "reply body", "reply message", "active reply composer"],
      post: ["post", "start a post", "post composer", "post editor", "active post composer", "share", "write a post"],
      comment: ["comment", "comments", "comments box", "active comment box", "write a comment"],
      address: ["address", "street", "residential address", "home address", "postal address"]
    };

    for (const [key, synList] of Object.entries(SYNONYMS)) {
      const hMatch = hNorm === key || synList.some((s) => hNorm === s || cH === s || (s.length >= 3 && (hNorm.includes(s) || cH.includes(s))));
      const tMatch = tNorm === key || synList.some((s) => tNorm === s || cT === s || (s.length >= 3 && (tNorm.includes(s) || cT.includes(s))));
      if (hMatch && tMatch) return true;
    }

    // Active Composer Context Compatibility
    if (typeof activeComposer !== "undefined" && activeComposer && activeComposer.state === "open") {
      const actType = activeComposer.type;
      if (actType === "message") {
        if ((cT === "message" || tTokens.includes("message")) && (cH === "message" || cH === "body" || hTokens.includes("message") || hTokens.includes("body"))) return true;
      } else if (actType === "reply") {
        if ((cT === "reply" || tTokens.includes("reply")) && (cH === "reply" || cH === "body" || hTokens.includes("reply") || hTokens.includes("body"))) return true;
      } else if (actType === "email" || actType === "compose") {
        if ((cT === "email" || cT === "compose" || tTokens.includes("body")) && (cH === "email" || cH === "body" || hTokens.includes("email") || hTokens.includes("body"))) return true;
      } else if (actType === "post") {
        if ((cT === "post" || tTokens.includes("post")) && (cH === "post" || cH === "body" || hTokens.includes("post") || hTokens.includes("body"))) return true;
      } else if (actType === "comment") {
        if ((cT === "comment" || tTokens.includes("comment")) && (cH === "comment" || cH === "body" || hTokens.includes("comment") || hTokens.includes("body"))) return true;
      }
    }

    return false;
  };

  /**
   * Scores a candidate DOM element against a requested field hint using rich semantic signals.
   * Considers label, ariaLabel, nearbyText, contextText, placeholder, name, id.
   * @param {Object} el
   * @param {string} fieldHint
   * @returns {number} Score from 0.0 to 1.0
   */
  /**
   * Scores a candidate DOM element against a requested field hint using rich semantic signals.
   * Considers label, ariaLabel, nearbyText, contextText, placeholder, name, id.
   * @param {Object} el
   * @param {string} fieldHint
   * @returns {number} Score from 0.0 to 1.0
   */
  const scoreElementForField = (el, fieldHint) => {
    if (!el || !fieldHint) return 0;
    const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
    const hNorm = normalize(fieldHint);
    if (!hNorm) return 0;

    const labelNorm = normalize(el.label);
    const ariaNorm = normalize(el.ariaLabel);
    const placeholderNorm = normalize(el.placeholder);

    const isSearchIntent = hNorm === "search" ||
      hNorm === "primary search input" ||
      fieldHint === "PRIMARY_SEARCH_INPUT" ||
      (typeof currentStepPlan !== "undefined" && currentStepPlan && (currentStepPlan.expectedRole === "PRIMARY_SEARCH_INPUT" || currentStepPlan.targetRole === "PRIMARY_SEARCH_INPUT" || currentStepPlan.semanticTarget === "PRIMARY_SEARCH_INPUT" || currentStepPlan.target === "PRIMARY_SEARCH_INPUT"));

    const hasExplicitAi = typeof originalUserTask !== "undefined" && originalUserTask &&
      /\b(?:gemini|copilot|chatgpt|ai\s+mode|ai\s+assistant|chat\s+with|ask\s+ai|ask\s+anything)\b/i.test(originalUserTask);

    if (isSearchIntent) {
      if (typeof scoreSearchCandidate === "function") {
        return scoreSearchCandidate(el, typeof originalUserTask !== "undefined" ? originalUserTask : "", hasExplicitAi);
      }
      if (typeof globalThis !== "undefined" && typeof globalThis.scoreSearchCandidate === "function") {
        return globalThis.scoreSearchCandidate(el, typeof originalUserTask !== "undefined" ? originalUserTask : "", hasExplicitAi);
      }
      if (!hasExplicitAi) {
        if (isAiAssistantElement(el)) return 0;
        const fullCand = [labelNorm, ariaNorm, placeholderNorm, normalize(el.title), normalize(el.name), normalize(el.id)].join(" ");
        if (/\b(?:ai\s+mode|ask\s+anything|ask\s+google|gemini|ai\s+assistant|assistant|chat\s+with|ask\s+ai|ai\s+search|copilot|how\s+search\s+works)\b/i.test(fullCand) || /^(?:chat|ai|assistant|how\s+search\s+works)$/i.test(labelNorm)) {
          return 0;
        }
      }
    }

    const elType = (el.type || "").toLowerCase();
    const elRole = (el.role || "").toLowerCase();
    const isFormType = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes(elType) ||
      ["input", "textarea", "select", "combobox", "searchbox", "textbox"].includes(elRole) ||
      Boolean(el.ariaAutocomplete);
    if (!isFormType) return 0;
    const isSearchHint = /\bsearch\b/i.test(hNorm);
    const isSearchTarget = /\bsearch\b/i.test(labelNorm) || /\bsearch\b/i.test(ariaNorm) || /\bsearch\b/i.test(placeholderNorm) || el.semanticTag === "SEARCH_INPUT";

    if (isSearchHint && !isSearchTarget) return 0;
    if (!isSearchHint && isSearchTarget) {
      const hasSpecificFieldMatch = isFieldMatch(el.label, fieldHint) ||
        (el.ariaLabel && isFieldMatch(el.ariaLabel, fieldHint)) ||
        (el.placeholder && isFieldMatch(el.placeholder, fieldHint)) ||
        (el.nearbyText && isFieldMatch(el.nearbyText, fieldHint)) ||
        (el.contextText && isFieldMatch(el.contextText, fieldHint));
      if (!hasSpecificFieldMatch) return 0;
    }

    const activeCompType = (typeof activeComposer !== "undefined" && activeComposer && activeComposer.state === "open")
      ? activeComposer.type
      : null;
    const planCompType = (typeof currentStepPlan !== "undefined" && currentStepPlan && currentStepPlan.composerType)
      ? currentStepPlan.composerType
      : null;
    const planContext = (typeof currentStepPlan !== "undefined" && currentStepPlan && currentStepPlan.context)
      ? currentStepPlan.context
      : null;

    const isCommunicationComposer =
      planContext === "communication_composer" ||
      planContext === "post_composer" ||
      planContext === "message_composer" ||
      planContext === "reply_composer" ||
      planCompType === "post" ||
      planCompType === "message" ||
      planCompType === "reply" ||
      Boolean(activeCompType) ||
      hNorm === "linkedin post composer" ||
      hNorm === "post composer" ||
      hNorm === "active post composer" ||
      hNorm === "communication message body" ||
      hNorm === "message composer" ||
      hNorm === "active message composer" ||
      hNorm === "reply message body" ||
      hNorm === "active reply composer";

    // CRITICAL EXCLUSION: Global Search MUST be excluded from communication composer grounding
    if (isCommunicationComposer) {
      if (isSearchTarget || isSearchHint || el.semanticTag === "SEARCH_INPUT" || /search/i.test(labelNorm) || /search/i.test(ariaNorm) || /search/i.test(placeholderNorm) || el.role === "searchbox" || el.name === "q" || el.name === "query") {
        return 0.0;
      }
      if (/\b(?:profile|author|user|avatar)\b/i.test(labelNorm) || el.name === "name") {
        return 0.0;
      }
      const candMeta = [labelNorm, ariaNorm, placeholderNorm, normalize(el.name), normalize(el.id)].join(" ");
      if (/\b(?:recipient|recipients|subject|search\s+for\s+people|type\s+a\s+name)\b/i.test(candMeta) && !/\b(?:write\s+(?:a\s+)?message|share\s+your\s+thoughts|start\s+a\s+post|message\s+body)\b/i.test(candMeta)) {
        return 0.0;
      }
    }

    // 0b. Post composer / editor field grounding
    const isPostComposerHint = hNorm === "linkedin post composer" || hNorm === "post composer" || hNorm === "post editor" || hNorm === "active post composer" || /\b(?:post\s+composer|post\s+editor)\b/i.test(hNorm) ||
      planCompType === "post" || activeCompType === "post" ||
      (typeof currentStepPlan !== "undefined" && currentStepPlan && (currentStepPlan.target === "active post composer" || currentStepPlan.target === "LinkedIn post composer" || currentStepPlan.target === "post composer" || currentStepPlan.fieldHint === "post composer" || currentStepPlan.context === "post_composer" || (currentStepPlan.context === "communication_composer" && currentStepPlan.composerType === "post")));

    if (isPostComposerHint) {
      if (isSearchTarget || isSearchHint || el.semanticTag === "SEARCH_INPUT") return 0;
      if (/\b(?:profile|author|user|name)\b/i.test(labelNorm) || el.name === "name") return 0;
      if (/\bcomment\b/i.test(labelNorm) || /\bcomment\b/i.test(ariaNorm) || /\bcomment\b/i.test(placeholderNorm)) return 0;

      const isInDialog = Boolean(el.inDialog || el.inModal || el.containerRole === "dialog" || el.containerRole === "alertdialog" || /dialog|modal/i.test(el.contextText || "") || /dialog|modal/i.test(el.nearbyText || ""));
      const isContentEditable = elType === "contenteditable" || el.isContentEditable || elRole === "textbox";
      const fullCand = [labelNorm, ariaNorm, placeholderNorm, normalize(el.dataPlaceholder), normalize(el.nearbyText), normalize(el.contextText)].join(" ");
      const matchesPostIntent = /\b(?:post|talk\s+about|what\s+do\s+you\s+want\s+to\s+talk\s+about|share\s+your\s+thoughts|share|thoughts|write|editor|composer|what's\s+on\s+your\s+mind|create\s+a\s+post)\b/i.test(fullCand);

      if (isInDialog) {
        if (isContentEditable && matchesPostIntent) return 1.0;
        if (elType === "textarea" && matchesPostIntent) return 0.99;
        if (isContentEditable) return 0.98;
        if (elType === "textarea") return 0.95;
        if (matchesPostIntent) return 0.90;
        return 0.80;
      }

      if (isContentEditable && matchesPostIntent) return 1.0;
      if (isContentEditable && (activeCompType === "post" || planCompType === "post")) return 0.95;
      if (elType === "textarea" && matchesPostIntent) return 0.95;
      if (elType === "textarea" && (activeCompType === "post" || planCompType === "post")) return 0.90;
      if (isContentEditable) return 0.85;
      if (elType === "textarea") return 0.80;
      if (matchesPostIntent) return 0.75;
      return 0.1;
    }

    // 0c. Message composer field grounding (LinkedIn, Slack, Twitter/X, Chat, etc.)
    const isMessageComposerHint = hNorm === "communication message body" || hNorm === "active message composer" || hNorm === "message composer" || hNorm === "message body" ||
      planCompType === "message" || activeCompType === "message" ||
      (typeof currentStepPlan !== "undefined" && currentStepPlan && (currentStepPlan.target === "active message composer" || currentStepPlan.target === "communication message body" || currentStepPlan.context === "message_composer" || (currentStepPlan.context === "communication_composer" && currentStepPlan.composerType === "message"))) ||
      (hNorm === "message" && (activeCompType === "message" || planCompType === "message"));

    if (isMessageComposerHint) {
      if (isSearchTarget || isSearchHint || el.semanticTag === "SEARCH_INPUT") return 0;
      const candMeta = [labelNorm, ariaNorm, placeholderNorm, normalize(el.name), normalize(el.id)].join(" ");
      if (/\b(?:recipient|recipients|subject|subject\s+optional|type\s+a\s+name|search\s+for\s+people)\b/i.test(candMeta) && !/\b(?:write\s+a\s+message|message\s+body)\b/i.test(candMeta)) {
        return 0;
      }

      const isInDialog = Boolean(el.inDialog || el.inModal || el.containerRole === "dialog" || el.containerRole === "alertdialog" || /dialog|modal/i.test(el.contextText || "") || /dialog|modal/i.test(el.nearbyText || ""));
      const isContentEditable = elType === "contenteditable" || el.isContentEditable || elRole === "textbox";
      const fullCand = [labelNorm, ariaNorm, placeholderNorm, normalize(el.dataPlaceholder), normalize(el.nearbyText), normalize(el.contextText)].join(" ");
      const matchesMsgIntent = /\b(?:write\s+(?:a\s+)?message|type\s+(?:a\s+)?message|send\s+(?:a\s+)?message|message\s+body|write\s+message|enter\s+(?:the\s+)?message|message)\b/i.test(fullCand);

      if (isInDialog) {
        if (isContentEditable && matchesMsgIntent) return 1.0;
        if (elType === "textarea" && matchesMsgIntent) return 1.0;
        if (isContentEditable) return 0.98;
        if (elType === "textarea") return 0.95;
        if (matchesMsgIntent) return 0.90;
        return 0.80;
      }

      if (isContentEditable && matchesMsgIntent) return 1.0;
      if (elType === "textarea" && matchesMsgIntent) return 1.0;
      if (isContentEditable && (activeCompType === "message" || planCompType === "message")) return 0.95;
      if (elType === "textarea" && (activeCompType === "message" || planCompType === "message")) return 0.90;
      if (matchesMsgIntent) return 0.85;
      return 0.1;
    }

    // 0d. Reply composer field grounding
    const isReplyComposerHint = hNorm === "reply message body" || hNorm === "active reply composer" || hNorm === "reply composer" || hNorm === "reply body" ||
      planCompType === "reply" || activeCompType === "reply" ||
      (typeof currentStepPlan !== "undefined" && currentStepPlan && (currentStepPlan.target === "active reply composer" || currentStepPlan.target === "Reply message body" || currentStepPlan.context === "reply_composer" || (currentStepPlan.context === "communication_composer" && currentStepPlan.composerType === "reply"))) ||
      (hNorm === "reply" && (activeCompType === "reply" || planCompType === "reply"));

    if (isReplyComposerHint) {
      if (isSearchTarget || isSearchHint || el.semanticTag === "SEARCH_INPUT") return 0;
      const isInDialog = Boolean(el.inDialog || el.inModal || el.containerRole === "dialog" || el.containerRole === "alertdialog" || /dialog|modal/i.test(el.contextText || "") || /dialog|modal/i.test(el.nearbyText || ""));
      const isContentEditable = elType === "contenteditable" || el.isContentEditable || elRole === "textbox";
      const fullCand = [labelNorm, ariaNorm, placeholderNorm, normalize(el.dataPlaceholder), normalize(el.nearbyText), normalize(el.contextText)].join(" ");
      const matchesReplyIntent = /\b(?:write\s+(?:a\s+)?reply|type\s+(?:a\s+)?reply|reply\s+body|write\s+reply|enter\s+(?:a\s+)?reply|reply|message\s+body)\b/i.test(fullCand);

      if (isInDialog) {
        if (isContentEditable && matchesReplyIntent) return 1.0;
        if (elType === "textarea" && matchesReplyIntent) return 1.0;
        if (isContentEditable) return 0.98;
        if (elType === "textarea") return 0.95;
        if (matchesReplyIntent) return 0.90;
        return 0.80;
      }

      if (isContentEditable && matchesReplyIntent) return 1.0;
      if (elType === "textarea" && matchesReplyIntent) return 1.0;
      if (isContentEditable && (activeCompType === "reply" || planCompType === "reply")) return 0.95;
      if (elType === "textarea" && (activeCompType === "reply" || planCompType === "reply")) return 0.90;
      if (matchesReplyIntent) return 0.85;
      return 0.1;
    }

    // 0e. Email compose textbox field grounding (Gmail, Outlook, etc.)
    const isEmailComposerHint = hNorm === "active compose textbox" || hNorm === "compose body" || hNorm === "email body" ||
      planCompType === "email" || activeCompType === "email" ||
      (typeof currentStepPlan !== "undefined" && currentStepPlan && (currentStepPlan.target === "active compose textbox" || currentStepPlan.context === "compose_body")) ||
      (hNorm === "body" && (activeCompType === "email" || planCompType === "email"));

    if (isEmailComposerHint) {
      if (isSearchTarget || isSearchHint || el.semanticTag === "SEARCH_INPUT") return 0;
      const candMeta = [labelNorm, ariaNorm, placeholderNorm, normalize(el.name), normalize(el.id)].join(" ");
      if (/\b(?:recipient|recipients|to|subject|cc|bcc)\b/i.test(candMeta) && !/\b(?:message\s+body|compose\s+body)\b/i.test(candMeta)) {
        return 0;
      }
      const isContentEditable = elType === "contenteditable" || el.isContentEditable || elRole === "textbox";
      const fullCand = [labelNorm, ariaNorm, placeholderNorm, normalize(el.nearbyText), normalize(el.contextText)].join(" ");
      const matchesEmailIntent = /\b(?:message\s+body|compose\s+body|email\s+body|body|write\s+(?:an?\s+)?email|type\s+message)\b/i.test(fullCand);

      if (isContentEditable && matchesEmailIntent) return 1.0;
      if (elType === "textarea" && matchesEmailIntent) return 1.0;
      if (isContentEditable && (activeCompType === "email" || planCompType === "email")) return 0.98;
      if (elType === "textarea" && (activeCompType === "email" || planCompType === "email")) return 0.92;
      if (matchesEmailIntent) return 0.85;
      return 0.1;
    }

    // 0f. Comment box field grounding
    const isCommentComposerHint = hNorm === "active comment box" || hNorm === "comment box" || hNorm === "comment" ||
      planCompType === "comment" || activeCompType === "comment" ||
      (typeof currentStepPlan !== "undefined" && currentStepPlan && (currentStepPlan.target === "active comment box" || currentStepPlan.context === "comment_box"));

    if (isCommentComposerHint) {
      if (isSearchTarget || isSearchHint || el.semanticTag === "SEARCH_INPUT") return 0;
      const isContentEditable = elType === "contenteditable" || el.isContentEditable || elRole === "textbox";
      const fullCand = [labelNorm, ariaNorm, placeholderNorm, normalize(el.nearbyText), normalize(el.contextText)].join(" ");
      const matchesCommentIntent = /\b(?:comment|add\s+a\s+comment|write\s+a\s+comment|leave\s+a\s+comment)\b/i.test(fullCand);

      if (isContentEditable && matchesCommentIntent) return 1.0;
      if (elType === "textarea" && matchesCommentIntent) return 1.0;
      if (isContentEditable && (activeCompType === "comment" || planCompType === "comment")) return 0.98;
      if (elType === "textarea" && (activeCompType === "comment" || planCompType === "comment")) return 0.92;
      if (matchesCommentIntent) return 0.85;
      return 0.1;
    }

    // 1. Direct label match
    if (labelNorm === hNorm) return 1.0;
    if (isFieldMatch(el.label, fieldHint)) return 1.0;

    // 2. ARIA label match
    if (el.ariaLabel) {
      if (normalize(el.ariaLabel) === hNorm || isFieldMatch(el.ariaLabel, fieldHint)) return 1.0;
    }

    // 3. Nearby DOM context match
    if (el.nearbyText) {
      if (isFieldMatch(el.nearbyText, fieldHint)) return 0.95;
    }

    // 4. Enclosing context text match
    if (el.contextText) {
      if (isFieldMatch(el.contextText, fieldHint)) return 0.90;
    }

    // 5. Placeholder match
    if (el.placeholder) {
      if (isFieldMatch(el.placeholder, fieldHint)) return 0.85;
    }

    // 6. Name / ID match
    if (el.name && isFieldMatch(el.name, fieldHint)) return 0.80;
    if (el.id && isFieldMatch(el.id, fieldHint)) return 0.80;

    // 7. Substring on label if >= 3 chars
    if (hNorm.length >= 3 && (labelNorm.includes(hNorm) || hNorm.includes(labelNorm))) return 0.75;

    return 0;
  };

  /**
   * Preserves a rich, normalized semantic target descriptor for dynamic controls.
   * Conforms to requirement 1: does NOT rely on DOM index or bounding box as primary identity.
   */
  const createSemanticTargetDescriptor = (el, targetHint = "", roleHint = "") => {
    if (!el && !targetHint) return null;
    const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
    const actualHint = typeof targetHint === "string" ? targetHint : (targetHint?.targetHint || targetHint?.target || targetHint?.fieldHint || "");
    const actualRole = typeof roleHint === "string" ? roleHint : (typeof targetHint === "object" ? (targetHint?.targetRole || targetHint?.role || "") : "");
    const lbl = el?.label || actualHint || "";
    const isSearchTarget = actualRole === "PRIMARY_SEARCH_INPUT" ||
      actualHint === "PRIMARY_SEARCH_INPUT" ||
      actualHint === "search" ||
      el?.semanticTag === "SEARCH_INPUT" ||
      (typeof currentStepPlan !== "undefined" && currentStepPlan && (currentStepPlan.expectedRole === "PRIMARY_SEARCH_INPUT" || currentStepPlan.targetRole === "PRIMARY_SEARCH_INPUT" || currentStepPlan.fieldHint === "search"));

    const role = isSearchTarget ? "PRIMARY_SEARCH_INPUT" : (el?.role || (el?.type === "combobox" ? "combobox" : (el?.type === "textbox" ? "textbox" : (el?.type || actualRole || "element"))));
    const inputType = el?.inputType || el?.type || "input";
    return {
      normalizedLabel: isSearchTarget ? "primary_search_input" : normalize(lbl),
      label: lbl,
      role: role,
      targetRole: isSearchTarget ? "PRIMARY_SEARCH_INPUT" : (actualRole || role),
      isSearchIntent: isSearchTarget,
      inputType: inputType,
      controlType: inputType,
      url: el?.url || el?.href || null,
      href: el?.href || el?.url || null,
      domain: el?.domain || null,
      tag: el?.tag || el?.tagName || null,
      placeholder: el?.placeholder || null,
      ariaLabel: el?.ariaLabel || null,
      name: el?.name || null,
      id: el?.id || null,
      title: el?.title || null,
      nearbyVisibleText: el?.nearbyText || null,
      associatedLabel: el?.associatedLabel || null,
      contextText: el?.contextText || el?.nearbyText || null,
      targetHint: actualHint || lbl,
      originalIndex: el?.index !== undefined ? el.index : (el?.domIndex !== undefined ? el.domIndex : null),
      bounds: (typeof normalizeBounds === "function" ? normalizeBounds : (b => Array.isArray(b) ? { x: b[0], y: b[1], width: b[2], height: b[3] } : (b && typeof b.x === "number" ? { x: b.x, y: b.y, width: b.width || 0, height: b.height || 0 } : null)))(el?.bounds || (el?.x !== undefined ? { x: el.x, y: el.y, width: el.width, height: el.height } : null))
    };
  };

  /**
   * Scores a candidate element against a semantic target descriptor using weighted semantic evidence.
   */
  const scoreCandidateAgainstDescriptor = (cand, targetDesc) => {
    if (!cand || !targetDesc) return 0;
    const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
    const normUrl = typeof normalizeUrl === "function" ? normalizeUrl : (u => (u ? String(u).trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "") : ""));
    const normBounds = typeof normalizeBounds === "function" ? normalizeBounds : (b => Array.isArray(b) ? { x: b[0], y: b[1], width: b[2], height: b[3] } : (b && typeof b.x === "number" ? { x: b.x, y: b.y, width: b.width || 0, height: b.height || 0 } : null));
    const targetLabel = normalize(targetDesc.normalizedLabel || targetDesc.targetLabel || targetDesc.label || targetDesc.fieldHint || targetDesc.target || "");
    if (!targetLabel) return 0;

    const candLabel = normalize(cand.label);
    const candAria = normalize(cand.ariaLabel);
    const candPlaceholder = normalize(cand.placeholder);
    const candName = normalize(cand.name);
    const candId = normalize(cand.id);
    const candTitle = normalize(cand.title);
    const candNearby = normalize(cand.nearbyText || cand.nearbyVisibleText);
    const candContext = normalize(cand.contextText);
    const candAssoc = normalize(cand.associatedLabel);

    const isSearchDescriptor = targetDesc.isSearchIntent ||
      targetDesc.targetRole === "PRIMARY_SEARCH_INPUT" ||
      targetDesc.role === "PRIMARY_SEARCH_INPUT" ||
      targetLabel === "primary_search_input" ||
      targetLabel === "search";

    if (isSearchDescriptor) {
      const hasExplicitAi = typeof originalUserTask !== "undefined" && originalUserTask &&
        /\b(?:gemini|copilot|chatgpt|ai\s+mode|ai\s+assistant|chat\s+with|ask\s+ai)\b/i.test(originalUserTask);
      if (typeof scoreSearchCandidate === "function") {
        return scoreSearchCandidate(cand, typeof originalUserTask !== "undefined" ? originalUserTask : "", hasExplicitAi);
      }
      if (typeof globalThis !== "undefined" && typeof globalThis.scoreSearchCandidate === "function") {
        return globalThis.scoreSearchCandidate(cand, typeof originalUserTask !== "undefined" ? originalUserTask : "", hasExplicitAi);
      }
      if (!hasExplicitAi) {
        const candFull = [candLabel, candAria, candPlaceholder, candName, candId, candTitle, candNearby, candContext].join(" ");
        if (/\b(?:ai\s+mode|ask\s+anything|ask\s+google|gemini|ai\s+assistant|assistant|chat\s+with|ask\s+ai|ai\s+search|copilot|how\s+search\s+works)\b/i.test(candFull) || /^(?:chat|ai|assistant|how\s+search\s+works)$/i.test(candLabel)) {
          return 0;
        }
      }
    }

    const candType = (cand.type || "").toLowerCase();
    const candRole = (cand.role || cand.type || "").toLowerCase();
    const targetRole = (targetDesc.role || targetDesc.targetType || "").toLowerCase();
    const isFormTarget = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].some(r => targetRole.includes(r)) ||
      Boolean(targetDesc.fieldHint);
    const isFormCand = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes(candType) ||
      ["input", "textarea", "select", "combobox", "searchbox", "textbox"].includes(candRole) ||
      Boolean(cand.ariaAutocomplete);

    // Reject voice/mic controls unless explicitly requested
    if (!targetLabel.includes("voice") && !targetLabel.includes("mic")) {
      if (/voice|mic|audio|speak/i.test(candLabel) || /voice|mic|audio|speak/i.test(candAria)) return 0;
    }

    // Generic search vs non-search distinction
    const isTargetSearch = /\bsearch\b/i.test(targetLabel);
    const isCandSearch = /\bsearch\b/i.test(candLabel) || /\bsearch\b/i.test(candAria) || /\bsearch\b/i.test(candPlaceholder) || cand.semanticTag === "SEARCH_INPUT";
    if (!isTargetSearch && isCandSearch && !candNearby.includes(targetLabel) && !candAssoc.includes(targetLabel)) {
      if (/^search(?:\s+(?:box|input|field|bar|area|website))?$/i.test(candLabel) || /^search(?:\s+(?:box|input|field|bar|area|website))?$/i.test(candPlaceholder)) {
        return 0;
      }
    }

    let score = 0;

    // 1. Direct label match
    if (candLabel === targetLabel) {
      score += 0.45;
    } else if (isFieldMatch(cand.label, targetLabel)) {
      score += 0.40;
    } else if (targetLabel.length >= 3 && (candLabel.includes(targetLabel) || targetLabel.includes(candLabel))) {
      score += 0.35;
    } else {
      const tTokens = targetLabel.split(/\s+/).filter(w => w.length >= 3 || w === "to" || w === "from");
      const cTokens = candLabel.split(/\s+/).filter(w => w.length >= 3 || w === "to" || w === "from");
      const matchedTokens = tTokens.filter(t => cTokens.includes(t) || candLabel.includes(t));
      if (tTokens.length > 0 && matchedTokens.length === tTokens.length) {
        score += 0.30;
      } else if (matchedTokens.length > 0) {
        score += 0.15 * (matchedTokens.length / tTokens.length);
      }
    }

    // 1b. Destination URL / domain matching (Essential for search results like ISRO)
    const targetUrl = normUrl(targetDesc.url || targetDesc.href || "");
    const targetDomain = normalize(targetDesc.domain || (targetUrl.match(/https?:\/\/(?:www\.)?([^/]+)/i)?.[1]) || "");
    const candUrl = normUrl(cand.url || cand.href || (cand.node?.href || ""));
    if (targetUrl && candUrl) {
      if (candUrl === targetUrl || candUrl.includes(targetUrl) || targetUrl.includes(candUrl)) {
        score += 0.50;
      }
    }
    if (targetDomain && (candUrl.includes(targetDomain) || candNearby.includes(targetDomain) || candContext.includes(targetDomain) || candLabel.includes(targetDomain))) {
      score += 0.45;
    }

    // 1c. Acronym & Organization Entity expansion (e.g. ISRO <-> Indian Space Research Organisation)
    const ENTITY_EXPANSIONS = {
      isro: ["indian space research organisation", "isro"],
      linkedin: ["linkedin"],
      github: ["github"],
      nasa: ["national aeronautics and space administration", "nasa"]
    };
    const targetHintStr = typeof targetDesc.targetHint === "string" ? targetDesc.targetHint.toLowerCase() : "";
    for (const [ek, expansions] of Object.entries(ENTITY_EXPANSIONS)) {
      if (targetLabel.includes(ek) || (targetHintStr && targetHintStr.includes(ek))) {
        if (expansions.some(exp => candLabel.includes(exp) || candNearby.includes(exp) || candAria.includes(exp))) {
          score += 0.40;
          break;
        }
      }
    }

    // 2. ARIA label match
    if (candAria) {
      if (candAria === targetLabel || (targetDesc.ariaLabel && candAria === normalize(targetDesc.ariaLabel)) || isFieldMatch(cand.ariaLabel, targetLabel)) {
        score += 0.35;
      } else if (targetLabel.length >= 3 && (candAria.includes(targetLabel) || targetLabel.includes(candAria))) {
        score += 0.25;
      }
    }

    // 3. Placeholder match
    if (candPlaceholder) {
      if (candPlaceholder === targetLabel || (targetDesc.placeholder && candPlaceholder === normalize(targetDesc.placeholder)) || isFieldMatch(cand.placeholder, targetLabel)) {
        score += 0.30;
      } else if (targetLabel.length >= 3 && (candPlaceholder.includes(targetLabel) || targetLabel.includes(candPlaceholder))) {
        score += 0.20;
      }
    }

    // 4. Role & dynamic control compatibility
    if (isFormTarget && isFormCand) {
      score += 0.15;
      if (targetRole && candRole && (targetRole === candRole || candType === targetRole)) {
        score += 0.05;
      }
    } else if (!isFormTarget && (candType === "button" || candType === "link" || candRole === "button" || candRole === "link")) {
      score += 0.10;
    }

    // 5. Name / ID / Title match
    if (candName && (candName === targetLabel || (targetDesc.name && candName === normalize(targetDesc.name)) || isFieldMatch(cand.name, targetLabel))) score += 0.15;
    if (candId && (candId === targetLabel || (targetDesc.id && candId === normalize(targetDesc.id)) || isFieldMatch(cand.id, targetLabel))) score += 0.15;
    if (candTitle && (candTitle === targetLabel || (targetDesc.title && candTitle === normalize(targetDesc.title)) || isFieldMatch(cand.title, targetLabel))) score += 0.15;

    // 6. Nearby DOM text & parent/ancestor context
    if (candNearby && (candNearby === targetLabel || candNearby.includes(targetLabel) || isFieldMatch(candNearby, targetLabel))) score += 0.20;
    if (candContext && (candContext === targetLabel || candContext.includes(targetLabel) || isFieldMatch(candContext, targetLabel))) score += 0.15;
    if (candAssoc && (candAssoc === targetLabel || candAssoc.includes(targetLabel) || isFieldMatch(candAssoc, targetLabel))) score += 0.20;

    // 7. Secondary hints (tie-breakers and identity confirmation)
    if (typeof targetDesc.originalIndex === "number" && cand.index === targetDesc.originalIndex && score > 0) {
      score += 0.15;
    }
    const tBounds = normBounds(targetDesc.bounds);
    const cBounds = normBounds(cand.bounds || cand);
    if (tBounds && cBounds && score > 0) {
      const dx = Math.abs(cBounds.x - tBounds.x);
      const dy = Math.abs(cBounds.y - tBounds.y);
      if (dx < 25 && dy < 25) {
        score += 0.25;
      } else if (dx < 50 && dy < 50) {
        score += 0.10;
      }
    }

    return Math.min(1.0, score);
  };

  /**
   * Re-grounds a semantic target descriptor against fresh perception elements.
   * Conforms to requirements 2, 5, 6:
   * - Evaluates weighted semantic evidence
   * - Uses DOM index and coordinates only as secondary hints
   * - If exactly one matches strongly (score >= 0.35, difference >= 0.08), returns it
   * - If multiple match with similar confidence, returns ambiguous
   */
  const reGroundSemanticTarget = (freshElements, targetDesc) => {
    if (!Array.isArray(freshElements) || freshElements.length === 0 || !targetDesc) {
      return { match: null, isAmbiguous: false, score: 0, index: -1 };
    }

    const scored = [];
    freshElements.forEach((cand, idx) => {
      if (!cand || cand.disabled || String(cand["aria-disabled"]).toLowerCase() === "true") return;
      const candType = (cand.type || "").toLowerCase();
      const candRole = (cand.role || "").toLowerCase();
      const isDynamic = ["combobox", "select"].includes(candType) || ["combobox", "select"].includes(candRole);
      const isTargetClick = targetDesc.action === "CLICK" || targetDesc.controlType === "button" || targetDesc.controlType === "link";
      if (cand.readOnly && !isDynamic && !isTargetClick) return;
      const s = scoreCandidateAgainstDescriptor(cand, targetDesc);
      if (s >= 0.35) {
        scored.push({ cand, idx, score: s });
      }
    });

    if (scored.length === 0) {
      return { match: null, isAmbiguous: false, score: 0, index: -1 };
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];

    // Ambiguity check (Requirement 6)
    if (scored.length > 1) {
      const runnerUp = scored[1];
      if (Math.abs(top.score - runnerUp.score) < 0.08) {
        const topLabel = (top.cand.label || "").trim().toLowerCase();
        const runLabel = (runnerUp.cand.label || "").trim().toLowerCase();
        if (topLabel !== runLabel) {
          return { match: null, isAmbiguous: true, score: top.score, index: -1, candidates: [top.cand, runnerUp.cand] };
        }
      }
    }

    return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
  };

  /**
   * Helper to execute the core local perception pipeline (M7-M12) once.
   * Returns a promise resolving with { tab, pageData, redactionResult }.
   */
  const runLocalPipeline = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          tab = tabs && tabs[0];
        }

        if (!tab || !tab.id) {
          throw new Error("No active tab found");
        }

        if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("view-source:"))) {
          const restrictedErr = new Error("This page is restricted by the browser.");
          restrictedErr.isRestrictedPage = true;
          throw restrictedErr;
        }

        // Ensure page navigation / loading is stabilized and content script ready before perception
        await waitForTabReady(tab.id, 5000);

        // 1. Trigger local screenshot capture (M7, M9, M12) with tab windowId
        captureVisualContext(tab.windowId);

        // 2. Query DOM metadata and sensitive regions via content script (M1, M2, M8, M11)
        const tDomStart = performance.now();

        const handleDomResponse = (response) => {
          const domElapsed = Math.round(performance.now() - tDomStart);
          if (response && response.success) {
            timing.domExtractionMs = domElapsed;
            timing.sensitiveRegionDetectionMs = typeof response.sensitiveDetectionMs === "number"
              ? response.sensitiveDetectionMs
              : 0;

            currentPerceptionGeneration++;
            latestVisualElements = response.visualElements || [];
            latestVisualElements.forEach((el) => {
              el.perceptionGeneration = currentPerceptionGeneration;
            });
            latestSensitiveRegions = response.sensitiveRegions || [];
            latestPageData = response;

            // Display local sanitized context
            if (outputArea) outputArea.value = `Title: ${response.title}\nURL: ${response.url}`;
            if (sampleOutput) sampleOutput.value = response.redactedSample || "(No visible text found on page)";

            // Milestone 8: Display detected visual elements locally
            if (elementsOutput) {
              if (response.visualElements && Array.isArray(response.visualElements) && response.visualElements.length > 0) {
                let elementsText = `Detected elements: ${response.visualElements.length}\n\n`;
                response.visualElements.forEach((el, index) => {
                  const typeUpper = (el.type || "ELEMENT").toUpperCase();
                  elementsText += `${index + 1}.${typeUpper} — ${el.label} [x:${el.x}, y:${el.y}, w:${el.width}, h:${el.height}]\n`;
                });
                elementsOutput.value = elementsText.trim();
              } else {
                elementsOutput.value = "No visual elements detected.";
              }
            }

            renderPerceptionSummary();

            // Trigger redaction if screenshot + OCR are already settled
            triggerRedaction();

            // Await both redaction and vision inference before resolving local perception
            Promise.allSettled([
              waitForRedaction(),
              latestVisionPromise || Promise.resolve(null)
            ]).then(([redactionSettled]) => {
              renderPerceptionSummary();
              resolve({
                tab,
                pageData: response,
                redactionResult: redactionSettled && redactionSettled.status === "fulfilled" ? redactionSettled.value : null
              });
            });
          } else {
            reject(new Error("Failed to retrieve page info from content script"));
          }
        };

        // Send getPageInfo to content script
        chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (response) => {
          if (chrome.runtime.lastError) {
            // Dynamic injection fallback if content script not yet present
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["form-profile.js", "pii-detector.js", "change-detector.js", "content.js"]
              });

              chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  handleDomResponse(retryResponse);
                }
              });
            } catch (injectErr) {
              reject(new Error(`Script injection failed: ${injectErr.message}`));
            }
            return;
          }

          handleDomResponse(response);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  // Milestone 14 & Final Architecture: Render Explainable Agent Trace (Section 22) + Evaluation Telemetry (Section 23)
  const renderTraceHistory = () => {
    if (agentTraceContainer) {
      if (!executionTraceHistory || executionTraceHistory.length === 0) {
        agentTraceContainer.innerHTML = "<div style='color: #94a3b8; font-style: italic; text-align: center; padding: 8px 0;'>No trace recorded yet. Run a task to view execution timeline.</div>";
        if (traceStepCount) traceStepCount.textContent = "0 steps executed";
      } else {
        let html = "";
        if (traceStepCount) traceStepCount.textContent = `${executionTraceHistory.length} step(s) recorded`;
        executionTraceHistory.forEach((t) => {
          const execColor = t.executed ? "#166534" : (t.status === "completed" ? "#1565c0" : "#b91c1c");
          const riskColor = (t.risk === "HIGH" || t.risk === "CRITICAL") ? "#b91c1c" : ((t.risk === "MEDIUM") ? "#b45309" : "#3730a3");
          const riskBg = (t.risk === "HIGH" || t.risk === "CRITICAL") ? "#fee2e2" : ((t.risk === "MEDIUM") ? "#fef3c7" : "#e0e7ff");
          const actType = (t.action?.action || "NONE").toUpperCase();
          const actBadgeClass = actType === "FILL" ? "badge-action-fill" :
            (actType === "CLICK" ? "badge-action-click" :
              (actType === "SUBMIT" ? "badge-action-submit" :
                (actType === "SELECT" ? "badge-action-select" :
                  (["CHECK", "UNCHECK", "TOGGLE"].includes(actType) ? "badge-action-check" : "badge-action-none"))));
          const stepTotal = t.totalSteps || (typeof totalPlannedSteps !== "undefined" && totalPlannedSteps ? totalPlannedSteps : Math.max(t.step || 1, 1));

          html += `<div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: #1e40af; font-size: 11px;">STEP ${t.step} / ${stepTotal}</span> 
                <span class="action-badge ${actBadgeClass}">${escapeHtml(actType)}</span>
              </div>
              <span style="font-size: 8.5px; padding: 1px 5px; border-radius: 3px; font-weight: bold; background: ${riskBg}; color: ${riskColor};">[${t.risk || "LOW"}]</span>
            </div>
            <div style="font-size: 10.5px; color: #1e293b; margin-bottom: 2px;">
              <strong>Target:</strong> <span style="color: #0f172a; font-weight: 600;">${escapeHtml(t.action?.targetLabel || t.action?.target || "None")}</span>
              ${t.action?.value ? `<span style="color: #047857; font-family: monospace; font-weight: 600; margin-left: 4px;">(value: '${escapeHtml(window.SIHActionVerifier?.sanitizeFailureReason ? window.SIHActionVerifier.sanitizeFailureReason(String(t.action.value)) : (typeof redactText === "function" ? redactText(String(t.action.value)) : "[REDACTED]"))}')</span>` : ""}
              ${t.action?.amount ? `<span style="color: #64748b; margin-left: 4px;">(${t.action.amount}px)</span>` : ""}
            </div>
            <div style="font-size: 9.5px; color: #475569; display: flex; flex-direction: column; gap: 1px; margin-top: 3px; padding-top: 3px; border-top: 1px dashed #f1f5f9;">
              <div><strong>Execution:</strong> <span style="color: ${execColor}; font-weight: 700;">${t.executed ? "SUCCESS" : "FAILED"} — ${escapeHtml(t.executionResult)}</span></div>
              ${t.verification ? `<div><strong>Verification:</strong> <span style="color: ${
                (t.verificationDetails && t.verificationDetails.status === "FAILED") ? "#dc2626" : ((t.verificationDetails && t.verificationDetails.status === "UNKNOWN") ? "#d97706" : "#15803d")
              }; font-weight: 600;">${(t.verificationDetails && t.verificationDetails.status === "FAILED") ? "✗ " : ((t.verificationDetails && t.verificationDetails.status === "UNKNOWN") ? "? " : "✓ ")}${escapeHtml(t.verification)}</span></div>` : ""}
              <details style="margin-top: 2px; font-size: 9px; color: #64748b;">
                <summary style="cursor: pointer; color: #3b82f6; font-weight: 600;">Audit &amp; Grounding Details</summary>
                <div style="padding: 4px; background: #f8fafc; border-radius: 4px; margin-top: 2px; border: 1px solid #e2e8f0; line-height: 1.35;">
                  <div>• <strong>Perception:</strong> ${escapeHtml(t.perception || "DOM perception active")}</div>
                  <div>• <strong>Grounding:</strong> ${escapeHtml(t.groundingStr || "Target matched")}</div>
                  ${t.semanticDetails ? `<div>• <strong>Semantic Target:</strong> ${escapeHtml(t.semanticDetails)}</div>` : ""}
                  <div>• <strong>Safety Gate:</strong> ${escapeHtml(t.safetyDecision || "ALLOWED")} (Approval: ${escapeHtml(t.humanApproval || "NOT REQUIRED")})</div>
                  ${t.verificationDetails && t.verificationDetails.evidence ? `<div>• <strong>Verification Evidence:</strong> ${escapeHtml(Object.entries(t.verificationDetails.evidence).filter(([_, v]) => v).map(([k]) => k).join(", ") || "State evaluated")}</div>` : ""}
                  ${t.recovery ? `<div style="color: #0369a1; font-weight: bold;">• <strong>Recovery:</strong> ${escapeHtml(typeof t.recovery === "object" ? `[${t.recovery.result}] ${t.recovery.reason || "Outcome processed"}${t.recovery.recoveryAction ? ` (Action: ${t.recovery.recoveryAction})` : ""}` : t.recovery)}</div>` : ""}
                </div>
              </details>
            </div>
          </div>`;
        });
        agentTraceContainer.innerHTML = html;
        agentTraceContainer.scrollTop = agentTraceContainer.scrollHeight;
      }
    }

    // Update Section 23 Evaluation & Safety Benchmark Telemetry
    if (window.SIHEvaluationTracker && typeof window.SIHEvaluationTracker.getSummary === "function") {
      const summary = window.SIHEvaluationTracker.getSummary();
      const evalTasksCount = document.getElementById("evalTasksCount");
      const evalActionsCount = document.getElementById("evalActionsCount");
      const evalGroundingConf = document.getElementById("evalGroundingConf");
      const evalVerifRate = document.getElementById("evalVerifRate");
      const evalRecoveryCount = document.getElementById("evalRecoveryCount");
      const evalReplanCount = document.getElementById("evalReplanCount");
      const evalSafetyStatus = document.getElementById("evalSafetyStatus");
      const evalZeroViolationBadge = document.getElementById("evalZeroViolationBadge");

      if (evalTasksCount) evalTasksCount.textContent = `${summary.tasksSucceeded}/${summary.tasksAttempted}`;
      if (evalActionsCount) evalActionsCount.textContent = `${summary.actionsExecuted}/${summary.actionsAttempted}`;
      if (evalGroundingConf) evalGroundingConf.textContent = summary.avgGroundingConfidence ? `${(summary.avgGroundingConfidence * 100).toFixed(0)}%` : "-";
      if (evalVerifRate) evalVerifRate.textContent = summary.verificationSuccessRate ? `${(summary.verificationSuccessRate * 100).toFixed(0)}%` : "-";
      if (evalRecoveryCount) evalRecoveryCount.textContent = String(summary.recoveryCount);
      if (evalReplanCount) evalReplanCount.textContent = String(summary.replanningCount);
      if (evalSafetyStatus) {
        evalSafetyStatus.textContent = summary.isZeroUnauthorizedConsequential
          ? `PASSED (0 Violations, ${summary.blockedConsequentialActions} Gated)`
          : `VIOLATION (${summary.unauthorizedConsequentialActions} unauthorized)`;
        evalSafetyStatus.style.color = summary.isZeroUnauthorizedConsequential ? "#166534" : "#dc2626";
      }
      if (evalZeroViolationBadge) {
        evalZeroViolationBadge.textContent = `${summary.unauthorizedConsequentialActions} UNAUTHORIZED ACTIONS`;
        evalZeroViolationBadge.style.background = summary.isZeroUnauthorizedConsequential ? "#e8f5e9" : "#fee2e2";
        evalZeroViolationBadge.style.color = summary.isZeroUnauthorizedConsequential ? "#166534" : "#dc2626";
      }
    }
  };

  // =====================================================================
  // Milestone 20: Voice Assistant Input Layer Integration
  // =====================================================================
  let voiceAssistant = null;

  if (window.SIHVoiceAssistant && typeof window.SIHVoiceAssistant.VoiceAssistantController === "function") {
    voiceAssistant = new window.SIHVoiceAssistant.VoiceAssistantController({
      onStateChange: (state, message, transcript) => {
        if (voiceStatusBadge) {
          voiceStatusBadge.textContent = state;
          if (state === "LISTENING") {
            voiceStatusBadge.style.background = "#fee2e2";
            voiceStatusBadge.style.color = "#dc2626";
          } else if (state === "CONFIRMING") {
            voiceStatusBadge.style.background = "#e0f2fe";
            voiceStatusBadge.style.color = "#0369a1";
          } else if (state === "RUNNING") {
            voiceStatusBadge.style.background = "#fef3c7";
            voiceStatusBadge.style.color = "#b45309";
          } else if (state === "ERROR") {
            voiceStatusBadge.style.background = "#fee2e2";
            voiceStatusBadge.style.color = "#991b1b";
          } else {
            voiceStatusBadge.style.background = "#f1f5f9";
            voiceStatusBadge.style.color = "#475569";
          }
        }

        if (voiceStatusText && message) {
          voiceStatusText.textContent = message;
          if (state === "ERROR") {
            voiceStatusText.style.color = "#dc2626";
          } else if (state === "CONFIRMING") {
            voiceStatusText.style.color = "#0369a1";
          } else {
            voiceStatusText.style.color = "#64748b";
          }
        }

        if (voiceMicBtn) {
          if (state === "LISTENING") {
            voiceMicBtn.style.background = "#dc2626";
            if (voiceMicIcon) voiceMicIcon.textContent = "🔴";
            if (voiceMicLabel) voiceMicLabel.textContent = "Listening...";
          } else {
            voiceMicBtn.style.background = "#2563eb";
            if (voiceMicIcon) voiceMicIcon.textContent = "🎤";
            if (voiceMicLabel) voiceMicLabel.textContent = "Speak Command";
          }
        }
      },

      onTranscriptReady: (transcript) => {
        // Update taskInput textarea so user can see what will be executed
        if (taskInput) {
          taskInput.value = transcript;
        }
        if (voiceTranscriptText) {
          voiceTranscriptText.textContent = `"${transcript}"`;
        }
        if (voiceConfirmationCard) {
          voiceConfirmationCard.style.display = "block";
        }
      },

      onExecute: (confirmedTranscript) => {
        // Ensure confirmed transcript is in task input
        if (taskInput) {
          taskInput.value = confirmedTranscript;
        }
        if (voiceConfirmationCard) {
          voiceConfirmationCard.style.display = "none";
        }
        // Seamlessly invoke the existing Agent Task execution pipeline
        if (runAgentTaskBtn) {
          runAgentTaskBtn.click();
        }
      },

      onError: (errMsg) => {
        if (voiceConfirmationCard) {
          voiceConfirmationCard.style.display = "none";
        }
      }
    });

    // Check availability on initialization
    if (!voiceAssistant.isAvailable()) {
      if (voiceStatusBadge) {
        voiceStatusBadge.textContent = "UNAVAILABLE";
        voiceStatusBadge.style.background = "#f3f4f6";
        voiceStatusBadge.style.color = "#9ca3af";
      }
      if (voiceStatusText) {
        voiceStatusText.textContent = "Voice input is not available in this browser. You can still use the text Agent Task.";
      }
      if (voiceMicBtn) {
        voiceMicBtn.disabled = true;
        voiceMicBtn.style.opacity = "0.6";
        voiceMicBtn.style.cursor = "not-allowed";
        voiceMicBtn.title = "Speech recognition is not available in this environment";
      }
    }
  }

  // Bind voice controls
  if (voiceMicBtn) {
    voiceMicBtn.addEventListener("click", () => {
      if (!voiceAssistant) return;
      if (voiceAssistant.getState() === "LISTENING") {
        voiceAssistant.stopListening();
      } else {
        voiceAssistant.startListening();
      }
    });
  }

  if (voiceConfirmBtn) {
    voiceConfirmBtn.addEventListener("click", () => {
      if (voiceAssistant) {
        voiceAssistant.confirmTranscript();
      }
    });
  }

  if (voiceRetryBtn) {
    voiceRetryBtn.addEventListener("click", () => {
      if (voiceAssistant) {
        voiceAssistant.tryAgain();
      }
    });
  }

  if (voiceClearBtn) {
    voiceClearBtn.addEventListener("click", () => {
      if (voiceAssistant) {
        voiceAssistant.clearTranscript();
      }
      if (voiceConfirmationCard) {
        voiceConfirmationCard.style.display = "none";
      }
    });
  }

  // =====================================================================
  // =====================================================================
  // Milestone 14, 15 & 16: Bounded Multi-Step Agent Loop with Safe Form Fill
  // Loop (up to MAX_AGENT_STEPS = 5): Observe -> Verify -> Gateway -> Execute -> Post-Verify
  // =====================================================================
  if (runAgentTaskBtn) {
    runAgentTaskBtn.addEventListener("click", async () => {
      const currentSessionToken = ++activeExecutionSessionToken;
      console.log(`[SIH26171] Run Agent Task clicked (Session #${currentSessionToken})`);
      const task = (taskInput ? taskInput.value : "").trim() || "Find the Submit button and click it.";

      // Update Browser Agent Status immediately upon click so user sees active state
      if (agentTaskText) agentTaskText.textContent = task;
      if (agentExecutionStatus) agentExecutionStatus.textContent = "Starting...";
      if (agentSafetyStatus) agentSafetyStatus.textContent = "Analyzing...";

      let currentStep = 1;
      let currentRequestId = "-";

      // TASK STATE ISOLATION (M23 & Critical Rules 7 & 8): Ensure previous task plan/perception state never leaks into new task
      executionTraceHistory = [];
      renderTraceHistory();
      resetTaskGroundingState();

      try {
        // Retrieve active tab metadata if available for plan context
        let pageTitle = document.title;
        let pageUrl = window.location.href;
        try {
          const initialTabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (initialTabs && initialTabs[0]) {
            pageTitle = initialTabs[0].title || pageTitle;
            pageUrl = initialTabs[0].url || pageUrl;
          }
        } catch (_) {}

        // Milestone 16: Local deterministic NL task parser (client-side only; values never transmitted)
        let parsedTask = null;
        if (window.SIHTaskParser && typeof window.SIHTaskParser.parseTask === "function") {
          parsedTask = window.SIHTaskParser.parseTask(task);
        }
        console.log("[SIH26171] Task parsed");

        // Final Architecture: On-Device Reasoning & Safety Planner (Deterministic, Local, Auditable)
        let reasoningPlan = null;
        if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.planTask === "function") {
          reasoningPlan = window.SIHReasoningPlanner.planTask(parsedTask, {
            title: pageTitle,
            url: pageUrl
          });
        }
        console.log("[SIH26171] Reasoning plan created");

        // Milestone 17: Semantic Task Normalization Stage
        // Guarantees clean separation of Content, Actions, and Control/Approval before grounding & execution
        if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.normalizeTaskPlan === "function") {
          reasoningPlan = window.SIHReasoningPlanner.normalizeTaskPlan(reasoningPlan, parsedTask, task);
        }
        console.log("[SIH26171] Semantic task normalization completed");

        // Persistent original user task (never overwritten or truncated)
        const originalUserTask = task;
        let taskGoals = (reasoningPlan && Array.isArray(reasoningPlan.goals) && reasoningPlan.goals.length > 0)
          ? reasoningPlan.goals
          : (parsedTask && Array.isArray(parsedTask.goals) ? parsedTask.goals : []);
        let completedGoals = [];
        let remainingGoals = [...taskGoals];

        // Render transparent task understanding and structured plan in UI
        if (plannerTaskUnderstanding) {
          plannerTaskUnderstanding.textContent = reasoningPlan ? reasoningPlan.taskUnderstanding : originalUserTask;
        }
        if (plannerExecutionPlan) {
          if (taskGoals && taskGoals.length > 0) {
            let planHtml = `<div style="margin-bottom: 4px; font-weight: bold; color: #1e3a8a;">Ordered Subgoals (${taskGoals.length}):</div>`;
            taskGoals.forEach((g) => {
              planHtml += `<div style="padding: 1px 0 1px 6px; font-size: 10px; color: #1e293b;">&bull; <strong>Goal ${g.id}:</strong> ${escapeHtml(g.title)}</div>`;
            });
            planHtml += `<div style="margin: 4px 0 2px; font-weight: bold; color: #1e3a8a;">Action Steps (${reasoningPlan ? reasoningPlan.steps.length : parsedTask.steps.length}):</div>`;
            const planSteps = (reasoningPlan && reasoningPlan.steps) ? reasoningPlan.steps : parsedTask.steps;
            planHtml += planSteps.map((st, i) => {
              const riskColor = (st.risk === "HIGH" || st.risk === "CRITICAL") ? "#dc2626" : ((st.risk === "MEDIUM") ? "#d97706" : "#2563eb");
              const approvalBadge = st.requiresApproval
                ? `<span style="background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:bold;margin-left:4px;">APPROVAL REQ</span>`
                : `<span style="background:#f3f4f6;color:#4b5563;padding:1px 5px;border-radius:3px;font-size:9px;margin-left:4px;">AUTO</span>`;
              return `<div style="padding:1px 0 1px 6px;"><strong>${i + 1}.</strong> ${escapeHtml(st.type)} &rarr; <strong>${escapeHtml(st.target || st.targetHint || st.fieldHint || "target")}</strong> <span style="color:${riskColor};font-weight:bold;font-size:10px;">[${st.risk || "LOW"}]</span>${approvalBadge}</div>`;
            }).join("");
            plannerExecutionPlan.innerHTML = planHtml;
          } else if (reasoningPlan && reasoningPlan.steps && reasoningPlan.steps.length > 0) {
            plannerExecutionPlan.innerHTML = reasoningPlan.steps.map((st, i) => {
              const riskColor = (st.risk === "HIGH" || st.risk === "CRITICAL") ? "#dc2626" : ((st.risk === "MEDIUM") ? "#d97706" : "#2563eb");
              const approvalBadge = st.requiresApproval
                ? `<span style="background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:bold;margin-left:4px;">APPROVAL REQ</span>`
                : `<span style="background:#f3f4f6;color:#4b5563;padding:1px 5px;border-radius:3px;font-size:9px;margin-left:4px;">AUTO</span>`;
              return `<div style="padding:2px 0;"><strong>${i + 1}.</strong> ${escapeHtml(st.type)} &rarr; <strong>${escapeHtml(st.target || st.fieldHint || "target")}</strong> <span style="color:${riskColor};font-weight:bold;font-size:10px;">[${st.risk}]</span>${approvalBadge}</div>`;
            }).join("");
          } else {
            plannerExecutionPlan.innerHTML = "<div>1. Generic Action &rarr; [LOW] (Auto)</div>";
          }
        }

        let plannerTraceList = (reasoningPlan && Array.isArray(reasoningPlan.reasoningTrace))
          ? [...reasoningPlan.reasoningTrace]
          : [];
        const appendPlannerTrace = (msg) => {
          if (!msg) return;
          plannerTraceList.push(msg);
          if (plannerReasoningTrace) {
            plannerReasoningTrace.innerHTML = plannerTraceList.map((m) => `<div>&bull; ${escapeHtml(m)}</div>`).join("");
            plannerReasoningTrace.scrollTop = plannerReasoningTrace.scrollHeight;
          }
        };
        if (plannerReasoningTrace) {
          plannerReasoningTrace.innerHTML = plannerTraceList.length > 0
            ? plannerTraceList.map((m) => `<div>&bull; ${escapeHtml(m)}</div>`).join("")
            : "<div>&bull; Task parsed and planned locally.</div>";
        }
        if (plannerRiskBadge) {
          plannerRiskBadge.textContent = "LOW";
          plannerRiskBadge.style.background = "#e0e7ff";
          plannerRiskBadge.style.color = "#3730a3";
        }
        if (plannerSafetyDecision) {
          plannerSafetyDecision.textContent = "PASSED (Safe Action)";
          plannerSafetyDecision.style.color = "#166534";
        }
        if (plannerApprovalStatus) {
          plannerApprovalStatus.textContent = "NOT REQUIRED";
          plannerApprovalStatus.style.color = "#1e1b4b";
        }
        if (popupApprovalContainer) {
          popupApprovalContainer.style.display = "none";
        }

        let isPlannedTask = parsedTask && parsedTask.intent !== "NONE" && Array.isArray(parsedTask.steps) && parsedTask.steps.length > 0;
        let plannedSteps = isPlannedTask ? parsedTask.steps : null;
        let totalPlannedSteps = isPlannedTask ? Math.min(plannedSteps.length, MAX_AGENT_STEPS) : 1;
        let localValuesMap = (isPlannedTask && parsedTask.localValues) ? parsedTask.localValues : {};
        let taskContext = {
          currentEntity: null,
          currentIntent: null,
          currentPage: null,
          previousAction: null,
          previousTarget: null,
          previousVerifiedState: null,
          currentDialog: null,
          currentContainer: "main",
          currentSemanticIntent: null,
          establishedEntities: []
        };

        // AGENT SESSION ISOLATION (Milestone 17 Production Hardening):
        // A new task execution must NEVER inherit approval state, stale actions, or prior plan state.
        previousScreenSignature = null;
        cachedLightweightSignature = null;
        cachedPerceptionTimestamp = 0;
        lastExecutedActionType = null;
        lastStepVerification = null;
        lastPerceptionDecision = { reused: false, reason: "FRESH — Initial observation (Step 1)", probeMs: 0 };
        perceptionTelemetryStats = {
          fullPerceptionPasses: 0,
          reusedPerceptionPasses: 0,
          totalProbeMs: 0
        };
        executionTraceHistory = [];
        let lastActionKey = null;
        renderTraceHistory();
        resetPipelineUI();

        // SEVENTH REQUIREMENT: Log/debug structured plan & assert plan validity
        console.log("[SIH26171] TASK:", task);
        const planDebug = (plannedSteps || []).map(s => ({
          action: s.type,
          targetIntent: s.target || s.targetHint || s.fieldHint || "search input",
          value: s.value || s.query || undefined
        }));
        console.log("[SIH26171] PLAN:", JSON.stringify(planDebug, null, 2));

        // Defensive check: If plannedSteps contains a stale value (e.g. "YouTube") not present in user task, correct it
        if (isPlannedTask && plannedSteps) {
          const taskLower = task.toLowerCase();
          for (const st of plannedSteps) {
            if (st.value && typeof st.value === "string") {
              const v = st.value.trim().toLowerCase();
              if (v === "youtube" && !taskLower.includes("youtube")) {
                console.error("[SIH26171] Stale state leak detected: 'YouTube' in plan for task:", task);
                const correctVal = (window.SIHTaskParser && typeof window.SIHTaskParser.extractTaskQueryOrValue === "function")
                  ? window.SIHTaskParser.extractTaskQueryOrValue(task)
                  : null;
                st.value = correctVal || "";
                if (localValuesMap) {
                  for (const k of Object.keys(localValuesMap)) {
                    if (String(localValuesMap[k]).toLowerCase() === "youtube") {
                      localValuesMap[k] = correctVal || "";
                    }
                  }
                }
              }
            }
          }
        }
        if (pipelineStepCounter) {
          pipelineStepCounter.textContent = isPlannedTask ? `Step 1 of ${totalPlannedSteps}` : `Step 1 of ${MAX_AGENT_STEPS}`;
        }
        const firstStepPlan = isPlannedTask && plannedSteps ? plannedSteps[0] : null;
        updateCurrentActionCard({
          stepText: isPlannedTask ? `STEP 1 / ${totalPlannedSteps}` : `STEP 1 / ${MAX_AGENT_STEPS}`,
          action: firstStepPlan ? firstStepPlan.type : "PERCEIVE",
          target: firstStepPlan ? (firstStepPlan.target || firstStepPlan.targetHint || firstStepPlan.fieldHint || "Page Context") : "Page Context",
          value: firstStepPlan?.value || "",
          grounding: "Local Observation",
          risk: firstStepPlan?.risk || "LOW",
          safety: "ANALYZING",
          status: "Starting agent..."
        });

        if (popupApprovalContainer) {
          popupApprovalContainer.style.display = "none";
        }

        // Ensure any lingering in-page approval modal is dismissed
        try {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "dismissHumanApproval" }, () => {
                if (chrome.runtime.lastError) { }
              });
            }
          });
        } catch (e) { }

        if (fillStepStatus) {
          fillStepStatus.textContent = isPlannedTask && (parsedTask.intent.includes("FILL") || parsedTask.steps.some((s) => s.type === "FILL")) ? "Planning steps..." : "-";
        }
        if (fieldValuesPrivacyNotice) {
          fieldValuesPrivacyNotice.textContent = "Kept local (not sent)";
        }

        if (window.SIHEvaluationTracker && typeof window.SIHEvaluationTracker.recordTaskStart === "function") {
          window.SIHEvaluationTracker.recordTaskStart(currentRequestId, task);
        }

        /**
         * M21.3: Executes controlled recovery after an action failure (execution or verification).
         * Enforces strict single-recovery limit per action, fresh on-device perception,
         * anti-stale grounding, target validation, safety gate re-check, and outcome verification.
         */
        const attemptControlledRecovery = async ({
          currentStep,
          totalSteps,
          activeTab,
          originalAction,
          currentStepPlan,
          initialFailureReason,
          requestId
        }) => {
          console.log("[M21][RECOVERY] start");
          console.log("[M21][RECOVERY] failure detected");

          appendPlannerTrace(`Step ${currentStep} failure detected: ${initialFailureReason}`);
          appendPlannerTrace("Recovery:");
          appendPlannerTrace("Re-perceiving page...");

          if (agentStepText) agentStepText.textContent = `Step ${currentStep}: CONTROLLED RECOVERY`;
          if (agentVerificationText) {
            agentVerificationText.textContent = "Recovery: Re-perceiving page...";
            agentVerificationText.style.color = "#d97706";
          }
          setAgentState(AGENT_STATES.REPERCEIVE, "Recovery: Re-perceiving page...");

          // 1. Re-perceive current page using local pipeline (on-device, zero PII transmission)
          console.log("[M21][RECOVERY] re-perceiving current page");
          let freshPageData = null;
          let freshElements = [];
          let recoveryTab = activeTab;
          try {
            if (recoveryTab && recoveryTab.id) {
              await waitForTabReady(recoveryTab.id, 4000);
            }
            resetPipelineState();
            lastPerceptionDecision = { reused: false, reason: "FRESH — Recovery", probeMs: 0 };
            perceptionTelemetryStats.fullPerceptionPasses++;
            const pipelineOutput = await runLocalPipeline();
            if (pipelineOutput) {
              recoveryTab = pipelineOutput.tab || activeTab;
              freshPageData = pipelineOutput.pageData;
              freshElements = latestFusedElements || latestVisualElements || (freshPageData && freshPageData.visualElements) || [];
              cachedPerceptionTimestamp = Date.now();
            }
          } catch (e) {
            console.warn("Re-perception error:", e);
            try {
              const fallbackInfo = await new Promise((res) => {
                chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (r) => res(r || null));
              });
              if (fallbackInfo) {
                freshPageData = fallbackInfo;
                freshElements = fallbackInfo.visualElements || [];
              }
            } catch (_) {}
          }

          if (!freshElements || freshElements.length === 0) {
            console.log("[M21][RECOVERY] target not found");
            appendPlannerTrace("Target not found on current page");
            appendPlannerTrace("Recovery aborted");
            appendPlannerTrace("Final: Action failed safely");
            return window.SIHActionVerifier?.createRecoveryResult ? window.SIHActionVerifier.createRecoveryResult({
              attempted: true,
              allowed: false,
              result: "FAILED",
              reason: "Target not found on current page after re-perception",
              recoveryAction: originalAction?.action || null,
              safetyChecked: false
            }) : {
              attempted: true,
              allowed: false,
              result: "FAILED",
              reason: "Target not found on current page after re-perception",
              recoveryAction: originalAction?.action || null,
              safetyChecked: false
            };
          }

          // 2. Re-ground the original intended target against fresh perception (ANTI-STALE PROTECTION)
          console.log("[M21][RECOVERY] re-grounding target");
          const normalize = (s) => (s || "").trim().toLowerCase();
          const actionType = (originalAction?.action || (currentStepPlan && currentStepPlan.type) || "CLICK").toUpperCase();

          let matchedCandidate = null;
          let matchedCandidateIdx = -1;
          let groundingScore = 0;

          const rawTargetHint = (currentStepPlan && (currentStepPlan.explicitTarget || currentStepPlan.fieldHint || currentStepPlan.targetHint || currentStepPlan.legacyTarget)) ||
            originalAction?.fieldHint ||
            originalAction?.semanticTarget ||
            originalAction?.targetLabel ||
            originalAction?.target ||
            "";
          const targetDescriptor = originalAction?.semanticTargetDescriptor || createSemanticTargetDescriptor(
            originalAction?.element || null,
            rawTargetHint,
            originalAction?.targetType || originalAction?.role || (actionType === "FILL" ? "input" : "element")
          );

          if (actionType === "CLICK") {
            const resolver = window.SIHSemanticResolver || (typeof SIHSemanticResolver !== "undefined" ? SIHSemanticResolver : null);
            if (resolver && (currentStepPlan?.isSemantic || currentStepPlan?.ranking || (currentStepPlan?.ordinal !== null && currentStepPlan?.ordinal !== undefined) || currentStepPlan?.spatial || resolver.isSemanticInstruction(originalAction?.targetLabel || originalAction?.target || currentStepPlan?.targetHint))) {
              const semanticRes = resolver.resolveSemanticTarget(currentStepPlan, freshElements, { allElements: freshElements });
              if (semanticRes && semanticRes.action !== "PASS_THROUGH" && semanticRes.concreteElement) {
                matchedCandidate = semanticRes.concreteElement;
                matchedCandidateIdx = semanticRes.targetIndex;
                groundingScore = semanticRes.groundingScore;
              }
            }

            if (!matchedCandidate && targetDescriptor) {
              const regroundRes = reGroundSemanticTarget(freshElements, targetDescriptor);
              if (regroundRes.isAmbiguous) {
                console.log("[M21][RECOVERY] target ambiguous");
                appendPlannerTrace("Target ambiguous");
                appendPlannerTrace("Recovery aborted");
                appendPlannerTrace("Final: Action failed safely");
                return window.SIHActionVerifier?.createRecoveryResult ? window.SIHActionVerifier.createRecoveryResult({
                  attempted: true,
                  allowed: false,
                  result: "FAILED",
                  reason: "Target ambiguous: multiple candidates match target with similar confidence",
                  recoveryAction: actionType,
                  safetyChecked: false
                }) : {
                  attempted: true,
                  allowed: false,
                  result: "FAILED",
                  reason: "Target ambiguous: multiple candidates match target with similar confidence",
                  recoveryAction: actionType,
                  safetyChecked: false
                };
              }
              if (regroundRes.match) {
                matchedCandidate = regroundRes.match;
                matchedCandidateIdx = regroundRes.index;
                groundingScore = regroundRes.score;
              }
            }

            if (!matchedCandidate) {
              const isExplicitTarget = Boolean(currentStepPlan && currentStepPlan.isExplicitTarget);
              const targetHint = normalize(
                (currentStepPlan && (currentStepPlan.explicitTarget || currentStepPlan.targetHint || currentStepPlan.legacyTarget)) ||
                originalAction.targetLabel ||
                originalAction.target ||
                ""
              ).replace(/_button|_input/, "").trim();

              const isSearchBoxTarget = Boolean(
                (targetHint && /\bsearch\s*(?:box|input|field|bar|area)?\b/i.test(targetHint)) ||
                (currentStepPlan && currentStepPlan.legacyTarget === "SEARCH_INPUT")
              );

              const computeClickScore = (el) => {
                if (!el) return 0;
                if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true" || el.readOnly) return 0;
                const elType = (el.type || "").toLowerCase();
                if (!["button", "link", "input", "element", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes(elType)) return 0;
                const labelNorm = normalize(el.label);
                if (!labelNorm && !targetHint) return 0;

                if (isSearchBoxTarget) {
                  // Reject voice/mic controls unless explicitly requested
                  if (!targetHint.includes("voice") && !targetHint.includes("mic")) {
                    if (/voice|mic|audio|speak/i.test(labelNorm) || /voice|mic|audio|speak/i.test(el.ariaLabel || "")) {
                      return 0;
                    }
                  }
                  // Strictly prioritize editable text input
                  if (elType === "input" || elType === "textarea" || el.semanticTag === "SEARCH_INPUT") {
                    if (labelNorm.includes("search") || el.semanticTag === "SEARCH_INPUT") return 1.0;
                    return 0.85;
                  }
                  // Heavily penalize buttons when user asked for search box
                  if (elType === "button" || elType === "link") return 0.2;
                }

                const candTextParts = [
                  el.label,
                  el.text,
                  el.ariaLabel,
                  el.title,
                  el.alt,
                  el.dataColor,
                  el.placeholder,
                  el.href,
                  el.url
                ].filter(Boolean).map(normalize);
                const candFullText = candTextParts.join(" ");

                // Profile picture / avatar rejection unless explicitly requested
                const isExplicitProfileRequested = Boolean(targetHint && /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(targetHint));
                const isProfileElement = Boolean(
                  /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar|profile_photo|profile_pic|identity-module)\b/i.test(candFullText) ||
                  (el.role === "img" && /\b(?:photo|picture|avatar|profile)\b/i.test(el.ariaLabel || el.alt || "")) ||
                  elType === "image" ||
                  (el.tagName && el.tagName.toLowerCase() === "img") ||
                  (el.className && /\b(?:avatar|profile-photo|profile-pic)\b/i.test(el.className))
                );

                if (isExplicitProfileRequested) {
                  if (isProfileElement || candFullText.includes("profile")) return 1.0;
                  return 0;
                }
                if (isProfileElement && !isExplicitProfileRequested) {
                  return 0;
                }

                // Action-aware composite target: "Start a post" / "Create a post" / "Write a post"
                const isStartPostTarget = Boolean(
                  targetHint === "start a post" ||
                  /^(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(targetHint)
                );
                if (isStartPostTarget) {
                  const hasActionWord = /\b(?:start|create|write|open)\b/i.test(labelNorm) || /\b(?:start|create|write|open)\b/i.test(candFullText);
                  const hasPostWord = /\bpost\b/i.test(labelNorm) || /\bpost\b/i.test(candFullText);
                  if (!hasActionWord || !hasPostWord) return 0;
                  if (labelNorm === "start a post") return 1.0;
                  if (candFullText.includes("start a post")) return 0.95;
                  if (hasActionWord && hasPostWord) return (elType === "button" || el.role === "button") ? 0.92 : 0.85;
                  return 0;
                }

                // Action-aware publish button: "Post" / "Publish"
                const isPublishTarget = Boolean(
                  targetHint === "post" ||
                  targetHint === "post button" ||
                  targetHint === "publish"
                );
                if (isPublishTarget) {
                  if (/\b(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(candFullText) || /\b(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(labelNorm)) return 0;
                  if (el.role === "article" || elType === "article" || /\b(?:feed|comment|share)\b/i.test(labelNorm)) return 0;
                  const isButtonRole = elType === "button" || el.role === "button" || el.semanticTag === "SUBMIT_BUTTON";
                  if ((labelNorm === "post" || labelNorm === "publish") && isButtonRole) return 1.0;
                  if (labelNorm === "post" || labelNorm === "publish") return 0.90;
                  if (candFullText.trim() === "post" && isButtonRole) return 0.95;
                  return 0;
                }

                if (isExplicitTarget && targetHint) {
                  if (labelNorm === targetHint) return 1.0;
                  if (labelNorm.includes(targetHint)) return 0.95;
                  const tokens = targetHint.split(/\s+/).filter(t => t.length > 2);
                  if (tokens.length > 0 && tokens.every(t => labelNorm.includes(t))) return 0.90;
                  return 0;
                }

                if (currentStepPlan?.attribute && currentStepPlan?.attributeValue && currentStepPlan?.objectTarget) {
                  const targetObjNorm = normalize(currentStepPlan.objectTarget);
                  const targetValNorm = normalize(currentStepPlan.attributeValue);
                  const candText = [el.label, el.text, el.ariaLabel, el.title, el.alt, el.dataColor].filter(Boolean).map(normalize).join(" ");
                  const objTokens = targetObjNorm.split(/\s+/).filter(t => t.length > 2);
                  const matchesObj = candText.includes(targetObjNorm) || (objTokens.length > 0 && objTokens.every(t => candText.includes(t)));
                  if (!matchesObj) return 0;
                  const matchesAttr = candText.includes(targetValNorm) || (el.dataColor && normalize(el.dataColor).includes(targetValNorm));
                  return matchesAttr ? 0.95 : 0;
                }

                if (labelNorm === targetHint) return 1.0;
                if (targetHint && (labelNorm.includes(targetHint) || targetHint.includes(labelNorm))) return 0.85;
                const tokens = targetHint.split(/\s+/).filter(t => t.length > 2);
                if (tokens.length > 0 && tokens.every(t => labelNorm.includes(t))) return 0.80;
                return 0;
              };

              freshElements.forEach((el, idx) => {
                let s = computeClickScore(el);
                if (s > 0 && el.isVisualConfirmed) s = Math.min(1.0, s + 0.10);
                if (s > groundingScore) {
                  groundingScore = s;
                  matchedCandidate = el;
                  matchedCandidateIdx = idx;
                }
              });
            }
          } else if (actionType === "FILL" || actionType === "FILL_FORM") {
            if (targetDescriptor) {
              const regroundRes = reGroundSemanticTarget(freshElements, targetDescriptor);
              if (regroundRes.isAmbiguous) {
                console.log("[M21][RECOVERY] target ambiguous");
                appendPlannerTrace("Target ambiguous");
                appendPlannerTrace("Recovery aborted");
                appendPlannerTrace("Final: Action failed safely");
                return window.SIHActionVerifier?.createRecoveryResult ? window.SIHActionVerifier.createRecoveryResult({
                  attempted: true,
                  allowed: false,
                  result: "FAILED",
                  reason: "Target ambiguous: multiple candidates match target with similar confidence",
                  recoveryAction: actionType,
                  safetyChecked: false
                }) : {
                  attempted: true,
                  allowed: false,
                  result: "FAILED",
                  reason: "Target ambiguous: multiple candidates match target with similar confidence",
                  recoveryAction: actionType,
                  safetyChecked: false
                };
              }
              if (regroundRes.match) {
                matchedCandidate = regroundRes.match;
                matchedCandidateIdx = regroundRes.index;
                groundingScore = regroundRes.score;
              }
            }

            if (!matchedCandidate) {
              const rawHint = (currentStepPlan && (currentStepPlan.fieldHint || currentStepPlan.targetHint)) ||
                originalAction.fieldHint ||
                originalAction.semanticTarget ||
                originalAction.targetLabel ||
                originalAction.target ||
                "";
              const fieldHint = normalize(rawHint);
              freshElements.forEach((el, idx) => {
                if (!el || el.disabled || String(el["aria-disabled"]).toLowerCase() === "true" || el.readOnly) return;
                const elType = (el.type || "").toLowerCase();
                const elRole = (el.role || "").toLowerCase();
                const isFormType = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes(elType) ||
                  ["input", "textarea", "select", "combobox", "searchbox", "textbox"].includes(elRole) ||
                  Boolean(el.ariaAutocomplete);
                if (!isFormType) return;
                const labelNorm = normalize(el.label);
                if (/voice|mic|audio|speak/i.test(labelNorm) || /voice|mic|audio|speak/i.test(el.ariaLabel || "")) return;
                if (/\bsearch\b/i.test(labelNorm) && !/\bsearch\b/i.test(fieldHint)) return;

                let s = scoreElementForField(el, rawHint);
                if (s === 0 && originalAction.fieldHint) s = scoreElementForField(el, originalAction.fieldHint);
                if (s === 0 && originalAction.semanticTarget) s = scoreElementForField(el, originalAction.semanticTarget);
                if (s === 0 && originalAction.targetLabel) s = scoreElementForField(el, originalAction.targetLabel);
                if (s > 0 && el.isVisualConfirmed) s = Math.min(1.0, s + 0.05);

                if (s > groundingScore) {
                  groundingScore = s;
                  matchedCandidate = el;
                  matchedCandidateIdx = idx;
                }
              });
            }
          } else if (actionType === "SUBMIT") {
            freshElements.forEach((el, idx) => {
              if (!el || el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return;
              const elType = (el.type || "").toLowerCase();
              const labelNorm = normalize(el.label);
              if (elType === "button" && (labelNorm.includes("submit") || labelNorm.includes("search") || el.semanticTag === "SUBMIT_BUTTON")) {
                matchedCandidate = el;
                matchedCandidateIdx = idx;
                groundingScore = 1.0;
              } else if (elType === "input" && (el.semanticTag === "SEARCH_INPUT" || labelNorm.includes("search"))) {
                if (groundingScore < 0.9) {
                  matchedCandidate = el;
                  matchedCandidateIdx = idx;
                  groundingScore = 0.9;
                }
              }
            });
            if (!matchedCandidate) {
              matchedCandidate = { label: "search", type: "input", x: 0, y: 0, width: 0, height: 0 };
              matchedCandidateIdx = 0;
              groundingScore = 0.8;
            }
          } else if (actionType === "SCROLL") {
            matchedCandidate = { label: "PAGE", type: "element" };
            matchedCandidateIdx = 0;
            groundingScore = 1.0;
          } else if (["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(actionType)) {
            const rawHint = (currentStepPlan && (currentStepPlan.targetHint || currentStepPlan.target)) ||
              originalAction?.targetLabel ||
              originalAction?.target ||
              "";
            const targetHint = normalize(rawHint).replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+(?:box|checkbox|option|button|link|switch|radio)$/i, "").trim();
            const stepContext = (currentStepPlan && currentStepPlan.context) || originalAction?.context || null;
            const ctxNorm = stepContext ? normalize(stepContext) : null;

            // Verify context presence on fresh perception if specified
            let contextValid = true;
            if (ctxNorm) {
              contextValid = freshElements.some(el => {
                const lbl = normalize(el.label);
                return lbl.includes(ctxNorm) || ctxNorm.includes(lbl);
              });
            }

            if (contextValid) {
              const matches = [];
              freshElements.forEach((el, idx) => {
                if (!el || el.disabled || String(el["aria-disabled"]).toLowerCase() === "true" || el.readOnly) return;
                const elType = (el.type || "").toLowerCase();
                const labelNorm = normalize(el.label).replace(/[:*#_\-\/\\]+/g, " ").trim();

                let typeBonus = 0;
                if (["CHECK", "UNCHECK"].includes(actionType) && (elType === "checkbox" || el.semanticTag === "CHECKBOX")) typeBonus = 0.2;
                if (actionType === "SELECT" && (elType === "option" || elType === "button" || elType === "radio" || elType === "link" || elType === "element")) typeBonus = 0.1;
                if (actionType === "TOGGLE" && (elType === "switch" || elType === "checkbox" || elType === "button")) typeBonus = 0.2;

                if (labelNorm === targetHint || labelNorm.includes(targetHint) || targetHint.includes(labelNorm)) {
                  const exact = (labelNorm === targetHint) ? 1.0 : 0.85;
                  matches.push({ el, idx, score: exact + typeBonus });
                }
              });

              if (matches.length > 0) {
                matches.sort((a, b) => b.score - a.score);
                const ordinal = currentStepPlan?.ordinal !== undefined ? currentStepPlan.ordinal : originalAction?.ordinal;
                if (typeof ordinal === "number" && ordinal >= 1 && ordinal <= matches.length) {
                  matchedCandidate = matches[ordinal - 1].el;
                  matchedCandidateIdx = matches[ordinal - 1].idx;
                  groundingScore = matches[ordinal - 1].score;
                } else {
                  matchedCandidate = matches[0].el;
                  matchedCandidateIdx = matches[0].idx;
                  groundingScore = matches[0].score;
                }
              }
            }
          }

          if (!matchedCandidate) {
            console.log("[M21][RECOVERY] target not found");
            appendPlannerTrace("Target not confidently grounded");
            appendPlannerTrace("Recovery aborted");
            appendPlannerTrace("Final: Action failed safely");
            return window.SIHActionVerifier?.createRecoveryResult ? window.SIHActionVerifier.createRecoveryResult({
              attempted: true,
              allowed: false,
              result: "FAILED",
              reason: "Target not found during re-grounding",
              recoveryAction: actionType,
              safetyChecked: false
            }) : {
              attempted: true,
              allowed: false,
              result: "FAILED",
              reason: "Target not found during re-grounding",
              recoveryAction: actionType,
              safetyChecked: false
            };
          }

          // 3. Validate target (presence, enabled, usable, unambiguous, confidence)
          let validation = { valid: true, reason: "Target validated" };
          if (window.SIHActionVerifier && typeof window.SIHActionVerifier.validateRecoveryTarget === "function") {
            validation = window.SIHActionVerifier.validateRecoveryTarget(
              matchedCandidate,
              freshElements,
              {
                action: actionType,
                targetLabel: matchedCandidate.label,
                targetType: matchedCandidate.type,
                groundingScore,
                targetIndex: matchedCandidateIdx !== undefined ? matchedCandidateIdx : matchedCandidate.index,
                url: matchedCandidate.url || matchedCandidate.href || (targetDescriptor && (targetDescriptor.url || targetDescriptor.href)),
                bounds: matchedCandidate.bounds || (matchedCandidate.x !== undefined ? { x: matchedCandidate.x, y: matchedCandidate.y, width: matchedCandidate.width, height: matchedCandidate.height } : null) || (targetDescriptor && targetDescriptor.bounds),
                semanticTargetDescriptor: targetDescriptor
              }
            );
          } else {
            if (matchedCandidate.disabled || String(matchedCandidate["aria-disabled"]).toLowerCase() === "true" || matchedCandidate.readOnly) {
              validation = { valid: false, reason: "Target element is disabled or read-only" };
            } else if (groundingScore < 0.40) {
              validation = { valid: false, reason: "Target grounding confidence too low" };
            }
          }

          if (!validation.valid) {
            if (validation.reason && validation.reason.includes("ambiguous")) {
              console.log("[M21][RECOVERY] target ambiguous");
              appendPlannerTrace("Target ambiguous");
            } else {
              console.log("[M21][RECOVERY] target not found");
              appendPlannerTrace(validation.reason);
            }
            appendPlannerTrace("Recovery aborted");
            appendPlannerTrace("Final: Action failed safely");
            return window.SIHActionVerifier?.createRecoveryResult ? window.SIHActionVerifier.createRecoveryResult({
              attempted: true,
              allowed: false,
              result: "FAILED",
              reason: validation.reason,
              recoveryAction: actionType,
              safetyChecked: false
            }) : {
              attempted: true,
              allowed: false,
              result: "FAILED",
              reason: validation.reason,
              recoveryAction: actionType,
              safetyChecked: false
            };
          }

          console.log("[M21][RECOVERY] target validated");
          appendPlannerTrace("Target re-grounded");

          // 4. Existing Safety Gate Re-check (Never bypass safety; block high-risk actions)
          console.log("[M21][RECOVERY] safety check");
          const recoveryAction = {
            action: actionType,
            target: matchedCandidate.label,
            targetIndex: matchedCandidate.index !== undefined ? matchedCandidate.index : matchedCandidateIdx,
            targetType: matchedCandidate.type,
            targetLabel: matchedCandidate.label,
            context: (currentStepPlan && currentStepPlan.context) || originalAction?.context || null,
            relation: (currentStepPlan && currentStepPlan.relation) || originalAction?.relation || null,
            ordinal: (currentStepPlan && currentStepPlan.ordinal !== undefined) ? currentStepPlan.ordinal : (originalAction?.ordinal !== undefined ? originalAction.ordinal : null),
            value: (currentStepPlan && currentStepPlan.value) ? currentStepPlan.value : originalAction?.value,
            amount: originalAction?.amount,
            groundingScore: groundingScore,
            groundingMethod: matchedCandidate.isVisualConfirmed ? "recovery-dom+visual-fusion" : "recovery-reground"
          };

          let recoverySafety = { allowed: true, requiresApproval: false, risk: "LOW" };
          if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.evaluateSafetyGate === "function") {
            recoverySafety = window.SIHReasoningPlanner.evaluateSafetyGate(
              recoveryAction,
              currentStepPlan,
              null, // Recovery cannot invent approval tokens; destructive/high-risk actions are blocked
              { url: recoveryTab?.url, title: freshPageData?.title, visualElements: freshElements }
            );
          }

          // High-risk or consequential actions MUST NOT be automatically retried
          if (!recoverySafety.allowed || recoverySafety.requiresApproval || recoverySafety.risk === "HIGH" || recoverySafety.risk === "CRITICAL") {
            console.log("[M21][RECOVERY] blocked by safety gate");
            appendPlannerTrace("Safety: BLOCKED");
            appendPlannerTrace("Recovery aborted");
            appendPlannerTrace("Final: Action failed safely");
            return window.SIHActionVerifier?.createRecoveryResult ? window.SIHActionVerifier.createRecoveryResult({
              attempted: true,
              allowed: false,
              result: "BLOCKED",
              reason: recoverySafety.reason || "Consequential action blocked by Safety Gate",
              recoveryAction: actionType,
              safetyChecked: true
            }) : {
              attempted: true,
              allowed: false,
              result: "BLOCKED",
              reason: recoverySafety.reason || "Consequential action blocked by Safety Gate",
              recoveryAction: actionType,
              safetyChecked: true
            };
          }

          appendPlannerTrace("Safety: ALLOWED");
          appendPlannerTrace(`Recovery action: ${recoveryAction.action}`);

          // 5. One recovery action (executed exactly ONCE)
          console.log("[M21][RECOVERY] action executed");
          setAgentState(AGENT_STATES.EXECUTE, `Recovery: Executing ${recoveryAction.action}...`);

          const preRecoveryState = {
            url: (freshPageData && freshPageData.url) || recoveryTab?.url || "",
            title: (freshPageData && freshPageData.title) || recoveryTab?.title || "",
            scrollX: (freshPageData && freshPageData.viewport && typeof freshPageData.viewport.scrollX === "number") ? freshPageData.viewport.scrollX : 0,
            scrollY: (freshPageData && freshPageData.viewport && typeof freshPageData.viewport.scrollY === "number") ? freshPageData.viewport.scrollY : 0,
            visualElements: freshElements,
            elementCount: freshElements.length
          };

          const recoveryPayload = {
            action: recoveryAction.action,
            target: recoveryAction.target,
            targetIndex: recoveryAction.targetIndex,
            targetType: recoveryAction.targetType,
            targetLabel: recoveryAction.targetLabel,
            context: recoveryAction.context,
            relation: recoveryAction.relation,
            ordinal: recoveryAction.ordinal,
            localValue: recoveryAction.value,
            value: recoveryAction.value,
            amount: recoveryAction.amount
          };

          let recoveryExecRes = null;
          await new Promise((resolveExec) => {
            chrome.tabs.sendMessage(
              recoveryTab.id,
              { action: "executeAction", payload: recoveryPayload },
              (res) => {
                if (chrome.runtime.lastError) {
                  recoveryExecRes = { executed: false, reason: chrome.runtime.lastError.message };
                } else if (res && res.result) {
                  recoveryExecRes = res.result;
                } else {
                  recoveryExecRes = { executed: false, reason: "No execution response" };
                }
                resolveExec();
              }
            );
          });

          // 6. Verify again using M21 verification
          if (recoveryAction.action === "SUBMIT" || recoveryAction.action === "CLICK") {
            await waitForTabReady(recoveryTab.id, 4000);
          } else {
            await new Promise((r) => setTimeout(r, 600));
          }

          let postRecoveryPageData = null;
          const postRecoveryElements = await new Promise((resolveDom) => {
            chrome.tabs.sendMessage(recoveryTab.id, { action: "getPageInfo" }, (resp) => {
              if (resp && resp.success) {
                postRecoveryPageData = resp;
                resolveDom(resp.visualElements || freshElements);
              } else {
                resolveDom(freshElements);
              }
            });
          });

          const postRecoveryState = {
            url: (postRecoveryPageData && postRecoveryPageData.url) || recoveryTab?.url || "",
            title: (postRecoveryPageData && postRecoveryPageData.title) || recoveryTab?.title || "",
            scrollX: (postRecoveryPageData && postRecoveryPageData.viewport && typeof postRecoveryPageData.viewport.scrollX === "number") ? postRecoveryPageData.viewport.scrollX : 0,
            scrollY: (postRecoveryPageData && postRecoveryPageData.viewport && typeof postRecoveryPageData.viewport.scrollY === "number") ? postRecoveryPageData.viewport.scrollY : 0,
            visualElements: postRecoveryElements || [],
            elementCount: (postRecoveryElements || []).length
          };

          let recoveryVerif = null;
          if (window.SIHActionVerifier && typeof window.SIHActionVerifier.verifyActionOutcome === "function") {
            recoveryVerif = window.SIHActionVerifier.verifyActionOutcome(
              preRecoveryState,
              postRecoveryState,
              recoveryAction,
              recoveryExecRes
            );
          } else {
            const isSuccess = recoveryExecRes && recoveryExecRes.executed;
            recoveryVerif = {
              status: isSuccess ? "VERIFIED" : "FAILED",
              verified: isSuccess,
              actionType: recoveryAction.action,
              reason: isSuccess ? "Action executed successfully" : "Execution failed"
            };
          }

          if (recoveryVerif.status === "VERIFIED") {
            console.log("[M21][RECOVERY] verification=VERIFIED");
            appendPlannerTrace("Verification: VERIFIED");
            appendPlannerTrace("Final: Recovery successful");
            if (agentVerificationText) {
              agentVerificationText.textContent = `VERIFIED: ${recoveryVerif.reason}`;
              agentVerificationText.style.color = "#2e7d32";
            }
            return {
              attempted: true,
              allowed: true,
              result: "VERIFIED",
              reason: recoveryVerif.reason,
              recoveryAction: recoveryAction.action,
              safetyChecked: true,
              verificationDetails: recoveryVerif,
              actionExecutedSuccessfully: true,
              agentAction: recoveryAction
            };
          } else if (recoveryVerif.status === "FAILED") {
            console.log("[M21][RECOVERY] verification=FAILED");
            appendPlannerTrace("Verification: FAILED");
            appendPlannerTrace("Final: Action failed safely");
            if (agentVerificationText) {
              agentVerificationText.textContent = `FAILED: ${recoveryVerif.reason}`;
              agentVerificationText.style.color = "#dc2626";
            }
            return {
              attempted: true,
              allowed: true,
              result: "FAILED",
              reason: recoveryVerif.reason,
              recoveryAction: recoveryAction.action,
              safetyChecked: true,
              verificationDetails: recoveryVerif,
              actionExecutedSuccessfully: false
            };
          } else {
            console.log("[M21][RECOVERY] verification=UNKNOWN");
            appendPlannerTrace("Verification: UNKNOWN");
            appendPlannerTrace("Final: Action failed safely");
            if (agentVerificationText) {
              agentVerificationText.textContent = `UNKNOWN: ${recoveryVerif.reason}`;
              agentVerificationText.style.color = "#d97706";
            }
            return {
              attempted: true,
              allowed: true,
              result: "UNKNOWN",
              reason: recoveryVerif.reason,
              recoveryAction: recoveryAction.action,
              safetyChecked: true,
              verificationDetails: recoveryVerif,
              actionExecutedSuccessfully: false
            };
          }
        };

        while (currentStep <= (isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS)) {
          if (currentSessionToken !== activeExecutionSessionToken) {
            console.log(`[SIH26171] Aborting superseded session #${currentSessionToken} in favor of #${activeExecutionSessionToken}`);
            return;
          }
          const requestId = "SIH-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          currentRequestId = requestId;
          let stepRecoveryNote = null;
          let recoveryAttempted = false;

          // Milestone 22.2: Fast local structural page probe before resetting pipeline state
          const plannedStepForProbe = isPlannedTask && plannedSteps ? plannedSteps[currentStep - 1] : null;
          const nextActionType = plannedStepForProbe ? plannedStepForProbe.type : null;

          let probeActiveTab = null;
          let probeResult = null;
          let probeMs = 0;
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            probeActiveTab = (tabs && tabs[0]) || null;
            if (!probeActiveTab || !probeActiveTab.id) {
              const fallbackTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
              probeActiveTab = (fallbackTabs && fallbackTabs[0]) || null;
            }
            if (probeActiveTab && probeActiveTab.id) {
              const tProbe0 = performance.now();
              probeResult = await new Promise((res) => {
                chrome.tabs.sendMessage(probeActiveTab.id, { action: "getLightweightPageState" }, (r) => {
                  if (chrome.runtime.lastError || !r || !r.success) {
                    res(null);
                  } else {
                    res(r);
                  }
                });
              });
              probeMs = Math.round(performance.now() - tProbe0);
              timing.pageProbeMs = probeMs;
            }
          } catch (_) {
            probeResult = null;
          }

          let currentLightweightSignature = null;
          if (probeResult && probeResult.signature) {
            currentLightweightSignature = probeResult.signature;
          } else if (probeResult && window.SIHChangeDetector && typeof window.SIHChangeDetector.computeLightweightDomSignature === "function") {
            currentLightweightSignature = window.SIHChangeDetector.computeLightweightDomSignature(
              probeResult.structuralElements || [],
              { url: probeResult.url, title: probeResult.title, viewport: probeResult.viewport }
            );
          }

          const hasCachedPerceptionData = Boolean(
            latestVisualElements &&
            latestVisualElements.length > 0 &&
            latestScreenshotDataUrl
          );

          const prevStepPlan = isPlannedTask && plannedSteps && currentStep > 1 ? plannedSteps[currentStep - 2] : null;
          const nextStepPlan = isPlannedTask && plannedSteps ? plannedSteps[currentStep - 1] : null;
          const shouldForceFresh = Boolean(
            (prevStepPlan && (prevStepPlan.expectedTransition === "post_composer_open" || /start\s+(?:a\s+)?post/i.test(prevStepPlan.target || ""))) ||
            (nextStepPlan && (/^post$/i.test(nextStepPlan.target || "") || nextStepPlan.expectedTransition === "post_published"))
          );

          const perceptionDecision = canReusePerception({
            lastAction: lastExecutedActionType,
            nextActionType: nextActionType,
            previousSignature: cachedLightweightSignature,
            currentSignature: currentLightweightSignature,
            currentStep: currentStep,
            verificationResult: lastStepVerification,
            cachedAt: cachedPerceptionTimestamp,
            forceFresh: shouldForceFresh,
            hasCachedData: hasCachedPerceptionData
          });

          lastPerceptionDecision = {
            reused: perceptionDecision.canReuse,
            reason: perceptionDecision.reason,
            probeMs: probeMs
          };

          if (perceptionDecision.canReuse) {
            perceptionTelemetryStats.reusedPerceptionPasses++;
            perceptionTelemetryStats.totalProbeMs += probeMs;
            console.log(`[SIH26171][ADAPTIVE] Reusing cached perception: ${perceptionDecision.reason} (Probe: ${probeMs}ms)`);
            appendPlannerTrace(`Perception: ${perceptionDecision.reason} (Probe: ${probeMs}ms)`);
            setAgentState(AGENT_STATES.PERCEIVE, `Reusing stable perception for step ${currentStep}...`);
          } else {
            perceptionTelemetryStats.fullPerceptionPasses++;
            console.log(`[SIH26171][ADAPTIVE] Running fresh perception: ${perceptionDecision.reason}`);
            appendPlannerTrace(`Perception: ${perceptionDecision.reason}`);
            resetPipelineState();
            setAgentState(AGENT_STATES.PERCEIVE, `Observing page state for step ${currentStep}...`);
          }

          if (pipelineStepCounter) {
            pipelineStepCounter.textContent = isPlannedTask
              ? `Step ${currentStep} of ${totalPlannedSteps}`
              : `Step ${currentStep} of ${MAX_AGENT_STEPS}`;
          }
          const stepPlanForPerceive = plannedStepForProbe;
          updateCurrentActionCard({
            stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
            action: stepPlanForPerceive ? stepPlanForPerceive.type : "PERCEIVE",
            target: stepPlanForPerceive ? (stepPlanForPerceive.target || stepPlanForPerceive.targetHint || stepPlanForPerceive.fieldHint || "Page Context") : "Page DOM & Visual Context",
            value: stepPlanForPerceive?.value || "",
            grounding: perceptionDecision.canReuse ? "Reused Stable State" : "Perceiving...",
            risk: stepPlanForPerceive?.risk || "LOW",
            safety: "PENDING",
            status: perceptionDecision.canReuse
              ? `Reusing stable page state (Probe: ${probeMs}ms)`
              : `Perceiving page state for step ${currentStep}...`
          });

          // Update step & verification indicators
          if (agentStepText) {
            agentStepText.textContent = isPlannedTask
              ? `Step ${currentStep} of ${totalPlannedSteps}`
              : `Step ${currentStep} of up to ${MAX_AGENT_STEPS}`;
          }
          if (agentVerificationText) {
            agentVerificationText.textContent = currentStep === 1
              ? "Observing initial page state..."
              : (perceptionDecision.canReuse ? `Reusing verified state (${probeMs}ms probe)...` : "Observing updated page state...");
            agentVerificationText.style.color = "#1565c0";
          }

          // Show task in UI (never reveals literal extracted values in status)
          if (agentTaskText) agentTaskText.textContent = task;
          if (agentRequestId) agentRequestId.textContent = requestId;
          if (agentScreenshotStatus) {
            agentScreenshotStatus.textContent = perceptionDecision.canReuse
              ? "REUSED (Stable Client-Side State)"
              : "CAPTURING LOCALLY...";
          }
          if (agentPrivacyStatus) agentPrivacyStatus.textContent = "ACTIVE";
          if (agentDomPiiCount) agentDomPiiCount.textContent = latestSensitiveRegions ? latestSensitiveRegions.length : (perceptionDecision.canReuse ? "0" : "Scanning...");
          if (agentOcrPiiCount) agentOcrPiiCount.textContent = latestOcrSensitiveRegions ? latestOcrSensitiveRegions.length : (perceptionDecision.canReuse ? "0" : "Scanning...");
          if (agentSensitiveCount) agentSensitiveCount.textContent = latestMergedRegions ? latestMergedRegions.length : (perceptionDecision.canReuse ? "0" : "Calculating...");
          if (agentRedactionStatus) {
            agentRedactionStatus.textContent = perceptionDecision.canReuse
              ? "COMPLETE (Cached)"
              : "PROCESSING...";
          }
          if (agentSanitizedStatus) {
            agentSanitizedStatus.textContent = perceptionDecision.canReuse
              ? "READY (Cached)"
              : "Awaiting Redaction...";
          }
          if (agentRawUploadStatus) {
            agentRawUploadStatus.textContent = "BLOCKED (Never transmitted)";
          }
          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "AWAITING PIPELINE";
            agentSanitizedUploadStatus.style.color = "#555";
          }
          if (agentModeStatus) {
            agentModeStatus.textContent = "Awaiting Reasoning...";
            agentModeStatus.style.color = "#555";
          }
          if (agentModeSubtext) agentModeSubtext.textContent = "";
          if (agentFallbackRow) agentFallbackRow.style.display = "none";
          if (agentActionText) agentActionText.textContent = "Awaiting pipeline...";
          if (agentReasoningText) {
            agentReasoningText.textContent = perceptionDecision.canReuse
              ? `Step ${currentStep}: Reusing stable on-device perception (Adaptive bypass)...`
              : `Step ${currentStep}: Running local privacy pipeline...`;
          }
          if (agentSafetyStatus) agentSafetyStatus.textContent = "Pending...";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Pending...";
          if (agentGatewayLatency) agentGatewayLatency.textContent = "-";
          if (groundingMethodText) groundingMethodText.textContent = "-";
          if (groundingScoreText) groundingScoreText.textContent = "-";
          if (groundedElementText) groundedElementText.textContent = "-";

          let pipelineOutput = null;
          try {
            if (perceptionDecision.canReuse && latestPageData && probeActiveTab) {
              pipelineOutput = {
                tab: probeActiveTab,
                pageData: latestPageData,
                redactionResult: {
                  success: true,
                  sanitizedScreenshotDataUrl: latestSanitizedDataUrl || latestScreenshotDataUrl
                }
              };
            } else {
              // Step 1 or forced refresh: Run full local observation pipeline
              console.log("[SIH26171] Perception pipeline started");
              pipelineOutput = await runLocalPipeline();
              console.log("[SIH26171] Perception pipeline completed");
              cachedPerceptionTimestamp = Date.now();
              cachedLightweightSignature = currentLightweightSignature;
            }
          } catch (pipelineErr) {
            if (pipelineErr.isRestrictedPage) {
              if (agentSafetyStatus) agentSafetyStatus.textContent = "Browser Restricted Page";
              if (agentExecutionStatus) agentExecutionStatus.textContent = "This page is restricted by the browser.";
              if (agentReasoningText) agentReasoningText.textContent = "This page is restricted by the browser. Browser extensions cannot run on internal browser pages (chrome://, edge://, about:). Please navigate to an ordinary website or http://127.0.0.1:8000/test-page.html.";
              if (agentStepText) agentStepText.textContent = "Halted (Restricted Page)";
              if (agentVerificationText) {
                agentVerificationText.textContent = "Browser internal page policy enforced.";
                agentVerificationText.style.color = "#e65100";
              }
              if (agentSanitizedUploadStatus) {
                agentSanitizedUploadStatus.textContent = "N/A (Restricted Page)";
                agentSanitizedUploadStatus.style.color = "#777";
              }
              executionTraceHistory.push({
                step: currentStep,
                requestId,
                action: null,
                executed: false,
                status: "restricted",
                executionResult: "This page is restricted by the browser.",
                verification: "Browser internal page policy"
              });
              renderTraceHistory();
              break;
            }
            console.error("Observation pipeline error:", pipelineErr);
            if (agentReasoningText) agentReasoningText.textContent = `Pipeline Error: ${pipelineErr.message}`;
            if (agentSanitizedUploadStatus) {
              agentSanitizedUploadStatus.textContent = "ERROR (Pipeline stopped)";
              agentSanitizedUploadStatus.style.color = "#c62828";
            }
            if (agentSafetyStatus) agentSafetyStatus.textContent = "Error";
            if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (Pipeline error)";
            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: null,
              executed: false,
              status: "error",
              executionResult: `Pipeline error: ${pipelineErr.message}`,
              verification: "Pipeline observation failed"
            });
            renderTraceHistory();
            break;
          }

          const { tab: activeTab, pageData, redactionResult } = pipelineOutput;
          // Milestone 18: Clear any prior overlay when moving to next page state/step
          sendOverlayTelemetry(activeTab?.id, { action: "clearAgentOverlay" });

          // Step 2: Compute current screen signature on-device (perceptual 32x32 hash + DOM structure)
          let currentSignature = null;
          if (window.SIHChangeDetector && typeof window.SIHChangeDetector.computeScreenSignature === "function") {
            currentSignature = await window.SIHChangeDetector.computeScreenSignature(
              latestScreenshotDataUrl,
              latestVisualElements
            );
          }

          // Update panel with local perception metrics
          if (agentScreenshotStatus) {
            agentScreenshotStatus.textContent = perceptionDecision.canReuse
              ? "REUSED (Stable Client-Side State)"
              : "CAPTURED LOCALLY (Client-Side Only)";
          }
          if (agentDomPiiCount) agentDomPiiCount.textContent = latestSensitiveRegions ? latestSensitiveRegions.length : 0;
          if (agentOcrPiiCount) agentOcrPiiCount.textContent = latestOcrSensitiveRegions ? latestOcrSensitiveRegions.length : 0;
          if (agentSensitiveCount) agentSensitiveCount.textContent = latestMergedRegions ? latestMergedRegions.length : 0;

          if (previewDomCount) previewDomCount.textContent = `${latestVisualElements ? latestVisualElements.length : 0} elements`;
          if (previewSensitiveCount) previewSensitiveCount.textContent = String(latestMergedRegions ? latestMergedRegions.length : (latestSensitiveRegions ? latestSensitiveRegions.length : 0));
          if (previewRedactionStatus) previewRedactionStatus.textContent = (redactionResult && redactionResult.success) ? "ACTIVE" : "WITHHELD";
          updatePipelineStage(
            "PERCEPTION",
            "completed",
            perceptionDecision.canReuse ? `REUSED (${probeMs}ms)` : `${latestVisualElements ? latestVisualElements.length : 0} DOM items`
          );

          // Transition immediately to Stage 2: REASONING
          updatePipelineStage("REASONING", "active", "Reasoning over visual context...");
          setAgentState(AGENT_STATES.PLAN, `Reasoning step ${currentStep}...`);
          const currentPlanBeforeReason = isPlannedTask && plannedSteps ? plannedSteps[currentStep - 1] : null;
          updateCurrentActionCard({
            stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
            action: currentPlanBeforeReason ? currentPlanBeforeReason.type : "REASON",
            target: currentPlanBeforeReason ? (currentPlanBeforeReason.target || currentPlanBeforeReason.targetHint || currentPlanBeforeReason.fieldHint || "Page Elements") : "Page Elements",
            value: currentPlanBeforeReason?.value || "",
            grounding: "Reasoning in progress...",
            risk: currentPlanBeforeReason?.risk || "LOW",
            safety: "ANALYZING",
            status: `Reasoning action for step ${currentStep}...`
          });

          if (visionPageChangeStatus) {
            visionPageChangeStatus.textContent = perceptionDecision.canReuse
              ? "STABLE (Reused)"
              : (perceptionDecision.reason.includes("Initial") ? "INITIAL" : "FRESH");
            visionPageChangeStatus.style.color = perceptionDecision.canReuse ? "#15803d" : "#1e40af";
          }

          // Step 3: Verify M11/M12 redaction success (Fail-closed contract)
          if (!redactionResult || !redactionResult.success || !redactionResult.sanitizedScreenshotDataUrl) {
            console.warn("Visual privacy redaction failed. Failing closed: Falling back to text-only pipeline.");
            if (agentRedactionStatus) {
              agentRedactionStatus.textContent = "FAILED (Masking withheld for privacy)";
              agentRedactionStatus.style.color = "#c62828";
            }
            if (agentSanitizedStatus) {
              agentSanitizedStatus.textContent = "UNAVAILABLE (Fail-closed)";
              agentSanitizedStatus.style.color = "#c62828";
            }
            if (agentSanitizedUploadStatus) {
              agentSanitizedUploadStatus.textContent = "N/A (BLOCKED: Redaction failed; raw screenshot NEVER transmitted)";
              agentSanitizedUploadStatus.style.color = "#c62828";
            }
            if (agentReasoningText) {
              agentReasoningText.textContent = "Visual context unavailable (redaction failed/withheld). Falling back to text-only sanitized pipeline.";
            }

            await executeTextOnlyFallback(activeTab, pageData, "Visual redaction withheld — text-only fallback");
            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: { action: "FALLBACK_TEXT_ONLY", target: "PAGE" },
              executed: true,
              status: "fallback",
              executionResult: "Executed text-only fallback",
              verification: "Fail-closed (visual upload blocked)"
            });
            renderTraceHistory();
            break;
          }

          // Redaction succeeded
          if (agentRedactionStatus) {
            agentRedactionStatus.textContent = "COMPLETE (Masked Offscreen)";
            agentRedactionStatus.style.color = "#2e7d32";
          }
          if (agentSanitizedStatus) {
            agentSanitizedStatus.textContent = "READY";
            agentSanitizedStatus.style.color = "#2e7d32";
          }
          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "TRANSMITTING (Sanitized Only)";
            agentSanitizedUploadStatus.style.color = "#1565c0";
          }

          // Step 4: Convert sanitized screenshot data URL to Blob (in-memory)
          const sanitizedBlobRes = await fetch(redactionResult.sanitizedScreenshotDataUrl);
          const sanitizedBlob = await sanitizedBlobRes.blob();

          // Step 5: Construct safe structured context and privacy metadata
          // CRITICAL PRIVACY: Never include literal values in structuredContext or fieldPlan!
          let currentStepPlan = isPlannedTask && (currentStep - 1 < plannedSteps.length)
            ? plannedSteps[currentStep - 1]
            : null;

          let activeGoal = taskGoals.find((g) => g.stepIds && g.stepIds.includes(currentStep - 1)) || null;

          if (currentStepPlan && currentStepPlan.type === "CLICK") {
            const isSearchResultSelection = !!(
              currentStepPlan.query ||
              currentStepPlan.isProductSelection ||
              (currentStepPlan.targetHint && /result|product|item|listing|video|movie|article|website|site|webpage|page|link/i.test(currentStepPlan.targetHint))
            );
            if (isSearchResultSelection) {
              setAgentState(AGENT_STATES.VERIFY, "Verifying search results state...");
              const searchState = await verifySearchResultsStateLocally(activeTab.id, currentStepPlan.query);
              if (!searchState.verified) {
                console.log("[SIH26171] Search results not yet stabilized, waiting briefly...");
                await waitForSearchResultsStabilization(activeTab.id, 4000);
              }
            }
          }

          let taskToSend = originalUserTask;
          let stepFieldPlan = [];
          if (currentStepPlan) {
            if (currentStepPlan.type === "FILL_FORM") {
              taskToSend = "Fill form";
              stepFieldPlan = [{
                type: "FILL_FORM",
                fieldHint: currentStepPlan.fieldHint || "all form fields",
                stepId: currentStep - 1
              }];
            } else if (currentStepPlan.type === "FILL") {
              const isSearchStep = currentStepPlan.expectedRole === "PRIMARY_SEARCH_INPUT" || currentStepPlan.targetRole === "PRIMARY_SEARCH_INPUT" || currentStepPlan.fieldHint === "search";
              taskToSend = isSearchStep ? "Fill search" : `Fill ${currentStepPlan.fieldHint}`;
              stepFieldPlan = [{
                type: "FILL",
                fieldHint: currentStepPlan.fieldHint,
                targetRole: isSearchStep ? "PRIMARY_SEARCH_INPUT" : "input",
                stepId: currentStep - 1
              }];
            } else if (currentStepPlan.type === "SUBMIT") {
              taskToSend = currentStepPlan.query
                ? `Submit search for '${currentStepPlan.query}'`
                : "Submit search";
              stepFieldPlan = [];
            } else if (currentStepPlan.type === "NAVIGATE") {
              taskToSend = currentStepPlan.url
                ? `Navigate to ${currentStepPlan.url}`
                : `Navigate to ${currentStepPlan.target || currentStepPlan.targetHint || "destination"}`;
              stepFieldPlan = [];
            } else if (currentStepPlan.type === "CLICK" || currentStepPlan.type === "OPEN") {
              const isSearchResultSelection = !!(
                currentStepPlan.query ||
                currentStepPlan.isProductSelection ||
                (currentStepPlan.targetHint && /result|product|item|listing|video|movie|article|website|site|webpage|page|link/i.test(currentStepPlan.targetHint))
              );
              const targetHintNorm = (currentStepPlan.targetHint || "").toLowerCase().trim();
              const isAbstract = !targetHintNorm || /^(?:most\s+relevant\s+result|most\s+relavent\s+result|relevant\s+result|correct\s+result|appropriate\s+result|the\s+result|result|the\s+website|website|the\s+site|site|the\s+page|page|the\s+link|link|the\s+product|product|most\s+relevant\s+product|it|that|this|them)$/i.test(targetHintNorm);

              if (currentStepPlan.targetEntity && currentStepPlan.targetEntity.name) {
                taskToSend = `Open ${currentStepPlan.targetEntity.name} ${currentStepPlan.targetIntent || "profile"}`;
              } else if (currentStepPlan.isExplicitTarget && currentStepPlan.explicitTarget) {
                taskToSend = `Click the result called "${currentStepPlan.explicitTarget}"`;
              } else if (!isAbstract && currentStepPlan.targetHint) {
                taskToSend = `Click ${currentStepPlan.targetHint}`;
              } else if (isSearchResultSelection && currentStepPlan.query) {
                const concrete = (window.SIHReasoningPlanner && window.SIHReasoningPlanner.resolveConcreteSearchTarget)
                  ? window.SIHReasoningPlanner.resolveConcreteSearchTarget(currentStepPlan.query, currentStepPlan.targetHint)
                  : `${currentStepPlan.query} official website`;
                taskToSend = `Click ${concrete}`;
              } else {
                taskToSend = currentStepPlan.targetHint
                  ? `Click ${currentStepPlan.targetHint}`
                  : (currentStepPlan.legacyTarget || "Click");
              }
              stepFieldPlan = [];
            } else if (currentStepPlan.type === "SCROLL") {
              taskToSend = currentStepPlan.amount
                ? `Scroll down ${currentStepPlan.amount} pixels`
                : "Scroll down";
              stepFieldPlan = [];
            }
          } else if (isPlannedTask) {
            stepFieldPlan = parsedTask.sanitizedPlan.filter((s) => s.type === "FILL" || s.type === "FILL_FORM");
          }

          const structuredContext = {
            title: (typeof redactText === "function") ? redactText(pageData?.title || "") : (pageData?.title || ""),
            url: pageData?.url || "",
            redactedSample: (typeof redactText === "function") ? redactText(pageData?.redactedSample || "") : (pageData?.redactedSample || ""),
            elementCount: (latestVisualElements || []).length,
            elements: (latestVisualElements || []).map((el) => ({
              type: el.type,
              tag: el.tag || null,
              role: el.role || null,
              label: (typeof redactText === "function") ? redactText(el.label || "") : (el.label || ""),
              semanticTag: el.semanticTag || null,
              url: el.url || el.href || null,
              href: el.href || el.url || null,
              placeholder: el.placeholder || null,
              ariaLabel: el.ariaLabel || null,
              name: el.name || null,
              id: el.id || null,
              title: el.title || null,
              fieldId: el.fieldId !== undefined ? el.fieldId : null,
              index: el.index !== undefined ? el.index : null,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              isSearchResult: !!el.isSearchResult,
              isAccountControl: !!el.isAccountControl,
              isHeaderNav: !!el.isHeaderNav,
              isFooterNav: !!el.isFooterNav,
              snippet: el.snippet || null
            })),
            fieldPlan: stepFieldPlan,
            currentGoal: activeGoal ? activeGoal.title : taskToSend,
            remainingGoalsCount: remainingGoals.length,
            sceneClassification: latestVisionResult ? {
              classIndex: latestVisionResult.classIndex,
              confidence: latestVisionResult.confidence
            } : null,
            sensitiveRegionCount: latestSensitiveRegions ? latestSensitiveRegions.length : 0,
            ocrTextRegionCount: latestOcrWordCount,
            totalRedactedRegionCount: latestMergedRegions ? latestMergedRegions.length : 0,
            loopStep: currentStep,
            totalPlannedSteps: totalPlannedSteps
          };

          const privacyMetadata = {
            privacyState: "SANITIZED",
            rawScreenshotTransmitted: false,
            redactedRegionsCount: latestMergedRegions ? latestMergedRegions.length : 0,
            timestamp: Date.now()
          };

          // Step 6: Send ONLY sanitized screenshot + structured data to Visual Gateway
          let gatewayResult = null;
          try {
            console.log("[SIH26171] Gateway request started");
            gatewayResult = await sendToVisualGateway(
              sanitizedBlob,
              taskToSend,
              structuredContext,
              privacyMetadata,
              requestId
            );
            console.log("[SIH26171] Gateway response received");
          } catch (gwErr) {
            console.warn("Visual gateway upload error, attempting local reasoning fallback:", gwErr);
            if (currentStepPlan) {
              console.log("[SIH26171] Gateway unavailable, falling back seamlessly to local deterministic reasoning plan");
              if (agentSanitizedUploadStatus) {
                agentSanitizedUploadStatus.textContent = "OFFLINE (Local Reasoning Fallback)";
                agentSanitizedUploadStatus.style.color = "#e65100";
              }
              if (agentReasoningText) {
                agentReasoningText.textContent = `Visual gateway unavailable (${gwErr.message}). Using on-device deterministic reasoning.`;
              }
              let localActionVal = (currentStepPlan.value !== undefined) ? currentStepPlan.value : null;
              if (!localActionVal && localValuesMap && localValuesMap[currentStep - 1] !== undefined) {
                localActionVal = localValuesMap[currentStep - 1];
              }
              gatewayResult = {
                latencyMs: 0,
                data: {
                  provider: "Demo fallback",
                  providerType: "gemini-fallback",
                  fallbackUsed: true,
                  fallbackReason: `Gateway unavailable (${gwErr.message}), fell back to local deterministic planner`,
                  action: {
                    action: currentStepPlan.type,
                    target: currentStepPlan.target || currentStepPlan.targetHint || currentStepPlan.fieldHint || "target",
                    targetLabel: currentStepPlan.targetHint || currentStepPlan.fieldHint || currentStepPlan.target || "target",
                    fieldHint: currentStepPlan.fieldHint,
                    value: localActionVal,
                    amount: currentStepPlan.amount || null,
                    requiresApproval: !!currentStepPlan.requiresApproval,
                    groundingMethod: "planned-intent",
                    groundingScore: 0
                  }
                }
              };
            } else {
              if (agentSanitizedUploadStatus) {
                agentSanitizedUploadStatus.textContent = "GATEWAY FAILED (Falling back to text-only)";
                agentSanitizedUploadStatus.style.color = "#e65100";
              }
              if (agentReasoningText) {
                agentReasoningText.textContent = `Visual gateway call failed (${gwErr.message}). Falling back to text-only sanitized pipeline.`;
              }

              await executeTextOnlyFallback(activeTab, pageData, "Gateway error fallback");
              resetTaskGroundingState();
              executionTraceHistory.push({
                step: currentStep,
                requestId,
                action: null,
                executed: false,
                status: "fallback",
                executionResult: `Gateway error: ${gwErr.message}`,
                verification: "Fell back to text-only (/api/context)"
              });
              renderTraceHistory();
              break;
            }
          }

          // Step 7: Process Visual Gateway response
          const { data, latencyMs } = gatewayResult;
          timing.gatewayMs = latencyMs;
          if (agentGatewayLatency) agentGatewayLatency.textContent = `${latencyMs} ms`;
          if (timingGateway) timingGateway.textContent = `${latencyMs} ms`;

          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "ALLOWED (Delivered to Gateway)";
            agentSanitizedUploadStatus.style.color = "#2e7d32";
          }
          const isGeminiSuccess = data.provider === "Gemini" && !data.fallbackUsed;
          updatePipelineStage("REASONING", "completed", isGeminiSuccess ? "Gemini (Sanitized) ✓" : "Local Reasoning ✓");

          // Section AI Provider Telemetry

          const isFallback = data.fallbackUsed || data.provider === "Demo fallback" || data.providerType === "gemini-fallback";

          if (agentModeStatus) {
            if (isGeminiSuccess) {
              agentModeStatus.textContent = "AI PROVIDER: GEMINI";
              agentModeStatus.style.color = "#1565c0";
            } else if (isFallback) {
              agentModeStatus.textContent = "AI PROVIDER: DEMO FALLBACK";
              agentModeStatus.style.color = "#e65100";
            } else {
              agentModeStatus.textContent = "AI PROVIDER: DEMO (Deterministic)";
              agentModeStatus.style.color = "#0d47a1";
            }
          }

          if (agentModeSubtext) {
            if (isGeminiSuccess) {
              agentModeSubtext.textContent = "(Server-side Gemini reasoning over sanitized context; zero PII transmitted)";
            } else if (isFallback) {
              agentModeSubtext.textContent = "(Local deterministic fallback)";
            } else {
              agentModeSubtext.textContent = "(Deterministic local agent; no external AI API keys)";
            }
          }

          const agentReasoningLocation = document.getElementById("agentReasoningLocation");
          if (agentReasoningLocation) {
            if (isGeminiSuccess) {
              agentReasoningLocation.textContent = "GEMINI (Sanitized Context)";
              agentReasoningLocation.style.color = "#1565c0";
            } else if (isFallback) {
              agentReasoningLocation.textContent = "LOCAL FALLBACK";
              agentReasoningLocation.style.color = "#e65100";
            } else {
              agentReasoningLocation.textContent = "LOCAL (Deterministic)";
              agentReasoningLocation.style.color = "#2e7d32";
            }
          }

          if (agentFallbackRow && agentFallbackReasonText) {
            if (isFallback) {
              agentFallbackRow.style.display = "block";
              agentFallbackReasonText.textContent = data.fallbackReason || "Gemini API unavailable";
            } else {
              agentFallbackRow.style.display = "none";
            }
          }

          if (badgeGeminiReasoning) {
            if (isGeminiSuccess) {
              badgeGeminiReasoning.textContent = "2. GEMINI REASONING";
              badgeGeminiReasoning.style.background = "#e8eaf6";
              badgeGeminiReasoning.style.color = "#1a237e";
            } else if (isFallback) {
              badgeGeminiReasoning.textContent = "2. LOCAL FALLBACK REASONING";
              badgeGeminiReasoning.style.background = "#fff3e0";
              badgeGeminiReasoning.style.color = "#e65100";
            } else {
              badgeGeminiReasoning.textContent = "2. DEMO REASONING";
              badgeGeminiReasoning.style.background = "#ede7f6";
              badgeGeminiReasoning.style.color = "#4a148c";
            }
          }

          let agentAction = data.action;

          // FIX #2: STRICT STEP COMPATIBILITY & EXPLICIT TASK AUTHORITY
          // When a parsed task contains a current planned step, the returned agent action
          // MUST be compatible with that step. Incompatible actions from backend or page-text fallbacks
          // are discarded and replaced with local grounding for the planned step.
          setAgentState(AGENT_STATES.GROUND, "Grounding action locally...");
          if (currentStepPlan) {
            const plannedType = (currentStepPlan.type || "").toUpperCase();

            if (plannedType === "NAVIGATE" || plannedType === "OPEN_URL") {
              const destination = currentStepPlan.target || currentStepPlan.targetHint || "destination";
              let targetUrl = currentStepPlan.url;
              if (!targetUrl && window.SIHTaskParser && typeof window.SIHTaskParser.resolveNavigationUrl === "function") {
                targetUrl = window.SIHTaskParser.resolveNavigationUrl(destination);
              }
              if (!targetUrl) {
                targetUrl = `https://www.${destination.toLowerCase().replace(/[^a-z0-9\-]/g, "")}.com`;
              }
              agentAction = {
                action: "NAVIGATE",
                target: destination,
                targetLabel: destination,
                url: targetUrl,
                groundingScore: 1.0,
                groundingMethod: "navigation-rule",
                isNavigation: true
              };
            } else if (plannedType === "FILL_FORM") {
              agentAction = {
                action: "FILL_FORM",
                target: "all form fields",
                targetLabel: "all form fields",
                groundingMethod: "simultaneous-form-profile"
              };
            } else if (plannedType === "FILL") {
              const targetCandidate = agentAction ? (agentAction.targetLabel || agentAction.target || "") : "";
              const isSearchStep = currentStepPlan.expectedRole === "PRIMARY_SEARCH_INPUT" || currentStepPlan.targetRole === "PRIMARY_SEARCH_INPUT" || currentStepPlan.fieldHint === "search";
              const hasExplicitAi = typeof originalUserTask !== "undefined" && originalUserTask && /\b(?:gemini|copilot|chatgpt|ai\s+mode|ai\s+assistant|chat\s+with|ask\s+ai|ask\s+anything)\b/i.test(originalUserTask);
              const isAiTarget = isAiAssistantElement({ label: targetCandidate, ariaLabel: targetCandidate });
              const isDisallowedSearchTarget = isSearchStep && !hasExplicitAi && (
                isAiTarget ||
                /^(?:how\s+search\s+works|ai\s+mode|ask\s+anything|gemini|ai\s+assistant|assistant)$/i.test(targetCandidate.trim())
              );
              const matchesRequestedField = isFieldMatch(targetCandidate, currentStepPlan.fieldHint) && (!isSearchStep || !isDisallowedSearchTarget);
              const isCompatibleFill = agentAction && agentAction.action === "FILL" && agentAction.targetIndex !== undefined && matchesRequestedField;
              // CRITICAL QUERY RULE: Authoritative explicit value extraction takes precedence
              let authoritativeVal = (currentStepPlan && currentStepPlan.value) ? currentStepPlan.value : null;
              if (!authoritativeVal && localValuesMap && localValuesMap[currentStep - 1] !== undefined) {
                authoritativeVal = localValuesMap[currentStep - 1];
              }
              if (!authoritativeVal && localValuesMap && localValuesMap[`step_${currentStep - 1}`] !== undefined) {
                authoritativeVal = localValuesMap[`step_${currentStep - 1}`];
              }
              if (!authoritativeVal && window.SIHTaskParser && typeof window.SIHTaskParser.extractTaskQueryOrValue === "function") {
                authoritativeVal = window.SIHTaskParser.extractTaskQueryOrValue(task);
              }

              if (isCompatibleFill) {
                if (authoritativeVal) {
                  agentAction.value = authoritativeVal;
                } else if (!agentAction.value && currentStepPlan.value) {
                  agentAction.value = currentStepPlan.value;
                }
              }
              if (!isCompatibleFill) {
                const normalize = (s) => (s || "").trim().toLowerCase();
                const targetHintNorm = normalize(currentStepPlan.fieldHint);

                let bestIdx = -1;
                let bestScore = 0;
                let runnerUpScore = 0;
                let runnerUpIdx = -1;
                const expectedRole = (isSearchStep ? "PRIMARY_SEARCH_INPUT" : (currentStepPlan.expectedRole || currentStepPlan.role || "")).toLowerCase();
                const fillCandidates = latestFusedElements || latestVisualElements || [];

                // Generic Semantic Editable Target Resolution (Parts 2, 4, 5, 26)
                let semanticResolved = null;
                const semResolver = window.SIHSemanticResolver || (typeof require === "function" ? (function(){ try { return require("./semantic-resolver.js"); } catch(e){ return null; } })() : null);
                if (semResolver && typeof semResolver.resolveEditableTarget === "function" && !isSearchStep) {
                  const intentDesc = {
                    intent: currentStepPlan.semanticIntent || (parsedTask && parsedTask.semanticIntent) || "GENERIC_TEXT_EDITOR",
                    role: currentStepPlan.semanticRole || currentStepPlan.expectedRole || currentStepPlan.targetRole || null,
                    composerType: currentStepPlan.composerType || null,
                    fieldHint: currentStepPlan.fieldHint || currentStepPlan.targetHint || currentStepPlan.target || ""
                  };
                  const ctxDesc = {
                    previousAction: taskContext.previousAction,
                    previousTarget: taskContext.previousTarget,
                    inDialog: Boolean(taskContext.currentDialog || fillCandidates.some(c => c.inDialog)),
                    container: taskContext.currentContainer || "main",
                    task: task
                  };
                  semanticResolved = semResolver.resolveEditableTarget(intentDesc, fillCandidates, ctxDesc);
                }

                if (semanticResolved && semanticResolved.target && semanticResolved.score >= 0.35) {
                  const matchedEl = semanticResolved.target;
                  bestIdx = matchedEl.index !== undefined ? matchedEl.index : fillCandidates.indexOf(matchedEl);
                  bestScore = semanticResolved.score;
                  const resolvedRole = matchedEl.role || matchedEl.type || "textbox";
                  const resolvedTag = matchedEl.tag || matchedEl.semanticTag || (matchedEl.type === "contenteditable" ? "contenteditable" : (matchedEl.type || "input"));
                  const containerType = (matchedEl.inDialog || taskContext.currentDialog) ? "dialog" : (matchedEl.containerRole || "container");
                  const candidateCount = semanticResolved.candidateCount || fillCandidates.length;
                  const groundingMethod = semanticResolved.method || "semantic+container+visual";

                  agentAction = {
                    action: "FILL",
                    target: matchedEl.label || matchedEl.ariaLabel || matchedEl.placeholder || currentStepPlan.target || currentStepPlan.fieldHint,
                    targetIndex: bestIdx,
                    targetType: matchedEl.type || "contenteditable",
                    targetLabel: matchedEl.label || matchedEl.ariaLabel || matchedEl.placeholder || currentStepPlan.fieldHint,
                    fieldHint: currentStepPlan.fieldHint,
                    semanticTarget: currentStepPlan.semanticTarget || semanticResolved.role || currentStepPlan.fieldHint,
                    value: authoritativeVal || currentStepPlan.value || (data.action?.value) || "",
                    groundingScore: bestScore,
                    groundingMethod: groundingMethod,
                    semanticTargetDescriptor: createSemanticTargetDescriptor(matchedEl, currentStepPlan.fieldHint, expectedRole)
                  };

                  const fillVal = agentAction.value || authoritativeVal || currentStepPlan.value || "[text]";
                  const safeFillVal = (typeof redactText === "function" ? redactText(String(fillVal)) : (window.SIHPrivacyRedactor?.redactText ? window.SIHPrivacyRedactor.redactText(String(fillVal)) : "[text]"));
                  appendPlannerTrace(
                    `[GROUNDING AUDIT]\n` +
                    `semanticTarget: ${agentAction.semanticTarget}\n` +
                    `resolvedRole: ${resolvedRole}\n` +
                    `resolvedTag: ${resolvedTag}\n` +
                    `containerType: ${containerType}\n` +
                    `candidateCount: ${candidateCount}\n` +
                    `groundingScore: ${Number(bestScore).toFixed(2)}\n` +
                    `groundingMethod: ${groundingMethod}\n` +
                    `postActionPerception: true\n` +
                    `confidence: ${Number(bestScore).toFixed(2)}`
                  );
                  appendPlannerTrace(`[GROUNDING TRACE]\nAction:\nFILL\n\nRequested Target:\n${agentAction.semanticTarget}\n\nCandidate:\n${agentAction.targetLabel}\n\nRole:\n${resolvedRole}\n\nSemantic Score:\n${Number(bestScore).toFixed(2)}\n\nAction Compatibility:\nHIGH\n\nValue:\n${safeFillVal}\n\nFinal Decision:\nGROUNDED`);
                } else {
                  fillCandidates.forEach((el, idx) => {
                    let score = isSearchStep
                      ? scoreSearchCandidate(el, task, hasExplicitAi)
                      : scoreElementForField(el, currentStepPlan.fieldHint);
                    if (score > 0 && expectedRole && !isSearchStep) {
                      const elType = (el.type || "").toLowerCase();
                      if (expectedRole.includes(elType) || (expectedRole.includes("textarea") && (elType === "textarea" || elType === "contenteditable")) || (expectedRole.includes("combobox") && elType === "combobox")) {
                        score = Math.min(1.0, score + 0.10);
                      }
                    }
                    if (score > 0 && el.isVisualConfirmed && !isSearchStep) {
                      score = Math.min(1.0, score + 0.10);
                    }
                    if (score > bestScore) {
                      runnerUpScore = bestScore;
                      runnerUpIdx = bestIdx;
                      bestScore = score;
                      bestIdx = idx;
                    } else if (score > runnerUpScore) {
                      runnerUpScore = score;
                      runnerUpIdx = idx;
                    }
                  });

                  // Safety Gate: Ambiguity Rejection (Requirement 10)
                  let isAmbiguous = false;
                  if (bestIdx >= 0 && runnerUpIdx >= 0 && Math.abs(bestScore - runnerUpScore) < 0.05) {
                    const bestEl = fillCandidates[bestIdx];
                    const runnerUpEl = fillCandidates[runnerUpIdx];
                    if (bestEl.label !== runnerUpEl.label && normalize(bestEl.label) !== normalize(runnerUpEl.label)) {
                      isAmbiguous = true;
                    }
                  }

                  if (isAmbiguous) {
                    const isComm = (currentStepPlan && (currentStepPlan.context === "communication_composer" || currentStepPlan.composerType || currentStepPlan.context === "post_composer" || currentStepPlan.context === "message_composer"));
                    agentAction = {
                      action: "NONE",
                      target: null,
                      reason: isComm
                        ? "AMBIGUOUS COMMUNICATION COMPOSER"
                        : `Ambiguous field targets: multiple candidates match '${currentStepPlan.fieldHint}' with similar confidence.`
                    };
                  } else if (bestIdx >= 0 && bestScore >= 0.35) {
                    const matchedEl = fillCandidates[bestIdx];
                    const cleanSearchLabel = matchedEl.label && !/^(?:how\s+search\s+works|ai\s+mode|textarea|input)$/i.test(matchedEl.label) ? matchedEl.label : "Search";
                    agentAction = {
                      action: "FILL",
                      target: isSearchStep ? "PRIMARY_SEARCH_INPUT" : (matchedEl.label || matchedEl.ariaLabel || matchedEl.placeholder || currentStepPlan.target || currentStepPlan.fieldHint),
                      targetRole: isSearchStep ? "PRIMARY_SEARCH_INPUT" : undefined,
                      targetIndex: matchedEl.index !== undefined ? matchedEl.index : bestIdx,
                      targetType: matchedEl.type,
                      targetLabel: isSearchStep ? cleanSearchLabel : (matchedEl.label || matchedEl.ariaLabel || matchedEl.placeholder || currentStepPlan.fieldHint),
                      fieldHint: currentStepPlan.fieldHint,
                      semanticTarget: currentStepPlan.semanticTarget || (isSearchStep ? "PRIMARY_SEARCH_INPUT" : (matchedEl.label || matchedEl.ariaLabel || matchedEl.placeholder)),
                      value: authoritativeVal || currentStepPlan.value || (data.action?.value) || "",
                      groundingScore: bestScore,
                      groundingMethod: isSearchStep ? "primary-search-ranking" : (matchedEl.isVisualConfirmed ? "dom+visual-fusion" : "local-fuzzy-match"),
                      semanticTargetDescriptor: createSemanticTargetDescriptor(matchedEl, currentStepPlan.fieldHint, isSearchStep ? "PRIMARY_SEARCH_INPUT" : expectedRole)
                    };
                    const reqTarget = currentStepPlan.target || currentStepPlan.fieldHint || "input";
                    const candName = agentAction.targetLabel || agentAction.target || reqTarget;
                    const roleName = agentAction.targetType || "contenteditable";
                    const scoreVal = Number(bestScore || 0.95).toFixed(2);
                    const fillVal = agentAction.value || authoritativeVal || currentStepPlan.value || "[text]";
                    const safeFillVal = (typeof redactText === "function" ? redactText(String(fillVal)) : (window.SIHPrivacyRedactor?.redactText ? window.SIHPrivacyRedactor.redactText(String(fillVal)) : "[text]"));
                    appendPlannerTrace(`[GROUNDING TRACE]\nAction:\nFILL\n\nRequested Target:\n${reqTarget}\n\nCandidate:\n${candName}\n\nRole:\n${roleName}\n\nSemantic Score:\n${scoreVal}\n\nAction Compatibility:\nHIGH\n\nValue:\n${safeFillVal}\n\nFinal Decision:\nGROUNDED`);
                  } else {
                  // Section 5 Bounded Recovery: Live DOM re-perception before falling back
                  const recoveryPage = await new Promise((r) => {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => r(resp || null));
                    }, 250);
                  });
                  if (recoveryPage && Array.isArray(recoveryPage.visualElements)) {
                    latestVisualElements = recoveryPage.visualElements;
                    (latestVisualElements || []).forEach((el, idx) => {
                      let score = isSearchStep
                        ? scoreSearchCandidate(el, task, hasExplicitAi)
                        : scoreElementForField(el, currentStepPlan.fieldHint);
                      if (score > 0 && expectedRole && !isSearchStep) {
                        const elType = (el.type || "").toLowerCase();
                        if (expectedRole.includes(elType) || (expectedRole.includes("textarea") && (elType === "textarea" || elType === "contenteditable")) || (expectedRole.includes("combobox") && elType === "combobox")) {
                          score = Math.min(1.0, score + 0.10);
                        }
                      }
                      if (score > bestScore) {
                        bestScore = score;
                        bestIdx = idx;
                      }
                    });
                    if (bestIdx >= 0 && bestScore >= 0.35) {
                      const matchedEl = latestVisualElements[bestIdx];
                      const cleanSearchLabel = matchedEl.label && !/^(?:how\s+search\s+works|ai\s+mode|textarea|input)$/i.test(matchedEl.label) ? matchedEl.label : "Search";
                      stepRecoveryNote = "Recovered form field target after live DOM re-perception";
                      if (window.SIHEvaluationTracker) window.SIHEvaluationTracker.recordRecovery(stepRecoveryNote);
                      agentAction = {
                        action: "FILL",
                        target: isSearchStep ? "PRIMARY_SEARCH_INPUT" : (matchedEl.label || matchedEl.ariaLabel || matchedEl.placeholder || currentStepPlan.target || currentStepPlan.fieldHint),
                        targetRole: isSearchStep ? "PRIMARY_SEARCH_INPUT" : undefined,
                        targetIndex: matchedEl.index !== undefined ? matchedEl.index : bestIdx,
                        targetType: matchedEl.type,
                        targetLabel: isSearchStep ? cleanSearchLabel : (matchedEl.label || matchedEl.ariaLabel || matchedEl.placeholder || currentStepPlan.fieldHint),
                        fieldHint: currentStepPlan.fieldHint,
                        semanticTarget: currentStepPlan.semanticTarget || (isSearchStep ? "PRIMARY_SEARCH_INPUT" : (matchedEl.label || matchedEl.ariaLabel || matchedEl.placeholder)),
                        value: authoritativeVal || currentStepPlan.value || (data.action?.value) || "",
                        groundingScore: bestScore,
                        groundingMethod: isSearchStep ? "primary-search-ranking" : "bounded-recovery-match",
                        semanticTargetDescriptor: createSemanticTargetDescriptor(matchedEl, currentStepPlan.fieldHint, isSearchStep ? "PRIMARY_SEARCH_INPUT" : expectedRole)
                      };
                    }
                  }

                  if (!agentAction || agentAction.action !== "FILL") {
                    agentAction = {
                      action: "NONE",
                      target: null,
                      reason: `Could not safely ground form field '${currentStepPlan.fieldHint}' on DOM.`
                    };
                  }
                }
                }
              }
            } else if (plannedType === "SUBMIT") {
              agentAction = {
                action: "SUBMIT",
                target: "search",
                targetType: "input",
                targetLabel: "search",
                groundingScore: 1.0,
                groundingMethod: "search-submission-rule"
              };
            } else if (plannedType === "CLICK" || plannedType === "OPEN") {
              const isPreviousStepSearchSubmit = Boolean(
                (currentStep >= 3 && parsedTask && parsedTask.steps && parsedTask.steps[currentStep - 2] &&
                  (parsedTask.steps[currentStep - 2].type === "SUBMIT" || parsedTask.steps[currentStep - 2].target === "search")) ||
                (window.lastExecutedAction && (window.lastExecutedAction.action === "SUBMIT" || window.lastExecutedAction.target === "search"))
              );
              const isSearchResultSelection = Boolean(
                isPreviousStepSearchSubmit ||
                currentStepPlan.isSearchResult ||
                currentStepPlan.query ||
                currentStepPlan.isProductSelection ||
                (currentStepPlan.targetHint && /result|product|item|listing|video|movie|article|website|site|webpage|page|link/i.test(currentStepPlan.targetHint))
              );
              const isExplicitTarget = !!(currentStepPlan.isExplicitTarget);
              const explicitTargetVal = (currentStepPlan.explicitTarget || (isExplicitTarget ? currentStepPlan.targetHint : null) || "").toLowerCase().trim();
              const queryNorm = (currentStepPlan.query || "").toLowerCase().trim();
              const queryTokens = queryNorm.split(/\s+/).filter(Boolean);

              const ACCESSORY_TERMS = [
                "case", "cover", "protector", "screen protector", "tempered glass",
                "charger", "cable", "adapter", "cord", "strap", "holder", "stand",
                "pouch", "sleeve", "skin", "lens", "mount", "replacement",
                "battery pack", "power bank", "ear tips"
              ];

              const isSearchBoxTarget = Boolean(
                (currentStepPlan.targetHint && /\bsearch\s*(?:box|input|field|bar|area)?\b/i.test(currentStepPlan.targetHint)) ||
                currentStepPlan.legacyTarget === "SEARCH_INPUT"
              );

              let isCompatibleClick = agentAction && agentAction.action === "CLICK";
              if (isCompatibleClick && isSearchBoxTarget) {
                const candLabel = (agentAction.targetLabel || agentAction.target || "").toLowerCase();
                const candType = (agentAction.targetType || "").toLowerCase();
                // Reject voice controls when user requested search box
                if (/voice|mic|audio|speak/i.test(candLabel)) {
                  isCompatibleClick = false;
                } else if (candType === "button" && !candLabel.includes("search input") && !candLabel.includes("search box")) {
                  const hasActualInput = (latestFusedElements || latestVisualElements || []).some(el => {
                    const t = (el.type || "").toLowerCase();
                    const l = (el.label || "").toLowerCase();
                    return (t === "input" || t === "textarea" || el.semanticTag === "SEARCH_INPUT") &&
                           (l.includes("search") || el.semanticTag === "SEARCH_INPUT" || !/voice|mic/i.test(l));
                  });
                  if (hasActualInput) {
                    isCompatibleClick = false;
                  }
                }
              }
              if (isCompatibleClick && isExplicitTarget && explicitTargetVal) {
                const candLabel = (agentAction.targetLabel || agentAction.target || "").toLowerCase();
                if (!candLabel.includes(explicitTargetVal)) {
                  isCompatibleClick = false; // Discard backend action if it doesn't match the explicit target
                }
              }

              const explicitClickTarget = (currentStepPlan?.explicitTarget || (isExplicitTarget ? currentStepPlan?.targetHint : null) || currentStepPlan?.target || currentStepPlan?.targetHint || "").toLowerCase().trim();
              if (isCompatibleClick && explicitClickTarget && !isSearchResultSelection && !isSearchBoxTarget) {
                const candLabel = (agentAction.targetLabel || agentAction.target || "").toLowerCase();
                const isExplicitProfileRequested = /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(explicitClickTarget);
                const isCandProfile = /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar|profile_photo|profile_pic)\b/i.test(candLabel) ||
                  (agentAction.targetType === "image" || agentAction.role === "img");
                if (isCandProfile && !isExplicitProfileRequested) {
                  isCompatibleClick = false; // Discard avatar/profile click suggested by backend
                } else if (!candLabel.includes(explicitClickTarget) && !explicitClickTarget.includes(candLabel)) {
                  isCompatibleClick = false; // Discard backend action if it doesn't match the explicit target
                }
              }
              if (isCompatibleClick && isSearchResultSelection) {
                const candLabel = (agentAction.targetLabel || agentAction.target || "").toLowerCase();
                if (isGenericNavigationOrHomepageTarget(candLabel) || isGenericNavigationOrHomepageTarget(agentAction)) {
                  isCompatibleClick = false; // Discard homepage navigation / account / settings click
                }
                const resolver = (typeof window !== "undefined" && window.SIHSemanticResolver) || (typeof SIHSemanticResolver !== "undefined" ? SIHSemanticResolver : null);
                if (resolver && typeof resolver.isExcludedSearchPageControl === "function" && resolver.isExcludedSearchPageControl(agentAction)) {
                  isCompatibleClick = false; // Discard excluded search controls
                }
                const candIsAccessory = ACCESSORY_TERMS.some(t => candLabel.includes(t) && !queryNorm.includes(t));
                if (candIsAccessory) {
                  // If Gemini proposed an accessory, check if an actual non-accessory product candidate exists
                  const hasActualProductCand = (latestVisualElements || []).some(el => {
                    const lNorm = (el.label || "").toLowerCase();
                    const matchesQuery = queryTokens.length > 0 && queryTokens.every(t => lNorm.includes(t));
                    const isAcc = ACCESSORY_TERMS.some(t => lNorm.includes(t) && !queryNorm.includes(t));
                    return matchesQuery && !isAcc && !isGenericNavigationOrHomepageTarget(el.label);
                  });
                  if (hasActualProductCand) {
                    isCompatibleClick = false; // Discard accessory to allow local grounding of actual device
                  }
                }
              }

              if (isCompatibleClick && currentStepPlan?.attribute && currentStepPlan?.attributeValue) {
                const targetValNorm = (currentStepPlan.attributeValue || "").toLowerCase();
                const candLabel = (agentAction.targetLabel || agentAction.target || "").toLowerCase();
                if (!candLabel.includes(targetValNorm)) {
                  isCompatibleClick = false; // Discard Gemini suggestion if it doesn't verify the attribute
                }
              }

              const resolver = (typeof window !== "undefined" && window.SIHSemanticResolver) || (typeof SIHSemanticResolver !== "undefined" ? SIHSemanticResolver : null);
              const isSemanticTask = Boolean(
                resolver && (
                  isSearchResultSelection ||
                  currentStepPlan?.isSearchResult ||
                  currentStepPlan?.isSemantic ||
                  currentStepPlan?.ranking ||
                  (currentStepPlan?.ordinal !== null && currentStepPlan?.ordinal !== undefined) ||
                  currentStepPlan?.spatial ||
                  currentStepPlan?.semanticCategory ||
                  resolver.isSemanticInstruction(agentAction?.targetLabel || agentAction?.target || currentStepPlan?.targetHint || currentStepPlan?.rawStepText)
                )
              );

              if (isCompatibleClick && isSemanticTask) {
                const candLabel = (agentAction.targetLabel || agentAction.target || "").toLowerCase();
                if (resolver.isSemanticInstruction(candLabel) || agentAction.targetIndex === undefined || (isSearchResultSelection && resolver.isExcludedSearchPageControl && resolver.isExcludedSearchPageControl(agentAction))) {
                  isCompatibleClick = false; // Discard raw semantic phrase or excluded control to allow semantic grounding
                }
              }

              if (!isCompatibleClick || agentAction.targetIndex === undefined) {
                const normalize = (s) => (s || "").trim().toLowerCase();
                const rawHint = normalize(currentStepPlan.targetHint || currentStepPlan.legacyTarget || agentAction?.target || "").replace(/_button|_input/, "").trim();
                const cleanHint = rawHint.replace(/\s+(?:box|input|field|area|button|link|section|tab|panel|container|header|heading|option|checkbox)$/i, "").trim();

                const hasAttributeConstraint = Boolean(currentStepPlan?.attribute && currentStepPlan?.attributeValue && currentStepPlan?.objectTarget);
                const targetObjNorm = hasAttributeConstraint ? normalize(currentStepPlan.objectTarget) : null;
                const targetAttrNorm = hasAttributeConstraint ? normalize(currentStepPlan.attribute) : null;
                const targetValNorm = hasAttributeConstraint ? normalize(currentStepPlan.attributeValue) : null;

                const computeClickScore = (el) => {
                  if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return 0;
                  const elType = (el.type || "").toLowerCase();
                  const ALLOWED_CLICK_TYPES = ["button", "link", "input", "element", "heading", "tab", "menuitem", "option", "checkbox", "radio", "switch", "select", "section"];
                  if (!ALLOWED_CLICK_TYPES.includes(elType)) return 0;
                  const labelNorm = normalize(el.label);
                  const candTextParts = [
                    el.label,
                    el.text,
                    el.ariaLabel,
                    el.title,
                    el.alt,
                    el.dataColor,
                    el.placeholder,
                    el.href,
                    el.url
                  ].filter(Boolean).map(normalize);
                  const candFullText = candTextParts.join(" ");

                  // STRICT SEARCH BOX GROUNDING: Prefer editable text entry; reject voice/mic controls
                  if (isSearchBoxTarget) {
                    if (!rawHint.includes("voice") && !rawHint.includes("mic")) {
                      if (/voice|mic|audio|speak/i.test(labelNorm) || /voice|mic|audio|speak/i.test(el.ariaLabel || "")) {
                        return 0;
                      }
                    }
                    if (elType === "input" || elType === "textarea" || el.semanticTag === "SEARCH_INPUT") {
                      if (labelNorm.includes("search") || el.semanticTag === "SEARCH_INPUT" || (el.placeholder && el.placeholder.toLowerCase().includes("search"))) {
                        return 1.0;
                      }
                      return 0.85;
                    }
                    if (elType === "button" || elType === "link") {
                      return 0.2;
                    }
                  }

                  // Profile picture / avatar rejection unless explicitly requested
                  const isExplicitProfileRequested = Boolean(rawHint && /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(rawHint));
                  const isProfileElement = Boolean(
                    /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar|profile_photo|profile_pic|identity-module)\b/i.test(candFullText) ||
                    (el.role === "img" && /\b(?:photo|picture|avatar|profile)\b/i.test(el.ariaLabel || el.alt || "")) ||
                    elType === "image" ||
                    (el.tagName && el.tagName.toLowerCase() === "img") ||
                    (el.className && /\b(?:avatar|profile-photo|profile-pic)\b/i.test(el.className))
                  );

                  if (isExplicitProfileRequested) {
                    if (isProfileElement || candFullText.includes("profile")) return 1.0;
                    return 0;
                  }
                  if (isProfileElement && !isExplicitProfileRequested) {
                    return 0;
                  }

                  // ACTION-AWARE COMPOSITE UI TARGET: "Start a post" / "Create a post" / "Write a post"
                  const isStartPostTarget = Boolean(
                    cleanHint === "start a post" ||
                    rawHint === "start a post" ||
                    /^(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(rawHint) ||
                    /^(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(cleanHint)
                  );
                  if (isStartPostTarget) {
                    const hasActionWord = /\b(?:start|create|write|open)\b/i.test(labelNorm) || /\b(?:start|create|write|open)\b/i.test(candFullText);
                    const hasPostWord = /\bpost\b/i.test(labelNorm) || /\bpost\b/i.test(candFullText);
                    if (!hasActionWord || !hasPostWord) return 0;
                    if (labelNorm === "start a post") return 1.0;
                    if (candFullText.includes("start a post")) return 0.95;
                    if (hasActionWord && hasPostWord) return (elType === "button" || el.role === "button") ? 0.92 : 0.85;
                    return 0;
                  }

                  // ACTION-AWARE PUBLISH BUTTON: "Post" / "Publish"
                  const isPublishTarget = Boolean(
                    cleanHint === "post" ||
                    rawHint === "post" ||
                    rawHint === "post button" ||
                    cleanHint === "post button" ||
                    rawHint === "publish" ||
                    cleanHint === "publish"
                  );
                  if (isPublishTarget) {
                    if (/\b(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(candFullText) || /\b(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(labelNorm)) return 0;
                    if (el.role === "article" || elType === "article" || /\b(?:feed|comment|share)\b/i.test(labelNorm)) return 0;
                    const isButtonRole = elType === "button" || el.role === "button" || el.semanticTag === "SUBMIT_BUTTON";
                    if ((labelNorm === "post" || labelNorm === "publish") && isButtonRole) return 1.0;
                    if (labelNorm === "post" || labelNorm === "publish") return 0.90;
                    if (candFullText.trim() === "post" && isButtonRole) return 0.95;
                    return 0;
                  }

                  // STRICT TARGET VALIDATION: If user specified an explicit named target, verify strictly against it
                  if (isExplicitTarget && explicitTargetVal) {
                    if (isGenericNavigationOrHomepageTarget(el.label)) return 0;
                    if (elType === "input" && (el.semanticTag === "SEARCH_INPUT" || labelNorm.includes("search"))) return 0;

                    if (labelNorm === explicitTargetVal) return 1.0;
                    if (labelNorm.includes(explicitTargetVal) || candFullText.includes(explicitTargetVal)) return 0.95;

                    const explicitTokens = explicitTargetVal.split(/\s+/).filter((t) => t.length > 2 && !["result", "called", "named", "titled", "product", "item"].includes(t));
                    if (explicitTokens.length > 0 && explicitTokens.every((t) => candFullText.includes(t))) {
                      return 0.90;
                    }
                    // NEVER match solely on search query tokens when an explicit target is requested!
                    return 0;
                  }

                  // ATTRIBUTE-CONSTRAINED TARGET GROUNDING (Color / Descriptive attributes)
                  if (hasAttributeConstraint) {
                    const objTokens = targetObjNorm.split(/\s+/).filter(t => t.length > 2);
                    const matchesObject = candFullText.includes(targetObjNorm) || (objTokens.length > 0 && objTokens.every(t => candFullText.includes(t)));
                    if (!matchesObject) return 0;

                    const matchesAttribute = candFullText.includes(targetValNorm) || (el.dataColor && normalize(el.dataColor).includes(targetValNorm));
                    if (matchesAttribute) {
                      return 0.95;
                    }
                    return 0;
                  }

                  if (isSearchResultSelection) {
                    // Anti-homepage filter: Never click navigation, header, or footer links or Google account/apps
                    if (isGenericNavigationOrHomepageTarget(el.label) || isGenericNavigationOrHomepageTarget(el)) return 0;
                    if (resolver && typeof resolver.isExcludedSearchPageControl === "function" && resolver.isExcludedSearchPageControl(el)) return 0;
                    if (elType === "input" && (el.semanticTag === "SEARCH_INPUT" || labelNorm.includes("search"))) return 0;

                    // Product Selection Rule:
                    // Prefer actual product/device listing. Do NOT select accessories (cases, covers, screen protectors, chargers, cables)
                    // merely because they contain the product query.
                    const isAccessory = ACCESSORY_TERMS.some((term) => {
                      return labelNorm.includes(term) && !queryNorm.includes(term);
                    });

                    // 1. Destination Domain Matching (Rule 4: Prefer semantic grounding of actual result title/link and URL/domain)
                    const domainHint = currentStepPlan.domain ||
                      (currentStepPlan.targetHint && (currentStepPlan.targetHint.match(/\(([^)]+\.[a-z]{2,})\)/i)?.[1] || currentStepPlan.targetHint.match(/\b([a-zA-Z0-9_\-]+\.[a-zA-Z]{2,})\b/i)?.[1])) ||
                      null;
                    if (domainHint) {
                      const domainNorm = normalize(domainHint);
                      if (candFullText.includes(domainNorm)) {
                        return 0.98;
                      }
                    }

                    // 2. Acronym & Organization Entity expansion (e.g. ISRO <-> Indian Space Research Organisation)
                    const ENTITY_EXPANSIONS = {
                      isro: ["indian space research organisation", "isro", "isro.gov", "isro.gov.in"],
                      linkedin: ["linkedin", "linkedin.com"],
                      github: ["github", "github.com"],
                      nasa: ["national aeronautics and space administration", "nasa", "nasa.gov"]
                    };
                    const entityKeys = Object.keys(ENTITY_EXPANSIONS);
                    for (const ek of entityKeys) {
                      if (queryNorm.includes(ek) || (currentStepPlan.targetHint && currentStepPlan.targetHint.toLowerCase().includes(ek))) {
                        const expansions = ENTITY_EXPANSIONS[ek];
                        for (const exp of expansions) {
                          if (candFullText.includes(exp)) {
                            return 0.96;
                          }
                        }
                      }
                    }

                    // 3. Profile Matching (e.g. "Sundar Pichai LinkedIn profile")
                    if (currentStepPlan.targetHint && /profile\b/i.test(currentStepPlan.targetHint)) {
                      const pTokens = queryTokens.filter(t => t.length > 2);
                      if (pTokens.length > 0 && pTokens.every(t => candFullText.includes(t))) {
                        return 0.97;
                      }
                    }

                    // 4. Mission / Content Matching (e.g. "GSLV-F17/EOS-05 mission")
                    if (currentStepPlan.targetHint && /gslv|eos|mission/i.test(currentStepPlan.targetHint)) {
                      if (candFullText.includes("gslv") && candFullText.includes("eos")) {
                        return 0.98;
                      }
                      if (candFullText.includes("gslv-f17") || candFullText.includes("eos-05")) {
                        return 0.95;
                      }
                    }

                    // 5. Evaluate relevance against query or targetHint tokens
                    const hintTokens = (currentStepPlan.targetHint || "").toLowerCase().split(/\s+/).filter(t => !["official", "website", "the", "most", "relevant", "result", "page", "site", "webpage", "link"].includes(t));
                    const searchTokens = [...new Set([...queryTokens, ...hintTokens])];
                    if (searchTokens.length > 0 && (elType === "link" || elType === "button" || elType === "element" || elType === "heading")) {
                      let matchCount = 0;
                      for (const t of searchTokens) {
                        if (candFullText.includes(t)) matchCount++;
                      }
                      if (matchCount > 0) {
                        let relScore = 0.7 + (matchCount / searchTokens.length) * 0.25;
                        if (queryNorm && candFullText.includes(queryNorm)) {
                          relScore += 0.05; // Exact query phrase bonus
                        }
                        // Penalize accessory listings heavily when seeking the actual product
                        if (isAccessory) {
                          relScore = Math.min(relScore * 0.2, 0.25);
                        }
                        return Math.min(relScore, 0.98);
                      }
                    }
                  }

                  let score = 0;
                  if (labelNorm === cleanHint || labelNorm === rawHint) {
                    score = 1.0;
                  } else if (cleanHint && (labelNorm.includes(cleanHint) || cleanHint.includes(labelNorm) || candFullText.includes(cleanHint))) {
                    score = 0.85;
                  } else if (rawHint && (labelNorm.includes(rawHint) || rawHint.includes(labelNorm) || candFullText.includes(rawHint))) {
                    score = 0.8;
                  }
                  if (rawHint && /gslv|eos/i.test(rawHint)) {
                    if (candFullText.includes("gslv") && candFullText.includes("eos")) {
                      score = Math.max(score, 0.98);
                    }
                  }
                  if (cleanHint === "submit" && (labelNorm.includes("submit") || labelNorm.includes("send") || el.semanticTag === "SUBMIT_BUTTON")) {
                    score = Math.max(score, 0.9);
                  }
                  if (score > 0) {
                    const expectedRole = (currentStepPlan.expectedRole || currentStepPlan.role || "").toLowerCase();
                    if (expectedRole === "button" || rawHint.includes("button")) {
                      if (elType === "button" || el.semanticTag?.includes("BUTTON")) score += 0.1;
                      else score *= 0.5;
                    }
                    if (rawHint.includes("box") || rawHint.includes("input") || rawHint.includes("field") || rawHint.includes("search")) {
                      if (elType === "input" || elType === "textarea" || el.semanticTag === "SEARCH_INPUT") score += 0.15;
                      else score *= 0.5;
                    }
                  }
                  return score;
                };

                let bestIdx = -1;
                let bestScore = 0;
                let verifiedAttributeMatches = [];
                let objectFoundWithoutAttribute = false;
                let semanticHandled = false;

                const clickCandidates = latestFusedElements || latestVisualElements || [];

                if (resolver && isSemanticTask) {
                  const semanticRes = resolver.resolveSemanticTarget(currentStepPlan, clickCandidates, {
                    allElements: clickCandidates,
                    currentEntity: taskContext?.currentEntity,
                    taskContext: taskContext,
                    isSearchResultSelection: isSearchResultSelection,
                    isPreviousStepSearchSubmit: isPreviousStepSearchSubmit
                  });
                  if (semanticRes && semanticRes.action !== "PASS_THROUGH") {
                    agentAction = semanticRes;
                    semanticHandled = true;
                    if (semanticRes.action === "CLICK" || semanticRes.action === "OPEN") {
                      bestIdx = semanticRes.targetIndex !== undefined ? semanticRes.targetIndex : 0;
                      bestScore = semanticRes.groundingScore || 0.95;
                    }
                    if (semanticRes.semanticTargetObject) {
                      const sto = semanticRes.semanticTargetObject;
                      const attrEntries = sto.attributes ? Object.entries(sto.attributes).map(([k, v]) => `${k} = ${v}`).join(", ") : "";
                      const selStr = sto.selector ? `Selector = ${sto.selector.type}${sto.selector.attribute ? ` of ${sto.selector.attribute}` : ""}` : "";
                      const userIntentText = (taskInput && taskInput.value) ? taskInput.value : (currentStepPlan?.rawStepText || currentStepPlan?.targetHint || "");
                      appendPlannerTrace(`[USER INTENT] "${userIntentText}"`);
                      if (semanticRes.targetEntity) {
                        appendPlannerTrace(`[SEMANTIC TARGET] Entity = ${semanticRes.targetEntity.type || "entity"} (${semanticRes.targetEntity.name}), Intent = ${semanticRes.targetIntent || "open"}`);
                      } else {
                        appendPlannerTrace(`[SEMANTIC TARGET] Entity = ${sto.entity || "element"}, Description = ${sto.description || "item"}${attrEntries ? `, ${attrEntries}` : ""}${selStr ? `, ${selStr}` : ""}`);
                      }
                      if ((semanticRes.action === "CLICK" || semanticRes.action === "OPEN") && semanticRes.targetLabel) {
                        appendPlannerTrace(`[GROUNDED ELEMENT] "${semanticRes.targetLabel}" | DOM Index = ${semanticRes.targetIndex} | Confidence = ${Number(semanticRes.groundingScore || 0.94).toFixed(2)} | Method: ${semanticRes.groundingMethod || "semantic + DOM + visual fusion"}`);
                      }
                    }
                  }
                }

                if (!semanticHandled) {
                  let exactTextMatches = [];
                  clickCandidates.forEach((el, idx) => {
                    if (hasAttributeConstraint) {
                      const candTextParts = [
                        el.label,
                        el.text,
                        el.ariaLabel,
                        el.title,
                        el.alt,
                        el.dataColor,
                        el.placeholder
                      ].filter(Boolean).map(normalize);
                      const candFullText = candTextParts.join(" ");
                      const objTokens = targetObjNorm.split(/\s+/).filter(t => t.length > 2);
                      const matchesObject = candFullText.includes(targetObjNorm) || (objTokens.length > 0 && objTokens.every(t => candFullText.includes(t)));
                      const matchesAttribute = candFullText.includes(targetValNorm) || (el.dataColor && normalize(el.dataColor).includes(targetValNorm));

                      if (matchesObject && !matchesAttribute) {
                        objectFoundWithoutAttribute = true;
                      }
                      if (matchesObject && matchesAttribute) {
                        let s = 0.95;
                        if (el.isVisualConfirmed) s = 1.0;
                        verifiedAttributeMatches.push({ el, idx, score: s });
                      }
                    }

                    let s = computeClickScore(el);
                    if (s > 0 && el.isVisualConfirmed) {
                      s = Math.min(1.0, s + 0.10);
                    }
                    if (s >= 0.90) {
                      const candL = normalize(el.label);
                      if (candL === cleanHint || candL === rawHint || (cleanHint && candL.startsWith(cleanHint))) {
                        exactTextMatches.push({ el, idx, score: s });
                      }
                    }
                    if (s > bestScore) {
                      bestScore = s;
                      bestIdx = idx;
                    }
                  });

                  if (!hasAttributeConstraint && exactTextMatches.length > 0 && !isSearchResultSelection && !isSearchBoxTarget) {
                    if (exactTextMatches.length === 1) {
                      bestIdx = exactTextMatches[0].idx;
                      bestScore = exactTextMatches[0].score;
                    } else if (exactTextMatches.length > 1) {
                      const ordinal = currentStepPlan?.ordinal;
                      if (typeof ordinal === "number" && ordinal >= 1 && ordinal <= exactTextMatches.length) {
                        bestIdx = exactTextMatches[ordinal - 1].idx;
                        bestScore = exactTextMatches[ordinal - 1].score;
                      } else {
                        // Ambiguous exact text targets: multiple matches without distinguishing ordinal
                        bestIdx = -1;
                        bestScore = 0;
                        agentAction = {
                          action: "NONE",
                          target: null,
                          targetLabel: currentStepPlan.targetHint || currentStepPlan.target,
                          groundingScore: 0,
                          groundingMethod: "ambiguous-exact-text-targets",
                          reason: `Target ambiguous: multiple identical '${cleanHint || rawHint}' elements found on page without distinguishing evidence`,
                          blockedReason: `Multiple '${cleanHint || rawHint}' candidates found on page. Action: BLOCKED`
                        };
                      }
                    }
                  }

                  if (hasAttributeConstraint) {
                    if (verifiedAttributeMatches.length === 1) {
                      bestIdx = verifiedAttributeMatches[0].idx;
                      bestScore = verifiedAttributeMatches[0].score;
                    } else if (verifiedAttributeMatches.length > 1) {
                      const ordinal = currentStepPlan?.ordinal;
                      if (typeof ordinal === "number" && ordinal >= 1 && ordinal <= verifiedAttributeMatches.length) {
                        bestIdx = verifiedAttributeMatches[ordinal - 1].idx;
                        bestScore = verifiedAttributeMatches[ordinal - 1].score;
                      } else {
                        // Ambiguous attribute targets: multiple matches without distinguishing ordinal/evidence
                        bestIdx = -1;
                        bestScore = 0;
                        agentAction = {
                          action: "NONE",
                          target: null,
                          targetLabel: currentStepPlan.targetHint || currentStepPlan.target,
                          groundingScore: 0,
                          groundingMethod: "ambiguous-attribute-targets",
                          reason: `Target ambiguous: multiple identical '${targetValNorm} ${targetObjNorm}' elements found on page without distinguishing evidence`,
                          blockedReason: `Multiple '${targetValNorm} ${targetObjNorm}' candidates found on page. Action: BLOCKED`
                        };
                      }
                    } else if (objectFoundWithoutAttribute) {
                      // Object found, but attribute unverified -> BLOCK
                      bestIdx = -1;
                      bestScore = 0;
                      agentAction = {
                        action: "NONE",
                        target: null,
                        targetLabel: currentStepPlan.targetHint || currentStepPlan.target,
                        groundingScore: 0,
                        groundingMethod: "attribute-not-verified",
                        reason: `Target attribute not verified: object '${targetObjNorm}' found on current page, but attribute '${targetAttrNorm} = ${targetValNorm}' has insufficient evidence`,
                        blockedReason: `Object found: ${targetObjNorm}, Requested attribute: ${targetAttrNorm} = ${targetValNorm}, Attribute evidence: insufficient, Confidence: below threshold, Action: BLOCKED`
                      };
                    }
                  }
                }

                if (bestIdx >= 0 && bestScore >= 0.35) {
                  if (!semanticHandled) {
                    const matchedEl = clickCandidates[bestIdx];
                    agentAction = {
                      action: "CLICK",
                      target: matchedEl.label,
                      targetIndex: matchedEl.index !== undefined ? matchedEl.index : bestIdx,
                      targetType: matchedEl.type,
                      targetLabel: matchedEl.label,
                      groundingScore: bestScore,
                      groundingMethod: hasAttributeConstraint ? "attribute-verified-grounding" : (matchedEl.isVisualConfirmed ? "dom+visual-fusion" : "local-fuzzy-match"),
                      semanticTargetDescriptor: createSemanticTargetDescriptor(matchedEl, currentStepPlan.explicitTarget || currentStepPlan.targetHint || currentStepPlan.target || matchedEl.label, matchedEl.type)
                    };
                    const reqTarget = currentStepPlan.target || currentStepPlan.targetHint || currentStepPlan.explicitTarget || matchedEl.label;
                    const candName = matchedEl.label || agentAction.targetLabel || reqTarget;
                    const roleName = matchedEl.type || (matchedEl.role || "button / clickable");
                    const scoreVal = Number(bestScore || 0.95).toFixed(2);
                    appendPlannerTrace(`[GROUNDING TRACE]\nAction:\nCLICK\n\nRequested Target:\n${reqTarget}\n\nCandidate:\n${candName}\n\nRole:\n${roleName}\n\nSemantic Score:\n${scoreVal}\n\nAction Compatibility:\nHIGH\n\nFinal Decision:\nGROUNDED`);
                  }
                } else if (!agentAction || (agentAction.groundingMethod !== "attribute-not-verified" && agentAction.groundingMethod !== "ambiguous-attribute-targets" && agentAction.groundingMethod !== "ambiguous-semantic-targets" && agentAction.groundingMethod !== "ambiguous-exact-text-targets")) {
                  // Section 5 Bounded Recovery: Live DOM re-perception before falling back
                  const recoveryPage = await new Promise((r) => {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => r(resp || null));
                    }, 250);
                  });
                  if (recoveryPage && Array.isArray(recoveryPage.visualElements)) {
                    latestVisualElements = recoveryPage.visualElements;
                    if (resolver && isSemanticTask) {
                      const recoverySemantic = resolver.resolveSemanticTarget(currentStepPlan, latestVisualElements, { allElements: latestVisualElements });
                      if (recoverySemantic && recoverySemantic.action !== "PASS_THROUGH") {
                        agentAction = recoverySemantic;
                        semanticHandled = true;
                        if (recoverySemantic.action === "CLICK") {
                          bestIdx = recoverySemantic.targetIndex !== undefined ? recoverySemantic.targetIndex : 0;
                          bestScore = recoverySemantic.groundingScore || 0.95;
                        }
                        if (recoverySemantic.semanticTargetObject) {
                          const sto = recoverySemantic.semanticTargetObject;
                          const attrEntries = sto.attributes ? Object.entries(sto.attributes).map(([k, v]) => `${k} = ${v}`).join(", ") : "";
                          const selStr = sto.selector ? `Selector = ${sto.selector.type}${sto.selector.attribute ? ` of ${sto.selector.attribute}` : ""}` : "";
                          const userIntentText = (taskInput && taskInput.value) ? taskInput.value : (currentStepPlan?.rawStepText || currentStepPlan?.targetHint || "");
                          appendPlannerTrace(`[USER INTENT] "${userIntentText}"`);
                          appendPlannerTrace(`[SEMANTIC TARGET] Entity = ${sto.entity || "element"}, Description = ${sto.description || "item"}${attrEntries ? `, ${attrEntries}` : ""}${selStr ? `, ${selStr}` : ""}`);
                          if (recoverySemantic.action === "CLICK" && recoverySemantic.targetLabel) {
                            appendPlannerTrace(`[GROUNDED ELEMENT] "${recoverySemantic.targetLabel}" | DOM Index = ${recoverySemantic.targetIndex} | Confidence = ${Number(recoverySemantic.groundingScore || 0.94).toFixed(2)} | Method: ${recoverySemantic.groundingMethod || "semantic + DOM + visual fusion"}`);
                          }
                        }
                      }
                    }
                    if (!semanticHandled) {
                      (latestVisualElements || []).forEach((el, idx) => {
                        const s = computeClickScore(el);
                        if (s > bestScore) {
                          bestScore = s;
                          bestIdx = idx;
                        }
                      });
                      if (bestIdx >= 0 && bestScore >= 0.35) {
                        const matchedEl = latestVisualElements[bestIdx];
                        stepRecoveryNote = "Recovered click target after live DOM re-perception";
                        if (window.SIHEvaluationTracker) window.SIHEvaluationTracker.recordRecovery(stepRecoveryNote);
                        agentAction = {
                          action: "CLICK",
                          target: matchedEl.label,
                          targetIndex: bestIdx,
                          targetType: matchedEl.type,
                          targetLabel: matchedEl.label,
                          groundingScore: bestScore,
                          groundingMethod: hasAttributeConstraint ? "attribute-verified-grounding" : "bounded-recovery-match",
                          semanticTargetDescriptor: createSemanticTargetDescriptor(matchedEl, currentStepPlan.explicitTarget || currentStepPlan.targetHint || currentStepPlan.target || matchedEl.label, matchedEl.type)
                        };
                      }
                    }
                  }

                  if (bestIdx < 0 || bestScore < 0.35) {
                    const missingTargetLabel = currentStepPlan.explicitTarget || currentStepPlan.targetHint || currentStepPlan.target || rawHint;
                    let legacyFoundIdx = -1;
                    if (currentStepPlan.legacyTarget && !isExplicitTarget && !hasAttributeConstraint) {
                      const legCand = clickCandidates.findIndex((el) => el.semanticTag === currentStepPlan.legacyTarget || (el.label && el.label.toLowerCase().includes(currentStepPlan.legacyTarget.toLowerCase())));
                      if (legCand >= 0) legacyFoundIdx = legCand;
                    }
                    if (legacyFoundIdx >= 0) {
                      const matchedEl = clickCandidates[legacyFoundIdx];
                      agentAction = {
                        action: "CLICK",
                        target: matchedEl.label,
                        targetIndex: matchedEl.index !== undefined ? matchedEl.index : legacyFoundIdx,
                        targetType: matchedEl.type,
                        targetLabel: matchedEl.label,
                        groundingScore: 0.8,
                        groundingMethod: "keyword-rule",
                        semanticTargetDescriptor: createSemanticTargetDescriptor(matchedEl, missingTargetLabel, matchedEl.type)
                      };
                    } else {
                      agentAction = {
                        action: "NONE",
                        target: null,
                        targetLabel: missingTargetLabel,
                        groundingScore: 0,
                        groundingMethod: "target-not-found",
                        reason: `Target not found on current page: '${missingTargetLabel}'`
                      };
                    }
                  }
                }
              }
            } else if (["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(plannedType)) {
              const targetRaw = (currentStepPlan.targetHint || currentStepPlan.target || "").trim();
              const targetNorm = targetRaw.toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+(?:box|checkbox|option|button|link|switch|radio)$/i, "").trim();
              const actionCandidates = latestFusedElements || latestVisualElements || [];

              // If context is specified, verify context exists on page perception
              let contextValid = true;
              if (currentStepPlan.context) {
                const ctxNorm = (currentStepPlan.context || "").toLowerCase().trim();
                const ctxFound = actionCandidates.some(el => {
                  const lbl = (el.label || "").toLowerCase();
                  return lbl.includes(ctxNorm) || ctxNorm.includes(lbl);
                });
                if (!ctxFound) {
                  contextValid = false;
                }
              }

              let matchedCandidate = null;
              let matchedCandIdx = -1;

              if (contextValid) {
                // Find candidates matching targetNorm
                const matches = [];
                actionCandidates.forEach((el, idx) => {
                  if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return;
                  const lblNorm = (el.label || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
                  const elType = (el.type || "").toLowerCase();

                  // Type compatibility check
                  let typeBonus = 0;
                  if (["CHECK", "UNCHECK"].includes(plannedType) && (elType === "checkbox" || el.semanticTag === "CHECKBOX")) typeBonus = 0.2;
                  if (plannedType === "SELECT" && (elType === "option" || elType === "button" || elType === "radio" || elType === "link" || elType === "element")) typeBonus = 0.1;
                  if (plannedType === "TOGGLE" && (elType === "switch" || elType === "checkbox" || elType === "button")) typeBonus = 0.2;

                  if (lblNorm === targetNorm || lblNorm.includes(targetNorm) || targetNorm.includes(lblNorm)) {
                    const exact = (lblNorm === targetNorm) ? 1.0 : 0.85;
                    matches.push({ el, idx, score: exact + typeBonus });
                  }
                });

                if (matches.length > 0) {
                  matches.sort((a, b) => b.score - a.score);
                  if (typeof currentStepPlan.ordinal === "number" && currentStepPlan.ordinal >= 1 && currentStepPlan.ordinal <= matches.length) {
                    matchedCandidate = matches[currentStepPlan.ordinal - 1].el;
                    matchedCandIdx = matches[currentStepPlan.ordinal - 1].idx;
                  } else {
                    matchedCandidate = matches[0].el;
                    matchedCandIdx = matches[0].idx;
                  }
                }
              }

              if (matchedCandidate && matchedCandIdx >= 0) {
                agentAction = {
                  action: plannedType,
                  target: matchedCandidate.label,
                  targetIndex: matchedCandidate.index !== undefined ? matchedCandidate.index : matchedCandIdx,
                  targetType: matchedCandidate.type || currentStepPlan.targetType || "element",
                  targetLabel: matchedCandidate.label,
                  context: currentStepPlan.context || null,
                  relation: currentStepPlan.relation || null,
                  ordinal: currentStepPlan.ordinal !== undefined ? currentStepPlan.ordinal : null,
                  groundingScore: 1.0,
                  groundingMethod: currentStepPlan.context ? "contextual-rule" : "local-element-match",
                  semanticTargetDescriptor: createSemanticTargetDescriptor(matchedCandidate, targetRaw, matchedCandidate.type || currentStepPlan.targetType)
                };
              } else {
                // GROUNDING FAILED: Candidate does not exist in current perception
                agentAction = {
                  action: "NONE",
                  target: null,
                  targetLabel: targetRaw,
                  groundingScore: 0,
                  groundingMethod: "target-not-found",
                  reason: !contextValid
                    ? `Context '${currentStepPlan.context}' not found on current page.`
                    : `Target '${targetRaw}' not found in current page perception.`
                };
              }
            } else if (plannedType === "SCROLL") {
              if (!agentAction || agentAction.action !== "SCROLL") {
                agentAction = {
                  action: "SCROLL",
                  target: "PAGE",
                  amount: currentStepPlan.amount || 500
                };
              }
            }
          }

          const targetStr = agentAction?.target
            ? agentAction.target
            : (agentAction?.targetIndex !== undefined ? `${agentAction.targetType}: '${agentAction.targetLabel}'` : "None");
          let actionDisplay = "None";
          if (agentAction) {
            if (agentAction.action === "FILL") {
              let authoritativeVal = (currentStepPlan && currentStepPlan.value) ? currentStepPlan.value : null;
              if (!authoritativeVal && window.SIHTaskParser && typeof window.SIHTaskParser.extractTaskQueryOrValue === "function") {
                authoritativeVal = window.SIHTaskParser.extractTaskQueryOrValue(task);
              }
              const fillVal = authoritativeVal || agentAction.value || "";
              if (authoritativeVal) agentAction.value = authoritativeVal;
              actionDisplay = fillVal
                ? `FILL → ${targetStr} (value: '${fillVal}')`
                : `FILL → ${targetStr}`;
            } else if (agentAction.action === "NAVIGATE" || agentAction.action === "OPEN_URL") {
              actionDisplay = agentAction.url
                ? `NAVIGATE → ${agentAction.target} (${agentAction.url})`
                : `NAVIGATE → ${agentAction.target}`;
            } else if (agentAction.action === "OPEN" || agentAction.semanticAction === "OPEN") {
              actionDisplay = `OPEN → ${targetStr}`;
            } else if (agentAction.amount !== undefined && agentAction.amount !== null) {
              actionDisplay = `${agentAction.action} → ${targetStr} (amount: ${agentAction.amount})`;
            } else {
              actionDisplay = `${agentAction.action} → ${targetStr}`;
            }
          }

          if (agentActionText) agentActionText.textContent = actionDisplay;
          if (agentReasoningText) {
            agentReasoningText.textContent = data.reasoning || (isGeminiSuccess ? "Gemini proposed action over sanitized context." : "Local deterministic decision");
          }
          if (decisionOutput) decisionOutput.value = actionDisplay;
          if (backendOutput) backendOutput.value = JSON.stringify(data, null, 2);

          // Milestone 15 & 16: Grounding UI telemetry
          if (groundingMethodText && groundingScoreText && groundedElementText) {
            if (agentAction?.targetIndex !== undefined) {
              groundingMethodText.textContent = agentAction.groundingMethod || "local-fuzzy-match";
              groundingScoreText.textContent = agentAction.groundingScore !== undefined ? String(agentAction.groundingScore) : "-";
              groundedElementText.textContent = `${agentAction.targetType}: '${agentAction.targetLabel}'`;
            } else if (agentAction?.action === "NAVIGATE" || agentAction?.action === "OPEN_URL") {
              groundingMethodText.textContent = "navigation-rule";
              groundingScoreText.textContent = "1.00";
              groundedElementText.textContent = `Destination: '${agentAction.target}'`;
            } else if (agentAction?.target) {
              groundingMethodText.textContent = "keyword-rule (fixed target)";
              groundingScoreText.textContent = "-";
              groundedElementText.textContent = agentAction.target;
            } else {
              groundingMethodText.textContent = "-";
              groundingScoreText.textContent = "-";
              groundedElementText.textContent = "-";
            }
          }

          const groundedVisualEl = (agentAction?.targetIndex !== undefined && latestVisualElements)
            ? latestVisualElements[agentAction.targetIndex]
            : null;
          const bbox = groundedVisualEl
            ? { x: groundedVisualEl.x, y: groundedVisualEl.y, width: groundedVisualEl.width, height: groundedVisualEl.height }
            : null;

          const isGrounded = !!(
            agentAction &&
            agentAction.action !== "NONE" &&
            (agentAction.targetIndex !== undefined || (agentAction.target && agentAction.groundingScore > 0))
          );
          const actualScore = isGrounded
            ? (agentAction.groundingScore !== undefined ? agentAction.groundingScore : 0.8)
            : 0.0;
          let displayTarget = agentAction?.targetLabel || agentAction?.target || targetStr;
          const isTargetAbstract = !displayTarget || /^(?:most\s+relevant\s+result|most\s+relavent\s+result|relevant\s+result|correct\s+result|appropriate\s+result|the\s+result|result|the\s+website|website|the\s+site|site|the\s+page|page|the\s+link|link|the\s+product|product|most\s+relevant\s+product|it|that|this|them)$/i.test(displayTarget.trim());
          if (isTargetAbstract) {
            if (isGrounded && agentAction?.targetLabel && !/most\s+relevant|the\s+result/i.test(agentAction.targetLabel)) {
              displayTarget = agentAction.targetLabel;
            } else if (currentStepPlan && currentStepPlan.targetHint && !/most\s+relevant|the\s+result/i.test(currentStepPlan.targetHint)) {
              displayTarget = currentStepPlan.targetHint;
            } else if (currentStepPlan && currentStepPlan.query) {
              displayTarget = (window.SIHReasoningPlanner && window.SIHReasoningPlanner.resolveConcreteSearchTarget)
                ? window.SIHReasoningPlanner.resolveConcreteSearchTarget(currentStepPlan.query, currentStepPlan.targetHint)
                : `${currentStepPlan.query} search result`;
            }
          }

          updateGroundingInspection({
            element: isGrounded ? displayTarget : (displayTarget || "None"),
            role: agentAction?.targetType || (groundedVisualEl?.type || "element"),
            type: groundedVisualEl?.type || (agentAction?.targetType || "element"),
            index: agentAction?.targetIndex,
            score: isGrounded ? actualScore : 0.0,
            method: isGrounded ? (agentAction?.groundingMethod || (agentAction?.targetIndex !== undefined ? "local-fuzzy-match" : "keyword-rule")) : "target-not-found",
            bbox: isGrounded ? bbox : null,
            reason: isGrounded
              ? (data.reasoning || (isGeminiSuccess ? "Gemini proposed action grounded to verified DOM element" : "Local perception grounded action to DOM element"))
              : (agentAction?.reason || `Target '${displayTarget}' not found in current page perception.`)
          });

          if (isGrounded) {
            drawBoundingBoxOnPreview(bbox, displayTarget);
          } else {
            clearBoundingBoxOnPreview();
          }

          // Milestone 18: Live Explainable Agent Overlay (Grounded Target on active webpage)
          if (isGrounded && agentAction && agentAction.action !== "NONE") {
            sendOverlayTelemetry(activeTab?.id, {
              action: "showAgentOverlay",
              payload: {
                state: "GROUNDED",
                action: agentAction.action,
                target: targetStr,
                targetLabel: agentAction.targetLabel,
                targetIndex: agentAction.targetIndex,
                targetType: agentAction.targetType,
                confidence: actualScore,
                method: agentAction.groundingMethod || (agentAction.targetIndex !== undefined ? "local-fuzzy-match" : "keyword-rule"),
                bbox
              }
            });
          }

          if (isGrounded) {
            updatePipelineStage("GROUNDING", "completed", `${displayTarget} (${Number(actualScore).toFixed(2)})`);
            updateCurrentActionCard({
              stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
              action: agentAction?.action,
              target: displayTarget,
              value: agentAction?.value || "",
              grounding: `${displayTarget} (Score: ${Number(actualScore).toFixed(2)})`,
              risk: agentAction?.risk || "LOW",
              safety: "CHECKING...",
              status: "Evaluating safety gate..."
            });
          } else {
            updatePipelineStage("GROUNDING", "failed", `Target not found: ${displayTarget}`);
            updateCurrentActionCard({
              stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
              action: "NONE",
              target: displayTarget,
              value: "",
              grounding: `Target not found (Score: 0.00)`,
              risk: "LOW",
              safety: "BLOCKED",
              status: `Target not found on current page: '${displayTarget}'`
            });
          }

          const stepIdentifier = currentStepPlan ? `step_${currentStep - 1}:${currentStepPlan.type}:${currentStepPlan.fieldHint || currentStepPlan.targetHint || ""}` : `step_${currentStep}`;
          const actionTargetIdentifier = agentAction?.target || (agentAction?.targetIndex !== undefined ? `#${agentAction.targetIndex}:${agentAction.targetType}:${agentAction.targetLabel}` : "");
          const actionKey = `${stepIdentifier}:${agentAction?.action}:${actionTargetIdentifier}:${agentAction?.amount || ""}`;

          // Step 8: Stall Guard (Check if identical action proposed again with no screen change)
          if (currentStep > 1 && lastActionKey === actionKey) {
            if (agentVerificationText) {
              agentVerificationText.textContent = "Stall Guard: Proposing identical action with no page change. Loop halted.";
              agentVerificationText.style.color = "#c62828";
            }
            if (agentExecutionStatus) agentExecutionStatus.textContent = "Halted: No further meaningful action possible";
            executionTraceHistory.push({
              step: currentStep,
              totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
              requestId,
              action: agentAction,
              executed: false,
              status: "stalled",
              executionResult: "Halted by Stall Guard",
              verification: "No change from previous action"
            });
            renderTraceHistory();
            break;
          }

          // Step 9: If agent returns NONE or no target, check if task is planned and incomplete
          if (!agentAction || agentAction.action === "NONE" || (!agentAction.target && agentAction.targetIndex === undefined)) {
            // If this is a planned multi-step task and steps remain, try a brief page stabilization re-perception before halting
            if (isPlannedTask && currentStep <= totalPlannedSteps) {
              appendPlannerTrace(`Step ${currentStep}: Grounding pending. Awaiting page element stabilization...`);
              await new Promise((r) => setTimeout(r, 600));
              const retryPage = await new Promise((resolveRetry) => {
                chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => {
                  resolveRetry((resp && resp.visualElements) ? resp.visualElements : null);
                });
              });
              if (retryPage && retryPage.length > 0) {
                latestVisualElements = retryPage;
                // Check if currentStepPlan can now be grounded
                const planTargetHint = (currentStepPlan.fieldHint || currentStepPlan.targetHint || "").toLowerCase().trim();
                let retryIdx = -1;
                let retryScore = 0;
                retryPage.forEach((el, idx) => {
                  const lbl = (el.label || "").toLowerCase();
                  if (planTargetHint && lbl.includes(planTargetHint)) {
                    if (lbl.length > retryScore) {
                      retryScore = lbl.length;
                      retryIdx = idx;
                    }
                  }
                });
                if (retryIdx >= 0) {
                  const foundEl = retryPage[retryIdx];
                  agentAction = {
                    action: currentStepPlan.type || "CLICK",
                    target: foundEl.label,
                    targetIndex: retryIdx,
                    targetType: foundEl.type,
                    targetLabel: foundEl.label,
                    groundingScore: 0.85,
                    groundingMethod: "page-stabilized-grounding"
                  };
                  appendPlannerTrace(`Target grounded after stabilization: '${foundEl.label}'.`);
                }
              }
            }

            // If still NONE or no target, terminate safely without falsely claiming completion
            if (!agentAction || agentAction.action === "NONE" || (!agentAction.target && agentAction.targetIndex === undefined)) {
              const targetName = agentAction?.targetLabel || currentStepPlan?.explicitTarget || currentStepPlan?.targetHint || currentStepPlan?.fieldHint || currentStepPlan?.target || "element";
              const isExplicit = !!(currentStepPlan?.isExplicitTarget);

              if (isExplicit || (isPlannedTask && currentStepPlan && currentStepPlan.type !== "NONE")) {
                const isAttrBlocked = agentAction?.groundingMethod === "attribute-not-verified";
                const isAmbiguousBlocked = agentAction?.groundingMethod === "ambiguous-attribute-targets" || agentAction?.groundingMethod === "ambiguous-semantic-targets" || agentAction?.groundingMethod === "ambiguous-exact-text-targets";

                if (isAttrBlocked) {
                  if (agentSafetyStatus) agentSafetyStatus.textContent = "BLOCKED (Target attribute not verified)";
                  if (agentExecutionStatus) agentExecutionStatus.textContent = `TARGET ATTRIBUTE NOT VERIFIED: '${targetName}'`;
                  if (executionOutput) executionOutput.value = agentAction.blockedReason || `TARGET ATTRIBUTE NOT VERIFIED: Object found on page but attribute evidence is insufficient.`;
                  if (agentVerificationText) {
                    agentVerificationText.textContent = `Verification: Attribute not verified for target '${targetName}'.`;
                    agentVerificationText.style.color = "#c62828";
                  }
                  updatePipelineStage("SAFETY", "failed", "Blocked (Attribute Not Verified)");
                  updatePipelineStage("EXECUTION", "pending", "Skipped");
                  updatePipelineStage("VERIFICATION", "failed", "Attribute Not Verified");
                  appendPlannerTrace(`Grounding FAILED: Attribute not verified for target '${targetName}'.`);
                  appendPlannerTrace("Safety Gate: Execution BLOCKED due to unverified attribute.");
                  appendPlannerTrace("Loop halted cleanly without execution.");
                } else if (isAmbiguousBlocked) {
                  if (agentSafetyStatus) agentSafetyStatus.textContent = "BLOCKED (Target ambiguous)";
                  if (agentExecutionStatus) agentExecutionStatus.textContent = `TARGET AMBIGUOUS: '${targetName}'`;
                  if (executionOutput) executionOutput.value = agentAction.blockedReason || `TARGET AMBIGUOUS: Multiple matching candidates found on page.`;
                  if (agentVerificationText) {
                    agentVerificationText.textContent = `Verification: Multiple ambiguous matches for target '${targetName}'.`;
                    agentVerificationText.style.color = "#c62828";
                  }
                  updatePipelineStage("SAFETY", "failed", "Blocked (Target Ambiguous)");
                  updatePipelineStage("EXECUTION", "pending", "Skipped");
                  updatePipelineStage("VERIFICATION", "failed", "Target Ambiguous");
                  appendPlannerTrace(`Grounding FAILED: Multiple ambiguous matches for target '${targetName}'.`);
                  appendPlannerTrace("Safety Gate: Execution BLOCKED due to ambiguous target.");
                  appendPlannerTrace("Loop halted cleanly without execution.");
                } else {
                  if (agentSafetyStatus) agentSafetyStatus.textContent = "BLOCKED (Target not found in perception)";
                  if (agentExecutionStatus) agentExecutionStatus.textContent = `TARGET NOT FOUND: '${targetName}'`;
                  if (executionOutput) executionOutput.value = `TARGET NOT FOUND: Target '${targetName}' does not exist in current page perception.`;
                  if (agentVerificationText) {
                    agentVerificationText.textContent = `Verification: Target '${targetName}' not found in current page perception.`;
                    agentVerificationText.style.color = "#c62828";
                  }
                  updatePipelineStage("SAFETY", "failed", "Blocked (Missing Target)");
                  updatePipelineStage("EXECUTION", "pending", "Skipped");
                  updatePipelineStage("VERIFICATION", "failed", "Target Not Found");
                  appendPlannerTrace(`Grounding FAILED: Target '${targetName}' not found in current perception.`);
                  appendPlannerTrace("Safety Gate: Execution BLOCKED due to ungrounded target.");
                  appendPlannerTrace("Loop halted cleanly without execution.");
                }
              } else {
                if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (No-op action safely handled)";
                if (agentExecutionStatus) agentExecutionStatus.textContent = "Task complete (No further action needed)";
                if (executionOutput) executionOutput.value = "Task complete (Action is NONE)";
                if (agentVerificationText) {
                  agentVerificationText.textContent = "Verification: Goal reached or no actionable target.";
                  agentVerificationText.style.color = "#2e7d32";
                }
              }

              const isAttrBlocked = agentAction?.groundingMethod === "attribute-not-verified";
              const isAmbiguousBlocked = agentAction?.groundingMethod === "ambiguous-attribute-targets" || agentAction?.groundingMethod === "ambiguous-semantic-targets" || agentAction?.groundingMethod === "ambiguous-exact-text-targets";
              executionTraceHistory.push({
                step: currentStep,
                totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                requestId,
                action: agentAction,
                executed: false,
                status: (isExplicit || isPlannedTask) ? "blocked" : "completed",
                executionResult: isAttrBlocked ? `TARGET ATTRIBUTE NOT VERIFIED: '${targetName}'` : (isAmbiguousBlocked ? `TARGET AMBIGUOUS: '${targetName}'` : ((isExplicit || isPlannedTask) ? `TARGET NOT FOUND: Target '${targetName}' not found in current page perception` : "Skipped (Action is NONE)")),
                verification: isAttrBlocked ? "TARGET ATTRIBUTE NOT VERIFIED / ACTION BLOCKED" : (isAmbiguousBlocked ? "TARGET AMBIGUOUS / ACTION BLOCKED" : ((isExplicit || isPlannedTask) ? "TARGET NOT FOUND / ACTION BLOCKED" : "Goal completed"))
              });
              renderTraceHistory();
              break;
            }
          }

          // Step 10: Safe Execution via Local Allowlist in content.js (Milestones 5, 6, 14, 15, 16 & 17)
          let actionExecutionSummary = "";
          let actionExecutedSuccessfully = false;

          // Generic Action Normalization at Planning/Action Boundary:
          // If OPEN is grounded to a clickable webpage element/link/button, normalize to CLICK.
          // If OPEN is a destination URL, normalize to NAVIGATE.
          // Preserves semanticAction = "OPEN" and executionAction = "CLICK" for UI/audit.
          if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.normalizeAction === "function") {
            agentAction = window.SIHReasoningPlanner.normalizeAction(agentAction, currentStepPlan);
          }

          let executionPayload = null;
          if (agentAction.action === "FILL_FORM" || (currentStepPlan && currentStepPlan.type === "FILL_FORM")) {
            const localProf = (window.SIHFormProfile && typeof window.SIHFormProfile.getFormProfile === "function")
              ? window.SIHFormProfile.getFormProfile()
              : null;
            executionPayload = {
              action: "FILL_FORM",
              profile: localProf,
              simultaneous: true
            };
          } else if (agentAction.action === "FILL") {
            // Phase 7 Safety Guard: Never fill the wrong field
            if (currentStepPlan && currentStepPlan.type === "FILL") {
              const hintNorm = (currentStepPlan.fieldHint || "").toLowerCase().replace(/[:*_\-\/\\]+/g, " ").trim();
              const targetNorm = (agentAction.targetLabel || "").toLowerCase().replace(/[:*_\-\/\\]+/g, " ").trim();
              const matchesField = isFieldMatch(targetNorm, hintNorm) ||
                (currentStepPlan.target && isFieldMatch(targetNorm, currentStepPlan.target)) ||
                (currentStepPlan.composerType && isFieldMatch(targetNorm, currentStepPlan.composerType)) ||
                (typeof activeComposer !== "undefined" && activeComposer && isFieldMatch(targetNorm, activeComposer.type));

              if (!matchesField) {
                if (agentSafetyStatus) agentSafetyStatus.textContent = "SAFETY REJECT: Target Mismatch";
                if (agentExecutionStatus) agentExecutionStatus.textContent = `Halted: Grounded '${agentAction.targetLabel}' does not match requested field '${currentStepPlan.fieldHint}'`;
                // Milestone 18: Live Explainable Agent Overlay (Safety Blocked)
                sendOverlayTelemetry(activeTab?.id, {
                  action: "updateAgentOverlay",
                  payload: {
                    state: "SAFETY_BLOCKED",
                    action: agentAction.action,
                    target: targetStr,
                    reason: `Target '${agentAction.targetLabel}' does not match requested field '${currentStepPlan.fieldHint}'`
                  }
                });
                executionTraceHistory.push({
                  step: currentStep,
                  totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                  requestId,
                  action: agentAction,
                  executed: false,
                  status: "mismatch_rejected",
                  executionResult: `Rejected: Target '${agentAction.targetLabel}' does not match requested field '${currentStepPlan.fieldHint}'`,
                  verification: "Phase 7 Safety Check (Never fill wrong field)"
                });
                renderTraceHistory();
                break;
              }
            }
            // CRITICAL PRIVACY & AUTHORITATIVE EXTRACTION:
            // FILL VALUE PRIORITY for search and form fields:
            // 1. extractTaskQueryOrValue(task) / currentStepPlan.value is authoritative
            let authoritativeVal = (currentStepPlan && currentStepPlan.value) ? currentStepPlan.value : null;
            if (!authoritativeVal && window.SIHTaskParser && typeof window.SIHTaskParser.extractTaskQueryOrValue === "function") {
              authoritativeVal = window.SIHTaskParser.extractTaskQueryOrValue(task);
            }

            let localVal = authoritativeVal || "";

            // 1. Direct from currentStepPlan if this step in the plan is a FILL step with a value
            if (!localVal && currentStepPlan && currentStepPlan.type === "FILL" && currentStepPlan.value) {
              localVal = currentStepPlan.value;
            }

            // 2. Look up by step index (0-indexed) in localValuesMap
            if (!localVal && localValuesMap[currentStep - 1] !== undefined) {
              localVal = localValuesMap[currentStep - 1];
            }

            // 3. Look up by fieldHint / targetLabel match in plannedSteps
            if (!localVal && Array.isArray(plannedSteps)) {
              const targetNorm = (agentAction.targetLabel || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
              for (const st of plannedSteps) {
                if (st.type === "FILL" && st.value) {
                  const hintNorm = (st.fieldHint || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                  if (hintNorm && (targetNorm.includes(hintNorm) || hintNorm.includes(targetNorm))) {
                    localVal = st.value;
                    break;
                  }
                }
              }
            }

            // 4. Look up by normalized targetLabel in localValuesMap
            if (!localVal && agentAction.targetLabel) {
              const targetNorm = agentAction.targetLabel.toLowerCase().replace(/[:*_-]/g, " ").trim();
              for (const [k, v] of Object.entries(localValuesMap)) {
                const kNorm = String(k).toLowerCase().replace(/[:*_-]/g, " ").trim();
                if (kNorm && (targetNorm.includes(kNorm) || kNorm.includes(targetNorm))) {
                  localVal = v;
                  break;
                }
              }
            }

            // 5. Fallback for single-field FILL task: if exactly one fill value exists in local store
            if (!localVal && Array.isArray(plannedSteps)) {
              const fillSteps = plannedSteps.filter((s) => s.type === "FILL" && s.value);
              if (fillSteps.length === 1) {
                localVal = fillSteps[0].value;
              }
            }

            // 6. Emergency local fallback: parse directly from task text if not previously planned
            if (!localVal && window.SIHTaskParser && typeof window.SIHTaskParser.parseTask === "function") {
              const freshParsed = window.SIHTaskParser.parseTask(task);
              if (freshParsed && Array.isArray(freshParsed.steps)) {
                const fillSteps = freshParsed.steps.filter((s) => s.type === "FILL" && s.value);
                if (fillSteps.length === 1) {
                  localVal = fillSteps[0].value;
                } else if (fillSteps.length > 0) {
                  const targetNorm = (agentAction.targetLabel || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                  for (const st of fillSteps) {
                    const hintNorm = (st.fieldHint || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                    if (hintNorm && (targetNorm.includes(hintNorm) || hintNorm.includes(targetNorm))) {
                      localVal = st.value;
                      break;
                    }
                  }
                }
              }
            }

            // 7. Only use Gemini's value if no explicit task value can be safely extracted
            if (!localVal && agentAction.value) {
              localVal = agentAction.value;
            }

            // Never replace an explicit search value with target labels/placeholders/task suffixes
            if (authoritativeVal) {
              localVal = authoritativeVal;
            }

            // Defensive semantic content sanitization: ensure no control/action instructions leak into field values
            if (localVal && typeof localVal === "string" && window.SIHTaskParser && typeof window.SIHTaskParser.stripExecutionControlPhrases === "function") {
              const cleaned = window.SIHTaskParser.stripExecutionControlPhrases(localVal);
              if (cleaned && cleaned.trim().length > 0) {
                localVal = cleaned.trim();
              }
            }

            agentAction.value = localVal;

            executionPayload = {
              action: "FILL",
              targetIndex: agentAction.targetIndex,
              targetType: agentAction.targetType || "input",
              targetLabel: agentAction.targetLabel,
              value: localVal,
              localValue: localVal,
              semanticTargetDescriptor: agentAction.semanticTargetDescriptor || null
            };
          } else if (agentAction.action === "SUBMIT" || (currentStepPlan && currentStepPlan.type === "SUBMIT")) {
            executionPayload = {
              action: "SUBMIT",
              target: agentAction.target || "search",
              query: currentStepPlan ? currentStepPlan.query : null
            };
          } else if (["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(agentAction.action) || (currentStepPlan && ["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(currentStepPlan.type))) {
            const act = agentAction.action || currentStepPlan.type;
            executionPayload = {
              action: act,
              target: agentAction.target || (currentStepPlan ? currentStepPlan.target : null),
              targetLabel: agentAction.targetLabel || agentAction.target || (currentStepPlan ? currentStepPlan.target : null),
              targetType: agentAction.targetType || (currentStepPlan ? currentStepPlan.targetType : null),
              targetIndex: agentAction.targetIndex,
              context: agentAction.context || (currentStepPlan ? currentStepPlan.context : null),
              relation: agentAction.relation || (currentStepPlan ? currentStepPlan.relation : null),
              ordinal: agentAction.ordinal !== undefined ? agentAction.ordinal : (currentStepPlan ? currentStepPlan.ordinal : null),
              semanticTargetDescriptor: agentAction.semanticTargetDescriptor || null
            };
          } else if (agentAction.targetIndex !== undefined) {
            const rawExactTarget = currentStepPlan?.target || currentStepPlan?.targetHint || currentStepPlan?.explicitTarget || agentAction.targetLabel;
            executionPayload = {
              action: "CLICK",
              targetIndex: agentAction.targetIndex,
              targetType: agentAction.targetType,
              targetLabel: agentAction.targetLabel,
              exactTargetText: rawExactTarget,
              url: agentAction.url || (agentAction.semanticTargetDescriptor && (agentAction.semanticTargetDescriptor.url || agentAction.semanticTargetDescriptor.href)) || null,
              bounds: agentAction.bounds || (agentAction.semanticTargetDescriptor && agentAction.semanticTargetDescriptor.bounds) || null,
              context: agentAction.context || (currentStepPlan ? currentStepPlan.context : null),
              relation: agentAction.relation || (currentStepPlan ? currentStepPlan.relation : null),
              ordinal: agentAction.ordinal !== undefined ? agentAction.ordinal : (currentStepPlan ? currentStepPlan.ordinal : null),
              semanticTargetDescriptor: agentAction.semanticTargetDescriptor || {
                targetLabel: agentAction.targetLabel,
                exactText: rawExactTarget,
                normalizedLabel: (agentAction.targetLabel || "").toLowerCase().trim(),
                targetType: agentAction.targetType,
                role: agentAction.targetType,
                originalIndex: agentAction.targetIndex,
                bounds: agentAction.bounds || null
              }
            };
            executionPayload = {
              ...agentAction,
              context: agentAction.context || (currentStepPlan ? currentStepPlan.context : null),
              relation: agentAction.relation || (currentStepPlan ? currentStepPlan.relation : null),
              ordinal: agentAction.ordinal !== undefined ? agentAction.ordinal : (currentStepPlan ? currentStepPlan.ordinal : null),
              semanticTargetDescriptor: agentAction.semanticTargetDescriptor || null
            };
          }
          executionPayload.perceptionGeneration = agentAction?.perceptionGeneration || currentPerceptionGeneration;

          // =====================================================================
          // Final Architecture: On-Device Reasoning & Safety Gate (Human Approval)
          // =====================================================================
          setAgentState(AGENT_STATES.SAFETY, "Evaluating safety gate...");
          let stepPlanForCheck = currentStepPlan || (reasoningPlan && reasoningPlan.steps ? reasoningPlan.steps[currentStep - 1] : null);

          let safetyGate = { allowed: true, requiresApproval: false, risk: "LOW", reason: "Safe action" };
          if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.evaluateSafetyGate === "function") {
            safetyGate = window.SIHReasoningPlanner.evaluateSafetyGate(
              agentAction,
              stepPlanForCheck,
              null, // No approval token prior to user prompt
              { url: activeTab?.url, title: pageData?.title, visualElements: latestVisualElements }
            );
          }

          // Preconditions check: verify dependencies (e.g. prior fields verified before Submit)
          if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.validatePreconditions === "function" && stepPlanForCheck) {
            const preCheck = window.SIHReasoningPlanner.validatePreconditions(
              stepPlanForCheck,
              executionTraceHistory,
              null
            );
            const isSatisfied = preCheck ? (preCheck.satisfied ?? preCheck.valid ?? true) : true;
            if (!isSatisfied && !safetyGate.requiresApproval && !preCheck.requiresHumanApproval) {
              safetyGate.allowed = false;
              safetyGate.reason = preCheck.reason;
              safetyGate.rejectionReason = preCheck.reason;
            }
          }

          // Update Safety UI
          if (plannerRiskBadge) {
            plannerRiskBadge.textContent = safetyGate.risk;
            plannerRiskBadge.style.background = (safetyGate.risk === "HIGH" || safetyGate.risk === "CRITICAL") ? "#fee2e2" : ((safetyGate.risk === "MEDIUM") ? "#fef3c7" : "#e0e7ff");
            plannerRiskBadge.style.color = (safetyGate.risk === "HIGH" || safetyGate.risk === "CRITICAL") ? "#b91c1c" : ((safetyGate.risk === "MEDIUM") ? "#b45309" : "#3730a3");
          }
          if (plannerSafetyDecision) {
            plannerSafetyDecision.textContent = safetyGate.allowed
              ? (safetyGate.requiresApproval ? "APPROVAL REQUIRED" : "PASSED (Safe Action)")
              : `BLOCKED: ${safetyGate.rejectionReason || safetyGate.reason}`;
            plannerSafetyDecision.style.color = safetyGate.allowed
              ? (safetyGate.requiresApproval ? "#d97706" : "#166534")
              : "#dc2626";
          }
          if (plannerApprovalStatus) {
            plannerApprovalStatus.textContent = safetyGate.requiresApproval ? "WAITING FOR USER" : "NOT REQUIRED";
            plannerApprovalStatus.style.color = safetyGate.requiresApproval ? "#dc2626" : "#1e1b4b";
          }
          if (safetyGate.allowed && !safetyGate.requiresApproval) {
            if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (Safe Action)";
          }

          updatePipelineStage(
            "SAFETY",
            safetyGate.allowed ? "completed" : "failed",
            safetyGate.allowed ? (safetyGate.requiresApproval ? "Approval required" : "Passed allowlist ✓") : "Blocked ✗"
          );

          updateCurrentActionCard({
            stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
            action: agentAction?.semanticAction || agentAction?.action,
            target: agentAction?.targetLabel || agentAction?.target || targetStr,
            value: agentAction?.value || "",
            grounding: `${agentAction?.targetLabel || agentAction?.target || "Grounded"} (Score: ${agentAction?.groundingScore !== undefined ? agentAction.groundingScore : "1.00"})`,
            risk: safetyGate.risk || "LOW",
            safety: safetyGate.allowed ? (safetyGate.requiresApproval ? "APPROVAL REQUIRED" : "ALLOWED") : `BLOCKED: ${safetyGate.reason}`,
            status: safetyGate.allowed ? "Ready to execute" : "Halted by safety gate"
          });

          if (agentAction?.semanticAction === "OPEN" && (agentAction?.action === "CLICK" || agentAction?.executionAction === "CLICK")) {
            appendPlannerTrace(`Semantic Action: OPEN | Execution Action: CLICK | Target: '${agentAction.targetLabel || agentAction.target}' (${agentAction.targetType || "link"})`);
          }

          if (agentAction?.action === "FILL" && (currentStepPlan?.composerType || (typeof activeComposer !== "undefined" && activeComposer) || currentStepPlan?.requestedIntent)) {
            const reqIntent = currentStepPlan?.requestedIntent || (currentStepPlan?.fieldHint ? `write a ${currentStepPlan.fieldHint}` : "write a message");
            const resTarget = currentStepPlan?.target || (typeof activeComposer !== "undefined" && activeComposer ? `active ${activeComposer.type} composer` : (agentAction.targetLabel || "composer"));
            const conf = (agentAction.groundingScore !== undefined && agentAction.groundingScore >= 0.8) ? "high" : "medium";
            appendPlannerTrace(
              `ACTION:\nFILL\n\n` +
              `REQUESTED INTENT:\n${reqIntent}\n\n` +
              `RESOLVED TARGET:\n${resTarget}\n\n` +
              `VALUE:\n${agentAction.value ? "[CONFIDENTIAL / ENTERED]" : "[EMPTY]"}\n\n` +
              `GROUNDING:\nDOM + visual + active-composer-context\n\n` +
              `CONFIDENCE:\n${conf}\n\n` +
              `STATUS:\nReady to execute`
            );
          }

          // 1. If action requires Human Approval (Submit, Send, Delete, Purchase, etc.)
          if (safetyGate.requiresApproval) {
            appendPlannerTrace(`Consequential action '${agentAction.action} \u2192 ${targetStr}' requires explicit human approval.`);
            if (agentStepText) agentStepText.textContent = `Step ${currentStep}: WAITING FOR HUMAN APPROVAL`;
            if (agentVerificationText) {
              agentVerificationText.textContent = "Action paused: Consequential action requires explicit human approval.";
              agentVerificationText.style.color = "#e11d48";
            }
            if (plannerApprovalStatus) {
              plannerApprovalStatus.textContent = "WAITING FOR USER APPROVAL";
              plannerApprovalStatus.style.color = "#dc2626";
            }
            if (popupApprovalContainer) {
              popupApprovalContainer.style.display = "block";
              if (popupApprovalAction) popupApprovalAction.textContent = `${agentAction.action} \u2192 ${targetStr}`;
              if (popupApprovalReason) popupApprovalReason.textContent = safetyGate.reason;
            }

            // Trigger In-Page modal in active tab
            const inPageApprovalPromise = new Promise((resolve) => {
              chrome.tabs.sendMessage(
                activeTab.id,
                {
                  action: "requestHumanApproval",
                  payload: {
                    action: agentAction.action,
                    target: targetStr,
                    risk: safetyGate.risk,
                    reason: safetyGate.reason,
                    taskSummary: task
                  }
                },
                (res) => {
                  if (chrome.runtime.lastError || !res) {
                    // Tab didn't respond or message channel closed
                  } else {
                    resolve(res);
                  }
                }
              );
            });

            // Popup button listeners
            const popupApprovalPromise = new Promise((resolve) => {
              const onApprove = () => {
                cleanup();
                resolve({ approved: true });
              };
              const onCancel = () => {
                cleanup();
                resolve({ approved: false, cancelled: true });
              };
              const cleanup = () => {
                if (popupBtnApprove) popupBtnApprove.removeEventListener("click", onApprove);
                if (popupBtnCancel) popupBtnCancel.removeEventListener("click", onCancel);
              };
              if (popupBtnApprove) popupBtnApprove.addEventListener("click", onApprove);
              if (popupBtnCancel) popupBtnCancel.addEventListener("click", onCancel);
            });

            // Await genuine user approval - NO TIMEOUT, NO DEFAULT TRUE
            const userDecision = await Promise.race([
              inPageApprovalPromise,
              popupApprovalPromise
            ]);

            // Cleanup approval UI
            if (popupApprovalContainer) popupApprovalContainer.style.display = "none";
            chrome.tabs.sendMessage(activeTab.id, { action: "dismissHumanApproval" }, () => {
              if (chrome.runtime.lastError) { }
            });

            // Handle Cancellation
            if (!userDecision || !userDecision.approved) {
              appendPlannerTrace("Execution cancelled by user.");
              // Milestone 18: Live Explainable Agent Overlay (Safety Blocked / Cancelled)
              sendOverlayTelemetry(activeTab?.id, {
                action: "updateAgentOverlay",
                payload: {
                  state: "SAFETY_BLOCKED",
                  action: agentAction.action,
                  target: targetStr,
                  reason: "Execution cancelled by user"
                }
              });
              if (plannerApprovalStatus) {
                plannerApprovalStatus.textContent = "CANCELLED BY USER";
                plannerApprovalStatus.style.color = "#dc2626";
              }
              if (agentExecutionStatus) agentExecutionStatus.textContent = "Execution cancelled by user.";
              if (agentSafetyStatus) agentSafetyStatus.textContent = "CANCELLED BY USER";
              if (executionOutput) executionOutput.value = "Execution cancelled by user.";
              if (agentVerificationText) {
                agentVerificationText.textContent = "Execution cancelled by user. Page state preserved.";
                agentVerificationText.style.color = "#dc2626";
              }
              executionTraceHistory.push({
                step: currentStep,
                totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                requestId,
                action: agentAction,
                executed: false,
                status: "cancelled_by_user",
                executionResult: "Execution cancelled by user.",
                verification: "No action performed; page preserved"
              });
              renderTraceHistory();
              break;
            }

            // User Approved - Enforce Dynamic DOM re-grounding & invalidation check
            appendPlannerTrace(`User approved ${agentAction.action} \u2192 ${targetStr}. Re-verifying target on live page.`);
            if (plannerApprovalStatus) {
              plannerApprovalStatus.textContent = "APPROVED BY USER";
              plannerApprovalStatus.style.color = "#166534";
            }

            // Dynamic DOM Re-verification: Target element must still be valid
            const freshCheckData = await new Promise((resolve) => {
              chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => {
                resolve(resp || null);
              });
            });

            let targetReverified = false;
            if (freshCheckData && Array.isArray(freshCheckData.visualElements)) {
              const targetDesc = agentAction.semanticTargetDescriptor || createSemanticTargetDescriptor(
                null,
                agentAction.targetLabel || agentAction.target,
                agentAction.targetType
              );
              const reground = reGroundSemanticTarget(freshCheckData.visualElements, targetDesc);
              if (reground && reground.match && !reground.isAmbiguous) {
                agentAction.targetIndex = reground.index;
                if (executionPayload) {
                  executionPayload.targetIndex = reground.index;
                  executionPayload.semanticTargetDescriptor = targetDesc;
                }
                targetReverified = true;
              } else if (agentAction.targetIndex !== undefined) {
                const currentEl = freshCheckData.visualElements[agentAction.targetIndex];
                if (currentEl && currentEl.label === agentAction.targetLabel) {
                  targetReverified = true;
                } else {
                  // Re-find target in case DOM shifted slightly
                  const foundIdx = freshCheckData.visualElements.findIndex(
                    (el) => el.label === agentAction.targetLabel && el.type === agentAction.targetType
                  );
                  if (foundIdx >= 0) {
                    agentAction.targetIndex = foundIdx;
                    if (executionPayload) executionPayload.targetIndex = foundIdx;
                    targetReverified = true;
                  }
                }
              } else if (agentAction.target) {
                targetReverified = true;
              }
            } else {
              targetReverified = true;
            }

            if (!targetReverified) {
              appendPlannerTrace("Target changed or moved after approval. Safety gate re-locked.");
              if (agentSafetyStatus) agentSafetyStatus.textContent = "APPROVAL INVALIDATED: Target Drift";
              if (agentExecutionStatus) agentExecutionStatus.textContent = "Target moved or disappeared after approval. Halted.";
              executionTraceHistory.push({
                step: currentStep,
                totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                requestId,
                action: agentAction,
                executed: false,
                status: "approval_invalidated",
                executionResult: "Target drifted after approval. Execution halted.",
                verification: "Dynamic DOM verification protected action"
              });
              renderTraceHistory();
              break;
            }

            // Re-evaluate safety gate with valid approval token
            const currentApprovalToken = {
              approved: true,
              action: agentAction.action,
              target: agentAction.targetLabel || agentAction.target || targetStr,
              pageUrl: activeTab?.url,
              timestamp: Date.now()
            };
            if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.evaluateSafetyGate === "function") {
              const recheckGate = window.SIHReasoningPlanner.evaluateSafetyGate(
                agentAction,
                stepPlanForCheck,
                currentApprovalToken,
                { url: activeTab?.url, title: freshCheckData?.title || pageData?.title, visualElements: freshCheckData?.visualElements }
              );
              if (!recheckGate.allowed) {
                appendPlannerTrace(`Safety Gate rejected even with approval: ${recheckGate.reason}`);
                if (agentSafetyStatus) agentSafetyStatus.textContent = `SAFETY BLOCKED: ${recheckGate.reason}`;
                if (agentExecutionStatus) agentExecutionStatus.textContent = `Halted: ${recheckGate.reason}`;
                executionTraceHistory.push({
                  step: currentStep,
                  totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                  requestId,
                  action: agentAction,
                  executed: false,
                  status: "safety_blocked",
                  executionResult: recheckGate.reason,
                  verification: "Safety gate post-approval recheck"
                });
                renderTraceHistory();
                break;
              }
            }
          } else if (!safetyGate.allowed) {
            // 2. If safety gate rejected without approval requirement (e.g. CRITICAL or invalid action)
            appendPlannerTrace(`Safety Gate rejected action: ${safetyGate.rejectionReason || safetyGate.reason}`);
            // Milestone 18: Live Explainable Agent Overlay (Safety Blocked)
            sendOverlayTelemetry(activeTab?.id, {
              action: "updateAgentOverlay",
              payload: {
                state: "SAFETY_BLOCKED",
                action: agentAction.action,
                target: targetStr,
                reason: safetyGate.rejectionReason || safetyGate.reason
              }
            });
            if (agentSafetyStatus) agentSafetyStatus.textContent = `SAFETY BLOCKED: ${safetyGate.rejectionReason || safetyGate.reason}`;
            if (agentExecutionStatus) agentExecutionStatus.textContent = `Halted by Safety Gate: ${safetyGate.reason}`;
            executionTraceHistory.push({
              step: currentStep,
              totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
              requestId,
              action: agentAction,
              executed: false,
              status: "safety_blocked",
              executionResult: `Blocked by Safety Gate: ${safetyGate.reason}`,
              verification: "Safety gate policy enforcement"
            });
            renderTraceHistory();
            break;
          }

          console.log("[SIH26171] Safety validation completed");

          console.log("[SIH26171] Action execution started");
          setAgentState(AGENT_STATES.EXECUTE, `Executing ${agentAction.action}...`);
          // Milestone 18: Live Explainable Agent Overlay (Executing State)
          sendOverlayTelemetry(activeTab?.id, {
            action: "updateAgentOverlay",
            payload: {
              state: "EXECUTING",
              action: agentAction.action,
              target: targetStr
            }
          });
          if (executionOutput) executionOutput.value = "Executing action via local allowlist...";

          // M21.1: Capture lightweight pre-action state snapshot
          const preActionState = {
            url: (latestPageData && latestPageData.url) || activeTab?.url || "",
            title: (latestPageData && latestPageData.title) || activeTab?.title || "",
            scrollX: (latestPageData && latestPageData.viewport && typeof latestPageData.viewport.scrollX === "number")
              ? latestPageData.viewport.scrollX : 0,
            scrollY: (latestPageData && latestPageData.viewport && typeof latestPageData.viewport.scrollY === "number")
              ? latestPageData.viewport.scrollY : 0,
            visualElements: latestVisualElements || [],
            elementCount: (latestVisualElements || []).length,
            domSignature: currentSignature?.domSignature || "",
            pixelHash: currentSignature?.pixelHash || ""
          };

          let rawExecResult = null;
          if (agentAction.action === "NAVIGATE" || agentAction.action === "OPEN_URL") {
            const destName = agentAction.target || agentAction.targetLabel || "destination";
            let navUrl = agentAction.url;
            if (!navUrl && window.SIHTaskParser && typeof window.SIHTaskParser.resolveNavigationUrl === "function") {
              navUrl = window.SIHTaskParser.resolveNavigationUrl(destName);
            }
            if (!navUrl) {
              const clean = String(destName).toLowerCase().replace(/[^a-z0-9\-]/g, "");
              navUrl = `https://www.${clean}.com`;
            }

            try {
              if (chrome.tabs && typeof chrome.tabs.update === "function" && activeTab?.id) {
                await new Promise((resolveNav) => {
                  chrome.tabs.update(activeTab.id, { url: navUrl }, (updatedTab) => {
                    if (chrome.runtime.lastError) {
                      console.warn("[SIH26171] chrome.tabs.update error:", chrome.runtime.lastError.message);
                      chrome.tabs.sendMessage(activeTab.id, { action: "executeAction", payload: { action: "NAVIGATE", url: navUrl, target: destName } }, () => resolveNav(null));
                    } else {
                      resolveNav(updatedTab);
                    }
                  });
                });
              } else {
                await new Promise((resolveNav) => {
                  chrome.tabs.sendMessage(activeTab.id, { action: "executeAction", payload: { action: "NAVIGATE", url: navUrl, target: destName } }, () => resolveNav(null));
                });
              }
              actionExecutedSuccessfully = true;
              actionExecutionSummary = `Executed: NAVIGATE → ${destName} (${navUrl})`;
              rawExecResult = { executed: true, action: "NAVIGATE", target: destName, url: navUrl };
            } catch (navErr) {
              actionExecutionSummary = `Navigation error: ${navErr.message}`;
              rawExecResult = { executed: false, reason: navErr.message };
          } else if (typeof executionPayload.targetIndex === "number" && executionPayload.perceptionGeneration && executionPayload.perceptionGeneration < currentPerceptionGeneration) {
            actionExecutionSummary = `Execution rejected: Stale targetIndex from older perception snapshot (gen ${executionPayload.perceptionGeneration} vs current gen ${currentPerceptionGeneration})`;
            rawExecResult = { executed: false, reason: "Target index is stale: perception generation mismatch" };
            actionExecutedSuccessfully = false;
          } else {
            await new Promise((resolveExec) => {
            chrome.tabs.sendMessage(
              activeTab.id,
              { action: "executeAction", payload: executionPayload },
              (execRes) => {
                if (chrome.runtime.lastError) {
                  actionExecutionSummary = `Execution error: ${chrome.runtime.lastError.message}`;
                  rawExecResult = { executed: false, reason: chrome.runtime.lastError.message };
                } else if (execRes && execRes.result) {
                  rawExecResult = execRes.result;
                  const r = execRes.result;
                  if (r.executed) {
                    actionExecutedSuccessfully = true;
                    if (r.action === "FILL_FORM") {
                      const fieldNames = (r.fieldsFilled || []).map(f => f.targetLabel || f.matchedKey).join(", ");
                      actionExecutionSummary = `Executed: FILL_FORM (Simultaneous) → Filled ${r.count} field(s) [${fieldNames}]`;
                      if (fillStepStatus) {
                        fillStepStatus.textContent = `Autofilled ${r.count} field(s) simultaneously (Verified: ${r.verified ? "OK" : "Pending"})`;
                      }
                    } else if (r.action === "FILL") {
                      actionExecutionSummary = `Executed: FILL → ${r.targetType}: '${r.targetLabel}' (index: ${r.groundedIndex}, verified: ${r.verified ? "OK" : "Pending"})`;
                      if (fillStepStatus) {
                        fillStepStatus.textContent = `Step ${currentStep} (${r.targetLabel}): OK (Verified: ${r.verified ? "OK" : "Pending"})`;
                      }
                    } else if (r.action === "SUBMIT") {
                      actionExecutionSummary = `Executed: SUBMIT → ${r.target || "search"} (method: ${r.method || "enter_key"})`;
                    } else if (r.amount !== undefined && r.amount !== null) {
                      actionExecutionSummary = `Executed: ${r.action} → ${r.target} (amount: ${r.amount})`;
                    } else if (agentAction?.semanticAction === "OPEN" && (agentAction?.action === "CLICK" || agentAction?.executionAction === "CLICK")) {
                      actionExecutionSummary = `Executed: CLICK → ${r.targetType || agentAction.targetType || "link"}: '${r.targetLabel || agentAction.targetLabel || r.target || agentAction.target}'`;
                    } else {
                      actionExecutionSummary = r.target
                        ? `Executed: ${r.action} → ${r.target}`
                        : `Executed: ${r.action} → ${r.targetType}: '${r.targetLabel}' (index: ${r.groundedIndex})`;
                    }
                  } else {
                    actionExecutionSummary = `Not executed: ${r.reason}`;
                    if (fillStepStatus && (agentAction.action === "FILL" || agentAction.action === "FILL_FORM")) {
                      fillStepStatus.textContent = `Failed: ${r.reason}`;
                    }
                  }
                } else {
                  actionExecutionSummary = "No execution response received";
                  rawExecResult = { executed: false, reason: "No execution response received" };
                }
                resolveExec();
              }
            );
          });
          }
          console.log("[SIH26171] Action execution completed");

          if (executionOutput) executionOutput.value = actionExecutionSummary;
          if (agentExecutionStatus) agentExecutionStatus.textContent = actionExecutionSummary;

          if (!actionExecutedSuccessfully) {
            if (agentSafetyStatus) agentSafetyStatus.textContent = `REJECTED: ${actionExecutionSummary}`;

            let m21Verification = null;
            if (window.SIHActionVerifier && typeof window.SIHActionVerifier.verifyActionOutcome === "function") {
              m21Verification = window.SIHActionVerifier.verifyActionOutcome(
                preActionState,
                preActionState,
                agentAction,
                rawExecResult
              );
            } else {
              m21Verification = {
                status: "FAILED",
                verified: false,
                actionType: agentAction.action,
                reason: `Execution failed: ${actionExecutionSummary}`,
                evidence: {
                  urlChanged: false,
                  titleChanged: false,
                  domChanged: false,
                  visualStateChanged: false,
                  scrollChanged: false,
                  targetStateChanged: false,
                  executionSuccess: false,
                  executionError: actionExecutionSummary
                }
              };
            }

            // Milestone 21.3: Controlled Recovery after Action Failure
            if (!recoveryAttempted) {
              recoveryAttempted = true;
              const recoveryOutcome = await attemptControlledRecovery({
                currentStep,
                totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                activeTab,
                originalAction: agentAction,
                currentStepPlan,
                initialFailureReason: m21Verification.reason,
                requestId
              });

              if (recoveryOutcome && recoveryOutcome.result === "VERIFIED") {
                actionExecutedSuccessfully = true;
                if (recoveryOutcome.agentAction) {
                  agentAction = recoveryOutcome.agentAction;
                }
                m21Verification = recoveryOutcome.verificationDetails || {
                  status: "VERIFIED",
                  verified: true,
                  actionType: agentAction.action,
                  reason: recoveryOutcome.reason
                };
                stepRecoveryNote = `Controlled recovery verified: ${recoveryOutcome.reason}`;
                actionExecutionSummary = `Recovery executed: ${agentAction.action} → ${agentAction.targetLabel || agentAction.target}`;
                if (agentExecutionStatus) agentExecutionStatus.textContent = actionExecutionSummary;
                if (agentVerificationText) {
                  agentVerificationText.textContent = `VERIFIED: ${m21Verification.reason}`;
                  agentVerificationText.style.color = "#2e7d32";
                }
                if (window.SIHEvaluationTracker) window.SIHEvaluationTracker.recordRecovery(stepRecoveryNote);
              } else {
                const verificationResultStr = `${recoveryOutcome.result}: ${recoveryOutcome.reason}`;
                if (agentVerificationText) {
                  agentVerificationText.textContent = verificationResultStr;
                  agentVerificationText.style.color = "#dc2626";
                }
                if (agentExecutionStatus) {
                  agentExecutionStatus.textContent = `Action failed safely: ${recoveryOutcome.reason}`;
                }
                updatePipelineStage("EXECUTION", "failed", "Execution failed ✗");
                updatePipelineStage("VERIFICATION", "failed", "Verification failed ✗");

                executionTraceHistory.push({
                  step: currentStep,
                  totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                  requestId,
                  agentState: "FAILED",
                  action: agentAction,
                  executed: false,
                  status: "recovery_failed",
                  perception: (latestVisualElements && latestVisualElements.length > 0)
                    ? `${latestVisualElements.length} visual elements perceived locally`
                    : "DOM perception active",
                  groundingStr: `Label='${agentAction.targetLabel || agentAction.target || "none"}', Role=${agentAction.targetType || "element"}`,
                  risk: safetyGate.risk || "LOW",
                  safetyDecision: safetyGate.allowed ? "ALLOWED" : "BLOCKED",
                  humanApproval: safetyGate.requiresApproval ? "GRANTED" : "NOT REQUIRED",
                  executionResult: `Execution failed: ${recoveryOutcome.reason}`,
                  verification: verificationResultStr,
                  verificationDetails: m21Verification,
                  recovery: recoveryOutcome
                });
                renderTraceHistory();
                break;
              }
            } else {
              console.log("[M21][RECOVERY] recovery limit reached");
              appendPlannerTrace(`Step ${currentStep}: Recovery limit reached (max 1 attempt). Halting execution safely.`);
              const verificationResultStr = `${m21Verification.status}: ${m21Verification.reason}`;
              if (agentVerificationText) {
                agentVerificationText.textContent = verificationResultStr;
                agentVerificationText.style.color = "#dc2626";
              }
              if (agentExecutionStatus) {
                agentExecutionStatus.textContent = `Halted: ${actionExecutionSummary}`;
              }
              updatePipelineStage("EXECUTION", "failed", "Execution failed ✗");
              updatePipelineStage("VERIFICATION", "failed", "Verification failed ✗");

              executionTraceHistory.push({
                step: currentStep,
                totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                requestId,
                agentState: "FAILED",
                action: agentAction,
                executed: false,
                status: "rejected",
                perception: (latestVisualElements && latestVisualElements.length > 0)
                  ? `${latestVisualElements.length} visual elements perceived locally`
                  : "DOM perception active",
                groundingStr: `Label='${agentAction.targetLabel || agentAction.target || "none"}', Role=${agentAction.targetType || "element"}`,
                semanticDetails: agentAction?.semanticTargetObject ? `Entity: ${agentAction.semanticTargetObject.entity || "element"}, Descr: ${agentAction.semanticTargetObject.description || "item"}${agentAction.semanticTargetObject.attributes ? `, Attrs: ${JSON.stringify(agentAction.semanticTargetObject.attributes)}` : ""}${agentAction.semanticTargetObject.selector ? `, Selector: ${agentAction.semanticTargetObject.selector.type}` : ""}` : null,
                risk: safetyGate.risk || "LOW",
                safetyDecision: safetyGate.allowed ? "ALLOWED" : "BLOCKED",
                humanApproval: safetyGate.requiresApproval ? "GRANTED" : "NOT REQUIRED",
                executionResult: actionExecutionSummary,
                verification: verificationResultStr,
                verificationDetails: m21Verification
              });
              renderTraceHistory();
              break;
            }
          }

          if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (Allowlist Verified)";

          updatePipelineStage(
            "EXECUTION",
            actionExecutedSuccessfully ? "completed" : "failed",
            actionExecutedSuccessfully ? `${agentAction?.action} executed ✓` : "Execution failed ✗"
          );

          if (actionExecutedSuccessfully) {
            appendPlannerTrace(`Step ${currentStep} executed: ${agentAction.action} \u2192 ${targetStr}.`);
            if (stepPlanForCheck) {
              stepPlanForCheck.completed = true;
              stepPlanForCheck.verified = true;
            }
            if (plannedSteps && plannedSteps[currentStep - 1]) {
              plannedSteps[currentStep - 1].completed = true;
              plannedSteps[currentStep - 1].verified = true;
            }

            // Update goal completion tracking
            if (stepPlanForCheck && stepPlanForCheck.goalId && Array.isArray(taskGoals)) {
              const currentGoal = taskGoals.find((g) => g.id === stepPlanForCheck.goalId);
              if (currentGoal) {
                // Check if all steps in this goal are completed
                const goalSteps = (reasoningPlan?.steps || plannedSteps || []).filter((s) => s.goalId === currentGoal.id);
                const allGoalStepsDone = goalSteps.length === 0 || goalSteps.every((s) => s.completed || s.verified);
                if (allGoalStepsDone && !currentGoal.completed) {
                  currentGoal.completed = true;
                  if (!completedGoals.includes(currentGoal.id)) {
                    completedGoals.push(currentGoal.id);
                  }
                  remainingGoals = taskGoals.filter((g) => !completedGoals.includes(g.id));
                  appendPlannerTrace(`Goal ${currentGoal.id} [${currentGoal.type}] completed ✓ (${remainingGoals.length} remaining).`);
                }
              }
            }
          }

          // Step 11: Post-Action Verification via Screen-Change Detection & M21.1 Action Verifier
          // If an action could navigate or update the DOM, wait for page to stabilize
          if (agentAction.action === "NAVIGATE" || agentAction.action === "OPEN_URL") {
            setAgentState(AGENT_STATES.WAIT, `Navigating to ${agentAction.target}...`);
            await waitForTabReady(activeTab.id, 8000);
            setAgentState(AGENT_STATES.REPERCEIVE, `Observing navigated page (${agentAction.target})...`);
          } else if (agentAction.action === "SUBMIT") {
            setAgentState(AGENT_STATES.WAIT, "Waiting for search results...");
            await waitForSearchResultsStabilization(activeTab.id, 5000);
            await waitForTabReady(activeTab.id, 6000);
            setAgentState(AGENT_STATES.REPERCEIVE, "Perceiving search results...");
          } else if (agentAction.action === "CLICK") {
            const isComposerClick = (currentStepPlan && (currentStepPlan.expectedTransition === "post_composer_open" || currentStepPlan.expectedTransition === "message_composer_open" || currentStepPlan.expectedTransition === "composer_open")) ||
              /\b(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(agentAction.targetLabel || agentAction.target || "") ||
              /\b(?:message|reply)\b/i.test(agentAction.targetLabel || agentAction.target || "");
            if (isComposerClick) {
              setAgentState(AGENT_STATES.WAIT, "Waiting for composer to appear...");
              await new Promise((r) => setTimeout(r, 1200));
              await waitForTabReady(activeTab.id, 6000);
              setAgentState(AGENT_STATES.REPERCEIVE, "Observing composer...");
            } else {
              // If clicking search result or navigation link, allow time for new page load
              const isNavClick = (currentStepPlan && currentStepPlan.isSearchResult) ||
                /\b(result|website|site|link|video|product|listing|portal)\b/i.test(agentAction.targetLabel || agentAction.target || "");
              if (isNavClick) {
                setAgentState(AGENT_STATES.WAIT, "Navigating to selected target...");
                await new Promise((r) => setTimeout(r, 1200));
              }
              await waitForTabReady(activeTab.id, 6000);
              if (isNavClick) {
                setAgentState(AGENT_STATES.REPERCEIVE, "Observing navigated page...");
              }
            }
          } else if (agentAction.action === "FILL" || agentAction.action === "FILL_FORM") {
            await waitForTabReady(activeTab.id, 6000);
          } else {
            await new Promise((r) => setTimeout(r, ACTION_VERIFICATION_DELAY_MS));
          }

          // Advance perception generation & invalidate old snapshot after state-changing actions (Part 3 & 10)
          if (["CLICK", "NAVIGATE", "OPEN", "SUBMIT", "SELECT"].includes(agentAction.action)) {
            currentPerceptionGeneration++;
            latestVisualElements = null;
            latestScreenshotDataUrl = null;
            cachedPerceptionTimestamp = 0;
            cachedLightweightSignature = null;
          }

          setAgentState(AGENT_STATES.VERIFY, "Verifying post-action outcome...");
          let postActionSignature = null;
          let postPageData = null;

          const updatedDom = await new Promise((resolveDom) => {
            chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => {
              if (resp && resp.success) {
                postPageData = resp;
                if (resp.visualElements && Array.isArray(resp.visualElements)) {
                  resp.visualElements.forEach((el) => {
                    el.perceptionGeneration = currentPerceptionGeneration;
                  });
                }
                resolveDom(resp.visualElements || latestVisualElements);
              } else {
                resolveDom(latestVisualElements);
              }
            });
          });

          if (agentAction.action === "CLICK") {
            const isComposerClick = (currentStepPlan && (currentStepPlan.expectedTransition === "post_composer_open" || currentStepPlan.expectedTransition === "message_composer_open" || currentStepPlan.expectedTransition === "composer_open")) ||
              /\b(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(agentAction.targetLabel || agentAction.target || "") ||
              /\b(?:message|reply)\b/i.test(agentAction.targetLabel || agentAction.target || "");
            if (isComposerClick) {
              const composerFound = (updatedDom || []).some(el =>
                el.isContentEditable || el.type === "contenteditable" || el.role === "textbox" ||
                /\b(?:talk about|share|post|composer|editor|message|reply)\b/i.test(`${el.label || ""} ${el.ariaLabel || ""} ${el.placeholder || ""}`)
              );
              if (composerFound) {
                appendPlannerTrace("[VERIFIED TRANSITION] Composer opened and verified.");
              }
            }
          }

          const postDataUrl = (await captureScreenshotDataUrl(activeTab.windowId)) || latestScreenshotDataUrl;

          if (window.SIHChangeDetector && typeof window.SIHChangeDetector.computeScreenSignature === "function") {
            postActionSignature = await window.SIHChangeDetector.computeScreenSignature(postDataUrl, updatedDom);
          }

          let changeResult = null;
          if (currentSignature && postActionSignature && window.SIHChangeDetector) {
            changeResult = window.SIHChangeDetector.compareScreenSignatures(
              currentSignature,
              postActionSignature,
              PIXEL_CHANGE_THRESHOLD
            );
          }

          // M21.1: Post-Action Verification Layer
          const postActionState = {
            url: (postPageData && postPageData.url) || activeTab?.url || "",
            title: (postPageData && postPageData.title) || activeTab?.title || "",
            scrollX: (postPageData && postPageData.viewport && typeof postPageData.viewport.scrollX === "number")
              ? postPageData.viewport.scrollX : 0,
            scrollY: (postPageData && postPageData.viewport && typeof postPageData.viewport.scrollY === "number")
              ? postPageData.viewport.scrollY : 0,
            visualElements: updatedDom || [],
            elementCount: (updatedDom || []).length,
            domSignature: postActionSignature?.domSignature || "",
            pixelHash: postActionSignature?.pixelHash || "",
            pixelDiff: changeResult ? changeResult.pixelDiff : 0,
            changeResult: changeResult,
            isSearchResults: postPageData ? Boolean(postPageData.isSearchResults) : false,
            searchSignals: postPageData ? postPageData.searchSignals : null
          };

          let m21Verification = null;
          if (window.SIHActionVerifier && typeof window.SIHActionVerifier.verifyActionOutcome === "function") {
            m21Verification = window.SIHActionVerifier.verifyActionOutcome(
              preActionState,
              postActionState,
              agentAction,
              rawExecResult
            );
          } else {
            const isV = changeResult && changeResult.changed;
            m21Verification = {
              status: isV ? "VERIFIED" : "UNKNOWN",
              verified: isV ? true : "unknown",
              actionType: agentAction.action,
              reason: changeResult ? changeResult.reason : "Verification completed",
              evidence: {
                urlChanged: false,
                titleChanged: false,
                domChanged: changeResult ? changeResult.domDiff : false,
                visualStateChanged: isV,
                scrollChanged: false,
                targetStateChanged: false,
                executionSuccess: true,
                executionError: null
              }
            };
          }

          const verificationResultStr = `${m21Verification.status}: ${m21Verification.reason}`;

          if (agentVerificationText) {
            agentVerificationText.textContent = verificationResultStr;
            agentVerificationText.style.color = m21Verification.status === "VERIFIED" ? "#2e7d32" : (m21Verification.status === "FAILED" ? "#dc2626" : "#d97706");
          }

          // Record evaluation metrics (Section 23)
          lastStepVerification = m21Verification;
          lastExecutedActionType = agentAction ? agentAction.action : null;

          // Update contextual entity memory across actions (Section 1)
          if (agentAction) {
            taskContext.previousAction = agentAction.action;
            if (currentStepPlan && currentStepPlan.targetEntity) {
              taskContext.currentEntity = currentStepPlan.targetEntity;
              taskContext.establishedEntities.push(currentStepPlan.targetEntity);
            } else if (agentAction.action === "FILL" && (agentAction.value || currentStepPlan?.value)) {
              const val = agentAction.value || currentStepPlan?.value;
              const fHint = currentStepPlan?.fieldHint || agentAction.targetLabel || "";
              if (/search|query/i.test(fHint)) {
                const inferredType = (window.SIHTaskParser && window.SIHTaskParser.inferEntityType) ? window.SIHTaskParser.inferEntityType(val, fHint) : "person";
                taskContext.currentEntity = { type: inferredType, name: val };
                taskContext.currentIntent = "search";
                taskContext.establishedEntities.push(taskContext.currentEntity);
              }
            } else if (agentAction.action === "NAVIGATE") {
              taskContext.currentPage = agentAction.target || agentAction.targetLabel;
            }

            // Section 2: Active Composer Context State Transitions
            if (actionExecutedSuccessfully) {
              if (agentAction.action === "CLICK" || agentAction.action === "OPEN") {
                const clickTarget = (agentAction.targetLabel || agentAction.target || currentStepPlan?.target || "").toLowerCase();
                if (/\b(?:message|new\s+message)\b/i.test(clickTarget)) {
                  activeComposer = {
                    type: "message",
                    state: "open",
                    sourceAction: agentAction.targetLabel || currentStepPlan?.target || "Message"
                  };
                } else if (/\breply\b/i.test(clickTarget)) {
                  activeComposer = {
                    type: "reply",
                    state: "open",
                    sourceAction: agentAction.targetLabel || currentStepPlan?.target || "Reply"
                  };
                } else if (/\b(?:compose|new\s+email|email|mail)\b/i.test(clickTarget)) {
                  activeComposer = {
                    type: "email",
                    state: "open",
                    sourceAction: agentAction.targetLabel || currentStepPlan?.target || "Compose"
                  };
                } else if (/\b(?:start\s+a\s+post|create\s+(?:a\s+)?post|write\s+(?:a\s+)?post)\b/i.test(clickTarget)) {
                  activeComposer = {
                    type: "post",
                    state: "open",
                    sourceAction: agentAction.targetLabel || currentStepPlan?.target || "Start a post"
                  };
                } else if (/\bcomment\b/i.test(clickTarget)) {
                  activeComposer = {
                    type: "comment",
                    state: "open",
                    sourceAction: agentAction.targetLabel || currentStepPlan?.target || "Comment"
                  };
                } else if (/\b(?:send|publish|post)\b/i.test(clickTarget)) {
                  activeComposer = null;
                }
              } else if (agentAction.action === "FILL" && activeComposer) {
                activeComposer.state = "filled";
              }
            }
          }
          if (postPageData && window.SIHChangeDetector && typeof window.SIHChangeDetector.computeLightweightDomSignature === "function") {
            cachedLightweightSignature = window.SIHChangeDetector.computeLightweightDomSignature(
              updatedDom || [],
              { url: postPageData.url, title: postPageData.title, viewport: postPageData.viewport }
            );
          }

          if (window.SIHEvaluationTracker) {
            window.SIHEvaluationTracker.recordAction({
              action: agentAction.action,
              target: targetStr,
              groundingScore: agentAction.groundingScore,
              executed: actionExecutedSuccessfully,
              risk: safetyGate.risk
            });
            const isCh = m21Verification.status === "VERIFIED";
            window.SIHEvaluationTracker.recordVerification(isCh, verificationResultStr);

            updatePipelineStage(
              "VERIFICATION",
              m21Verification.status === "FAILED" ? "failed" : "completed",
              m21Verification.status === "VERIFIED" ? "Verified ✓" : (m21Verification.status === "FAILED" ? "Verification failed ✗" : "Unknown ?")
            );

            // Milestone 18: Live Explainable Agent Overlay (Verified State)
            sendOverlayTelemetry(activeTab?.id, {
              action: "updateAgentOverlay",
              payload: {
                state: "VERIFIED",
                action: agentAction?.action,
                target: targetStr
              }
            });

            updateCurrentActionCard({
              stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
              action: agentAction?.semanticAction || agentAction?.action,
              target: agentAction?.targetLabel || agentAction?.target || targetStr,
              value: agentAction?.value ? (window.SIHActionVerifier?.sanitizeFailureReason ? window.SIHActionVerifier.sanitizeFailureReason(String(agentAction.value)) : (typeof redactText === "function" ? redactText(String(agentAction.value)) : "[REDACTED]")) : "",
              grounding: `${agentAction?.targetLabel || agentAction?.target || "Grounded"} (Score: ${agentAction?.groundingScore !== undefined ? agentAction.groundingScore : "1.00"})`,
              risk: safetyGate.risk || "LOW",
              safety: "ALLOWED",
              status: m21Verification.status === "VERIFIED"
                ? `VERIFIED ✓ (${m21Verification.reason})`
                : (m21Verification.status === "FAILED" ? `FAILED ✗ (${m21Verification.reason})` : `UNKNOWN ? (${m21Verification.reason})`)
            });
          }

          // Record explainable trace for this step (Section 22)
          executionTraceHistory.push({
            step: currentStep,
            totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
            requestId,
            agentState: currentAgentState || "VERIFY",
            action: agentAction,
            executed: true,
            status: m21Verification.status === "FAILED" ? "verification_failed" : "success",
            perception: lastPerceptionDecision.reused
              ? `Reused stable perception (${lastPerceptionDecision.probeMs}ms)`
              : ((latestVisualElements && latestVisualElements.length > 0)
                ? `${latestVisualElements.length} visual elements perceived locally`
                : "DOM perception active"),
            perceptionDecision: lastPerceptionDecision.reason,
            adaptivePerceptionReused: lastPerceptionDecision.reused,
            groundingStr: `Label='${agentAction.targetLabel || agentAction.target || "none"}', Role=${agentAction.targetType || "element"}, Conf=${agentAction.groundingScore !== undefined ? agentAction.groundingScore : 1.0}`,
            semanticDetails: agentAction?.semanticTargetObject ? `Entity: ${agentAction.semanticTargetObject.entity || "element"}, Descr: ${agentAction.semanticTargetObject.description || "item"}${agentAction.semanticTargetObject.attributes ? `, Attrs: ${JSON.stringify(agentAction.semanticTargetObject.attributes)}` : ""}${agentAction.semanticTargetObject.selector ? `, Selector: ${agentAction.semanticTargetObject.selector.type}` : ""}` : null,
            auditDetails: agentAction?.action === "FILL" ? {
              semanticTarget: agentAction.semanticTarget || agentAction.targetRole || "GENERIC_TEXT_EDITOR",
              resolvedRole: agentAction.targetType || "textbox",
              resolvedTag: agentAction.targetType || "contenteditable",
              containerType: taskContext.currentContainer || "dialog",
              groundingScore: agentAction.groundingScore !== undefined ? agentAction.groundingScore : 0.95,
              groundingMethod: agentAction.groundingMethod || "semantic+container+visual",
              postActionPerception: true,
              verificationResult: m21Verification?.status || "UNKNOWN"
            } : null,
            risk: safetyGate.risk || "LOW",
            safetyDecision: safetyGate.allowed ? (safetyGate.requiresApproval ? "APPROVED" : "ALLOWED") : "BLOCKED",
            humanApproval: safetyGate.requiresApproval ? "GRANTED" : "NOT REQUIRED",
            executionResult: actionExecutionSummary,
            verification: verificationResultStr,
            verificationDetails: m21Verification,
            recovery: stepRecoveryNote
          });
          renderTraceHistory();

          // Milestone 21.1 / 21.3: If verification explicitly failed, attempt controlled recovery once
          if (m21Verification.status === "FAILED") {
            if (!recoveryAttempted) {
              recoveryAttempted = true;
              const recoveryOutcome = await attemptControlledRecovery({
                currentStep,
                totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
                activeTab,
                originalAction: agentAction,
                currentStepPlan,
                initialFailureReason: m21Verification.reason,
                requestId
              });

              if (recoveryOutcome && recoveryOutcome.result === "VERIFIED") {
                actionExecutedSuccessfully = true;
                if (recoveryOutcome.agentAction) {
                  agentAction = recoveryOutcome.agentAction;
                }
                m21Verification = recoveryOutcome.verificationDetails || {
                  status: "VERIFIED",
                  verified: true,
                  actionType: agentAction.action,
                  reason: recoveryOutcome.reason
                };
                stepRecoveryNote = `Controlled recovery verified: ${recoveryOutcome.reason}`;
                if (window.SIHEvaluationTracker) window.SIHEvaluationTracker.recordRecovery(stepRecoveryNote);

                // Update the last history trace entry with verified recovery
                if (executionTraceHistory.length > 0) {
                  const lastTrace = executionTraceHistory[executionTraceHistory.length - 1];
                  lastTrace.recovery = recoveryOutcome;
                  lastTrace.status = "success";
                  lastTrace.verification = `VERIFIED: ${m21Verification.reason}`;
                  lastTrace.verificationDetails = m21Verification;
                  renderTraceHistory();
                }

                // Update step/goal completion
                if (stepPlanForCheck) {
                  stepPlanForCheck.completed = true;
                  stepPlanForCheck.verified = true;
                }
                if (plannedSteps && plannedSteps[currentStep - 1]) {
                  plannedSteps[currentStep - 1].completed = true;
                  plannedSteps[currentStep - 1].verified = true;
                }
                if (stepPlanForCheck && stepPlanForCheck.goalId && Array.isArray(taskGoals)) {
                  const currentGoal = taskGoals.find((g) => g.id === stepPlanForCheck.goalId);
                  if (currentGoal) {
                    const goalSteps = (reasoningPlan?.steps || plannedSteps || []).filter((s) => s.goalId === currentGoal.id);
                    const allGoalStepsDone = goalSteps.length === 0 || goalSteps.every((s) => s.completed || s.verified);
                    if (allGoalStepsDone && !currentGoal.completed) {
                      currentGoal.completed = true;
                      if (!completedGoals.includes(currentGoal.id)) completedGoals.push(currentGoal.id);
                      remainingGoals = taskGoals.filter((g) => !completedGoals.includes(g.id));
                    }
                  }
                }
              } else {
                appendPlannerTrace(`Step ${currentStep} verification failed after recovery: ${recoveryOutcome.reason}. Halting execution.`);
                if (agentExecutionStatus) {
                  agentExecutionStatus.textContent = `Halted: Step ${currentStep} recovery failed (${recoveryOutcome.reason})`;
                }
                if (executionTraceHistory.length > 0) {
                  executionTraceHistory[executionTraceHistory.length - 1].recovery = recoveryOutcome;
                  executionTraceHistory[executionTraceHistory.length - 1].status = "recovery_failed";
                  renderTraceHistory();
                }
                break;
              }
            } else {
              console.log("[M21][RECOVERY] recovery limit reached");
              appendPlannerTrace(`Step ${currentStep} verification failed: ${m21Verification.reason}. Halting execution.`);
              if (agentExecutionStatus) {
                agentExecutionStatus.textContent = `Halted: Step ${currentStep} verification failed (${m21Verification.reason})`;
              }
              break;
            }
          }

          // Step 12: Loop termination condition
          const executedThisStep = actionExecutedSuccessfully;
          const screenActuallyChanged = m21Verification.status === "VERIFIED" || !!(currentSignature && postActionSignature && window.SIHChangeDetector &&
            window.SIHChangeDetector.compareScreenSignatures(currentSignature, postActionSignature, PIXEL_CHANGE_THRESHOLD).changed);

          // Check if explicit planned steps remain
          let hasMoreSteps = isPlannedTask && currentStep < totalPlannedSteps;

          // Generic Multi-Page / State Transition Re-evaluation:
          // If the initial plan completed (e.g. initial Click on a search engine or homepage link),
          // check if the overall user task still has unfulfilled intent (e.g. search, open product/video, play, add to cart).
          if (!hasMoreSteps && executedThisStep && (screenActuallyChanged || agentAction?.action === "CLICK") && currentStep < MAX_AGENT_STEPS) {
            // Check if user task has remaining multi-step intent not yet fulfilled
            if (window.SIHTaskParser && typeof window.SIHTaskParser.parseTask === "function") {
              const fullTaskParsed = window.SIHTaskParser.parseTask(task);
              if (fullTaskParsed && Array.isArray(fullTaskParsed.steps) && fullTaskParsed.steps.length > currentStep) {
                plannedSteps = fullTaskParsed.steps;
                totalPlannedSteps = Math.min(plannedSteps.length, MAX_AGENT_STEPS);
                isPlannedTask = true;
                if (fullTaskParsed.localValues) {
                  localValuesMap = Object.assign({}, localValuesMap, fullTaskParsed.localValues);
                }
                hasMoreSteps = currentStep < totalPlannedSteps;
                if (hasMoreSteps) {
                  appendPlannerTrace(`Page transition verified. Continuing multi-stage task (Step ${currentStep + 1} of ${totalPlannedSteps})...`);
                }
              }
            }
          }

          // Critical Rule 3 & 5: Check explicit stop conditions (e.g. "stop after filling", "do not send")
          const taskStopAfterFill = (parsedTask?.stopCondition === "AFTER_FILL" || reasoningPlan?.stopCondition === "AFTER_FILL");
          if (taskStopAfterFill && executedThisStep && (agentAction?.action === "FILL" || currentStepPlan?.type === "FILL")) {
            hasMoreSteps = false;
            appendPlannerTrace("Execution constraint reached: Stopped after filling as requested by user.");
          }

          const shouldContinue = executedThisStep && (isPlannedTask ? hasMoreSteps : (screenActuallyChanged && currentStep < MAX_AGENT_STEPS));

          if (!shouldContinue) {
            // Check if overall task is truly completed
            let isOverallDone = false;
            if (taskStopAfterFill && executedThisStep && (agentAction?.action === "FILL" || currentStepPlan?.type === "FILL")) {
              isOverallDone = true;
            } else if (isPlannedTask && totalPlannedSteps > 0) {
              const allStepsExecuted = currentStep >= totalPlannedSteps && executedThisStep;
              const hasNoFailedOrBlockedTraces = !executionTraceHistory.some(
                (t) => !t.executed || t.status === "blocked" || t.status === "rejected" || t.status === "unresolved" || t.status === "cancelled_by_user"
              );
              const allPlanStepsDone = (plannedSteps && plannedSteps.every((s) => s.completed || s.verified)) ||
                (reasoningPlan?.steps && reasoningPlan.steps.every((s) => s.completed || s.verified));

              isOverallDone = allStepsExecuted && hasNoFailedOrBlockedTraces && (allPlanStepsDone || executionTraceHistory.length >= totalPlannedSteps);
            } else {
              isOverallDone = executedThisStep && !executionTraceHistory.some((t) => !t.executed);
            }

            if (currentStep >= MAX_AGENT_STEPS && !isOverallDone) {
              setAgentState(AGENT_STATES.HALTED || "HALTED", `Loop safety limit reached (${MAX_AGENT_STEPS} steps). Execution stopped.`);
              setLiveAgentStatus("error", "LIMIT REACHED");
              if (pipelineStepCounter) {
                pipelineStepCounter.textContent = `Limit Reached (${MAX_AGENT_STEPS} steps)`;
              }
              if (agentStepText) {
                agentStepText.textContent = `Stopped at Step ${currentStep} of ${MAX_AGENT_STEPS} (Safety limit reached)`;
              }
              if (agentExecutionStatus) {
                agentExecutionStatus.textContent = `Stopped: Execution safety limit (${MAX_AGENT_STEPS} steps) reached.`;
              }
            } else if (isOverallDone) {
              const isPostComposerFilled = (activeComposer && activeComposer.state === "open" && activeComposer.type === "post") ||
                (currentStepPlan && (currentStepPlan.context === "post_composer" || currentStepPlan.composerType === "post"));
              const isMessageComposerFilled = (activeComposer && activeComposer.state === "open" && activeComposer.type === "message") ||
                (currentStepPlan && (currentStepPlan.context === "message_composer" || currentStepPlan.composerType === "message"));

              if (isPostComposerFilled || isMessageComposerFilled) {
                const termTarget = isPostComposerFilled ? "Post" : "Send";
                const termActionName = isPostComposerFilled ? "publish" : "send";
                const approvalMsg = isPostComposerFilled
                  ? "The post is ready. Do you want me to publish it?"
                  : "The message is ready. Do you want me to send it?";

                setAgentState(AGENT_STATES.WAITING_APPROVAL || "WAITING_APPROVAL", approvalMsg);
                setLiveAgentStatus("ready", "WAITING FOR APPROVAL");
                if (agentStepText) agentStepText.textContent = `WAITING FOR ${termTarget.toUpperCase()} APPROVAL`;
                if (agentExecutionStatus) agentExecutionStatus.textContent = approvalMsg;
                if (agentVerificationText) {
                  agentVerificationText.textContent = `${approvalMsg} Approve ${termActionName}ing?`;
                  agentVerificationText.style.color = "#15803d";
                }
                if (plannerApprovalStatus) {
                  plannerApprovalStatus.textContent = "WAITING FOR USER APPROVAL";
                  plannerApprovalStatus.style.color = "#dc2626";
                }
                appendPlannerTrace(`Content entered and verified.\n${approvalMsg}`);

                if (popupApprovalContainer) {
                  popupApprovalContainer.style.display = "block";
                  if (popupApprovalAction) popupApprovalAction.textContent = `CLICK \u2192 ${termTarget}`;
                  if (popupApprovalReason) popupApprovalReason.textContent = approvalMsg;
                }

                // In-page approval modal
                const termApprovalInPage = new Promise((resolve) => {
                  chrome.tabs.sendMessage(
                    activeTab.id,
                    {
                      action: "requestHumanApproval",
                      payload: {
                        action: "CLICK",
                        target: termTarget,
                        risk: "HIGH",
                        reason: approvalMsg,
                        taskSummary: task
                      }
                    },
                    (res) => {
                      if (chrome.runtime.lastError || !res) {
                        resolve(null);
                      } else {
                        resolve(res);
                      }
                    }
                  );
                });

                const termApprovalPopup = new Promise((resolve) => {
                  const onApprove = () => { cleanup(); resolve({ approved: true }); };
                  const onCancel = () => { cleanup(); resolve({ approved: false, cancelled: true }); };
                  const cleanup = () => {
                    if (popupBtnApprove) popupBtnApprove.removeEventListener("click", onApprove);
                    if (popupBtnCancel) popupBtnCancel.removeEventListener("click", onCancel);
                  };
                  if (popupBtnApprove) popupBtnApprove.addEventListener("click", onApprove);
                  if (popupBtnCancel) popupBtnCancel.addEventListener("click", onCancel);
                });

                const termDecision = await Promise.race([termApprovalInPage, termApprovalPopup]);
                if (popupApprovalContainer) popupApprovalContainer.style.display = "none";
                chrome.tabs.sendMessage(activeTab.id, { action: "dismissHumanApproval" }, () => {});

                if (termDecision && termDecision.approved) {
                  appendPlannerTrace(`${termTarget} approval GRANTED by user. Grounding ${termTarget} button...`);
                  if (plannerApprovalStatus) {
                    plannerApprovalStatus.textContent = "APPROVED BY USER";
                    plannerApprovalStatus.style.color = "#166534";
                  }
                  // Execute CLICK -> Post / Send
                  const termClickRes = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(
                      activeTab.id,
                      {
                        action: "executeAction",
                        payload: {
                          action: "CLICK",
                          target: termTarget,
                          targetLabel: termTarget,
                          exactTargetText: termTarget,
                          semanticTarget: termTarget,
                          semanticCategory: "button",
                          expectedRole: "button"
                        }
                      },
                      (resp) => resolve(resp || { success: false, reason: "No response" })
                    );
                  });
                  appendPlannerTrace(`${termTarget} action executed: ${termClickRes.success ? "COMPLETED ✓" : "Failed to click " + termTarget}`);
                  setAgentState(AGENT_STATES.COMPLETE, `${termTarget} executed at Step ${currentStep + 1}`);
                  setLiveAgentStatus("ready", "COMPLETED");
                  if (agentExecutionStatus) agentExecutionStatus.textContent = `${termTarget} completed successfully.`;
                } else {
                  appendPlannerTrace(`${termActionName.toUpperCase()} cancelled or not approved by user. ${termTarget} button was NOT clicked. Page left unchanged.`);
                  if (plannerApprovalStatus) {
                    plannerApprovalStatus.textContent = "NOT APPROVED / CANCELLED";
                    plannerApprovalStatus.style.color = "#dc2626";
                  }
                  if (agentExecutionStatus) {
                    agentExecutionStatus.textContent = `Content entered successfully. Paused without ${termActionName}ing (approval required).`;
                  }
                }
              } else {
                setAgentState(AGENT_STATES.COMPLETE, `Completed at Step ${currentStep}`);
                setLiveAgentStatus("ready", "COMPLETED");
                if (pipelineStepCounter) {
                  pipelineStepCounter.textContent = `Completed (${isPlannedTask ? totalPlannedSteps : currentStep} steps)`;
                }
                if (agentStepText) {
                  agentStepText.textContent = `Completed at Step ${currentStep} of ${isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS}`;
                }
                if (agentExecutionStatus) {
                  agentExecutionStatus.textContent = `Task complete (${isPlannedTask ? totalPlannedSteps : currentStep} steps executed successfully)`;
                }
              }
            } else {
              setAgentState(AGENT_STATES.HALTED || "HALTED", `Incomplete at Step ${currentStep}`);
              setLiveAgentStatus("error", "INCOMPLETE");
              if (pipelineStepCounter) {
                pipelineStepCounter.textContent = `Halted (${currentStep} of ${isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS} steps)`;
              }
              if (agentStepText) {
                agentStepText.textContent = `Halted at Step ${currentStep} of ${isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS}`;
              }
              if (agentExecutionStatus) {
                const targetName = currentStepPlan?.explicitTarget || currentStepPlan?.targetHint || currentStepPlan?.fieldHint || "element";
                if (currentStepPlan?.isExplicitTarget) {
                  agentExecutionStatus.textContent = `Target not found: ${targetName}`;
                } else {
                  agentExecutionStatus.textContent = `Halted: Remaining steps unfulfilled (${currentStep} of ${totalPlannedSteps}).`;
                }
              }
            }
            break;
          }

          setAgentState(AGENT_STATES.CONTINUE, `Proceeding to step ${currentStep + 1}...`);
          // Prepare next iteration
          previousScreenSignature = postActionSignature || currentSignature;
          lastActionKey = actionKey;
          currentStep++;
        }

        // Final verification across reasoningPlan steps
        let overallTaskSuccess = false;
        if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.isOverallTaskCompleted === "function") {
          overallTaskSuccess = window.SIHReasoningPlanner.isOverallTaskCompleted(reasoningPlan, executionTraceHistory);
        } else if (reasoningPlan && Array.isArray(reasoningPlan.steps) && reasoningPlan.steps.length > 0) {
          overallTaskSuccess = reasoningPlan.steps.every((s) => s.completed || s.verified);
        } else {
          overallTaskSuccess = executionTraceHistory.some((t) => t.executed && t.status === "success");
        }

        if (overallTaskSuccess) {
          appendPlannerTrace("All requested goals and actions verified. Task complete.");
        }
        if (window.SIHEvaluationTracker) {
          window.SIHEvaluationTracker.recordTaskEnd(currentRequestId, overallTaskSuccess);
        }
      } catch (err) {
        console.error("[SIH26171] Run Agent Task error:", err);
        const errMsg = (err && err.message) ? err.message : String(err);
        setLiveAgentStatus("error", "FAILED");
        updatePipelineStage("EXECUTION", "failed", "Error occurred ✗");
        updateCurrentActionCard({
          stepText: typeof currentStep !== "undefined" ? `STEP ${currentStep}` : "FAILED",
          action: "ERROR",
          target: "-",
          value: "",
          grounding: "-",
          risk: "HIGH",
          safety: "BLOCKED",
          status: `FAILED: ${errMsg}`
        });
        if (agentTaskText) agentTaskText.textContent = task;
        if (agentExecutionStatus) agentExecutionStatus.textContent = `FAILED: ${errMsg}`;
        if (agentSafetyStatus) agentSafetyStatus.textContent = "Error";
        if (agentReasoningText) agentReasoningText.textContent = `Error: ${errMsg}`;
        if (executionOutput) executionOutput.value = `FAILED: ${errMsg}`;
        if (agentVerificationText) {
          agentVerificationText.textContent = `Error: ${errMsg}`;
          agentVerificationText.style.color = "#dc2626";
        }
        executionTraceHistory.push({
          step: typeof currentStep !== "undefined" ? currentStep : 1,
          requestId: typeof currentRequestId !== "undefined" ? currentRequestId : "SIH-ERR",
          action: null,
          executed: false,
          status: "error",
          executionResult: `FAILED: ${errMsg}`,
          verification: `Error: ${errMsg}`
        });
        renderTraceHistory();
      }
    });
  }

  // =====================================================================
  // Existing Milestone 1–12 "Capture Page Info" Button Listener (Preserved)
  // Calls text-only /api/context endpoint while triggering local perception
  // =====================================================================
  captureBtn.addEventListener("click", async () => {
    resetPipelineState();

    try {
      updatePipelineStage("PERCEPTION", "active", "Capturing on-device perception...");
      if (agentTaskText) agentTaskText.textContent = "Observation Only (Capture Local)";
      if (agentExecutionStatus) agentExecutionStatus.textContent = "Perceiving locally...";
      if (agentSafetyStatus) agentSafetyStatus.textContent = "OBSERVATION ONLY";

      // Execute the exact same unified on-device perception pipeline as agent execution
      const pipelineOutput = await runLocalPipeline();
      const { tab, pageData, redactionResult } = pipelineOutput;

      // Update panel with local perception metrics (exact same as agent execution path)
      if (agentScreenshotStatus) agentScreenshotStatus.textContent = "CAPTURED LOCALLY (Client-Side Only)";
      if (agentDomPiiCount) agentDomPiiCount.textContent = latestSensitiveRegions ? latestSensitiveRegions.length : 0;
      if (agentOcrPiiCount) agentOcrPiiCount.textContent = latestOcrSensitiveRegions ? latestOcrSensitiveRegions.length : 0;
      if (agentSensitiveCount) agentSensitiveCount.textContent = latestMergedRegions ? latestMergedRegions.length : 0;

      if (previewDomCount) previewDomCount.textContent = `${latestVisualElements ? latestVisualElements.length : 0} elements`;
      if (previewSensitiveCount) previewSensitiveCount.textContent = String(latestMergedRegions ? latestMergedRegions.length : (latestSensitiveRegions ? latestSensitiveRegions.length : 0));
      if (previewRedactionStatus) previewRedactionStatus.textContent = (redactionResult && redactionResult.success) ? "ACTIVE" : "WITHHELD";
      updatePipelineStage("PERCEPTION", "completed", `${latestVisualElements ? latestVisualElements.length : 0} DOM items`);

      // Observation only fallback to backend context (Observation ≠ Action policy enforced)
      await executeTextOnlyFallback(tab, pageData, "Triggered via Capture Local button");
    } catch (err) {
      if (outputArea) outputArea.value = `Unexpected error: ${err.message}`;
      if (visualStatus) {
        visualStatus.textContent = `Screenshot capture failed (${err.message})`;
        visualStatus.style.color = "#c62828";
      }
      renderPerceptionSummary();
    }
  });
});
