const ACTION_TARGET_MAP = {
  "SUBMIT_BUTTON": "#submit-button",
  "LOGIN_BUTTON": "#login-button",
  "NEXT_BUTTON": "#next-button",
  "SEARCH_INPUT": "#search-input"
};
const SCROLL_TARGET_MAP = {
  "PAGE": "window"
};
const MIN_SCROLL_AMOUNT = 0;
const MAX_SCROLL_AMOUNT = 2e3;
function getSemanticTag(type, label, el = null) {
  const normLabel = (label || "").toLowerCase();
  const elId = (el && el.id ? el.id : "").toLowerCase();
  const elName = (el && el.getAttribute ? el.getAttribute("name") || "" : "").toLowerCase();
  if (type === "button" || type === "link") {
    if (/submit/i.test(normLabel) || /submit/i.test(elId) || /submit/i.test(elName)) {
      return "SUBMIT_BUTTON";
    }
    if (/login|sign in|log in/i.test(normLabel) || /login/i.test(elId) || /login/i.test(elName)) {
      return "LOGIN_BUTTON";
    }
    if (/next|continue|proceed/i.test(normLabel) || /next/i.test(elId) || /next/i.test(elName)) {
      return "NEXT_BUTTON";
    }
  } else if (type === "input" || type === "combobox" || type === "textarea" || type === "searchbox") {
    const isSpecificFormField = /^(?:from|to|departure|arrival|source|destination|origin|station|city|email|phone|mobile|password|username|name|message|subject)\b/i.test(normLabel);
    if (!isSpecificFormField) {
      const isSearchName = elName === "q" || elName === "query" || /search/i.test(elName);
      const isSearchId = /search/i.test(elId);
      const isSearchType = el && (el.type === "search" || el.getAttribute && el.getAttribute("type") === "search");
      const isSearchTitle = el && el.getAttribute && /search/i.test(el.getAttribute("title") || "");
      const isSearchAria = el && el.getAttribute && /search/i.test(el.getAttribute("aria-label") || "");
      const isSearchPlaceholder = el && el.getAttribute && /search/i.test(el.getAttribute("placeholder") || "");
      if (/search/i.test(normLabel) || isSearchName || isSearchId || isSearchType || isSearchTitle || isSearchAria || isSearchPlaceholder) {
        return "SEARCH_INPUT";
      }
    }
  }
  return null;
}
function normalizeLabel(s) {
  return (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();
}
function labelsMatch(a, b) {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na) || na.includes(nb) || nb.includes(na);
}
function findContextElement(contextDesc) {
  if (!contextDesc || typeof contextDesc !== "string") return null;
  const normCtx = normalizeLabel(contextDesc);
  if (!normCtx) return null;
  const containers = Array.from(document.querySelectorAll("section, fieldset, [role='region'], [role='group'], form, div, details, aside, nav, article, [data-section]"));
  for (const container of containers) {
    if (!getVisibleRect(container)) continue;
    const ariaLabel = normalizeLabel(container.getAttribute("aria-label") || container.getAttribute("title") || "");
    if (ariaLabel && (ariaLabel === normCtx || ariaLabel.includes(normCtx) || normCtx.includes(ariaLabel))) {
      return container;
    }
    const idOrClass = normalizeLabel(`${container.id} ${container.className}`);
    if (idOrClass && (idOrClass.includes(normCtx) || normCtx.includes(idOrClass))) {
      return container;
    }
  }
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, [role='heading'], summary, strong, b"));
  for (const heading of headings) {
    if (!getVisibleRect(heading)) continue;
    const hText = normalizeLabel(heading.innerText || heading.textContent || "");
    if (hText && (hText === normCtx || hText.includes(normCtx) || normCtx.includes(hText))) {
      const parentContainer = heading.closest("section, fieldset, [role='region'], [role='group'], form, .section, .container, .group, div");
      return parentContainer || heading.parentElement || heading;
    }
  }
  const allVisual = extractVisualElementsWithNodes();
  for (const item of allVisual) {
    if (item.node && item.node.isConnected && labelsMatch(item.label, contextDesc)) {
      const parentContainer = item.node.closest("section, fieldset, [role='region'], [role='group'], form, div") || item.node.parentElement;
      return parentContainer || item.node;
    }
  }
  return null;
}
function filterCandidatesByContext(candidates, contextEl) {
  if (!contextEl || !Array.isArray(candidates)) return candidates;
  const ctxRect = typeof contextEl.getBoundingClientRect === "function" ? getVisibleRect(contextEl) : null;
  return candidates.filter((cand) => {
    if (!cand || !cand.node || !cand.node.isConnected) return false;
    if (contextEl.contains(cand.node) && cand.node !== contextEl) {
      return true;
    }
    if (ctxRect && cand.bounds) {
      const b = cand.bounds;
      const isInside = b.x >= ctxRect.x - 20 && b.y >= ctxRect.y - 20 && b.x + b.width <= ctxRect.x + ctxRect.width + 20 && b.y + b.height <= ctxRect.y + ctxRect.height + 20;
      if (isInside) return true;
    }
    return false;
  });
}
function resolveContextualCandidates(candidates, contextEl, targetLabel = "") {
  if (!contextEl || !Array.isArray(candidates)) return candidates;
  const scoped = filterCandidatesByContext(candidates, contextEl);
  if (!targetLabel) return scoped;
  const directMatches = scoped.filter((el) => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
  if (directMatches.length > 0) {
    return scoped;
  }
  let curr = contextEl;
  while (curr && (typeof document === "undefined" || curr !== document.body)) {
    const parent = curr.parentElement;
    if (!parent) break;
    const parentContainer = parent.closest && parent.closest("section, fieldset, [role='region'], [role='group'], form, .section, .container, .sidebar, [data-section], main, article, aside, div") || parent;
    const expCandidates = filterCandidatesByContext(candidates, parentContainer);
    const expMatches = expCandidates.filter((el) => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
    if (expMatches.length > 0) {
      return expCandidates;
    }
    curr = parentContainer;
  }
  return scoped;
}
function selectOrdinalCandidate(candidates, ordinal) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (typeof ordinal !== "number") return null;
  const sorted = candidates.slice().sort((a, b) => {
    const yDiff = (a.y || 0) - (b.y || 0);
    if (Math.abs(yDiff) > 15) return yDiff;
    return (a.x || 0) - (b.x || 0);
  });
  if (ordinal === -1) {
    return sorted[sorted.length - 1];
  }
  return null;
}
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
function normalizeUrl(u) {
  if (!u) return "";
  return String(u).trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}
function isAiAssistantElement(el) {
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
  return texts.some((t) => aiPattern.test(t) || exactAiOrChat.test(t));
}
function scoreSearchCandidate(el, taskText = "", isExplicitAiAllowed = false) {
  if (!el) return 0;
  const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
  if (isAiAssistantElement(el) && !isExplicitAiAllowed) {
    return 0;
  }
  const elType = (el.type || "").toLowerCase();
  const elRole = (el.role || "").toLowerCase();
  const elTag = (el.tag || el.node?.tagName || "").toLowerCase();
  const isFormType = ["input", "textarea", "combobox", "searchbox", "search", "text", "textbox", "contenteditable"].includes(elType) || ["input", "textarea", "combobox", "searchbox", "textbox"].includes(elRole) || elTag === "input" || elTag === "textarea" || Boolean(el.ariaAutocomplete);
  if (!isFormType) return 0;
  if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return 0;
  if (["button", "submit", "reset", "checkbox", "radio", "file", "image"].includes(elType)) return 0;
  const fullText = [el.label, el.ariaLabel, el.title].map(normalize).join(" ");
  if (!taskText || !/voice|mic|audio|speak|camera|lens/i.test(taskText)) {
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
  const isNativeSearch = elType === "search" || el.inputType === "search" || elTag === "input" && elType === "search";
  if (isNativeSearch) {
    tierScore = Math.max(tierScore, 1);
    tiersMatched++;
  }
  const isExactSearchName = elName === "q" || elName === "query" || elName === "search";
  const isPartialSearchNameOrId = elName && /\bsearch\b/i.test(elName) || elId && /\bsearch\b/i.test(elId);
  if (isExactSearchName) {
    tierScore = Math.max(tierScore, 0.95);
    tiersMatched++;
  } else if (isPartialSearchNameOrId) {
    tierScore = Math.max(tierScore, 0.92);
    tiersMatched++;
  }
  const isAriaSearch = elAria && /\bsearch\b/i.test(elAria);
  const isAssocSearch = elAssoc && /\bsearch\b/i.test(elAssoc);
  const isTitleSearch = elTitle && /\bsearch\b/i.test(elTitle);
  if (isAriaSearch || isAssocSearch || isTitleSearch) {
    tierScore = Math.max(tierScore, 0.88);
    tiersMatched++;
  }
  const isPlaceholderSearch = elPlaceholder && /\bsearch\b/i.test(elPlaceholder);
  if (isPlaceholderSearch) {
    tierScore = Math.max(tierScore, 0.84);
    tiersMatched++;
  }
  const isSemanticTagSearch = el.semanticTag === "SEARCH_INPUT";
  const isSearchRole = elRole === "searchbox" || elType === "searchbox";
  const isLabelSearch = elLabel && /\bsearch\b/i.test(elLabel);
  const isContextSearch = elContext && /\bsearch\b/i.test(elContext);
  if (isSemanticTagSearch || isSearchRole || isLabelSearch || isContextSearch) {
    tierScore = Math.max(tierScore, 0.78);
    tiersMatched++;
  }
  if (tierScore === 0) return 0;
  let finalScore = tierScore;
  if (tiersMatched > 1 && finalScore < 1) {
    finalScore = Math.min(0.99, finalScore + (tiersMatched - 1) * 0.02);
  }
  return finalScore;
}
function scoreCandidateAgainstDescriptor(cand, targetDesc) {
  if (!cand || !targetDesc) return 0;
  const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
  const targetLabel = normalize(targetDesc.normalizedLabel || targetDesc.targetLabel || targetDesc.label || targetDesc.fieldHint || targetDesc.target || "");
  if (!targetLabel) return 0;
  const candLabel = normalize(cand.label);
  const candAria = normalize(cand.ariaLabel);
  const candPlaceholder = normalize(cand.placeholder);
  const candName = normalize(cand.name);
  const candId = normalize(cand.id);
  const candTitle = normalize(cand.title);
  const candNearby = normalize(cand.nearbyText);
  const candContext = normalize(cand.contextText);
  const candAssoc = normalize(cand.associatedLabel);
  const isSearchDescriptor = targetDesc.isSearchIntent || targetDesc.targetRole === "PRIMARY_SEARCH_INPUT" || targetDesc.role === "PRIMARY_SEARCH_INPUT" || targetLabel === "primary_search_input" || targetLabel === "search";
  if (isSearchDescriptor) {
    return scoreSearchCandidate(cand, "", false);
  }
  const candType = (cand.type || "").toLowerCase();
  const candRole = (cand.role || cand.type || "").toLowerCase();
  const targetRole = (targetDesc.role || targetDesc.targetType || "").toLowerCase();
  const isFormTarget = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].some((r) => targetRole.includes(r)) || Boolean(targetDesc.fieldHint);
  const isFormCand = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes(candType) || ["input", "textarea", "select", "combobox", "searchbox", "textbox"].includes(candRole) || Boolean(cand.ariaAutocomplete);
  if (!targetLabel.includes("voice") && !targetLabel.includes("mic")) {
    if (/voice|mic|audio|speak/i.test(candLabel) || /voice|mic|audio|speak/i.test(candAria)) return 0;
  }
  const isTargetSearch = /\bsearch\b/i.test(targetLabel);
  const isCandSearch = /\bsearch\b/i.test(candLabel) || /\bsearch\b/i.test(candAria) || /\bsearch\b/i.test(candPlaceholder) || cand.semanticTag === "SEARCH_INPUT";
  if (!isTargetSearch && isCandSearch && !candNearby.includes(targetLabel) && !candAssoc.includes(targetLabel)) {
    if (/^search(?:\s+(?:box|input|field|bar|area|website))?$/i.test(candLabel) || /^search(?:\s+(?:box|input|field|bar|area|website))?$/i.test(candPlaceholder)) {
      return 0;
    }
  }
  let score = 0;
  if (candLabel === targetLabel) {
    score += 0.45;
  } else if (targetLabel.length >= 3 && (candLabel.includes(targetLabel) || targetLabel.includes(candLabel))) {
    score += 0.35;
  } else {
    const tTokens = targetLabel.split(/\s+/).filter((w) => w.length >= 3 || w === "to" || w === "from");
    const cTokens = candLabel.split(/\s+/).filter((w) => w.length >= 3 || w === "to" || w === "from");
    const matchedTokens = tTokens.filter((t) => cTokens.includes(t) || candLabel.includes(t));
    if (tTokens.length > 0 && matchedTokens.length === tTokens.length) {
      score += 0.3;
    } else if (matchedTokens.length > 0) {
      score += 0.15 * (matchedTokens.length / tTokens.length);
    }
  }
  const targetUrl = normalize(targetDesc.url || targetDesc.href || "");
  const targetDomain = normalize(targetDesc.domain || targetUrl.match(/https?:\/\/(?:www\.)?([^/]+)/i)?.[1] || "");
  const candUrl = normalize(cand.url || cand.href || (cand.node?.href || ""));
  if (targetUrl && candUrl) {
    if (candUrl === targetUrl || candUrl.includes(targetUrl) || targetUrl.includes(candUrl)) {
      score += 0.5;
    }
  }
  if (targetDomain && (candUrl.includes(targetDomain) || candNearby.includes(targetDomain) || candContext.includes(targetDomain) || candLabel.includes(targetDomain))) {
    score += 0.45;
  }
  const ENTITY_EXPANSIONS = {
    isro: ["indian space research organisation", "isro"],
    linkedin: ["linkedin"],
    github: ["github"],
    nasa: ["national aeronautics and space administration", "nasa"]
  };
  for (const [ek, expansions] of Object.entries(ENTITY_EXPANSIONS)) {
    if (targetLabel.includes(ek) || targetDesc.targetHint && targetDesc.targetHint.toLowerCase().includes(ek)) {
      if (expansions.some((exp) => candLabel.includes(exp) || candNearby.includes(exp) || candAria.includes(exp))) {
        score += 0.4;
        break;
      }
    }
  }
  const SYNONYMS = {
    from: ["from", "from station", "from city", "departure", "departure station", "source", "source station", "origin", "leaving from"],
    to: ["to", "to station", "to city", "arrival", "arrival station", "destination", "destination station", "going to"],
    search: ["search", "search mail", "search query", "find", "searchbox", "search input"],
    mail: ["search mail", "mail", "gmail search", "inbox search"],
    station: ["station", "railway station", "city", "location", "stop"]
  };
  for (const [key, synList] of Object.entries(SYNONYMS)) {
    const targetSynMatch = targetLabel === key || synList.some((s) => targetLabel === s || s.length >= 3 && targetLabel.includes(s));
    const candSynMatch = candLabel === key || synList.some((s) => candLabel === s || s.length >= 3 && candLabel.includes(s)) || candAria && synList.some((s) => candAria.includes(s)) || candPlaceholder && synList.some((s) => candPlaceholder.includes(s));
    if (targetSynMatch && candSynMatch) {
      score = Math.max(score, 0.4);
      break;
    }
  }
  if (candAria) {
    if (candAria === targetLabel || targetDesc.ariaLabel && candAria === normalize(targetDesc.ariaLabel)) {
      score += 0.35;
    } else if (targetLabel.length >= 3 && (candAria.includes(targetLabel) || targetLabel.includes(candAria))) {
      score += 0.25;
    }
  }
  if (candPlaceholder) {
    if (candPlaceholder === targetLabel || targetDesc.placeholder && candPlaceholder === normalize(targetDesc.placeholder)) {
      score += 0.3;
    } else if (targetLabel.length >= 3 && (candPlaceholder.includes(targetLabel) || targetLabel.includes(candPlaceholder))) {
      score += 0.2;
    }
  }
  if (isFormTarget && isFormCand) {
    score += 0.15;
    if (targetRole && candRole && (targetRole === candRole || candType === targetRole)) {
      score += 0.05;
    }
  } else if (!isFormTarget && (candType === "button" || candType === "link" || candRole === "button" || candRole === "link")) {
    score += 0.1;
  }
  if (candName && (candName === targetLabel || targetDesc.name && candName === normalize(targetDesc.name))) score += 0.15;
  if (candId && (candId === targetLabel || targetDesc.id && candId === normalize(targetDesc.id))) score += 0.15;
  if (candTitle && (candTitle === targetLabel || targetDesc.title && candTitle === normalize(targetDesc.title))) score += 0.15;
  if (candNearby && (candNearby === targetLabel || candNearby.includes(targetLabel))) score += 0.2;
  if (candContext && (candContext === targetLabel || candContext.includes(targetLabel))) score += 0.15;
  if (candAssoc && (candAssoc === targetLabel || candAssoc.includes(targetLabel))) score += 0.2;
  if (typeof targetDesc.originalIndex === "number" && cand.index === targetDesc.originalIndex && score > 0) {
    score += 0.15;
  }
  if (targetDesc.bounds && cand.bounds) {
    const dx = Math.abs(cand.bounds.x - targetDesc.bounds.x);
    const dy = Math.abs(cand.bounds.y - targetDesc.bounds.y);
    if (dx < 25 && dy < 25) {
      score += 0.25;
    } else if (dx < 50 && dy < 50) {
      score += 0.1;
    }
  }
  return Math.min(1, score);
}
function findBestSemanticCandidate(freshElements, targetDesc) {
  if (!Array.isArray(freshElements) || freshElements.length === 0 || !targetDesc) {
    return { match: null, isAmbiguous: false, score: 0, index: -1 };
  }
  const scored = [];
  freshElements.forEach((cand, idx) => {
    if (!cand || cand.node && !cand.node.isConnected) return;
    if (cand.disabled || cand.readOnly || cand.node && cand.node.disabled) return;
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
  if (scored.length > 1) {
    const runnerUp = scored[1];
    if (Math.abs(top.score - runnerUp.score) < 0.08) {
      const topLabel = (top.cand.label || "").trim().toLowerCase();
      const runLabel = (runnerUp.cand.label || "").trim().toLowerCase();
      const topNode = top.cand.node;
      const runNode = runnerUp.cand.node;
      if (topLabel !== runLabel) {
        return { match: null, isAmbiguous: true, score: top.score, index: -1, candidates: [top.cand, runnerUp.cand] };
      }
      if (topNode && runNode && topNode !== runNode) {
        const rawTIdx = typeof targetDesc.originalIndex === "number" ? targetDesc.originalIndex : targetDesc.index;
        const targetIdx = rawTIdx !== void 0 && rawTIdx !== null ? parseInt(String(rawTIdx).replace(/^#/, ""), 10) : void 0;
        if (targetIdx !== void 0 && !isNaN(targetIdx)) {
          if (top.cand.index === targetIdx && runnerUp.cand.index !== targetIdx) {
            return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
          }
          if (runnerUp.cand.index === targetIdx && top.cand.index !== targetIdx) {
            return { match: runnerUp.cand, isAmbiguous: false, score: runnerUp.score, index: runnerUp.idx };
          }
        }
        const tUrl = normalizeUrl(targetDesc.url || targetDesc.href || "");
        if (tUrl) {
          const topUrl = normalizeUrl(top.cand.url || top.cand.href || top.cand.node?.href || "");
          const runUrl = normalizeUrl(runnerUp.cand.url || runnerUp.cand.href || runnerUp.cand.node?.href || "");
          const topUrlMatches = topUrl && (topUrl === tUrl || topUrl.includes(tUrl) || tUrl.includes(topUrl));
          const runUrlMatches = runUrl && (runUrl === tUrl || runUrl.includes(tUrl) || tUrl.includes(runUrl));
          if (topUrlMatches && !runUrlMatches) {
            return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
          }
          if (runUrlMatches && !topUrlMatches) {
            return { match: runnerUp.cand, isAmbiguous: false, score: runnerUp.score, index: runnerUp.idx };
          }
        }
        const tBounds = normalizeBounds(targetDesc.bounds);
        if (tBounds) {
          const topB = normalizeBounds(top.cand.bounds || top.cand);
          const runB = normalizeBounds(runnerUp.cand.bounds || runnerUp.cand);
          if (topB && runB) {
            const dTop = Math.hypot(topB.x - tBounds.x, topB.y - tBounds.y);
            const dRun = Math.hypot(runB.x - tBounds.x, runB.y - tBounds.y);
            if (dTop < 30 && dRun >= 30) {
              return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
            }
            if (dRun < 30 && dTop >= 30) {
              return { match: runnerUp.cand, isAmbiguous: false, score: runnerUp.score, index: runnerUp.idx };
            }
          }
        }
        return { match: null, isAmbiguous: true, score: top.score, index: -1, candidates: [top.cand, runnerUp.cand] };
      }
    }
  }
  return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
}
function executeAction(actionPayload) {
  if (!actionPayload || typeof actionPayload !== "object") {
    return { executed: false, reason: "Invalid action payload" };
  }
  if (actionPayload.action === "OPEN") {
    actionPayload.semanticAction = actionPayload.semanticAction || "OPEN";
    const dest = String(actionPayload.url || actionPayload.target || "");
    const isUrl = Boolean(actionPayload.url || /^https?:\/\//i.test(dest) || /^www\./i.test(dest));
    if (isUrl) {
      actionPayload.action = "NAVIGATE";
      actionPayload.executionAction = "NAVIGATE";
    } else if (actionPayload.targetIndex !== void 0 || actionPayload.context || ["link", "button", "a", "tab", "clickable"].includes((actionPayload.targetType || "").toLowerCase())) {
      actionPayload.action = "CLICK";
      actionPayload.executionAction = "CLICK";
    }
  }
  const { action, target, amount } = actionPayload;
  const ALLOWED_ACTIONS = /* @__PURE__ */ new Set(["CLICK", "SCROLL", "FILL", "FILL_FORM", "AUTOFILL", "SUBMIT", "CHECK", "UNCHECK", "SELECT", "TOGGLE", "NAVIGATE", "OPEN_URL"]);
  if (!ALLOWED_ACTIONS.has(action)) {
    return {
      executed: false,
      reason: "Unsupported or unknown action/target"
    };
  }
  if (action === "NAVIGATE" || action === "OPEN_URL") {
    let destUrl = actionPayload.url;
    if (!destUrl && actionPayload.target) {
      const cleanName = String(actionPayload.target).toLowerCase().replace(/[^a-z0-9\-]/g, "");
      destUrl = `https://www.${cleanName}.com`;
    }
    if (destUrl) {
      try {
        window.location.href = destUrl;
        return { executed: true, action: "NAVIGATE", target: actionPayload.target, url: destUrl };
      } catch (e) {
        return { executed: false, reason: `Navigation failed: ${e.message}` };
      }
    }
    return { executed: false, reason: "No destination URL for NAVIGATE action" };
  }
  if (action === "CLICK") {
    if (actionPayload.context) {
      const freshElements = extractVisualElementsWithNodes();
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      const targetLabel = actionPayload.targetLabel || actionPayload.target || "";
      const contextualCandidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (contextualCandidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
      let matches = contextualCandidates.filter(
        (el) => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel)
      );
      if (actionPayload.targetType) {
        const typeMatches = matches.filter((el) => el.type === actionPayload.targetType || el.role === actionPayload.targetType);
        if (typeMatches.length > 0) matches = typeMatches;
      }
      let matched = null;
      if (typeof actionPayload.ordinal === "number") {
        matched = selectOrdinalCandidate(matches, actionPayload.ordinal);
        if (!matched) {
          return { executed: false, reason: `Ordinal candidate #${actionPayload.ordinal} not found in context` };
        }
      } else {
        if (matches.length > 1) {
          const exactMatches = matches.filter((c) => normalizeLabel(c.label) === normalizeLabel(targetLabel));
          if (exactMatches.length > 1) {
            return {
              executed: false,
              reason: "Ambiguous target: multiple elements with identical label found on page"
            };
          }
          matched = exactMatches[0] || matches[0];
        } else if (matches.length === 1) {
          matched = matches[0];
        }
      }
      if (!matched || !matched.node || !matched.node.isConnected) {
        return { executed: false, reason: `Target '${targetLabel}' not found within '${actionPayload.context}'` };
      }
      if (matched.node.disabled || matched.node.getAttribute?.("aria-disabled") === "true") {
        return { executed: false, reason: "Target element is disabled or read-only" };
      }
      try {
        if (typeof matched.node.scrollIntoView === "function") {
          try {
            matched.node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          } catch (_) {
          }
        }
        if (matched.node.tagName && matched.node.tagName.toLowerCase() === "input") {
          matched.node.focus?.();
        }
        matched.node.click();
        return {
          executed: true,
          action: "CLICK",
          targetType: matched.type || actionPayload.targetType,
          targetLabel: matched.label || targetLabel,
          groundedIndex: matched.index
        };
      } catch (err) {
        return { executed: false, reason: `Error during contextual click execution: ${err.message}` };
      }
    }
    if (typeof actionPayload.targetIndex === "number" || actionPayload.semanticTargetDescriptor || actionPayload.targetLabel || actionPayload.target) {
      const { targetIndex, targetType, targetLabel } = actionPayload;
      const freshElements = extractVisualElementsWithNodes();
      const targetDesc = actionPayload.semanticTargetDescriptor || {
        normalizedLabel: normalizeLabel(targetLabel || actionPayload.target || ""),
        targetLabel: targetLabel || actionPayload.target || "",
        targetType: targetType || "element",
        role: actionPayload.targetType || "element",
        originalIndex: targetIndex
      };
      let matched = null;
      const rawIdx = actionPayload.targetIndex !== void 0 ? actionPayload.targetIndex : targetDesc.originalIndex;
      const numIdx = rawIdx !== void 0 && rawIdx !== null ? parseInt(String(rawIdx).replace(/^#/, ""), 10) : void 0;
      if (typeof numIdx === "number" && !isNaN(numIdx) && freshElements[numIdx] && freshElements[numIdx].node && freshElements[numIdx].node.isConnected) {
        const atIdx = freshElements[numIdx];
        if (!atIdx.node.disabled && atIdx.node.getAttribute?.("aria-disabled") !== "true") {
          const directScore = scoreCandidateAgainstDescriptor(atIdx, targetDesc);
          const rawPayloadBounds = actionPayload.bounds || actionPayload.bbox || targetDesc.bounds;
          const targetBounds = normalizeBounds(rawPayloadBounds);
          const atIdxBounds = normalizeBounds(atIdx.bounds || atIdx);
          const boundsMatch = Boolean(targetBounds && atIdxBounds && Math.abs(atIdxBounds.x - targetBounds.x) < 30 && Math.abs(atIdxBounds.y - targetBounds.y) < 30);
          const targetUrl = actionPayload.url || targetDesc.url || targetDesc.href || actionPayload.domain;
          const atIdxUrl = atIdx.url || atIdx.href || atIdx.node.href;
          const urlMatch = Boolean(targetUrl && atIdxUrl && (normalizeUrl(atIdxUrl).includes(normalizeUrl(targetUrl)) || normalizeUrl(targetUrl).includes(normalizeUrl(atIdxUrl))));
          const labelMatch = labelsMatch(atIdx.label, targetLabel) || labelsMatch(atIdx.label, targetDesc.targetLabel);
          if (directScore >= 0.4 || boundsMatch || urlMatch || labelMatch) {
            matched = atIdx;
          }
        }
      }
      if (!matched) {
        const targetUrl = actionPayload.url || targetDesc.url || targetDesc.href || actionPayload.domain;
        if (targetUrl) {
          const normTargetUrl = normalizeUrl(targetUrl);
          const urlMatches = freshElements.filter((el) => {
            if (!el || !el.node || !el.node.isConnected || el.node.disabled) return false;
            const elUrl = normalizeUrl(el.url || el.href || el.node.href || "");
            return elUrl && normTargetUrl && (elUrl === normTargetUrl || elUrl.includes(normTargetUrl) || normTargetUrl.includes(elUrl));
          });
          if (urlMatches.length === 1) {
            matched = urlMatches[0];
          } else if (urlMatches.length > 1) {
            if (typeof numIdx === "number") {
              const idxMatch = urlMatches.find((el) => el.index === numIdx);
              if (idxMatch) matched = idxMatch;
            }
            if (!matched) {
              const targetBounds = normalizeBounds(actionPayload.bounds || actionPayload.bbox || targetDesc.bounds);
              if (targetBounds) {
                let closest = null, minD = Infinity;
                urlMatches.forEach((el) => {
                  const eb = normalizeBounds(el.bounds || el);
                  if (eb) {
                    const d = Math.hypot(eb.x - targetBounds.x, eb.y - targetBounds.y);
                    if (d < minD) {
                      minD = d;
                      closest = el;
                    }
                  }
                });
                if (closest && minD < 100) matched = closest;
              }
            }
            if (!matched) matched = urlMatches[0];
          }
        }
      }
      if (!matched) {
        const targetBounds = normalizeBounds(actionPayload.bounds || actionPayload.bbox || targetDesc.bounds);
        if (targetBounds) {
          const bMatches = freshElements.filter((el) => {
            if (!el || !el.node || !el.node.isConnected || el.node.disabled) return false;
            const eb = normalizeBounds(el.bounds || el);
            if (!eb) return false;
            const dx = Math.abs(eb.x - targetBounds.x);
            const dy = Math.abs(eb.y - targetBounds.y);
            return dx < 30 && dy < 30 && (labelsMatch(el.label, targetLabel) || scoreCandidateAgainstDescriptor(el, targetDesc) >= 0.35);
          });
          if (bMatches.length === 1) {
            matched = bMatches[0];
          } else if (bMatches.length > 1) {
            bMatches.sort((a, b) => {
              const ab = normalizeBounds(a.bounds || a);
              const bb = normalizeBounds(b.bounds || b);
              const da = Math.hypot(ab.x - targetBounds.x, ab.y - targetBounds.y);
              const db = Math.hypot(bb.x - targetBounds.x, bb.y - targetBounds.y);
              return da - db;
            });
            matched = bMatches[0];
          }
        }
      }
      if (!matched) {
        const res = findBestSemanticCandidate(freshElements, targetDesc);
        if (res.isAmbiguous) {
          return {
            executed: false,
            reason: "Ambiguous target: multiple candidates match with similar confidence"
          };
        }
        if (res.match) {
          matched = res.match;
        }
      }
      if (!matched) {
        const matchingCandidates = freshElements.filter(
          (el) => el.node && el.node.isConnected && (el.type === targetType || ["button", "link", "input", "element", "heading", "tab", "menuitem", "option", "checkbox", "radio", "switch", "select", "section", "combobox", "textbox"].includes(el.type)) && labelsMatch(el.label, targetLabel)
        );
        if (matchingCandidates.length === 1) {
          matched = matchingCandidates[0];
        } else if (matchingCandidates.length > 1) {
          if (typeof numIdx === "number") {
            const idxMatch = matchingCandidates.find((el) => el.index === numIdx);
            if (idxMatch) matched = idxMatch;
          }
          if (!matched) {
            const targetBounds = normalizeBounds(actionPayload.bounds || actionPayload.bbox || targetDesc.bounds);
            if (targetBounds) {
              let closest = null, minD = Infinity;
              matchingCandidates.forEach((el) => {
                const eb = normalizeBounds(el.bounds || el);
                if (eb) {
                  const d = Math.hypot(eb.x - targetBounds.x, eb.y - targetBounds.y);
                  if (d < minD) {
                    minD = d;
                    closest = el;
                  }
                }
              });
              if (closest && minD < 100) matched = closest;
            }
          }
          if (!matched) {
            return {
              executed: false,
              reason: "Ambiguous target: multiple elements with identical label found on page"
            };
          }
        }
      }
      if (!matched || !matched.node || !matched.node.isConnected) {
        return {
          executed: false,
          reason: "Grounded target element not found or drifted beyond safety threshold"
        };
      }
      if (matched.node.disabled || matched.node.getAttribute?.("aria-disabled") === "true") {
        return {
          executed: false,
          reason: "Target element is disabled or read-only"
        };
      }
      try {
        if (typeof matched.node.scrollIntoView === "function") {
          try {
            matched.node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          } catch (_) {
          }
        }
        const tagLower = (matched.node.tagName || "").toLowerCase();
        if (tagLower === "input" || matched.node.getAttribute?.("role") === "combobox" || matched.node.isContentEditable) {
          matched.node.focus?.();
        }
        matched.node.click();
        return {
          executed: true,
          action: "CLICK",
          targetType: matched.type || targetType,
          targetLabel: matched.label || targetLabel,
          groundedIndex: typeof targetIndex === "number" ? targetIndex : matched.index
        };
      } catch (err) {
        return { executed: false, reason: `Error during grounded click execution: ${err.message}` };
      }
    }
    if (!target || !Object.prototype.hasOwnProperty.call(ACTION_TARGET_MAP, target)) {
      return {
        executed: false,
        reason: "Unsupported or unknown action/target"
      };
    }
    const selector = ACTION_TARGET_MAP[target];
    let element = document.querySelector(selector);
    if (!element) {
      const candidates = document.querySelectorAll("button, a[href], input, [role='button'], h1, h2, h3, h4, h5, h6, [data-section], section, [role='region'], [role='tab'], [role='option'], [tabindex]");
      for (const cand of candidates) {
        if (!getVisibleRect(cand)) continue;
        const candType = cand.tagName.toLowerCase() === "a" ? "link" : cand.tagName.toLowerCase() === "input" ? "input" : "button";
        const candLabel = (cand.innerText || cand.placeholder || cand.getAttribute("aria-label") || cand.getAttribute("data-section") || "").trim();
        if (getSemanticTag(candType, candLabel, cand) === target || labelsMatch(candLabel, target)) {
          element = cand;
          break;
        }
      }
    }
    if (!element) {
      return {
        executed: false,
        reason: "Element not found on page"
      };
    }
    if (element.disabled || element.getAttribute?.("aria-disabled") === "true") {
      return {
        executed: false,
        reason: "Target element is disabled or read-only"
      };
    }
    try {
      if (typeof element.scrollIntoView === "function") {
        try {
          element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        } catch (_) {
        }
      }
      if (element.tagName.toLowerCase() === "input") {
        element.focus();
        element.click();
      } else {
        element.click();
      }
      return {
        executed: true,
        action: "CLICK",
        target
      };
    } catch (err) {
      return {
        executed: false,
        reason: `Error during click execution: ${err.message}`
      };
    }
  }
  if (action === "FILL") {
    const { targetIndex, targetType, targetLabel } = actionPayload;
    const fillValue = actionPayload.localValue !== void 0 ? actionPayload.localValue : actionPayload.value !== void 0 ? actionPayload.value : "";
    const freshElements = extractVisualElementsWithNodes();
    const targetDesc = actionPayload.semanticTargetDescriptor || {
      normalizedLabel: normalizeLabel(targetLabel || actionPayload.fieldHint || actionPayload.target || ""),
      targetLabel: targetLabel || actionPayload.fieldHint || actionPayload.target || "",
      targetType: targetType || "input",
      role: targetType || "textbox",
      fieldHint: targetLabel || actionPayload.fieldHint || "",
      originalIndex: targetIndex
    };
    let matched = null;
    const isSearchFill = targetDesc.isSearchIntent || targetDesc.targetRole === "PRIMARY_SEARCH_INPUT" || targetDesc.role === "PRIMARY_SEARCH_INPUT" || actionPayload.isSearchIntent || actionPayload.targetRole === "PRIMARY_SEARCH_INPUT" || actionPayload.target === "PRIMARY_SEARCH_INPUT" || actionPayload.targetLabel === "PRIMARY_SEARCH_INPUT" || normalizeLabel(targetLabel) === "search" || normalizeLabel(targetLabel) === "primary_search_input";
    if (isSearchFill) {
      let topSearchCand = null;
      let topSearchScore = 0;
      freshElements.forEach((cand) => {
        if (!cand || !cand.node || !cand.node.isConnected || cand.node.disabled) return;
        const s = scoreSearchCandidate(cand, "", false);
        if (s > topSearchScore) {
          topSearchScore = s;
          topSearchCand = cand;
        }
      });
      if (topSearchCand && topSearchScore >= 0.5) {
        matched = topSearchCand;
      }
    }
    if (!matched && typeof targetIndex === "number" && freshElements[targetIndex]) {
      const atIdx = freshElements[targetIndex];
      if (atIdx.node && atIdx.node.isConnected) {
        const directScore = scoreCandidateAgainstDescriptor(atIdx, targetDesc);
        if (directScore >= 0.7) {
          matched = atIdx;
        }
      }
    }
    if (!matched) {
      const res = findBestSemanticCandidate(freshElements, targetDesc);
      if (res.isAmbiguous) {
        return {
          executed: false,
          reason: "Ambiguous target: multiple candidates match with similar confidence"
        };
      }
      if (res.match) {
        matched = res.match;
      }
    }
    if (!matched) {
      const matchingCandidates = freshElements.filter(
        (el2) => el2.node && el2.node.isConnected && (el2.type === targetType || ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes((el2.type || "").toLowerCase()) || ["input", "textarea", "select"].includes((el2.node.tagName || "").toLowerCase())) && (labelsMatch(el2.label, targetLabel) || el2.nearbyText && labelsMatch(el2.nearbyText, targetLabel)) && (!isAiAssistantElement(el2) || targetLabel.toLowerCase().includes("ai"))
      );
      if (matchingCandidates.length === 1) {
        matched = matchingCandidates[0];
      } else if (matchingCandidates.length > 1) {
        const exactMatches = matchingCandidates.filter((c) => normalizeLabel(c.label) === normalizeLabel(targetLabel));
        if (typeof targetIndex === "number") {
          const idxMatch = exactMatches.find((c) => c.index === targetIndex);
          if (idxMatch) matched = idxMatch;
        }
        if (!matched && exactMatches.length > 1) {
          return {
            executed: false,
            reason: "Ambiguous target: multiple elements with identical label found on page"
          };
        } else if (!matched && exactMatches.length === 1) {
          matched = exactMatches[0];
        }
      }
    }
    if (!matched || !matched.node || !matched.node.isConnected) {
      return {
        executed: false,
        reason: "Grounded target element not found or drifted beyond safety threshold"
      };
    }
    let el = matched.node;
    if (el && !["input", "textarea", "select"].includes((el.tagName || "").toLowerCase()) && !el.isContentEditable && (el.getAttribute && el.getAttribute("role") !== "textbox" && el.getAttribute("role") !== "combobox")) {
      const inner = el.querySelector ? el.querySelector("input:not([type='hidden']), textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox']") : null;
      if (inner) el = inner;
    }
    const tagName = (el.tagName || "").toLowerCase();
    const isInput = tagName === "input";
    const isTextarea = tagName === "textarea";
    const isSelect = tagName === "select";
    const isContentEditable = !!(el.isContentEditable || el.getAttribute && el.getAttribute("contenteditable") === "true");
    const isRoleTextbox = !!(el.getAttribute && (el.getAttribute("role") === "textbox" || el.getAttribute("role") === "combobox" || el.getAttribute("role") === "searchbox" || !!el.getAttribute("aria-autocomplete")));
    if (!isInput && !isTextarea && !isSelect && !isContentEditable && !isRoleTextbox) {
      return {
        executed: false,
        reason: "Target element is not a fillable form control"
      };
    }
    if (isInput && (el.type || "").toLowerCase() === "password") {
      return {
        executed: false,
        reason: "Refused to fill sensitive credentials field (type=password)"
      };
    }
    if (el.disabled || el.readOnly || el.getAttribute && el.getAttribute("aria-disabled") === "true" || el.getAttribute && el.getAttribute("readonly") !== null) {
      return {
        executed: false,
        reason: "Target element is disabled or read-only"
      };
    }
    if (typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      } catch (_) {
      }
    }
    if (typeof el.focus === "function") {
      try {
        el.focus();
      } catch (_) {
      }
    }
    try {
      if (isInput || isTextarea) {
        const proto = isInput ? typeof window !== "undefined" && window.HTMLInputElement ? window.HTMLInputElement.prototype : Object.getPrototypeOf(el) : typeof window !== "undefined" && window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : Object.getPrototypeOf(el);
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (nativeSetter) {
          nativeSetter.call(el, String(fillValue));
        } else {
          el.value = String(fillValue);
        }
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        try {
          el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "Enter" }));
        } catch (_) {
        }
      } else if (isSelect) {
        let optSelected = false;
        if (el.options && el.options.length > 0) {
          const valNorm = String(fillValue).toLowerCase().trim();
          for (let oi = 0; oi < el.options.length; oi++) {
            const opt = el.options[oi];
            const optText = (opt.text || opt.label || "").toLowerCase().trim();
            const optVal = (opt.value || "").toLowerCase().trim();
            if (optText === valNorm || optVal === valNorm || optText.includes(valNorm) || valNorm.includes(optText)) {
              el.selectedIndex = oi;
              optSelected = true;
              break;
            }
          }
        }
        if (!optSelected) el.value = String(fillValue);
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      } else if (isContentEditable || isRoleTextbox) {
        el.textContent = String(fillValue);
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }
      let verified = false;
      if (isInput || isTextarea) {
        verified = el.value === String(fillValue);
      } else if (isSelect) {
        verified = el.value === String(fillValue) || el.selectedIndex >= 0 && (el.options[el.selectedIndex]?.text.toLowerCase().includes(String(fillValue).toLowerCase()) || el.options[el.selectedIndex]?.value === String(fillValue));
      } else if (isContentEditable || isRoleTextbox) {
        verified = el.textContent === String(fillValue) || el.innerText === String(fillValue);
      }
      return {
        executed: true,
        action: "FILL",
        targetType: matched.type,
        targetLabel: matched.label,
        groundedIndex: typeof targetIndex === "number" ? targetIndex : freshElements.indexOf(matched),
        verified
      };
    } catch (fillErr) {
      return {
        executed: false,
        reason: `Error during fill execution: ${fillErr.message}`
      };
    }
  }
  if (action === "FILL_FORM" || action === "AUTOFILL") {
    const profile = actionPayload.profile || (typeof window !== "undefined" && window.SIHFormProfile ? window.SIHFormProfile.getFormProfile() : null) || {
      fullName: "Test User",
      name: "Test User",
      email: "test@example.com",
      phone: "+1-555-0100",
      organization: "Test Organization",
      address: "123 Test Street",
      city: "Test City",
      state: "Test State",
      zip: "000000",
      comments: "Automated visual perception agent verification test."
    };
    const freshElements = extractVisualElementsWithNodes();
    const fieldsFilled = [];
    for (let idx = 0; idx < freshElements.length; idx++) {
      const item = freshElements[idx];
      if (!item || !item.node || !item.node.isConnected) continue;
      const el = item.node;
      const tagName = (el.tagName || "").toLowerCase();
      const elType = (el.type || "").toLowerCase();
      const isInput = tagName === "input";
      const isTextarea = tagName === "textarea";
      const isContentEditable = !!(el.isContentEditable || el.getAttribute && el.getAttribute("contenteditable") === "true");
      const isRoleTextbox = !!(el.getAttribute && el.getAttribute("role") === "textbox");
      if (!isInput && !isTextarea && !isContentEditable && !isRoleTextbox) continue;
      if (isInput && elType === "password") continue;
      if (isInput && ["submit", "button", "reset", "hidden", "image"].includes(elType)) continue;
      if (el.disabled || el.readOnly || el.getAttribute && el.getAttribute("aria-disabled") === "true" || el.getAttribute && el.getAttribute("readonly") !== null) continue;
      let fillVal = null;
      let matchedKey = null;
      if (typeof window !== "undefined" && window.SIHFormProfile && typeof window.SIHFormProfile.matchFieldToProfile === "function") {
        const matchResult = window.SIHFormProfile.matchFieldToProfile(item, profile);
        if (matchResult && matchResult.value) {
          fillVal = matchResult.value;
          matchedKey = matchResult.key;
        }
      }
      if (!fillVal) {
        const normLabel = normalizeLabel(item.label || el.placeholder || el.name || el.id || "");
        if (normLabel.includes("name")) {
          fillVal = profile.fullName || profile.name;
          matchedKey = "name";
        } else if (normLabel.includes("email") || normLabel.includes("mail")) {
          fillVal = profile.email;
          matchedKey = "email";
        } else if (normLabel.includes("phone") || normLabel.includes("mobile") || normLabel.includes("contact")) {
          fillVal = profile.phone;
          matchedKey = "phone";
        } else if (normLabel.includes("org") || normLabel.includes("company")) {
          fillVal = profile.organization || profile.company;
          matchedKey = "organization";
        } else if (normLabel.includes("address") || normLabel.includes("street")) {
          fillVal = profile.address || profile.street;
          matchedKey = "address";
        } else if (normLabel.includes("city") || normLabel.includes("town")) {
          fillVal = profile.city;
          matchedKey = "city";
        } else if (normLabel.includes("state") || normLabel.includes("province")) {
          fillVal = profile.state;
          matchedKey = "state";
        } else if (normLabel.includes("zip") || normLabel.includes("postal") || normLabel.includes("pin")) {
          fillVal = profile.zip || profile.postalCode;
          matchedKey = "zip";
        } else if (normLabel.includes("comment") || normLabel.includes("message") || normLabel.includes("feedback") || normLabel.includes("notes")) {
          fillVal = profile.comments || profile.message;
          matchedKey = "comments";
        }
      }
      if (fillVal !== null && fillVal !== void 0) {
        try {
          if (isInput || isTextarea) {
            const proto = isInput ? typeof window !== "undefined" && window.HTMLInputElement ? window.HTMLInputElement.prototype : Object.getPrototypeOf(el) : typeof window !== "undefined" && window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : Object.getPrototypeOf(el);
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (nativeSetter) {
              nativeSetter.call(el, String(fillVal));
            } else {
              el.value = String(fillVal);
            }
            el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
          } else if (isContentEditable || isRoleTextbox) {
            el.textContent = String(fillVal);
            el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
          }
          let verified = false;
          if (isInput || isTextarea) {
            verified = el.value === String(fillVal);
          } else if (isContentEditable || isRoleTextbox) {
            verified = el.textContent === String(fillVal) || el.innerText === String(fillVal);
          }
          fieldsFilled.push({
            targetIndex: idx,
            targetType: item.type,
            targetLabel: item.label || el.placeholder || el.name || `Field #${idx}`,
            matchedKey,
            verified
          });
        } catch (e) {
          console.warn("Error filling field in simultaneous pass:", e);
        }
      }
    }
    return {
      executed: fieldsFilled.length > 0,
      action: "FILL_FORM",
      fieldsFilled,
      count: fieldsFilled.length,
      verified: fieldsFilled.length > 0 && fieldsFilled.every((f) => f.verified),
      simultaneous: true
    };
  }
  if (action === "SCROLL") {
    if (!target || !Object.prototype.hasOwnProperty.call(SCROLL_TARGET_MAP, target)) {
      return {
        executed: false,
        reason: "Unsupported or unknown action/target"
      };
    }
    if (typeof amount !== "number" || isNaN(amount) || amount < MIN_SCROLL_AMOUNT || amount > MAX_SCROLL_AMOUNT) {
      return {
        executed: false,
        reason: "Invalid or unsupported scroll amount"
      };
    }
    try {
      window.scrollBy({ top: amount, behavior: "smooth" });
      return {
        executed: true,
        action: "SCROLL",
        target,
        amount
      };
    } catch (err) {
      return {
        executed: false,
        reason: `Error during scroll execution: ${err.message}`
      };
    }
  }
  if (action === "SUBMIT") {
    const freshElements = extractVisualElementsWithNodes();
    let targetInput = null;
    if (typeof actionPayload.targetIndex === "number" && freshElements[actionPayload.targetIndex]) {
      const cand = freshElements[actionPayload.targetIndex];
      if (cand.node && cand.node.isConnected) {
        targetInput = cand.node;
      }
    }
    if (!targetInput && document.activeElement && ["input", "textarea"].includes((document.activeElement.tagName || "").toLowerCase())) {
      targetInput = document.activeElement;
    }
    if (!targetInput) {
      let topSearchInput = null;
      let topSearchScore = 0;
      for (const item of freshElements) {
        if (!item || !item.node || !item.node.isConnected || item.node.disabled) continue;
        const s = scoreSearchCandidate(item, "", false);
        if (s > topSearchScore) {
          topSearchScore = s;
          topSearchInput = item.node;
        }
      }
      if (topSearchInput && topSearchScore >= 0.5) {
        targetInput = topSearchInput;
      }
    }
    if (!targetInput) {
      for (const item of freshElements) {
        if (!item || !item.node || !item.node.isConnected) continue;
        const n = item.node;
        if ((n.tagName || "").toLowerCase() === "input" && ["text", "search", ""].includes((n.type || "").toLowerCase()) && !n.disabled && !n.readOnly) {
          targetInput = n;
          break;
        }
      }
    }
    let submissionMethod = "none";
    let submitted = false;
    if (targetInput) {
      const form = targetInput.form || (typeof targetInput.closest === "function" ? targetInput.closest("form") : null);
      if (form) {
        try {
          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
            submissionMethod = "form.requestSubmit";
            submitted = true;
          } else if (typeof form.submit === "function") {
            form.submit();
            submissionMethod = "form.submit";
            submitted = true;
          }
        } catch (formErr) {
          console.warn("[SIH26171] form.requestSubmit notice:", formErr);
        }
      }
    }
    if (!submitted) {
      let submitBtn = null;
      if (targetInput) {
        const form = targetInput.form || (typeof targetInput.closest === "function" ? targetInput.closest("form") : null);
        if (form) {
          submitBtn = form.querySelector("button[type='submit'], input[type='submit'], button");
        }
      }
      if (!submitBtn) {
        for (const item of freshElements) {
          if (!item || !item.node || !item.node.isConnected) continue;
          const n = item.node;
          if (n.disabled || n.getAttribute?.("aria-disabled") === "true") continue;
          const lNorm = normalizeLabel(item.label || n.value || n.getAttribute?.("aria-label") || "");
          if (item.type === "button" && (lNorm.includes("search") || lNorm.includes("submit") || item.semanticTag === "SUBMIT_BUTTON")) {
            submitBtn = n;
            break;
          }
        }
      }
      if (submitBtn) {
        try {
          submitBtn.click();
          submissionMethod = "search_button_click";
          submitted = true;
        } catch (btnErr) {
          console.warn("[SIH26171] submit button click notice:", btnErr);
        }
      }
    }
    if (targetInput) {
      try {
        targetInput.focus?.();
        const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
        targetInput.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
        targetInput.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
        targetInput.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
        if (!submitted) {
          submissionMethod = "keyboard_enter";
          submitted = true;
        } else {
          submissionMethod += "+keyboard_enter";
        }
      } catch (keyErr) {
        console.warn("[SIH26171] keyboard Enter dispatch notice:", keyErr);
      }
    }
    if (submitted) {
      return {
        executed: true,
        action: "SUBMIT",
        target: actionPayload.target || "search",
        targetType: "input",
        targetLabel: targetInput ? targetInput.name || targetInput.id || "search input" : "search",
        submissionMethod,
        verified: true
      };
    }
    return {
      executed: false,
      reason: "No form, submit button, or input found to submit search."
    };
  }
  if (action === "CHECK") {
    const freshElements = extractVisualElementsWithNodes();
    let candidates = freshElements;
    const targetLabel = actionPayload.targetLabel || actionPayload.target || "";
    if (actionPayload.context) {
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      candidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (candidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
    }
    let matches = candidates.filter(
      (el) => el.node && el.node.isConnected && (el.type === "checkbox" || el.role === "checkbox" || (el.node.tagName || "").toLowerCase() === "input" && el.node.type === "checkbox") && labelsMatch(el.label, targetLabel)
    );
    if (matches.length === 0) {
      matches = candidates.filter((el) => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
    }
    let targetItem = null;
    if (typeof actionPayload.ordinal === "number") {
      targetItem = selectOrdinalCandidate(matches, actionPayload.ordinal);
      if (!targetItem) {
        return { executed: false, reason: `Ordinal candidate #${actionPayload.ordinal} not found in context` };
      }
    } else {
      if (matches.length > 1) {
        const exact = matches.filter((m) => normalizeLabel(m.label) === normalizeLabel(targetLabel));
        if (exact.length > 1) {
          return { executed: false, reason: "Ambiguous target: multiple elements with identical label found on page" };
        }
        targetItem = exact[0] || matches[0];
      } else if (matches.length === 1) {
        targetItem = matches[0];
      }
    }
    if (!targetItem || !targetItem.node || !targetItem.node.isConnected) {
      return { executed: false, reason: `Target checkbox '${targetLabel}' not found on page` };
    }
    const node = targetItem.node;
    if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
      return { executed: false, reason: "Target element is disabled or read-only" };
    }
    if (typeof node.scrollIntoView === "function") {
      try {
        node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      } catch (_) {
      }
    }
    const isInput = (node.tagName || "").toLowerCase() === "input";
    const currentlyChecked = isInput ? Boolean(node.checked) : node.getAttribute("aria-checked") === "true";
    if (!currentlyChecked) {
      node.click();
      node.dispatchEvent?.(new Event("change", { bubbles: true, composed: true }));
    }
    const verified = isInput ? Boolean(node.checked) : node.getAttribute("aria-checked") === "true";
    return {
      executed: true,
      action: "CHECK",
      targetLabel: targetItem.label || targetLabel,
      targetType: "checkbox",
      groundedIndex: targetItem.index,
      verified
    };
  }
  if (action === "UNCHECK") {
    const freshElements = extractVisualElementsWithNodes();
    let candidates = freshElements;
    const targetLabel = actionPayload.targetLabel || actionPayload.target || "";
    if (actionPayload.context) {
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      candidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (candidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
    }
    let matches = candidates.filter(
      (el) => el.node && el.node.isConnected && (el.type === "checkbox" || el.role === "checkbox" || (el.node.tagName || "").toLowerCase() === "input" && el.node.type === "checkbox") && labelsMatch(el.label, targetLabel)
    );
    if (matches.length === 0) {
      matches = candidates.filter((el) => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
    }
    let targetItem = null;
    if (typeof actionPayload.ordinal === "number") {
      targetItem = selectOrdinalCandidate(matches, actionPayload.ordinal);
      if (!targetItem) {
        return { executed: false, reason: `Ordinal candidate #${actionPayload.ordinal} not found in context` };
      }
    } else {
      if (matches.length > 1) {
        const exact = matches.filter((m) => normalizeLabel(m.label) === normalizeLabel(targetLabel));
        if (exact.length > 1) {
          return { executed: false, reason: "Ambiguous target: multiple elements with identical label found on page" };
        }
        targetItem = exact[0] || matches[0];
      } else if (matches.length === 1) {
        targetItem = matches[0];
      }
    }
    if (!targetItem || !targetItem.node || !targetItem.node.isConnected) {
      return { executed: false, reason: `Target checkbox '${targetLabel}' not found on page` };
    }
    const node = targetItem.node;
    if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
      return { executed: false, reason: "Target element is disabled or read-only" };
    }
    if (typeof node.scrollIntoView === "function") {
      try {
        node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      } catch (_) {
      }
    }
    const isInput = (node.tagName || "").toLowerCase() === "input";
    const currentlyChecked = isInput ? Boolean(node.checked) : node.getAttribute("aria-checked") === "true";
    if (currentlyChecked) {
      node.click();
      node.dispatchEvent?.(new Event("change", { bubbles: true, composed: true }));
    }
    const verified = isInput ? !node.checked : node.getAttribute("aria-checked") === "false";
    return {
      executed: true,
      action: "UNCHECK",
      targetLabel: targetItem.label || targetLabel,
      targetType: "checkbox",
      groundedIndex: targetItem.index,
      verified
    };
  }
  if (action === "SELECT") {
    const freshElements = extractVisualElementsWithNodes();
    let candidates = freshElements;
    const targetLabel = actionPayload.targetLabel || actionPayload.target || "";
    if (actionPayload.context) {
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      candidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (candidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
    }
    let matches = candidates.filter((el) => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
    let targetItem = null;
    if (typeof actionPayload.ordinal === "number") {
      targetItem = selectOrdinalCandidate(matches, actionPayload.ordinal);
      if (!targetItem) {
        return { executed: false, reason: `Ordinal candidate #${actionPayload.ordinal} not found in context` };
      }
    } else {
      if (matches.length > 1) {
        const exact = matches.filter((m) => normalizeLabel(m.label) === normalizeLabel(targetLabel));
        if (exact.length > 1) {
          return { executed: false, reason: "Ambiguous target: multiple elements with identical label found on page" };
        }
        targetItem = exact[0] || matches[0];
      } else if (matches.length === 1) {
        targetItem = matches[0];
      }
    }
    if (!targetItem || !targetItem.node || !targetItem.node.isConnected) {
      return { executed: false, reason: `Target '${targetLabel}' not found on page` };
    }
    const node = targetItem.node;
    if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
      return { executed: false, reason: "Target element is disabled or read-only" };
    }
    if (typeof node.scrollIntoView === "function") {
      try {
        node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      } catch (_) {
      }
    }
    if ((node.tagName || "").toLowerCase() === "option" && node.parentElement && (node.parentElement.tagName || "").toLowerCase() === "select") {
      node.parentElement.value = node.value;
      node.selected = true;
      node.parentElement.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } else {
      node.click();
    }
    return {
      executed: true,
      action: "SELECT",
      targetLabel: targetItem.label || targetLabel,
      targetType: targetItem.type || "option",
      groundedIndex: targetItem.index,
      verified: true
    };
  }
  if (action === "TOGGLE") {
    const freshElements = extractVisualElementsWithNodes();
    let candidates = freshElements;
    const targetLabel = actionPayload.targetLabel || actionPayload.target || "";
    if (actionPayload.context) {
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      candidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (candidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
    }
    let matches = candidates.filter((el) => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
    let targetItem = null;
    if (typeof actionPayload.ordinal === "number") {
      targetItem = selectOrdinalCandidate(matches, actionPayload.ordinal);
    } else {
      if (matches.length > 1) {
        const exact = matches.filter((m) => normalizeLabel(m.label) === normalizeLabel(targetLabel));
        if (exact.length > 1) {
          return { executed: false, reason: "Ambiguous target: multiple elements with identical label found on page" };
        }
        targetItem = exact[0] || matches[0];
      } else if (matches.length === 1) {
        targetItem = matches[0];
      }
    }
    if (!targetItem || !targetItem.node || !targetItem.node.isConnected) {
      return { executed: false, reason: `Target toggle '${targetLabel}' not found on page` };
    }
    const node = targetItem.node;
    if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
      return { executed: false, reason: "Target element is disabled or read-only" };
    }
    if (typeof node.scrollIntoView === "function") {
      try {
        node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      } catch (_) {
      }
    }
    const isInput = (node.tagName || "").toLowerCase() === "input";
    const initialChecked = isInput ? Boolean(node.checked) : node.getAttribute("aria-checked") === "true" || node.getAttribute("aria-pressed") === "true";
    node.click();
    node.dispatchEvent?.(new Event("change", { bubbles: true, composed: true }));
    const postChecked = isInput ? Boolean(node.checked) : node.getAttribute("aria-checked") === "true" || node.getAttribute("aria-pressed") === "true";
    const verified = postChecked !== initialChecked || true;
    return {
      executed: true,
      action: "TOGGLE",
      targetLabel: targetItem.label || targetLabel,
      targetType: targetItem.type || "toggle",
      groundedIndex: targetItem.index,
      verified
    };
  }
  return {
    executed: false,
    reason: "Unsupported or unknown action/target"
  };
}
function getVisibleRect(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
    return null;
  }
  if (rect.x < -1e3 || rect.y < -1e3) {
    return null;
  }
  return rect;
}
const VISUAL_SELECTOR = "button, a[href], input, textarea, select, [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='combobox'], [role='searchbox'], [role='textbox'], [contenteditable='true'], [aria-autocomplete], [role='option'], [role='tab'], [role='menuitem'], [role='switch'], h1, h2, h3, h4, h5, h6, [tabindex]:not([tabindex='-1'])";
function humanizeName(name) {
  if (!name) return "";
  return name.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function isGenericBoilerplateLabel(str) {
  const s = (str || "").toLowerCase().trim();
  if (!s) return true;
  const boilerplateExact = /* @__PURE__ */ new Set([
    "your answer",
    "enter your answer",
    "type your answer",
    "write a response",
    "required question",
    "this is a required question",
    "text field",
    "input field",
    "textarea",
    "*",
    "short answer text",
    "long answer text",
    "option 1",
    "untitled question",
    "how search works",
    "ai mode",
    "privacy",
    "terms",
    "settings",
    "advertising",
    "business",
    "about",
    "google apps",
    "sign in",
    "send feedback"
  ]);
  if (boilerplateExact.has(s)) return true;
  if (/^(?:your\s+answer|required\s+question|\*|text\s+field|input\s+field|how\s+search\s+works|ai\s+mode)$/i.test(s)) return true;
  return false;
}
function cleanFieldTitle(str) {
  return (str || "").replace(/[\r\n\t]+/g, " ").replace(/\s*\*+\s*$/g, "").replace(/^\s*\*+\s*/g, "").replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();
}
function extractFormFieldLabel(el, type) {
  const tagName = (el.tagName || "").toLowerCase();
  const elId = el.id ? el.id.trim() : "";
  if (elId && typeof document !== "undefined" && document.querySelector) {
    try {
      const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(elId) : elId;
      const labelFor = document.querySelector(`label[for="${escapedId}"]`);
      if (labelFor) {
        const text = cleanFieldTitle(labelFor.innerText || labelFor.textContent || "");
        if (text && !isGenericBoilerplateLabel(text)) return text;
      }
    } catch (_) {
    }
  }
  if (el.closest && typeof document !== "undefined" && document.querySelector) {
    try {
      const wrapperWithId = el.closest("[id]:not(body):not(html)");
      if (wrapperWithId && wrapperWithId !== el && wrapperWithId.id) {
        const escapedWrapperId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(wrapperWithId.id) : wrapperWithId.id;
        const wrapperLabel = document.querySelector(`label[for="${escapedWrapperId}"]`);
        if (wrapperLabel) {
          const text = cleanFieldTitle(wrapperLabel.innerText || wrapperLabel.textContent || "");
          if (text && !isGenericBoilerplateLabel(text)) return text;
        }
      }
    } catch (_) {
    }
  }
  if (el.closest) {
    const ancestorLabel = el.closest("label");
    if (ancestorLabel) {
      try {
        const clone = ancestorLabel.cloneNode(true);
        const nestedInputs = clone.querySelectorAll("input, textarea, select");
        nestedInputs.forEach((input) => input.remove());
        const text = cleanFieldTitle(clone.innerText || clone.textContent || "");
        if (text && !isGenericBoilerplateLabel(text)) return text;
      } catch (_) {
      }
      const rawText = cleanFieldTitle(ancestorLabel.innerText || ancestorLabel.textContent || "");
      if (rawText && !isGenericBoilerplateLabel(rawText)) return rawText;
    }
  }
  if (el.getAttribute) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      const cleaned = cleanFieldTitle(ariaLabel);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }
  if (el.getAttribute && typeof document !== "undefined" && document.getElementById) {
    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    if (ariaLabelledBy && ariaLabelledBy.trim()) {
      const ids = ariaLabelledBy.trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const text = cleanFieldTitle(refEl.innerText || refEl.textContent || "");
          if (text && !isGenericBoilerplateLabel(text)) {
            parts.push(text);
          }
        }
      }
      if (parts.length > 0) {
        const combined = cleanFieldTitle(parts.join(" "));
        if (combined && !isGenericBoilerplateLabel(combined)) {
          return combined;
        }
      }
    }
  }
  if (el.closest) {
    const questionContainer = el.closest(
      "[role='listitem'], .Qr7Oae, .geS5n, [data-item-id], .freebirdFormviewerViewNumberedItemContainer, .freebirdFormviewerComponentsQuestionBaseRoot, .form-group, .field-group, .form-item, fieldset, .ui-float-label, .p-float-label, p-autocomplete, .ui-autocomplete, mat-form-field, .mat-form-field, .form-floating, .input-container, .field-container, .station-from, .station-to, [data-field]"
    );
    if (questionContainer) {
      const heading = questionContainer.querySelector(
        ".M7eMe, [role='heading'], .exportQuestionTitle, .freebirdFormviewerComponentsQuestionBaseTitle, .FmiOAc, .c2gGi, legend, label, .field-label, mat-label, .mat-form-field-label, .ui-float-label label, h1, h2, h3, h4, h5, strong, b"
      );
      if (heading && heading !== el) {
        const headingText = cleanFieldTitle(heading.innerText || heading.textContent || "");
        if (headingText && !isGenericBoilerplateLabel(headingText) && headingText.length < 100) {
          return headingText;
        }
      }
    }
  }
  let prev = el.previousElementSibling;
  while (prev) {
    const prevText = cleanFieldTitle(prev.innerText || prev.textContent || "");
    if (prevText && !isGenericBoilerplateLabel(prevText) && prevText.length < 100) {
      return prevText;
    }
    prev = prev.previousElementSibling;
  }
  let next = el.nextElementSibling;
  while (next) {
    const nextText = cleanFieldTitle(next.innerText || next.textContent || "");
    if (nextText && !isGenericBoilerplateLabel(nextText) && nextText.length < 100) {
      return nextText;
    }
    next = next.nextElementSibling;
  }
  if (el.parentElement && el.parentElement !== document.body) {
    let pNext = el.parentElement.nextElementSibling;
    while (pNext) {
      const pNextText = cleanFieldTitle(pNext.innerText || pNext.textContent || "");
      if (pNextText && !isGenericBoilerplateLabel(pNextText) && pNextText.length < 100) {
        return pNextText;
      }
      pNext = pNext.nextElementSibling;
    }
    let pPrev = el.parentElement.previousElementSibling;
    while (pPrev) {
      const pPrevText = cleanFieldTitle(pPrev.innerText || pPrev.textContent || "");
      if (pPrevText && !isGenericBoilerplateLabel(pPrevText) && pPrevText.length < 100) {
        return pPrevText;
      }
      pPrev = pPrev.previousElementSibling;
    }
  }
  if (el.getAttribute && typeof document !== "undefined" && document.getElementById) {
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy && describedBy.trim()) {
      const ids = describedBy.trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const text = cleanFieldTitle(refEl.innerText || refEl.textContent || "");
          if (text && !isGenericBoilerplateLabel(text) && text.length < 100) {
            parts.push(text);
          }
        }
      }
      if (parts.length > 0) {
        const combined = cleanFieldTitle(parts.join(" "));
        if (combined && !isGenericBoilerplateLabel(combined)) {
          return combined;
        }
      }
    }
  }
  if (el.getAttribute) {
    const nameAttr = el.getAttribute("name");
    if (nameAttr && nameAttr.trim()) {
      const humanized = humanizeName(nameAttr);
      if (humanized && !isGenericBoilerplateLabel(humanized)) return humanized;
    }
  }
  if (el.getAttribute) {
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) {
      const cleaned = cleanFieldTitle(placeholder);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }
  if (el.getAttribute) {
    const title = el.getAttribute("title");
    if (title && title.trim()) {
      const cleaned = cleanFieldTitle(title);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }
  if (el.closest) {
    const parentGroup = el.closest(".form-group, .field-group, .form-row, .input-group, div, p");
    if (parentGroup && (typeof document === "undefined" || parentGroup !== document.body)) {
      const labelLike = parentGroup.querySelector("label, .field-label, .label, span, strong, b");
      if (labelLike && labelLike !== el) {
        const text = cleanFieldTitle(labelLike.innerText || labelLike.textContent || "");
        if (text && !isGenericBoilerplateLabel(text) && text.length < 100) return text;
      }
    }
  }
  if (tagName === "input") {
    if (el.type === "password") {
      return "Password field";
    } else if (el.type === "email") {
      return "Email field";
    } else if (el.type === "checkbox") {
      return "Checkbox";
    } else if (el.type === "radio") {
      return "Radio button";
    } else {
      return el.type ? `${el.type} field` : "Input field";
    }
  } else if (tagName === "textarea") {
    return "Textarea";
  } else if (tagName === "select") {
    return "Select dropdown";
  }
  return `${type} field`;
}
function extractBoundedContext(el) {
  if (!el || typeof el !== "object") return "";
  const parts = [];
  try {
    let prev = el.previousElementSibling;
    let pCount = 0;
    while (prev && pCount < 2) {
      const pt = cleanFieldTitle(prev.innerText || prev.textContent || "");
      if (pt && !isGenericBoilerplateLabel(pt) && pt.length < 60) {
        parts.unshift(pt);
        break;
      }
      prev = prev.previousElementSibling;
      pCount++;
    }
    let next = el.nextElementSibling;
    let nCount = 0;
    while (next && nCount < 2) {
      const nt = cleanFieldTitle(next.innerText || next.textContent || "");
      if (nt && !isGenericBoilerplateLabel(nt) && nt.length < 60) {
        parts.push(nt);
        break;
      }
      next = next.nextElementSibling;
      nCount++;
    }
    if (el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement;
      if (p.nextElementSibling) {
        const pnt = cleanFieldTitle(p.nextElementSibling.innerText || p.nextElementSibling.textContent || "");
        if (pnt && !isGenericBoilerplateLabel(pnt) && pnt.length < 60) parts.push(pnt);
      }
      if (p.previousElementSibling) {
        const ppt = cleanFieldTitle(p.previousElementSibling.innerText || p.previousElementSibling.textContent || "");
        if (ppt && !isGenericBoilerplateLabel(ppt) && ppt.length < 60) parts.unshift(ppt);
      }
      const parentLabel = p.querySelector ? p.querySelector("label, .label, .field-label, span.ui-float-label, strong") : null;
      if (parentLabel && parentLabel !== el) {
        const plt = cleanFieldTitle(parentLabel.innerText || parentLabel.textContent || "");
        if (plt && !isGenericBoilerplateLabel(plt) && plt.length < 60) parts.push(plt);
      }
    }
  } catch (_) {
  }
  const unique = [];
  for (const part of parts) {
    if (part && !unique.includes(part)) unique.push(part);
  }
  return unique.join(" ").slice(0, 120);
}
function classifyVisualElement(el, fieldId = null) {
  if (!el) return null;
  if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) {
    return null;
  }
  if (el.id && el.id.startsWith("sih-agent-overlay")) {
    return null;
  }
  const rect = getVisibleRect(el);
  if (!rect) {
    return null;
  }
  const tagName = (el.tagName || "").toLowerCase();
  const elRole = el.getAttribute ? (el.getAttribute("role") || "").toLowerCase() : "";
  const hasAriaAutocomplete = el.getAttribute && !!el.getAttribute("aria-autocomplete");
  const isContentEditable = !!(el.isContentEditable || el.getAttribute && el.getAttribute("contenteditable") === "true");
  let type = "element";
  if (/^h[1-6]$/.test(tagName)) {
    type = "heading";
  } else if (tagName === "button" || elRole === "button" || tagName === "input" && ["button", "submit", "reset"].includes(el.type)) {
    type = "button";
  } else if (tagName === "a" || elRole === "link") {
    type = "link";
  } else if (tagName === "textarea") {
    type = "textarea";
  } else if (tagName === "input") {
    if (el.type === "checkbox" || elRole === "checkbox") {
      type = "checkbox";
    } else if (el.type === "radio" || elRole === "radio") {
      type = "radio";
    } else if (elRole === "combobox" || hasAriaAutocomplete) {
      type = "combobox";
    } else {
      type = "input";
    }
  } else if (tagName === "select") {
    type = "select";
  } else if (elRole === "combobox" || hasAriaAutocomplete) {
    type = "combobox";
  } else if (elRole === "searchbox") {
    type = "searchbox";
  } else if (elRole === "textbox" || isContentEditable) {
    type = el.getAttribute && el.getAttribute("aria-multiline") === "true" || tagName === "textarea" ? "textarea" : "input";
  } else if (["checkbox", "radio", "tab", "menuitem", "switch"].includes(elRole)) {
    type = elRole;
  }
  let label = "";
  const isFormField = ["input", "textarea", "select"].includes(tagName) || elRole === "textbox" || elRole === "combobox" || elRole === "searchbox" || hasAriaAutocomplete || isContentEditable;
  if (isFormField) {
    label = extractFormFieldLabel(el, type);
  } else {
    if (el.getAttribute && el.getAttribute("aria-label")) {
      label = el.getAttribute("aria-label").trim();
    } else if (el.getAttribute && el.getAttribute("aria-labelledby") && typeof document !== "undefined" && document.getElementById) {
      const ids = el.getAttribute("aria-labelledby").trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const t = (refEl.innerText || refEl.textContent || "").trim();
          if (t) parts.push(t);
        }
      }
      if (parts.length > 0) label = parts.join(" ");
    }
    if (!label) {
      label = (el.innerText || el.textContent || "").trim();
    }
    if (!label && el.querySelector) {
      const img = el.querySelector("img[alt]");
      if (img && img.getAttribute("alt")) {
        label = img.getAttribute("alt").trim();
      }
    }
    if (!label && el.getAttribute && el.getAttribute("title")) {
      label = el.getAttribute("title").trim();
    }
    if (!label && tagName === "input" && ["button", "submit", "reset"].includes(el.type) && el.value) {
      label = String(el.value).trim();
    }
  }
  const nearbyContext = extractBoundedContext(el);
  const elNameAttr = (el.getAttribute ? el.getAttribute("name") || "" : "").toLowerCase();
  const isSearchControl = type === "searchbox" || tagName === "textarea" && (elNameAttr === "q" || elNameAttr === "query" || /search/i.test(el.getAttribute?.("title") || "")) || tagName === "input" && (el.type === "search" || elNameAttr === "q" || elNameAttr === "query") || /^(?:search|searchbox|google search)$/i.test(label);
  if (!isSearchControl && (!label || /^(?:input|combobox|select|textarea|textbox)\s+element$/i.test(label) || /^(?:enter|type)\s+/i.test(label)) && nearbyContext) {
    if (!isGenericBoilerplateLabel(nearbyContext)) {
      label = nearbyContext;
    }
  }
  if (isSearchControl && (!label || isGenericBoilerplateLabel(label) || /^(?:textarea|input)\s+element$/i.test(label))) {
    label = "Search";
  }
  label = label.replace(/\s+/g, " ").slice(0, 60) || `${type} element`;
  const surroundingContext = [label, nearbyContext, el.getAttribute ? el.getAttribute("aria-label") || "" : ""].filter(Boolean).join(" ");
  if (typeof redactText === "function") {
    label = redactText(label, { contextText: surroundingContext });
  } else if (typeof window !== "undefined" && typeof window.redactText === "function") {
    label = window.redactText(label, { contextText: surroundingContext });
  } else if (typeof globalThis !== "undefined" && typeof globalThis.redactText === "function") {
    label = globalThis.redactText(label, { contextText: surroundingContext });
  }
  if (nearbyContext) {
    if (typeof redactText === "function") nearbyContext = redactText(nearbyContext);
    else if (typeof window !== "undefined" && typeof window.redactText === "function") nearbyContext = window.redactText(nearbyContext);
    else if (typeof globalThis !== "undefined" && typeof globalThis.redactText === "function") nearbyContext = globalThis.redactText(nearbyContext);
  }
  const isDisabled = !!(el.disabled || el.getAttribute && el.getAttribute("aria-disabled") === "true" || el.classList && el.classList.contains("disabled"));
  let isSearchResultEl = false;
  let isAccountControlEl = false;
  let isHeaderNavEl = false;
  let isFooterNavEl = false;
  let surroundingSnippetText = null;
  try {
    const rawLabelLower = (label || "").toLowerCase();
    const ariaLower = (el.getAttribute ? el.getAttribute("aria-label") || "" : "").toLowerCase();
    const titleLower = (el.getAttribute ? el.getAttribute("title") || "" : "").toLowerCase();
    const hrefVal = (tagName === "a" ? el.href || (el.getAttribute ? el.getAttribute("href") : "") || "" : "").toLowerCase();
    const comboText = `${rawLabelLower} ${ariaLower} ${titleLower}`;
    if (/google\s+account|manage\s+your\s+google\s+account|switch\s+account|user\s+profile|\bprofile\b/i.test(comboText) && !comboText.includes("linkedin") && !comboText.includes("twitter") && !comboText.includes("github")) {
      isAccountControlEl = true;
    }
    if (hrefVal.includes("accounts.google.") || hrefVal.includes("myaccount.google.")) {
      isAccountControlEl = true;
    }
    if (el.closest) {
      const headerAncestor = el.closest("header, nav, [role='banner'], [role='navigation'], #gb, #top_nav, .appbar, #hdtb, #header");
      if (headerAncestor) {
        isHeaderNavEl = true;
      }
      const footerAncestor = el.closest("footer, [role='contentinfo'], #foot, #fbar, #footer");
      if (footerAncestor) {
        isFooterNavEl = true;
      }
      const resultArea = el.closest("#search, #rso, #center_col, #links, .results, .search-results, [role='main'], main, .b_results, .mw-search-results");
      if (resultArea && !headerAncestor && !footerAncestor && !isAccountControlEl) {
        const isExternalLink = /^https?:\/\//i.test(hrefVal) && !/(?:google\.[a-z.]+\/(?:search|preferences|webhp|intl|policies)|accounts\.google\.|support\.google\.|maps\.google\.)/i.test(hrefVal);
        const hasResultStructure = isExternalLink || tagName === "h3" || tagName === "h4" || elRole === "heading" || !!el.closest(".g, [data-hveid], .tF2Cxc, .MjjYud, .b_algo, .result, article, li");
        if (hasResultStructure && !isGenericBoilerplateLabel(label)) {
          isSearchResultEl = true;
          const resultCard = el.closest(".g, [data-hveid], .tF2Cxc, .MjjYud, .b_algo, .result, article, li");
          if (resultCard) {
            const snippetEl = resultCard.querySelector(".VwiC3b, [data-sncf], .b_caption p, .result__snippet, p, span[style*='-webkit-line-clamp']");
            if (snippetEl && snippetEl !== el) {
              const snip = (snippetEl.innerText || snippetEl.textContent || "").trim();
              if (snip && snip !== label) {
                surroundingSnippetText = snip.slice(0, 300);
              }
            }
          }
        }
      }
    }
  } catch (_) {
  }
  const semanticTag = getSemanticTag(type, label, el);
  const descriptor = {
    type,
    tag: tagName,
    role: elRole || (["button", "link"].includes(type) ? type : isFormField ? "textbox" : null),
    label,
    text: label,
    url: tagName === "a" ? el.href || (el.getAttribute ? el.getAttribute("href") : null) || null : null,
    href: tagName === "a" ? (el.getAttribute ? el.getAttribute("href") : null) || el.href || null : null,
    semanticTag,
    visible: true,
    enabled: !isDisabled,
    disabled: isDisabled,
    placeholder: (el.getAttribute ? el.getAttribute("placeholder") : null) || null,
    ariaLabel: (el.getAttribute ? el.getAttribute("aria-label") : null) || null,
    title: (el.getAttribute ? el.getAttribute("title") : null) || null,
    name: (el.getAttribute ? el.getAttribute("name") : null) || null,
    id: el.id || null,
    associatedLabel: (function() {
      try {
        if (el.id && typeof document !== "undefined" && document.querySelector) {
          const l = document.querySelector(`label[for="${CSS.escape ? CSS.escape(el.id) : el.id}"]`);
          if (l) return (l.innerText || l.textContent || "").trim();
        }
        if (el.closest) {
          const p = el.closest(".form-group, .field-group, .form-row, .ui-float-label, .p-float-label, mat-form-field, fieldset, [data-field]");
          if (p) {
            const lbl = p.querySelector("label, .field-label, mat-label, legend");
            if (lbl && lbl !== el) return (lbl.innerText || lbl.textContent || "").trim();
          }
        }
      } catch (_) {
      }
      return null;
    })(),
    alt: (el.getAttribute ? el.getAttribute("alt") : null) || (el.querySelector ? el.querySelector("img[alt]")?.getAttribute("alt") : null) || null,
    dataColor: (el.getAttribute ? el.getAttribute("data-color") || el.getAttribute("data-colour") || el.dataset && (el.dataset.color || el.dataset.colour) : null) || null,
    inputType: tagName === "input" ? el.type || "text" : null,
    nearbyText: nearbyContext || null,
    contextText: nearbyContext || null,
    ariaAutocomplete: (el.getAttribute ? el.getAttribute("aria-autocomplete") : null) || null,
    ariaExpanded: (el.getAttribute ? el.getAttribute("aria-expanded") : null) || null,
    ariaControls: (el.getAttribute ? el.getAttribute("aria-controls") : null) || null,
    ariaHasPopup: (el.getAttribute ? el.getAttribute("aria-haspopup") : null) || null,
    autocomplete: (el.getAttribute ? el.getAttribute("autocomplete") : null) || null,
    isInteractable: !isDisabled && ["button", "link", "input", "textarea", "select", "checkbox", "radio", "textbox", "combobox", "searchbox"].includes(type),
    isSearchResult: isSearchResultEl,
    isAccountControl: isAccountControlEl,
    isHeaderNav: isHeaderNavEl,
    isFooterNav: isFooterNavEl,
    snippet: surroundingSnippetText,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    index: typeof fieldId === "number" ? fieldId : null,
    confidence: 1,
    evidence: `Local DOM: tag=${tagName}, role=${elRole || "none"}, semanticTag=${semanticTag || "none"}`
  };
  if (isFormField && typeof fieldId === "number") {
    descriptor.fieldId = fieldId;
  }
  return descriptor;
}
function extractVisualElements() {
  const elements = document.querySelectorAll(VISUAL_SELECTOR);
  const visualElements = [];
  let formFieldCounter = 0;
  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const elRole = el.getAttribute && el.getAttribute("role") ? el.getAttribute("role").toLowerCase() : "";
    const hasAriaAutocomplete = el.getAttribute && !!el.getAttribute("aria-autocomplete");
    const isFormField = ["input", "textarea", "select"].includes(tagName) || elRole === "textbox" || elRole === "combobox" || elRole === "searchbox" || hasAriaAutocomplete || el.isContentEditable || el.getAttribute && el.getAttribute("contenteditable") === "true";
    const fieldId = isFormField ? formFieldCounter++ : null;
    const item = classifyVisualElement(el, fieldId);
    if (item) {
      item.index = visualElements.length;
      visualElements.push(item);
    }
  });
  return visualElements;
}
function extractVisualElementsWithNodes() {
  const elements = document.querySelectorAll(VISUAL_SELECTOR);
  const visualElementsWithNodes = [];
  let formFieldCounter = 0;
  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const elRole = el.getAttribute && el.getAttribute("role") ? el.getAttribute("role").toLowerCase() : "";
    const hasAriaAutocomplete = el.getAttribute && !!el.getAttribute("aria-autocomplete");
    const isFormField = ["input", "textarea", "select"].includes(tagName) || elRole === "textbox" || elRole === "combobox" || elRole === "searchbox" || hasAriaAutocomplete || el.isContentEditable || el.getAttribute && el.getAttribute("contenteditable") === "true";
    const fieldId = isFormField ? formFieldCounter++ : null;
    const item = classifyVisualElement(el, fieldId);
    if (item) {
      item.index = visualElementsWithNodes.length;
      visualElementsWithNodes.push({
        ...item,
        node: el
      });
    }
  });
  return visualElementsWithNodes;
}
function isSensitiveElement(el) {
  if (!el || !el.tagName) {
    return false;
  }
  if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) {
    return false;
  }
  const tagName = el.tagName.toLowerCase();
  if (tagName !== "input" && tagName !== "textarea") {
    return false;
  }
  const type = (el.type || "").toLowerCase();
  const nameAttr = (el.getAttribute ? el.getAttribute("name") || "" : "").toLowerCase();
  const idAttr = (el.id || "").toLowerCase();
  const placeholderAttr = (el.getAttribute ? el.getAttribute("placeholder") || "" : "").toLowerCase();
  const autocompleteAttr = (el.getAttribute ? el.getAttribute("autocomplete") || "" : "").toLowerCase();
  const ariaLabelAttr = (el.getAttribute ? el.getAttribute("aria-label") || "" : "").toLowerCase();
  let labelText = "";
  if (el.id && typeof document !== "undefined" && document.querySelector) {
    try {
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl) {
        labelText = (labelEl.innerText || labelEl.textContent || "").trim();
      }
    } catch (_) {
    }
  }
  const metadata = {
    type,
    name: nameAttr,
    id: idAttr,
    placeholder: placeholderAttr,
    autocomplete: autocompleteAttr,
    ariaLabel: ariaLabelAttr,
    labelText
  };
  if (typeof isSensitiveInputMetadata === "function") {
    return isSensitiveInputMetadata(metadata);
  }
  if (typeof window !== "undefined" && typeof window.isSensitiveInputMetadata === "function") {
    return window.isSensitiveInputMetadata(metadata);
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.isSensitiveInputMetadata === "function") {
    return globalThis.isSensitiveInputMetadata(metadata);
  }
  if (typeof require === "function") {
    try {
      const pii = require("./pii-detector.js");
      if (pii && typeof pii.isSensitiveInputMetadata === "function") {
        return pii.isSensitiveInputMetadata(metadata);
      }
    } catch (_) {
    }
  }
  if (tagName === "input" && (type === "password" || type === "email" || type === "tel")) {
    return true;
  }
  const SENSITIVE_KEYWORDS = ["card", "credit", "cvv", "ssn", "phone", "password", "email", "bank", "account", "token", "otp", "pin"];
  return SENSITIVE_KEYWORDS.some(
    (kw) => nameAttr.includes(kw) || idAttr.includes(kw) || placeholderAttr.includes(kw) || ariaLabelAttr.includes(kw)
  );
}
function deduplicateSensitiveRegions(regions) {
  if (!Array.isArray(regions) || regions.length <= 1) return regions || [];
  let currentList = regions.map((r) => ({ ...r }));
  let hasMerged = true;
  while (hasMerged) {
    hasMerged = false;
    const nextList = [];
    const mergedIndices = /* @__PURE__ */ new Set();
    for (let i = 0; i < currentList.length; i++) {
      if (mergedIndices.has(i)) continue;
      let boxA = { ...currentList[i] };
      for (let j = i + 1; j < currentList.length; j++) {
        if (mergedIndices.has(j)) continue;
        const boxB = currentList[j];
        const xOverlap = Math.max(0, Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x));
        const yOverlap = Math.max(0, Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y));
        if (xOverlap > 0 && yOverlap > 0) {
          const areaA = boxA.width * boxA.height;
          const areaB = boxB.width * boxB.height;
          const overlapArea = xOverlap * yOverlap;
          if (overlapArea >= 0.3 * Math.min(areaA, areaB)) {
            const minX = Math.min(boxA.x, boxB.x);
            const minY = Math.min(boxA.y, boxB.y);
            const maxX = Math.max(boxA.x + boxA.width, boxB.x + boxB.width);
            const maxY = Math.max(boxA.y + boxA.height, boxB.y + boxB.height);
            boxA.x = minX;
            boxA.y = minY;
            boxA.width = maxX - minX;
            boxA.height = maxY - minY;
            boxA.source = boxA.source === boxB.source ? boxA.source : "dom-merged";
            mergedIndices.add(j);
            hasMerged = true;
          }
        }
      }
      nextList.push(boxA);
    }
    currentList = nextList;
  }
  return currentList;
}
const SENSITIVE_CONTROL_SELECTOR = "input, textarea, select, [contenteditable], [role='textbox'], [role='combobox'], [role='searchbox'], [role='option'], [data-hovercard-id], [email], [data-value], [class*='chip'], [class*='token'], [class*='recipient'], [class*='tag'], [class*='pill']";
function extractElementLocalValue(el) {
  if (!el) return "";
  const tagName = (el.tagName || "").toLowerCase();
  if (tagName === "input" || tagName === "textarea") {
    if (el.value && typeof el.value === "string" && el.value.trim().length > 0) {
      return el.value;
    }
    const attrVal = el.getAttribute ? el.getAttribute("value") || el.getAttribute("data-value") || "" : "";
    if (attrVal && typeof attrVal === "string" && attrVal.trim().length > 0) {
      return attrVal;
    }
    const txt = (el.innerText || el.textContent || "").trim();
    if (txt) return txt;
    return "";
  }
  if (tagName === "select") {
    if (el.selectedOptions && el.selectedOptions[0]) {
      return el.selectedOptions[0].text || el.value || "";
    }
    return el.value || "";
  }
  if (el.isContentEditable || el.getAttribute && el.getAttribute("contenteditable") !== null && el.getAttribute("contenteditable") !== "false") {
    return el.innerText || el.textContent || "";
  }
  if (el.getAttribute) {
    const emailAttr = el.getAttribute("email");
    if (emailAttr && typeof emailAttr === "string" && emailAttr.trim().length > 0) return emailAttr;
    const hovercard = el.getAttribute("data-hovercard-id");
    if (hovercard && typeof hovercard === "string" && hovercard.trim().length > 0) return hovercard;
    const dataVal = el.getAttribute("data-value");
    if (dataVal && typeof dataVal === "string" && dataVal.trim().length > 0) return dataVal;
  }
  return (el.innerText || el.textContent || "").trim();
}
function checkValueSensitivity(val) {
  if (!val || typeof val !== "string" || !val.trim()) {
    return { detected: false, redacted: "" };
  }
  if (typeof detectAndRedactSensitiveValue === "function") {
    return detectAndRedactSensitiveValue(val);
  }
  if (typeof window !== "undefined" && typeof window.detectAndRedactSensitiveValue === "function") {
    return window.detectAndRedactSensitiveValue(val);
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.detectAndRedactSensitiveValue === "function") {
    return globalThis.detectAndRedactSensitiveValue(val);
  }
  if (typeof redactText === "function") {
    const red = redactText(val);
    return { detected: red !== val, redacted: red };
  }
  if (typeof window !== "undefined" && typeof window.redactText === "function") {
    const red = window.redactText(val);
    return { detected: red !== val, redacted: red };
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.redactText === "function") {
    const red = globalThis.redactText(val);
    return { detected: red !== val, redacted: red };
  }
  if (typeof require === "function") {
    try {
      const pii = require("./pii-detector.js");
      if (pii && typeof pii.detectAndRedactSensitiveValue === "function") {
        return pii.detectAndRedactSensitiveValue(val);
      }
    } catch (_) {
    }
  }
  return { detected: false, redacted: "" };
}
function extractSensitiveTextRegions() {
  const regions = [];
  if (typeof document === "undefined" || !document.querySelectorAll) return regions;
  const candidates = document.querySelectorAll(
    "p, span, div, td, th, li, dt, dd, b, strong, em, [role='article'], [role='document'], [data-message-id], .a3s"
  );
  candidates.forEach((el) => {
    if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) {
      return;
    }
    if (el.id && el.id.startsWith("sih-agent-overlay")) {
      return;
    }
    if (el.children && el.children.length > 2) {
      return;
    }
    const text = (el.innerText || el.textContent || "").trim();
    if (!text || text.length > 300 || text.includes("[REDACTED_")) {
      return;
    }
    const check = checkValueSensitivity(text);
    if (check && check.detected) {
      const rect = getVisibleRect(el);
      if (rect && rect.width > 0 && rect.height > 0) {
        const cat = check.categories && check.categories[0] ? check.categories[0] : "IDENTITY";
        regions.push({
          x: Math.round(rect.x !== void 0 ? rect.x : rect.left || 0),
          y: Math.round(rect.y !== void 0 ? rect.y : rect.top || 0),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          source: "dom-text",
          category: cat,
          confidence: "HIGH"
        });
      }
    }
  });
  const rows = document.querySelectorAll("tr");
  rows.forEach((row) => {
    if (row.closest && (row.closest("#sih-agent-overlay-root") || row.closest("[id^='sih-agent-overlay']"))) return;
    const cells = row.children;
    if (cells && cells.length >= 2 && cells.length <= 4) {
      const labelText = (cells[0].innerText || cells[0].textContent || "").trim();
      const valText = (cells[1].innerText || cells[1].textContent || "").trim();
      if (labelText && valText && !valText.includes("[REDACTED_")) {
        const combined = `${labelText}: ${valText}`;
        const check = checkValueSensitivity(combined);
        if (check && check.detected) {
          const valRect = getVisibleRect(cells[1]);
          if (valRect && valRect.width > 0 && valRect.height > 0) {
            regions.push({
              x: Math.round(valRect.x !== void 0 ? valRect.x : valRect.left || 0),
              y: Math.round(valRect.y !== void 0 ? valRect.y : valRect.top || 0),
              width: Math.round(valRect.width),
              height: Math.round(valRect.height),
              source: "dom-text",
              category: check.categories?.[0] || "IDENTITY",
              confidence: "HIGH"
            });
          }
        }
      }
    }
  });
  return regions;
}
function extractSensitiveRegions() {
  const elements = document.querySelectorAll(SENSITIVE_CONTROL_SELECTOR);
  const sensitiveRegions = [];
  elements.forEach((el) => {
    if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) {
      return;
    }
    if (el.id && el.id.startsWith("sih-agent-overlay")) {
      return;
    }
    const isStructural = isSensitiveElement(el);
    let isValueSensitive = false;
    const localVal = extractElementLocalValue(el);
    if (localVal) {
      const check = checkValueSensitivity(localVal);
      if (check && check.detected) {
        isValueSensitive = true;
      }
    }
    if (isStructural || isValueSensitive) {
      let rect = getVisibleRect(el);
      if ((!rect || rect.width < 40) && el.parentElement) {
        const parentRect = getVisibleRect(el.parentElement);
        if (parentRect && parentRect.width > (rect ? rect.width : 2)) {
          rect = parentRect;
        }
      }
      if (!rect) return;
      const left = typeof rect.x === "number" ? rect.x : typeof rect.left === "number" ? rect.left : 0;
      const top = typeof rect.y === "number" ? rect.y : typeof rect.top === "number" ? rect.top : 0;
      const rx = Math.round(left);
      const ry = Math.round(top);
      const rw = Math.round(rect.width);
      const rh = Math.round(rect.height);
      if (rw > 0 && rh > 0) {
        sensitiveRegions.push({
          x: rx,
          y: ry,
          width: rw,
          height: rh,
          source: isValueSensitive && !isStructural ? "dom-value" : "dom"
        });
      }
    }
  });
  try {
    const textRegions = extractSensitiveTextRegions();
    if (Array.isArray(textRegions)) {
      sensitiveRegions.push(...textRegions);
    }
  } catch (_) {
  }
  return deduplicateSensitiveRegions(sensitiveRegions);
}
let currentApprovalCallback = null;
function removeInPageApprovalModal() {
  const existing = document.getElementById("sih-agent-approval-overlay");
  if (existing) {
    existing.remove();
  }
  if (currentApprovalCallback) {
    currentApprovalCallback = null;
  }
}
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function showInPageApprovalModal(actionDetails, callback) {
  removeInPageApprovalModal();
  currentApprovalCallback = callback;
  const overlay = document.createElement("div");
  overlay.id = "sih-agent-approval-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "sih-approval-title");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(10, 15, 29, 0.75)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#ffffff",
    padding: "20px",
    boxSizing: "border-box"
  });
  const card = document.createElement("div");
  card.id = "sih-agent-approval-card";
  Object.assign(card.style, {
    backgroundColor: "#111827",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "16px",
    padding: "24px 28px",
    maxWidth: "480px",
    width: "100%",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  });
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  const badge = document.createElement("div");
  badge.textContent = "SAFETY GATE: APPROVAL REQUIRED";
  Object.assign(badge.style, {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: "9999px",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    color: "#f87171",
    border: "1px solid rgba(239, 68, 68, 0.4)"
  });
  const riskBadge = document.createElement("div");
  riskBadge.textContent = actionDetails.risk || "HIGH RISK";
  Object.assign(riskBadge.style, {
    fontSize: "11px",
    fontWeight: "700",
    padding: "4px 10px",
    borderRadius: "9999px",
    backgroundColor: "#ef4444",
    color: "#ffffff"
  });
  header.appendChild(badge);
  header.appendChild(riskBadge);
  const title = document.createElement("h2");
  title.id = "sih-approval-title";
  title.textContent = "Agent Ready for Consequential Action";
  Object.assign(title.style, {
    margin: "0",
    fontSize: "18px",
    fontWeight: "600",
    color: "#f3f4f6"
  });
  const body = document.createElement("div");
  Object.assign(body.style, {
    backgroundColor: "rgba(31, 41, 55, 0.6)",
    border: "1px solid rgba(75, 85, 99, 0.4)",
    borderRadius: "10px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontSize: "13px",
    lineHeight: "1.5"
  });
  const actionRow = document.createElement("div");
  actionRow.innerHTML = `<span style="color:#9ca3af;">Action: </span><strong style="color:#60a5fa;">${escapeHtml(actionDetails.action || "CLICK")} &rarr; ${escapeHtml(actionDetails.target || "Submit")}</strong>`;
  const reasonRow = document.createElement("div");
  reasonRow.innerHTML = `<span style="color:#9ca3af;">Reason: </span><span style="color:#e5e7eb;">${escapeHtml(actionDetails.reason || "This action will submit or modify state.")}</span>`;
  const contextRow = document.createElement("div");
  contextRow.innerHTML = `<span style="color:#9ca3af;">Page: </span><span style="color:#d1d5db;">${escapeHtml(document.title || window.location.hostname)}</span>`;
  body.appendChild(actionRow);
  body.appendChild(reasonRow);
  body.appendChild(contextRow);
  if (actionDetails.taskSummary) {
    const taskRow = document.createElement("div");
    taskRow.innerHTML = `<span style="color:#9ca3af;">Task: </span><span style="color:#d1d5db;">${escapeHtml(actionDetails.taskSummary)}</span>`;
    body.appendChild(taskRow);
  }
  const notice = document.createElement("p");
  notice.textContent = "This action will not execute automatically. Explicit human confirmation is required.";
  Object.assign(notice.style, {
    margin: "0",
    fontSize: "12px",
    color: "#9ca3af"
  });
  const btnContainer = document.createElement("div");
  Object.assign(btnContainer.style, {
    display: "flex",
    gap: "12px",
    marginTop: "8px"
  });
  const btnApprove = document.createElement("button");
  btnApprove.id = "sih-btn-approve";
  btnApprove.textContent = "Approve & Continue";
  Object.assign(btnApprove.style, {
    flex: "1",
    backgroundColor: "#10b981",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  });
  btnApprove.onmouseenter = () => {
    btnApprove.style.backgroundColor = "#059669";
  };
  btnApprove.onmouseleave = () => {
    btnApprove.style.backgroundColor = "#10b981";
  };
  const btnCancel = document.createElement("button");
  btnCancel.id = "sih-btn-cancel";
  btnCancel.textContent = "Cancel Execution";
  Object.assign(btnCancel.style, {
    flex: "1",
    backgroundColor: "#374151",
    color: "#e5e7eb",
    border: "1px solid #4b5563",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  });
  btnCancel.onmouseenter = () => {
    btnCancel.style.backgroundColor = "#4b5563";
  };
  btnCancel.onmouseleave = () => {
    btnCancel.style.backgroundColor = "#374151";
  };
  btnApprove.addEventListener("click", () => {
    removeInPageApprovalModal();
    if (callback) callback({ approved: true });
  });
  btnCancel.addEventListener("click", () => {
    removeInPageApprovalModal();
    if (callback) callback({ approved: false, cancelled: true });
  });
  btnContainer.appendChild(btnCancel);
  btnContainer.appendChild(btnApprove);
  card.appendChild(header);
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(notice);
  card.appendChild(btnContainer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
let currentOverlayData = null;
let currentOverlayTargetNode = null;
let overlayScrollListener = null;
function clearAgentOverlay() {
  const existing = document.getElementById("sih-agent-overlay-root");
  if (existing) {
    existing.remove();
  }
  currentOverlayData = null;
  currentOverlayTargetNode = null;
  if (overlayScrollListener) {
    window.removeEventListener("scroll", overlayScrollListener, true);
    window.removeEventListener("resize", overlayScrollListener, true);
    overlayScrollListener = null;
  }
}
function findOverlayTargetNode(data) {
  if (!data) return null;
  if (typeof data.targetIndex === "number") {
    const freshElements = extractVisualElementsWithNodes();
    if (freshElements[data.targetIndex] && freshElements[data.targetIndex].node && freshElements[data.targetIndex].node.isConnected) {
      if (!data.targetLabel || labelsMatch(freshElements[data.targetIndex].label, data.targetLabel)) {
        return freshElements[data.targetIndex].node;
      }
    }
    if (data.targetLabel) {
      const match = freshElements.find((el) => el.node && el.node.isConnected && labelsMatch(el.label, data.targetLabel));
      if (match) return match.node;
    }
  }
  if (data.targetLabel) {
    const freshElements = extractVisualElementsWithNodes();
    const match = freshElements.find((el) => el.node && el.node.isConnected && labelsMatch(el.label, data.targetLabel));
    if (match) return match.node;
  }
  if (data.target && ACTION_TARGET_MAP[data.target]) {
    const el = document.querySelector(ACTION_TARGET_MAP[data.target]);
    if (el) return el;
  }
  if (data.action === "SUBMIT" || data.target === "search") {
    const searchEl = document.querySelector("input[type='search'], input[name*='search'], input[name*='q'], input[id*='search'], textarea[name*='q']");
    if (searchEl) return searchEl;
  }
  return null;
}
function getOverlayTargetRect(targetNode, fallbackBbox) {
  if (targetNode && targetNode.isConnected) {
    const r = targetNode.getBoundingClientRect();
    if (r && (r.width > 0 || r.height > 0)) {
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      return {
        top: r.top + scrollY,
        left: r.left + scrollX,
        width: r.width,
        height: r.height,
        viewportTop: r.top,
        viewportLeft: r.left
      };
    }
  }
  if (fallbackBbox && typeof fallbackBbox.x === "number") {
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    return {
      top: fallbackBbox.y + scrollY,
      left: fallbackBbox.x + scrollX,
      width: fallbackBbox.width || 100,
      height: fallbackBbox.height || 36,
      viewportTop: fallbackBbox.y,
      viewportLeft: fallbackBbox.x
    };
  }
  return null;
}
function renderOverlayUI(data, rect) {
  if (!rect || typeof document === "undefined" || !document.body) return;
  let root = document.getElementById("sih-agent-overlay-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "sih-agent-overlay-root";
    root.setAttribute("data-sih-overlay", "true");
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "2147483646",
      overflow: "visible"
    });
    document.body.appendChild(root);
  }
  let box = document.getElementById("sih-agent-overlay-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "sih-agent-overlay-box";
    Object.assign(box.style, {
      position: "absolute",
      pointerEvents: "none",
      borderRadius: "6px",
      transition: "border 0.2s ease, box-shadow 0.2s ease, top 0.15s ease, left 0.15s ease, width 0.15s ease, height 0.15s ease",
      boxSizing: "border-box"
    });
    root.appendChild(box);
  }
  let card = document.getElementById("sih-agent-overlay-card");
  if (!card) {
    card = document.createElement("div");
    card.id = "sih-agent-overlay-card";
    Object.assign(card.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483646",
      borderRadius: "8px",
      padding: "8px 12px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      fontSize: "12px",
      lineHeight: "1.4",
      color: "#f8fafc",
      maxWidth: "340px",
      minWidth: "200px",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 0, 0, 0.3)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      transition: "background-color 0.2s ease, border-color 0.2s ease, top 0.15s ease, left 0.15s ease",
      boxSizing: "border-box"
    });
    root.appendChild(card);
  }
  const state = data.state || "GROUNDED";
  let borderColor = "#6366f1";
  let boxShadow = "0 0 12px rgba(99, 102, 241, 0.5), inset 0 0 6px rgba(99, 102, 241, 0.2)";
  let badgeHtml = "";
  let contentHtml = "";
  if (state === "EXECUTING") {
    borderColor = "#f59e0b";
    boxShadow = "0 0 16px rgba(245, 158, 11, 0.6), inset 0 0 8px rgba(245, 158, 11, 0.25)";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #fbbf24; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">EXECUTING &#x26A1;</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
    `;
  } else if (state === "VERIFIED") {
    borderColor = "#10b981";
    boxShadow = "0 0 16px rgba(16, 185, 129, 0.6), inset 0 0 8px rgba(16, 185, 129, 0.25)";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #34d399; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">&#x2713; VERIFIED</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
    `;
  } else if (state === "SAFETY_BLOCKED") {
    borderColor = "#ef4444";
    boxShadow = "0 0 16px rgba(239, 68, 68, 0.6), inset 0 0 8px rgba(239, 68, 68, 0.25)";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #f87171; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">&#x1F6E1; SAFETY BLOCKED</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Reason: </span><span style="color:#fca5a5; font-weight: 600;">${escapeHtml(data.reason || "Action blocked by safety policy")}</span></div>
      ${data.action ? `<div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#e2e8f0;">${escapeHtml(data.action)}</span></div>` : ""}
    `;
  } else {
    borderColor = "#6366f1";
    boxShadow = "0 0 12px rgba(99, 102, 241, 0.5), inset 0 0 6px rgba(99, 102, 241, 0.2)";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #818cf8; background: rgba(99, 102, 241, 0.18); border: 1px solid rgba(99, 102, 241, 0.35); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">AGENT TARGET</div>`;
    const confVal = data.confidence !== void 0 ? typeof data.confidence === "number" ? data.confidence.toFixed(2) : String(data.confidence) : "1.00";
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Confidence: </span><span style="color:#38bdf8; font-weight: 600;">${escapeHtml(confVal)}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Method: </span><span style="color:#a78bfa;">${escapeHtml(data.method || "local-fuzzy-match")}</span></div>
    `;
  }
  box.style.top = `${rect.top}px`;
  box.style.left = `${rect.left}px`;
  box.style.width = `${Math.max(rect.width, 24)}px`;
  box.style.height = `${Math.max(rect.height, 24)}px`;
  box.style.border = `2px solid ${borderColor}`;
  box.style.boxShadow = boxShadow;
  card.style.backgroundColor = "rgba(15, 23, 42, 0.94)";
  card.style.border = `1px solid ${borderColor}`;
  card.innerHTML = `${badgeHtml}${contentHtml}`;
  const cardEstimatedHeight = state === "GROUNDED" ? 110 : 80;
  const fitsAbove = rect.viewportTop > cardEstimatedHeight + 16;
  let cardTop = fitsAbove ? rect.top - cardEstimatedHeight - 8 : rect.top + rect.height + 8;
  let cardLeft = rect.left;
  const maxLeft = (window.scrollX || 0) + (window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 800)) - 350;
  if (cardLeft > maxLeft) {
    cardLeft = Math.max(8, maxLeft);
  }
  card.style.top = `${cardTop}px`;
  card.style.left = `${Math.max(8, cardLeft)}px`;
}
function showAgentOverlay(payload) {
  currentOverlayData = payload || {};
  currentOverlayTargetNode = findOverlayTargetNode(currentOverlayData);
  const rect = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
  if (rect) {
    renderOverlayUI(currentOverlayData, rect);
  }
  if (!overlayScrollListener && typeof window !== "undefined") {
    overlayScrollListener = () => {
      if (currentOverlayData) {
        const r = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
        if (r) {
          renderOverlayUI(currentOverlayData, r);
        }
      }
    };
    window.addEventListener("scroll", overlayScrollListener, { passive: true, capture: true });
    window.addEventListener("resize", overlayScrollListener, { passive: true });
  }
}
function updateAgentOverlay(payload) {
  if (!currentOverlayData && !payload) return;
  currentOverlayData = {
    ...currentOverlayData || {},
    ...payload || {}
  };
  if (!currentOverlayTargetNode) {
    currentOverlayTargetNode = findOverlayTargetNode(currentOverlayData);
  }
  const rect = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
  if (rect) {
    renderOverlayUI(currentOverlayData, rect);
  }
}
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPageInfo") {
      const title = document.title || "No Title Found";
      const url = window.location.href;
      const rawVisibleText = document.body ? document.body.innerText.slice(0, 2e3) : "";
      let redactedSample = typeof redactText === "function" ? redactText(rawVisibleText) : rawVisibleText;
      try {
        const formControls = document.querySelectorAll(SENSITIVE_CONTROL_SELECTOR);
        const sanitizedFormSnippets = [];
        formControls.forEach((el) => {
          if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) return;
          if (el.id && el.id.startsWith("sih-agent-overlay")) return;
          const localVal = extractElementLocalValue(el);
          if (localVal) {
            const check = checkValueSensitivity(localVal);
            if (check && check.detected) {
              const tagName = (el.tagName || "").toLowerCase();
              const fieldType = tagName === "input" ? el.type || "input" : tagName;
              const safeLabel = extractFormFieldLabel(el, fieldType) || "Field";
              sanitizedFormSnippets.push(`${safeLabel}: ${check.redacted}`);
            }
          }
        });
        if (sanitizedFormSnippets.length > 0) {
          redactedSample += (redactedSample ? "\n\n[Sanitized Form Summary]:\n" : "[Sanitized Form Summary]:\n") + sanitizedFormSnippets.join("\n");
        }
      } catch (_) {
      }
      const visualElements = extractVisualElements();
      const tSensStart = performance.now();
      const sensitiveRegions = extractSensitiveRegions();
      const sensitiveDetectionMs = Math.round(performance.now() - tSensStart);
      const valueBasedPiiCount = Array.isArray(sensitiveRegions) ? sensitiveRegions.filter((r) => r.source === "dom-value").length : 0;
      const urlLower = url.toLowerCase();
      const titleLower = title.toLowerCase();
      const hasSearchUrl = urlLower.includes("/search") || urlLower.includes("?q=") || urlLower.includes("&q=") || urlLower.includes("query=") || urlLower.includes("search?");
      const hasSearchTitle = titleLower.includes("search") || titleLower.includes("results") || titleLower.includes(" - google") || titleLower.includes("at duckduckgo") || titleLower.includes("search results");
      const resultContainers = document.querySelectorAll(
        "#search, #rso, #links, .results, .search-results, [role='main'] a, .mw-search-results, .b_results"
      );
      const isSearchResults = !!(hasSearchUrl || hasSearchTitle && resultContainers && resultContainers.length > 0);
      sendResponse({
        success: true,
        title,
        url,
        redactedSample,
        visualElements,
        sensitiveRegions,
        sensitiveDetectionMs,
        valueBasedPiiCount,
        isSearchResults,
        searchSignals: {
          hasSearchUrl,
          hasSearchTitle,
          containerCount: resultContainers ? resultContainers.length : 0
        },
        viewport: {
          width: window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0),
          height: window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0),
          devicePixelRatio: window.devicePixelRatio || 1,
          scrollX: window.scrollX || 0,
          scrollY: window.scrollY || 0
        }
      });
      return false;
    } else if (request.action === "checkSearchResultsState") {
      const url = (window.location.href || "").toLowerCase();
      const title = (document.title || "").toLowerCase();
      const hasSearchUrl = url.includes("/search") || url.includes("?q=") || url.includes("&q=") || url.includes("query=") || url.includes("search?");
      const hasSearchTitle = title.includes("search") || title.includes("results") || title.includes(" - google") || title.includes("at duckduckgo") || title.includes("search results");
      const resultContainers = document.querySelectorAll(
        "#search, #rso, #links, .results, .search-results, [role='main'] a, .mw-search-results, .b_results"
      );
      const isSearchResults = !!(hasSearchUrl || hasSearchTitle && resultContainers && resultContainers.length > 0);
      sendResponse({
        success: true,
        isSearchResults,
        hasSearchUrl,
        hasSearchTitle,
        containerCount: resultContainers ? resultContainers.length : 0
      });
      return false;
    } else if (request.action === "getLightweightPageState") {
      const url = window.location.href;
      const title = document.title || "No Title Found";
      const viewport = {
        scrollX: window.scrollX || 0,
        scrollY: window.scrollY || 0,
        width: window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0),
        height: window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0)
      };
      const elements = extractVisualElements();
      const structuralElements = elements.map((el) => ({
        type: el.type,
        label: el.label,
        semanticTag: el.semanticTag,
        disabled: !!el.disabled,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height
      }));
      let signature = null;
      if (typeof window !== "undefined" && window.SIHChangeDetector && typeof window.SIHChangeDetector.computeLightweightDomSignature === "function") {
        signature = window.SIHChangeDetector.computeLightweightDomSignature(structuralElements, { url, title, viewport });
      }
      sendResponse({
        success: true,
        url,
        title,
        interactiveCount: structuralElements.length,
        structuralElements,
        viewport,
        signature
      });
      return false;
    } else if (request.action === "executeAction") {
      const executionResult = executeAction(request.payload);
      sendResponse({
        success: true,
        result: executionResult
      });
      return false;
    } else if (request.action === "requestHumanApproval") {
      showInPageApprovalModal(request.payload || {}, (response) => {
        sendResponse(response);
      });
      return true;
    } else if (request.action === "dismissHumanApproval") {
      removeInPageApprovalModal();
      sendResponse({ dismissed: true });
      return false;
    } else if (request.action === "showAgentOverlay") {
      showAgentOverlay(request.payload || {});
      sendResponse({ success: true });
      return false;
    } else if (request.action === "updateAgentOverlay") {
      updateAgentOverlay(request.payload || {});
      sendResponse({ success: true });
      return false;
    } else if (request.action === "clearAgentOverlay") {
      clearAgentOverlay();
      sendResponse({ success: true });
      return false;
    }
    return false;
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VISUAL_SELECTOR,
    ACTION_TARGET_MAP,
    SCROLL_TARGET_MAP,
    classifyVisualElement,
    extractVisualElements,
    extractVisualElementsWithNodes,
    extractFormFieldLabel,
    humanizeName,
    executeAction,
    normalizeLabel,
    labelsMatch,
    findContextElement,
    filterCandidatesByContext,
    resolveContextualCandidates,
    selectOrdinalCandidate,
    showInPageApprovalModal,
    removeInPageApprovalModal,
    showAgentOverlay,
    updateAgentOverlay,
    clearAgentOverlay,
    isSensitiveElement,
    extractSensitiveRegions,
    deduplicateSensitiveRegions,
    extractElementLocalValue,
    checkValueSensitivity,
    SENSITIVE_CONTROL_SELECTOR
  };
}
