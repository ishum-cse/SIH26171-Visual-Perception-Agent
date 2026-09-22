/**
 * background.js - Background Service Worker for Manifest V3
 * Milestone 7: Captures screenshot of the active visible tab on demand.
 * Milestone 24: Configures Chrome Side Panel for persistent agent UI.
 *
 * Security & Privacy:
 * Screenshot data is kept strictly local (client-side only).
 * It is never sent to the backend server or external services.
 */

// Configure Chrome Side Panel behavior on extension startup & installation
const configureSidePanel = () => {
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === "function") {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("[SIH26171] Failed to set sidePanel behavior:", error));
  }
};

// Immediate registration at worker start
configureSidePanel();

// Ensure registration on extension install / update
chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
});

// Fallback action click listener if openPanelOnActionClick is unavailable in browser environment
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (chrome.sidePanel && typeof chrome.sidePanel.open === "function") {
      try {
        if (tab?.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
      } catch (err) {
        console.warn("[SIH26171] Could not open side panel via action click fallback:", err);
      }
    }
  });
}

// Listen for messages from side panel, popup, or extension components
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureScreenshot") {
    // If a windowId is provided in the request, prioritize it; otherwise null (defaults to last focused window)
    const targetWinId = (typeof request.windowId === "number") ? request.windowId : null;

    chrome.tabs.captureVisibleTab(targetWinId, { format: "jpeg", quality: 60 }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        // Fallback: If capture with specific windowId failed or returned empty, retry with null
        if (targetWinId !== null) {
          chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (retryDataUrl) => {
            if (chrome.runtime.lastError || !retryDataUrl) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Capture blocked"
              });
            } else {
              sendResponse({
                success: true,
                dataUrl: retryDataUrl
              });
            }
          });
          return;
        }

        sendResponse({
          success: false,
          error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Failed to generate screenshot data URL"
        });
      } else {
        sendResponse({
          success: true,
          dataUrl: dataUrl
        });
      }
    });

    // Return true to indicate asynchronous response handling
    return true;
  }
});
