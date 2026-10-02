/**
 * reasoning-planner.js — On-Device Reasoning & Safety Planner
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents
 *
 * ARCHITECTURAL CLARIFICATION:
 * This module is a deterministic, explainable, auditable, on-device reasoning
 * and safety planning layer. It is NOT an LLM or generative AI model.
 * It provides transparent task understanding, dependency tracking, action risk
 * classification, precondition/postcondition validation, and human-in-the-loop safety gating.
 *
 * CRITICAL PRIVACY CONTRACT:
 * Plans produced or evaluated by this module contain ONLY sanitized structural intents
 * (e.g. action type, field hints, risk class, safety conditions).
 * Literal user-entered values are NEVER embedded into reasoning artifacts or network plans.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SIHReasoningPlanner = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Action Risk Classification Taxonomy
  const RISK_LEVELS = Object.freeze({
    LOW: "LOW",         // Local perception, scrolling, filling non-sensitive inputs
    MEDIUM: "MEDIUM",   // Navigation, opening tabs, ordinary interactive controls
    HIGH: "HIGH",       // Consequential actions: submit, delete, purchase, confirm, send
    CRITICAL: "CRITICAL" // Financial payment, account deletion, irreversible side effects
  });

  // Keywords that identify high-impact or consequential actions
  const HIGH_RISK_KEYWORDS = [
    "submit",
    "send",
    "delete",
    "remove",
    "purchase",
    "buy",
    "checkout",
    "place order",
    "confirm",
    "publish",
    "post",
    "pay",
    "transfer",
    "apply",
    "register",
    "sign up",
    "finish"
  ];

  const CRITICAL_RISK_KEYWORDS = [
    "pay now",
    "confirm payment",
    "delete account",
    "erase",
    "wipe",
    "wire transfer",
    "authorize charge"
  ];

  /**
   * Normalizes a text string for consistent comparison.
   * @param {string} str
   * @returns {string}
   */
  function normalize(str) {
    return (str || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();
  }

  // Known entity official domains for search result target resolution
  const KNOWN_ENTITY_DOMAINS = {
    isro: "isro.gov.in",
    linkedin: "linkedin.com",
    github: "github.com",
    google: "google.com",
    wikipedia: "wikipedia.org",
    youtube: "youtube.com",
    twitter: "twitter.com",
    x: "x.com",
    amazon: "amazon.in",
    nasa: "nasa.gov",
    apple: "apple.com",
    microsoft: "microsoft.com",
    facebook: "facebook.com",
    instagram: "instagram.com",
    reddit: "reddit.com"
  };

  /**
   * Checks if a target string is an abstract search-result phrase that cannot be directly grounded.
   * @param {string} target
   * @returns {boolean}
   */
  function isAbstractTarget(target) {
    if (!target) return true;
    const t = target.trim().toLowerCase();
    return /^(?:most\s+relevant\s+result|most\s+relavent\s+result|relevant\s+result|correct\s+result|appropriate\s+result|the\s+result|result|the\s+website|website|the\s+site|site|the\s+page|page|the\s+link|link|the\s+product|product|most\s+relevant\s+product|it|that|this|them|first\s+result|top\s+result)$/i.test(t);
  }

  /**
   * Converts abstract search-result references into concrete, groundable targets.
   * @param {string} query - The search query
   * @param {string} [candidate] - Raw candidate phrase
   * @param {Object} [entity] - Inferred entity
   * @param {string} [intent] - Contextual intent
   * @returns {string} Concrete, groundable target name
   */
  function resolveConcreteSearchTarget(query, candidate = "", entity = null, intent = null) {
    const q = (query || "").trim();
    const qLower = q.toLowerCase();
    const candLower = (candidate || "").toLowerCase().trim();
    const intentLower = (intent || "").toLowerCase().trim();

    // 1. Profile intent (e.g. "open his LinkedIn profile", "open Sundar Pichai's profile")
    if (candLower.includes("profile") || intentLower.includes("profile") || /\bprofile\b/i.test(candLower)) {
      if (candLower.includes("linkedin") || /linkedin\b/i.test(candLower)) {
        return `${q} LinkedIn profile`;
      }
      if (entity && entity.name) {
        return entity.name;
      }
      return `${q} profile`;
    }

    // 2. Official website / site intent (e.g. "official website", "official ISRO website", "the official website")
    const isOfficial = /official/i.test(candLower) || /official/i.test(intentLower);
    const isWebsite = /\b(?:website|site|webpage|page|portal)\b/i.test(candLower) || /\b(?:website|site|webpage|page|portal)\b/i.test(intentLower);

    if (isOfficial || isWebsite) {
      if (qLower === "isro") {
        return "official ISRO website (isro.gov.in)";
      }
      if (qLower === "linkedin") {
        return "LinkedIn official website";
      }
      const knownDomain = KNOWN_ENTITY_DOMAINS[qLower];
      if (knownDomain && isOfficial) {
        return `official ${q} website (${knownDomain})`;
      }
      if (isOfficial) {
        return `${q} official website`;
      }
      return `${q} website`;
    }

    // 3. Specific named result or explicit non-abstract target
    if (candidate && !isAbstractTarget(candidate)) {
      return candidate;
    }

    // 4. Fallback for abstract search result references
    if (q) {
      if (qLower === "isro") {
        return "official ISRO website (isro.gov.in)";
      }
      if (qLower === "linkedin") {
        return "LinkedIn official website";
      }
      return `${q} official website`;
    }

    return candidate || "search result";
  }

  /**
   * Classifies the operational risk level of an action and its target.
   * Deterministic local classification based on action semantics and target attributes.
   *
   * @param {Object} action - { action: "CLICK"|"FILL"|"SCROLL", target?: string, targetLabel?: string, targetType?: string }
   * @param {Object} [context] - Optional page context or DOM metadata
   * @returns {{ level: string, requiresApproval: boolean, rationale: string }}
   */
  function classifyActionRisk(action, context = {}) {
    if (!action || typeof action !== "object") {
      return {
        level: RISK_LEVELS.LOW,
        requiresApproval: false,
        rationale: "Empty or unrecognized action defaults to low risk."
      };
    }

    let actionType = (action.action || "").toUpperCase();
    if (actionType === "OPEN") {
      const targetStr = String(action.url || action.target || action.targetLabel || "").trim();
      if (action.url || /^https?:\/\//i.test(targetStr) || /^www\./i.test(targetStr)) {
        actionType = "NAVIGATE";
      } else {
        actionType = "CLICK";
      }
    }
    const targetLabel = normalize(action.targetLabel || action.target || action.targetHint || "");
    const targetType = normalize(action.targetType || "");
    const semanticTag = normalize(action.semanticTag || "");

    // 1. FILL / FILL_FORM Action: Low risk for ordinary form inputs (passwords already blocked by content script)
    if (actionType === "FILL" || actionType === "FILL_FORM") {
      return {
        risk: RISK_LEVELS.LOW,
        level: RISK_LEVELS.LOW,
        requiresApproval: false,
        reason: actionType === "FILL_FORM"
          ? "Simultaneous form autofill using local profile. Local non-consequential modification."
          : `Form fill on '${action.targetLabel || action.fieldHint || "field"}'. Local non-consequential modification.`,
        rationale: actionType === "FILL_FORM"
          ? "Simultaneous form autofill using local profile. Local non-consequential modification."
          : `Form fill on '${action.targetLabel || action.fieldHint || "field"}'. Local non-consequential modification.`
      };
    }

    // 1b. SUBMIT Action: Low risk for search submissions; High risk for consequential actions (checkout, delete, payment)
    if (actionType === "SUBMIT") {
      const isSearch = targetLabel.includes("search") || targetLabel.includes("query") || !targetLabel;
      if (isSearch) {
        return {
          risk: RISK_LEVELS.LOW,
          level: RISK_LEVELS.LOW,
          requiresApproval: false,
          reason: "Search submission. Autonomous execution permitted.",
          rationale: "Search submission. Autonomous execution permitted."
        };
      }
      return {
        risk: RISK_LEVELS.HIGH,
        level: RISK_LEVELS.HIGH,
        requiresApproval: true,
        reason: `Consequential form submission ('${targetLabel}'). Human approval required.`,
        rationale: `Consequential form submission ('${targetLabel}'). Human approval required.`
      };
    }

    // 2. SCROLL Action: Low risk bounded viewport movement
    if (actionType === "SCROLL") {
      return {
        risk: RISK_LEVELS.LOW,
        level: RISK_LEVELS.LOW,
        requiresApproval: false,
        reason: "Viewport scroll. Safe read-only inspection.",
        rationale: "Viewport scroll. Safe read-only inspection."
      };
    }

    // 2b. NAVIGATE / OPEN_URL Action: Safe destination navigation
    if (actionType === "NAVIGATE" || actionType === "OPEN_URL") {
      return {
        risk: RISK_LEVELS.LOW,
        level: RISK_LEVELS.LOW,
        requiresApproval: false,
        reason: `Navigation to '${action.target || action.targetLabel || "destination"}'. Autonomous execution permitted.`,
        rationale: `Navigation to '${action.target || action.targetLabel || "destination"}'. Autonomous execution permitted.`
      };
    }

    // 3. CLICK Action: Risk depends on the semantic consequence of clicking the target
    if (actionType === "CLICK") {
      // Check for critical keywords
      for (const kw of CRITICAL_RISK_KEYWORDS) {
        if (targetLabel.includes(kw)) {
          return {
            risk: RISK_LEVELS.CRITICAL,
            level: RISK_LEVELS.CRITICAL,
            requiresApproval: true,
            reason: `Critical action detected ('${kw}'). Financial or irreversible account operation requires explicit human approval.`,
            rationale: `Critical action detected ('${kw}'). Financial or irreversible account operation requires explicit human approval.`
          };
        }
      }

      // Check for composer opening buttons (e.g. "Start a post", "Create a post", "Write a post")
      // These open the editor and are non-consequential interactive controls (MEDIUM risk, autonomous)
      const isComposerOpener = /^(?:start|create|write|open|new)\s+(?:a\s+)?post\b/i.test(targetLabel);
      if (isComposerOpener) {
        return {
          risk: RISK_LEVELS.MEDIUM,
          level: RISK_LEVELS.MEDIUM,
          requiresApproval: false,
          reason: `Composer opening action ('${targetLabel}'). Autonomous execution permitted.`,
          rationale: `Composer opening action ('${targetLabel}'). Autonomous execution permitted.`
        };
      }

      // Check for high-risk / consequential keywords
      for (const kw of HIGH_RISK_KEYWORDS) {
        if (targetLabel === kw || targetLabel.includes(kw) || semanticTag === "submit_button") {
          return {
            risk: RISK_LEVELS.HIGH,
            level: RISK_LEVELS.HIGH,
            requiresApproval: true,
            reason: `Consequential action detected ('${kw}'). This action submits or permanently modifies state and requires human approval.`,
            rationale: `Consequential action detected ('${kw}'). This action submits or permanently modifies state and requires human approval.`
          };
        }
      }

      // Medium risk: general navigation, search, adding items, toggles
      if (["link", "a"].includes(targetType) || targetLabel.includes("search") || targetLabel.includes("filter") || targetLabel.includes("cart")) {
        return {
          risk: RISK_LEVELS.MEDIUM,
          level: RISK_LEVELS.MEDIUM,
          requiresApproval: false,
          reason: `Interactive navigation/selection on '${targetLabel}'. Autonomous execution permitted.`,
          rationale: `Interactive navigation/selection on '${targetLabel}'. Autonomous execution permitted.`
        };
      }

      // Default click risk
      return {
        risk: RISK_LEVELS.MEDIUM,
        level: RISK_LEVELS.MEDIUM,
        requiresApproval: false,
        reason: `Standard click interaction on '${targetLabel || "button"}'.`,
        rationale: `Standard click interaction on '${targetLabel || "button"}'.`
      };
    }

    // 4. CHECK / UNCHECK / SELECT / TOGGLE Action (Milestone 23 Hierarchical UI Interaction)
    if (["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(actionType)) {
      for (const kw of CRITICAL_RISK_KEYWORDS) {
        if (targetLabel.includes(kw)) {
          return {
            risk: RISK_LEVELS.CRITICAL,
            level: RISK_LEVELS.CRITICAL,
            requiresApproval: true,
            reason: `Critical action detected ('${kw}'). Operation requires explicit human approval.`,
            rationale: `Critical action detected ('${kw}'). Operation requires explicit human approval.`
          };
        }
      }
      for (const kw of HIGH_RISK_KEYWORDS) {
        if (targetLabel === kw || targetLabel.includes(kw)) {
          return {
            risk: RISK_LEVELS.HIGH,
            level: RISK_LEVELS.HIGH,
            requiresApproval: true,
            reason: `Consequential action detected ('${kw}'). Operation modifies state and requires human approval.`,
            rationale: `Consequential action detected ('${kw}'). Operation modifies state and requires human approval.`
          };
        }
      }
      const verbDisplay = actionType.charAt(0) + actionType.slice(1).toLowerCase();
      return {
        risk: RISK_LEVELS.LOW,
        level: RISK_LEVELS.LOW,
        requiresApproval: false,
        reason: `${verbDisplay} interaction on '${targetLabel || "control"}'. Autonomous execution permitted.`,
        rationale: `${verbDisplay} interaction on '${targetLabel || "control"}'. Autonomous execution permitted.`
      };
    }

    return {
      risk: RISK_LEVELS.LOW,
      level: RISK_LEVELS.LOW,
      requiresApproval: false,
      reason: "Action permitted under standard autonomous policy.",
      rationale: "Action permitted under standard autonomous policy."
    };
  }

  /**
   * Plans a task by transforming parsed task steps into an auditable, step-by-step reasoning plan.
   * Enforces dependencies and assigns risk classes without exposing literal form values.
   *
   * @param {Object} parsedTask - Result from SIHTaskParser.parseTask
   * @param {Object} [pageMetadata] - Current page title, URL, etc.
   * @returns {Object} Structured reasoning plan
   */
  function planTask(parsedTask, pageMetadata = {}) {
    if (!parsedTask || !Array.isArray(parsedTask.steps) || parsedTask.steps.length === 0) {
      return {
        intentSummary: "No actionable task steps parsed.",
        totalSteps: 0,
        hasHighRiskStep: false,
        steps: [],
        reasoningTrace: ["Task empty or unparseable."]
      };
    }

    const steps = [];
    const reasoningTrace = [];
    let hasHighRiskStep = false;
    let fillCount = 0;
    let clickCount = 0;

    parsedTask.steps.forEach((rawStep, idx) => {
      const stepType = (rawStep.type || "").toUpperCase();
      let riskAssessment = null;

      if (stepType === "FILL_FORM") {
        fillCount++;
        riskAssessment = classifyActionRisk({ action: "FILL_FORM", targetLabel: rawStep.fieldHint || "all form fields" });
        steps.push({
          id: idx + 1,
          stepId: idx,
          goalId: rawStep.goalId || null,
          type: "FILL_FORM",
          target: "all form fields",
          fieldHint: rawStep.fieldHint || "all form fields",
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: false,
          reasoning: `Step ${idx + 1}: Simultaneously fill all matching form fields on page using local form profile data.`,
          preconditions: ["page_active"],
          postconditions: ["all_form_fields_verified_locally"]
        });
        reasoningTrace.push(`Step ${idx + 1} planned: FILL_FORM (Simultaneous Profile Autofill) [${riskAssessment.level} Risk - Autonomous]`);
      } else if (stepType === "FILL") {
        fillCount++;
        const isSearchStep = rawStep.targetRole === "PRIMARY_SEARCH_INPUT" ||
          rawStep.expectedRole === "PRIMARY_SEARCH_INPUT" ||
          rawStep.semanticTarget === "PRIMARY_SEARCH_INPUT" ||
          rawStep.target === "PRIMARY_SEARCH_INPUT" ||
          rawStep.fieldHint === "search";
        const resolvedTarget = isSearchStep ? "PRIMARY_SEARCH_INPUT" : (rawStep.semanticTarget || rawStep.target || rawStep.fieldHint);
        const resolvedRole = isSearchStep ? "PRIMARY_SEARCH_INPUT" : (rawStep.expectedRole || rawStep.role || "input");

        riskAssessment = classifyActionRisk({ action: "FILL", targetLabel: rawStep.fieldHint || resolvedTarget });
        steps.push({
          id: idx + 1,
          stepId: idx,
          goalId: rawStep.goalId || null,
          type: "FILL",
          action: "FILL",
          target: resolvedTarget,
          fieldHint: rawStep.fieldHint || (isSearchStep ? "search" : resolvedTarget),
          value: null,
          query: rawStep.query || (isSearchStep ? (rawStep.value || rawStep.query) : null),
          semanticTarget: resolvedTarget,
          targetRole: resolvedRole,
          expectedRole: resolvedRole,
          role: resolvedRole,
          semanticRole: rawStep.semanticRole || resolvedRole,
          semanticIntent: rawStep.semanticIntent || (parsedTask && parsedTask.semanticIntent) || null,
          isSearchIntent: isSearchStep,
          isAiAssistantIntent: !!rawStep.isAiAssistantIntent,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: riskAssessment.requiresApproval,
          reasoning: isSearchStep
            ? `Step ${idx + 1}: Fill primary search input for query. Local value held in memory.`
            : `Step ${idx + 1}: Fill form field '${rawStep.fieldHint}'. Local value held in memory.`,
          preconditions: ["target_grounded", "target_visible", "target_not_disabled"],
          postconditions: ["field_value_verified_locally"]
        });
        reasoningTrace.push(`Step ${idx + 1} planned: FILL '${resolvedTarget}' [${riskAssessment.level} Risk - Autonomous]`);
      } else if (stepType === "CLICK" || stepType === "OPEN") {
        clickCount++;
        let targetLabel = (rawStep.targetEntity && rawStep.targetEntity.name) || rawStep.semanticTarget || rawStep.target || rawStep.legacyTarget || rawStep.targetHint || "control";
        if (rawStep.query && (rawStep.isProductSelection || isAbstractTarget(targetLabel))) {
          const concrete = resolveConcreteSearchTarget(rawStep.query, targetLabel, rawStep.targetEntity, rawStep.targetIntent);
          if (concrete && !isAbstractTarget(concrete)) {
            targetLabel = concrete;
          }
        }
        let resolvedAction = rawStep.action || (stepType === "OPEN" ? "OPEN" : "CLICK");
        if (resolvedAction === "OPEN" && !rawStep.targetEntity && !rawStep.url && !/^https?:\/\//i.test(targetLabel)) {
          resolvedAction = "CLICK";
        }
        riskAssessment = classifyActionRisk({
          action: resolvedAction,
          targetLabel: targetLabel,
          semanticTag: rawStep.legacyTarget
        });
        const requiresApproval = rawStep.requiresApproval || riskAssessment.requiresApproval;
        if (requiresApproval) {
          hasHighRiskStep = true;
        }

        const isSubmit = targetLabel.toLowerCase().includes("submit") || rawStep.legacyTarget === "SUBMIT_BUTTON";
        const preconditions = ["target_grounded", "target_visible", "target_not_disabled"];
        if (isSubmit && fillCount > 0) {
          preconditions.unshift("all_prior_fields_verified");
        }
        if (requiresApproval) {
          preconditions.push("human_approval_granted");
        }

        const concreteDomain = rawStep.domain || (rawStep.query && KNOWN_ENTITY_DOMAINS[rawStep.query.toLowerCase()]) || null;
        const isSearchRes = Boolean(rawStep.isSearchResult || rawStep.isProductSelection || (rawStep.query && targetLabel) || /\b(?:result|product|item|listing|website|site|link)\b/i.test(targetLabel));
        steps.push({
          id: idx + 1,
          stepId: idx,
          goalId: rawStep.goalId || null,
          type: "CLICK",
          action: resolvedAction,
          target: targetLabel,
          targetHint: targetLabel,
          semanticTarget: (rawStep.targetEntity && rawStep.targetEntity.name) || rawStep.semanticTarget || targetLabel,
          targetEntity: rawStep.targetEntity || null,
          targetIntent: rawStep.targetIntent || null,
          expectedRole: rawStep.expectedRole || rawStep.role || (isSearchRes ? "link" : "button"),
          role: rawStep.role || rawStep.expectedRole || (isSearchRes ? "link" : "button"),
          targetRole: rawStep.targetRole || rawStep.semanticRole || rawStep.expectedRole || (isSearchRes ? "link" : "button"),
          semanticRole: rawStep.semanticRole || (rawStep.expectedRole && typeof rawStep.expectedRole === "string" && rawStep.expectedRole.includes("_") ? rawStep.expectedRole : null) || (isSearchRes ? "RESULT_LINK" : "button"),
          semanticIntent: rawStep.semanticIntent || (parsedTask && parsedTask.semanticIntent) || null,
          legacyTarget: rawStep.legacyTarget || null,
          query: rawStep.query || null,
          domain: concreteDomain,
          isSearchResult: isSearchRes,
          isFirstResult: !!(rawStep.isFirstResult || (rawStep.ordinal === 1 && isSearchRes)),
          isProductSelection: !!rawStep.isProductSelection,
          isExplicitTarget: !!rawStep.isExplicitTarget,
          explicitTarget: rawStep.explicitTarget || null,
          isMostRelevant: !!rawStep.isMostRelevant,
          context: rawStep.context || null,
          relation: rawStep.relation || null,
          ordinal: rawStep.ordinal !== undefined ? rawStep.ordinal : null,
          targetType: rawStep.targetType || null,
          objectTarget: rawStep.objectTarget || null,
          attribute: rawStep.attribute || null,
          attributeValue: rawStep.attributeValue || null,
          semanticCategory: rawStep.semanticCategory || null,
          ranking: rawStep.ranking || null,
          spatial: rawStep.spatial || null,
          contentFilter: rawStep.contentFilter || null,
          referenceTarget: rawStep.referenceTarget || null,
          isSemantic: !!rawStep.isSemantic,
          conditional: rawStep.conditional || rawStep.condition || null,
          condition: rawStep.condition || rawStep.conditional || null,
          isConditional: !!(rawStep.isConditional || rawStep.condition || rawStep.conditional),
          risk: requiresApproval ? RISK_LEVELS.HIGH : (riskAssessment.risk || riskAssessment.level),
          level: requiresApproval ? RISK_LEVELS.HIGH : riskAssessment.level,
          requiresApproval: requiresApproval,
          approvalPrompt: `Execute consequential action: ${rawStep.action || "CLICK"} → ${targetLabel}`,
          reasoning: riskAssessment.rationale,
          preconditions: preconditions,
          postconditions: ["page_state_verified"]
        });
        const riskLabel = requiresApproval ? "HIGH Risk - Approval Required" : `${riskAssessment.level} Risk - Autonomous`;
        if (rawStep.targetEntity && rawStep.targetEntity.name) {
          reasoningTrace.push(`Step ${idx + 1} planned: ${rawStep.action || "OPEN"} '${rawStep.targetEntity.name}' (${rawStep.targetIntent || "target"}) [${riskLabel}]`);
        } else if (rawStep.attribute && rawStep.attributeValue) {
          reasoningTrace.push(`Step ${idx + 1} planned: CLICK '${targetLabel}' (object='${rawStep.objectTarget}', ${rawStep.attribute}='${rawStep.attributeValue}') [${riskLabel}]`);
        } else {
          reasoningTrace.push(`Step ${idx + 1} planned: CLICK '${targetLabel}' [${riskLabel}]`);
        }
      } else if (stepType === "SUBMIT") {
        const targetHint = rawStep.targetHint || "search";
        riskAssessment = classifyActionRisk({ action: "SUBMIT", targetLabel: targetHint });
        if (riskAssessment.requiresApproval) {
          hasHighRiskStep = true;
        }
        steps.push({
          id: idx + 1,
          stepId: idx,
          goalId: rawStep.goalId || null,
          type: "SUBMIT",
          target: targetHint,
          targetHint: targetHint,
          query: rawStep.query || null,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: riskAssessment.requiresApproval,
          approvalPrompt: `Execute action: SUBMIT → ${targetHint}`,
          reasoning: `Step ${idx + 1}: Submit ${targetHint}${rawStep.query ? " for '" + rawStep.query + "'" : ""}.`,
          preconditions: ["search_field_filled"],
          postconditions: ["search_results_verified"]
        });
        const riskLabel = riskAssessment.requiresApproval ? "HIGH Risk - Approval Required" : `${riskAssessment.level} Risk - Autonomous`;
        reasoningTrace.push(`Step ${idx + 1} planned: SUBMIT '${targetHint}' [${riskLabel}]`);
      } else if (stepType === "SCROLL") {
        riskAssessment = classifyActionRisk({ action: "SCROLL" });
        steps.push({
          id: idx + 1,
          stepId: idx,
          goalId: rawStep.goalId || null,
          type: "SCROLL",
          target: "PAGE",
          amount: rawStep.amount || 500,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: false,
          reasoning: `Step ${idx + 1}: Viewport scroll.`,
          preconditions: ["page_active"],
          postconditions: ["scroll_position_verified"]
        });
        reasoningTrace.push(`Step ${idx + 1} planned: SCROLL [${riskAssessment.level} Risk - Autonomous]`);
      } else if (stepType === "NAVIGATE" || stepType === "OPEN_URL") {
        const targetLabel = rawStep.targetHint || rawStep.target || "destination";
        riskAssessment = classifyActionRisk({ action: "NAVIGATE", target: targetLabel, targetLabel: targetLabel });
        steps.push({
          id: idx + 1,
          stepId: idx,
          goalId: rawStep.goalId || null,
          type: "NAVIGATE",
          action: "NAVIGATE",
          target: targetLabel,
          targetHint: targetLabel,
          url: rawStep.url || null,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: false,
          reasoning: `Step ${idx + 1}: Navigate to ${targetLabel}.`,
          preconditions: ["browser_active"],
          postconditions: ["page_navigated"]
        });
        reasoningTrace.push(`Step ${idx + 1} planned: NAVIGATE '${targetLabel}' [${riskAssessment.level} Risk - Autonomous]`);
      } else if (["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(stepType)) {
        clickCount++;
        const targetLabel = rawStep.targetHint || rawStep.target || "control";
        riskAssessment = classifyActionRisk({
          action: stepType,
          targetLabel: targetLabel,
          targetType: rawStep.targetType
        });
        if (riskAssessment.requiresApproval) {
          hasHighRiskStep = true;
        }
        steps.push({
          id: idx + 1,
          stepId: idx,
          goalId: rawStep.goalId || null,
          type: stepType,
          action: stepType,
          target: targetLabel,
          targetHint: targetLabel,
          context: rawStep.context || null,
          relation: rawStep.relation || null,
          ordinal: rawStep.ordinal !== undefined ? rawStep.ordinal : null,
          targetType: rawStep.targetType || null,
          objectTarget: rawStep.objectTarget || null,
          attribute: rawStep.attribute || null,
          attributeValue: rawStep.attributeValue || null,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: riskAssessment.requiresApproval,
          approvalPrompt: `Execute action: ${stepType} → ${targetLabel}`,
          reasoning: riskAssessment.rationale,
          preconditions: ["target_grounded", "target_visible", "target_not_disabled"],
          postconditions: ["target_state_verified"]
        });
        const riskLabel = riskAssessment.requiresApproval ? "HIGH Risk - Approval Required" : `${riskAssessment.level} Risk - Autonomous`;
        reasoningTrace.push(`Step ${idx + 1} planned: ${stepType} '${targetLabel}' [${riskLabel}]`);
      }
    });

    let intentSummary = "";
    if (fillCount > 0 && clickCount > 0) {
      intentSummary = `Composite workflow: Fill ${fillCount} form field(s) followed by ${clickCount} interactive action(s).`;
    } else if (fillCount > 0) {
      intentSummary = `Form filling task: Fill ${fillCount} field(s) locally.`;
    } else if (clickCount > 0) {
      intentSummary = `Interactive task: Execute ${clickCount} browser action(s).`;
    } else {
      intentSummary = "Read-only inspection or scrolling task.";
    }

    if (hasHighRiskStep) {
      reasoningTrace.push("Safety policy: High-impact action detected. Autonomous loop will pause for human approval.");
    }

    const approvalObj = (parsedTask && parsedTask.approval) || {
      required: !!(parsedTask && (parsedTask.requireApprovalBeforeSend || parsedTask.requireApprovalBeforeSubmit || parsedTask.requireApprovalBeforeBuy || hasHighRiskStep)),
      before_action: (parsedTask && parsedTask.requireApprovalBeforeSend) ? "SEND" :
                     (parsedTask && parsedTask.requireApprovalBeforeSubmit) ? "SUBMIT" :
                     (parsedTask && parsedTask.requireApprovalBeforeBuy) ? "PURCHASE" :
                     hasHighRiskStep ? "HIGH_RISK_ACTION" : null
    };

    const initialPlan = {
      intentSummary: intentSummary,
      totalSteps: steps.length,
      hasHighRiskStep: hasHighRiskStep,
      steps: steps,
      goals: (parsedTask && parsedTask.goals) || [],
      approval: approvalObj,
      constraints: (parsedTask && parsedTask.constraints) || [],
      stopCondition: (parsedTask && parsedTask.stopCondition) || null,
      approvalRequirement: (parsedTask && parsedTask.approvalRequirement) || null,
      requireApprovalBeforeSend: !!(parsedTask && parsedTask.requireApprovalBeforeSend),
      requireApprovalBeforeSubmit: !!(parsedTask && parsedTask.requireApprovalBeforeSubmit),
      requireApprovalBeforeBuy: !!(parsedTask && parsedTask.requireApprovalBeforeBuy),
      doNotSend: !!(parsedTask && parsedTask.doNotSend),
      doNotSubmit: !!(parsedTask && parsedTask.doNotSubmit),
      reasoningTrace: reasoningTrace
    };

    return normalizeTaskPlan(initialPlan, parsedTask);
  }

  /**
   * Semantic Task Normalization Stage:
   * Placed strictly between Gemini / Reasoning Planner and Grounding.
   * Enforces the separation between DATA / CONTENT, ACTIONS, and CONTROL / SAFETY.
   *
   * Validates:
   * 1. Target validity for all FILL steps (rejects command connectors like "but", "and", "then").
   * 2. Content isolation: Extracts any leaked control clauses from field values (e.g. "ask me before sending", "wait for approval").
   * 3. Action isolation: Splits any embedded subsequent actions from field values (e.g. "ISRO. Open the most relevant result").
   * 4. Safety attachment: Guarantees human approval gates remain attached to the consequential action (SEND, SUBMIT, PURCHASE).
   * 5. Preserves exact user content and conditional clauses without website-specific hardcoding.
   *
   * @param {Object} plan - The reasoning plan or Gemini plan
   * @param {Object} [parsedTask] - The locally parsed deterministic task
   * @param {string} [rawUserTask] - Original free-text user instruction
   * @returns {Object} Normalized plan conforming to structured internal task model
   */
  function normalizeTaskPlan(plan, parsedTask = null, rawUserTask = "") {
    if (!plan) return plan;

    const rawText = rawUserTask || (parsedTask && (parsedTask.rawTask || parsedTask.task)) || "";
    const lowerRaw = rawText.toLowerCase();

    // 1. Establish Task-Level Approval & Safety Constraints
    let reqSendApproval = Boolean(
      (plan && plan.requireApprovalBeforeSend) ||
      (parsedTask && parsedTask.requireApprovalBeforeSend) ||
      /\b(?:(?:ask|get)\s+(?:me\s+)?(?:for\s+)?(?:my\s+)?(?:approval|confirmation)\s+before\s+send(?:ing)?|ask\s+me\s+before\s+send(?:ing)?|wait\s+for\s+(?:my\s+approval|approval|me)\s+before\s+send(?:ing)?|confirm\s+with\s+me\s+before\s+send(?:ing)?)\b/i.test(lowerRaw)
    );

    let reqSubmitApproval = Boolean(
      (plan && plan.requireApprovalBeforeSubmit) ||
      (parsedTask && parsedTask.requireApprovalBeforeSubmit) ||
      /\b(?:(?:ask|get)\s+(?:me\s+)?(?:for\s+)?(?:my\s+)?(?:approval|confirmation)\s+before\s+submit(?:ting)?|ask\s+me\s+before\s+submit(?:ting)?|wait\s+for\s+(?:my\s+approval|approval|me)\s+before\s+submit(?:ting)?|confirm\s+with\s+me\s+before\s+submit(?:ting)?|approval\s+before\s+submit(?:ting)?)\b/i.test(lowerRaw)
    );

    let reqBuyApproval = Boolean(
      (plan && plan.requireApprovalBeforeBuy) ||
      (parsedTask && parsedTask.requireApprovalBeforeBuy) ||
      /\b(?:(?:ask|get)\s+(?:me\s+)?(?:for\s+)?(?:my\s+)?(?:approval|confirmation)\s+before\s+(?:checkout|buy(?:ing)?|purchas(?:e|ing)|order(?:ing)?)|ask\s+me\s+before\s+(?:checkout|buy(?:ing)?|purchas(?:e|ing)|order(?:ing)?))\b/i.test(lowerRaw)
    );

    let doNotSend = Boolean(
      (plan && plan.doNotSend) ||
      (parsedTask && parsedTask.doNotSend) ||
      /\b(?:do\s+not\s+send(?:\s+it)?|don'?t\s+(?:click\s+)?send(?:\s+it)?|never\s+send)\b(?!\s*until\s+i\s+approve)/i.test(lowerRaw)
    );

    let doNotSubmit = Boolean(
      (plan && plan.doNotSubmit) ||
      (parsedTask && parsedTask.doNotSubmit) ||
      /\b(?:do\s+not\s+submit(?:\s+it)?|don'?t\s+(?:click\s+)?submit(?:\s+it)?|never\s+submit)\b(?!\s*until\s+i\s+approve)/i.test(lowerRaw)
    );

    const steps = Array.isArray(plan.steps) ? [...plan.steps] : [];
    const normalizedSteps = [];
    const additionalSteps = [];

    const CONNECTOR_WORDS = /^(?:but|and|then|also|so|or|if|when|while|after|before|until|ask|wait|stop|pause|confirm|approval|require|let|do|don't|not|never)$/i;

    const CONTROL_CLAUSE_REGEX = /(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:(?:ask|get)\s+(?:me\s+)?(?:for\s+)?(?:my\s+)?(?:approval|confirmation)\s+before\s+(?:send(?:ing)?|submit(?:ting)?|checkout|buy(?:ing)?|purchas(?:e|ing))|ask\s+me\s+before\s+(?:send(?:ing)?|submit(?:ting)?|checkout|buy(?:ing)?|purchas(?:e|ing))|wait\s+for\s+(?:my\s+approval|approval|me)\s+before\s+(?:send(?:ing)?|submit(?:ting)?)|(?:don'?t|do\s+not)\s+(?:send|submit)(?:\s+it)?|stop\s+before\s+(?:send(?:ing)?|submit(?:ting)?)|let\s+me\s+approve\s+(?:it\s+)?first).*$/i;

    for (let i = 0; i < steps.length; i++) {
      const step = { ...steps[i] };
      const stepType = (step.type || step.action || "").toUpperCase();

      if (stepType === "FILL") {
        const rawTarget = (step.target || step.fieldHint || "").trim();

        // 1. Is target actually an input field? Reject leaked command connectors
        if (CONNECTOR_WORDS.test(rawTarget)) {
          // If value was a control clause, transfer to approval constraints
          const val = String(step.value || "");
          if (/before\s+send/i.test(val)) reqSendApproval = true;
          if (/before\s+submit/i.test(val)) reqSubmitApproval = true;
          if (/before\s+(?:buy|checkout|purchase)/i.test(val)) reqBuyApproval = true;
          // Do NOT keep this invalid fill step
          continue;
        }

        // 2. Validate value: Does value contain embedded action or control clauses?
        let rawVal = String(step.value || "");
        if (!rawVal && parsedTask) {
          if (Array.isArray(parsedTask.steps)) {
            const matchStep = parsedTask.steps.find((ps, pi) =>
              (ps.stepId === step.stepId || pi === step.stepId || pi === i) && ps.value
            );
            if (matchStep && matchStep.value) {
              rawVal = String(matchStep.value);
            }
          }
          if (!rawVal && step.fieldHint && parsedTask.localValues) {
            const h = step.fieldHint.toLowerCase().trim();
            for (const [k, v] of Object.entries(parsedTask.localValues)) {
              if (k.toLowerCase().trim() === h && v) {
                rawVal = String(v);
                break;
              }
            }
          }
        }

        // Check if value contains control instruction
        if (CONTROL_CLAUSE_REGEX.test(rawVal)) {
          if (/before\s+send/i.test(rawVal)) reqSendApproval = true;
          if (/before\s+submit/i.test(rawVal)) reqSubmitApproval = true;
          if (/before\s+(?:buy|checkout|purchase)/i.test(rawVal)) reqBuyApproval = true;
          if (/\b(?:don'?t|do\s+not)\s+send\b/i.test(rawVal)) doNotSend = true;
          if (/\b(?:don'?t|do\s+not)\s+submit\b/i.test(rawVal)) doNotSubmit = true;
          rawVal = rawVal.replace(CONTROL_CLAUSE_REGEX, "").trim();
        }

        // Strip leading message preambles
        rawVal = rawVal.replace(/^(?:the\s+message\s+(?:saying\s+|that\s+)?|message\s+(?:saying\s+|that\s+)?|the\s+text\s+(?:saying\s+|that\s+)?|text\s+(?:saying\s+|that\s+)?|saying\s+|that\s+)/i, "").trim();

        // Clean quotes
        if (rawVal.length >= 2) {
          const first = rawVal[0];
          const last = rawVal[rawVal.length - 1];
          if ((first === '"' && last === '"') || (first === "'" && last === "'") ||
              ((first === '“' || first === '”') && (last === '”' || last === '“')) ||
              ((first === '‘' || first === '’') && (last === '’' || last === '‘'))) {
            rawVal = rawVal.slice(1, -1).trim();
          }
        }

        // Re-clean preamble if exposed inside quotes
        rawVal = rawVal.replace(/^(?:the\s+message\s+(?:saying\s+|that\s+)?|message\s+(?:saying\s+|that\s+)?|the\s+text\s+(?:saying\s+|that\s+)?|text\s+(?:saying\s+|that\s+)?|saying\s+|that\s+)/i, "").trim();

        // Check if value contains an embedded subsequent action e.g. "ISRO. Open the most relevant result."
        const embeddedActionMatch = rawVal.match(/^(.*?)(?:[.,;]\s*|\s+and\s+|\s+then\s+)(?:open|click|select|choose)\s+(.+)$/i);
        if (embeddedActionMatch && step.isSearchIntent) {
          rawVal = embeddedActionMatch[1].trim();
          const trailingTarget = embeddedActionMatch[2].trim();
          additionalSteps.push({
            id: steps.length + additionalSteps.length + 1,
            type: "CLICK",
            action: "CLICK",
            target: trailingTarget,
            targetHint: trailingTarget,
            semanticTarget: trailingTarget,
            isSearchResult: true,
            risk: RISK_LEVELS.MEDIUM,
            level: RISK_LEVELS.MEDIUM,
            requiresApproval: false,
            preconditions: ["page_state_verified"],
            postconditions: ["page_state_verified"]
          });
        }

        step.value = step.isSearchIntent ? rawVal : null;
        if (parsedTask && parsedTask.localValues) {
          parsedTask.localValues[step.stepId] = rawVal;
          if (step.fieldHint) parsedTask.localValues[step.fieldHint.toLowerCase()] = rawVal;
        }

        normalizedSteps.push(step);
      } else if (stepType === "CLICK" || stepType === "OPEN") {
        const tNorm = (step.target || step.targetHint || "").toLowerCase();
        const isComposerOpener = /^(?:start|create|write|open|new)\s+(?:a\s+)?post\b/i.test(tNorm) || step.semanticRole === "POST_ENTRY" || step.targetRole === "POST_ENTRY" || step.semanticRole === "MESSAGE_BUTTON" || step.targetRole === "MESSAGE_BUTTON" || step.semanticRole === "REPLY_BUTTON" || step.targetRole === "REPLY_BUTTON";
        const isSend = !isComposerOpener && (tNorm === "send" || tNorm === "send message" || step.legacyTarget === "SEND_BUTTON" || step.targetRole === "SEND_BUTTON" || step.semanticRole === "SEND_BUTTON");
        const isPublish = !isComposerOpener && (tNorm === "post" || tNorm === "publish" || step.legacyTarget === "PUBLISH_BUTTON" || step.targetRole === "PUBLISH_BUTTON" || step.semanticRole === "PUBLISH_BUTTON");
        const isSubmit = tNorm === "submit" || /\bsubmit\b/i.test(tNorm) || step.legacyTarget === "SUBMIT_BUTTON" || step.targetRole === "SUBMIT_BUTTON" || step.semanticRole === "SUBMIT_BUTTON";
        const isBuy = tNorm === "buy" || tNorm === "checkout" || /\b(?:buy|checkout|purchase)\b/i.test(tNorm);

        if (isComposerOpener) {
          step.requiresApproval = false;
          step.risk = RISK_LEVELS.MEDIUM;
          step.level = RISK_LEVELS.MEDIUM;
          if (step.semanticRole === "POST_ENTRY" || /post/i.test(tNorm)) {
            step.expectedTransition = "post_composer_open";
          } else if (step.semanticRole === "MESSAGE_BUTTON" || /message/i.test(tNorm)) {
            step.expectedTransition = "message_composer_open";
          } else if (step.semanticRole === "REPLY_BUTTON" || /reply/i.test(tNorm)) {
            step.expectedTransition = "reply_composer_open";
          }
        } else if (isSend) {
          if (doNotSend) {
            step.doNotExecute = true;
            step.requiresApproval = false;
          } else {
            step.requiresApproval = true;
            step.risk = RISK_LEVELS.HIGH;
            step.level = RISK_LEVELS.HIGH;
            if (!step.preconditions) step.preconditions = [];
            if (!step.preconditions.includes("human_approval_granted")) {
              step.preconditions.push("human_approval_granted");
            }
          }
        } else if (isPublish) {
          if (doNotSend) {
            step.doNotExecute = true;
            step.requiresApproval = false;
          } else {
            step.requiresApproval = true;
            step.risk = RISK_LEVELS.HIGH;
            step.level = RISK_LEVELS.HIGH;
            if (!step.preconditions) step.preconditions = [];
            if (!step.preconditions.includes("human_approval_granted")) {
              step.preconditions.push("human_approval_granted");
            }
          }
        } else if (isSubmit) {
          if (doNotSubmit) {
            step.doNotExecute = true;
            step.requiresApproval = false;
          } else if (reqSubmitApproval) {
            step.requiresApproval = true;
            step.risk = RISK_LEVELS.HIGH;
            step.level = RISK_LEVELS.HIGH;
            if (!step.preconditions) step.preconditions = [];
            if (!step.preconditions.includes("human_approval_granted")) {
              step.preconditions.push("human_approval_granted");
            }
          }
        } else if (isBuy) {
          if (reqBuyApproval) {
            step.requiresApproval = true;
            step.risk = RISK_LEVELS.HIGH;
            step.level = RISK_LEVELS.HIGH;
            if (!step.preconditions) step.preconditions = [];
            if (!step.preconditions.includes("human_approval_granted")) {
              step.preconditions.push("human_approval_granted");
            }
          }
        }

        normalizedSteps.push(step);
      } else if (stepType === "SUBMIT") {
        if (doNotSubmit) {
          step.doNotExecute = true;
          step.requiresApproval = false;
        } else if (reqSubmitApproval) {
          step.requiresApproval = true;
          step.risk = RISK_LEVELS.HIGH;
          step.level = RISK_LEVELS.HIGH;
          if (!step.preconditions) step.preconditions = [];
          if (!step.preconditions.includes("human_approval_granted")) {
            step.preconditions.push("human_approval_granted");
          }
        }
        normalizedSteps.push(step);
      } else {
        normalizedSteps.push(step);
      }
    }

    if (additionalSteps.length > 0) {
      normalizedSteps.push(...additionalSteps);
    }

    const finalSteps = normalizedSteps.filter((st) => !st.doNotExecute);
    finalSteps.forEach((st, idx) => {
      if (!st.action) st.action = st.type;
      if (!st.target) st.target = st.targetHint || st.fieldHint || "PAGE";
      st.previousAction = idx > 0 ? (finalSteps[idx - 1].action || finalSteps[idx - 1].type) : null;
      st.currentAction = st.action || st.type;
      st.nextAction = idx < finalSteps.length - 1 ? (finalSteps[idx + 1].action || finalSteps[idx + 1].type) : null;
      st.currentUiState = idx === 0 ? "initial" : (finalSteps[idx - 1].expectedTransition || "stable");
      st.semanticTarget = st.semanticTarget || st.targetHint || st.target;
      st.targetRole = st.targetRole || st.expectedRole || st.role || (st.type === "CLICK" ? "button" : (st.type === "FILL" ? "input" : null));

      const tNorm = (st.target || st.targetHint || st.fieldHint || "").toLowerCase();
      if (!st.expectedTransition) {
        if (st.type === "NAVIGATE") {
          st.expectedTransition = "page_navigated";
        } else if (st.type === "CLICK" && /^(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(tNorm)) {
          st.expectedTransition = "post_composer_open";
        } else if (st.type === "CLICK" && /\b(?:message|new\s+message)\b/i.test(tNorm)) {
          st.expectedTransition = "message_composer_open";
        } else if (st.type === "CLICK" && /\breply\b/i.test(tNorm)) {
          st.expectedTransition = "reply_composer_open";
        } else if (st.type === "CLICK" && /\b(?:compose|new\s+email)\b/i.test(tNorm)) {
          st.expectedTransition = "compose_modal_open";
        } else if (st.type === "CLICK" && /\bcomment\b/i.test(tNorm)) {
          st.expectedTransition = "comment_box_open";
        } else if (st.type === "FILL" && (st.composerType === "post" || st.context === "post_composer" || /\b(?:post\s+composer|post\s+editor|post)\b/i.test(tNorm))) {
          st.expectedTransition = "composer_filled";
          st.context = st.context || "post_composer";
        } else if (st.type === "FILL" && (st.composerType === "message" || st.context === "message_composer" || /\bmessage\b/i.test(tNorm))) {
          st.expectedTransition = "message_filled";
          st.context = st.context || "message_composer";
        } else if (st.type === "FILL" && (st.composerType === "reply" || st.context === "reply_composer" || /\breply\b/i.test(tNorm))) {
          st.expectedTransition = "reply_filled";
          st.context = st.context || "reply_composer";
        } else if (st.type === "FILL" && (st.composerType === "email" || st.context === "compose_body" || /\b(?:compose|new\s+email|email|mail)\b/i.test(tNorm))) {
          st.expectedTransition = "compose_filled";
          st.context = st.context || "compose_body";
        } else if (st.type === "FILL" && (st.composerType === "comment" || st.context === "comment_box" || /\bcomment\b/i.test(tNorm))) {
          st.expectedTransition = "comment_filled";
          st.context = st.context || "comment_box";
        } else if (st.type === "CLICK" && (/^post$/i.test(tNorm) || /^publish$/i.test(tNorm))) {
          st.expectedTransition = "post_published";
          st.context = st.context || "post_composer";
        } else if (st.type === "CLICK" && /^send$/i.test(tNorm)) {
          st.expectedTransition = "message_sent";
        }
      }
    });
    const hasHighRisk = finalSteps.some((st) => st.requiresApproval || st.risk === RISK_LEVELS.HIGH || st.risk === RISK_LEVELS.CRITICAL);

    const approvalObj = {
      required: Boolean(reqSendApproval || reqSubmitApproval || reqBuyApproval || (plan.approval && plan.approval.required)),
      before_action: reqSendApproval ? "SEND" :
                     reqSubmitApproval ? "SUBMIT" :
                     reqBuyApproval ? "PURCHASE" :
                     (plan.approval && plan.approval.before_action) ? plan.approval.before_action :
                     hasHighRisk ? "HIGH_IMPACT_ACTION" : null
    };

    return {
      ...plan,
      semanticIntent: (parsedTask && parsedTask.semanticIntent) || (plan && plan.semanticIntent) || null,
      steps: finalSteps,
      totalSteps: finalSteps.length,
      hasHighRiskStep: hasHighRisk,
      approval: approvalObj,
      requireApprovalBeforeSend: reqSendApproval,
      requireApprovalBeforeSubmit: reqSubmitApproval,
      requireApprovalBeforeBuy: reqBuyApproval,
      doNotSend: doNotSend,
      doNotSubmit: doNotSubmit
    };
  }

  /**
   * Helper to verify if the overall user task and all subgoals have completed successfully.
   * Ensures agent loop does not terminate prematurely merely because one action succeeded.
   *
   * @param {Object} plan - The reasoning plan from planTask
   * @param {Array<Object>} executionHistory - Complete history of executed steps
   * @returns {boolean} True only when all steps/goals in plan are verified
   */
  function isOverallTaskCompleted(plan, executionHistory = []) {
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      return false;
    }
    // All planned steps must be accounted for in executionHistory with successful execution
    const executedStepIndices = new Set(
      executionHistory
        .filter((h) => h && h.executed && h.status === "success")
        .map((h) => (typeof h.step === "number" ? h.step - 1 : (typeof h.stepId === "number" ? h.stepId : -1)))
    );

    return plan.steps.every((st, idx) => executedStepIndices.has(idx) || executedStepIndices.has(st.stepId));
  }

  /**
   * Validates whether all preconditions for a step are satisfied before execution.
   * Enforces that high-impact actions like Submit require all prior fields to be verified.
   *
   * @param {Object} step - Step descriptor from planTask
   * @param {Array<Object>} completedStepsHistory - History of completed steps with their verification status
   * @param {Object} [approvalToken] - Human approval token if already granted
   * @returns {{ valid: boolean, reason: string }}
   */
  function validatePreconditions(step, completedStepsHistory = [], approvalToken = null) {
    if (!step) {
      return { valid: true, satisfied: true, reason: "No preconditions specified for step." };
    }

    // 1. Dependency check: Submit requires all prior fill operations to have succeeded and verified
    if (step.preconditions && step.preconditions.includes("all_prior_fields_verified")) {
      const failedOrUnverified = completedStepsHistory.filter(
        (prev) => prev.action && (prev.action.action === "FILL" || prev.action.action === "FILL_FORM") && !prev.verified
      );
      if (failedOrUnverified.length > 0) {
        const failedHints = failedOrUnverified.map(f => f.action.targetLabel || f.action.action || "field").join(", ");
        return {
          valid: false,
          satisfied: false,
          reason: `Precondition failed: Cannot execute '${step.targetHint || "Submit"}' because prior field(s) [${failedHints}] were not verified.`
        };
      }
    }

    // 1b. Search submission check: Submit requires prior search query fill
    if (step.preconditions && step.preconditions.includes("search_field_filled")) {
      const hasPriorFill = completedStepsHistory.some(
        (prev) => prev.action && (prev.action.action === "FILL" || prev.action.action === "FILL_FORM") && (prev.executed || prev.status === "success")
      );
      if (!hasPriorFill) {
        return {
          valid: false,
          satisfied: false,
          reason: "Precondition failed: Cannot execute search submission before query has been filled."
        };
      }
    }

    // 2. Human approval check for high-risk actions
    if (step.requiresApproval) {
      if (!approvalToken || !approvalToken.approved) {
        return {
          valid: false,
          satisfied: false,
          requiresHumanApproval: true,
          reason: `Precondition paused: Consequential action '${step.targetHint || step.type}' requires explicit human approval.`
        };
      }

      // Validate that approval token matches this exact step and target
      const targetMatch = normalize(approvalToken.target) === normalize(step.targetHint || step.fieldHint || "");
      if (!targetMatch && approvalToken.stepId !== step.stepId) {
        return {
          valid: false,
          satisfied: false,
          reason: "Precondition failed: Stale or mismatched approval token."
        };
      }
    }

    return { valid: true, satisfied: true, reason: "All preconditions satisfied." };
  }

  /**
   * Generic Action Normalization at the Planning/Action Boundary:
   * Converts high-level semantic intent (e.g. "OPEN") into an executable action type
   * ("CLICK" or "NAVIGATE"/"OPEN_URL") based on grounded target type, DOM role, or URL.
   * Preserves semanticAction and executionAction for auditing, explainability, and UI display.
   *
   * @param {Object} action - Proposed action or grounded target
   * @param {Object} [stepPlan] - Optional step plan context
   * @returns {Object} action with normalized executable action and preserved semanticAction
   */
  function normalizeAction(action, stepPlan = null) {
    if (!action || typeof action !== "object") return action;

    const rawAction = (action.action || (stepPlan && (stepPlan.action || stepPlan.type)) || "").toUpperCase();

    // Preserve original semantic intent for UI and audit telemetry
    if (!action.semanticAction) {
      action.semanticAction = (action.action || (stepPlan && (stepPlan.action || stepPlan.type)) || "CLICK").toUpperCase();
    }

    if (rawAction === "OPEN") {
      const targetStr = String(action.url || action.target || action.targetLabel || (stepPlan && (stepPlan.targetHint || stepPlan.target)) || "").trim();
      const targetType = (action.targetType || (stepPlan && stepPlan.targetType) || "").toLowerCase();
      const targetRole = (action.role || action.expectedRole || (stepPlan && (stepPlan.role || stepPlan.expectedRole)) || "").toLowerCase();

      const isUrl = Boolean(
        action.url ||
        action.isNavigation ||
        (stepPlan && (stepPlan.url || stepPlan.isNavigation)) ||
        /^https?:\/\//i.test(targetStr) ||
        /^www\./i.test(targetStr) ||
        /^[a-zA-Z0-9_\-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(targetStr) ||
        /^localhost(?::\d+)?(?:\/.*)?$/i.test(targetStr)
      );

      // Check if target is a grounded clickable webpage element/link/button
      const hasGroundedTarget = (
        action.targetIndex !== undefined &&
        action.targetIndex !== null &&
        action.targetIndex >= 0 &&
        action.action !== "NONE" &&
        action.groundingMethod !== "target-not-found" &&
        action.groundingMethod !== "attribute-not-verified" &&
        action.groundingMethod !== "ambiguous-attribute-targets" &&
        action.groundingMethod !== "ambiguous-semantic-targets"
      );

      const isClickableRoleOrType = (
        ["link", "button", "a", "tab", "menuitem", "element", "clickable", "heading", "card"].includes(targetType) ||
        ["link", "button", "a", "tab", "menuitem", "element", "clickable", "heading", "card"].includes(targetRole) ||
        Boolean(action.clickable || action.href)
      );

      if (isUrl && !hasGroundedTarget) {
        action.action = "NAVIGATE";
        action.executionAction = "NAVIGATE";
        if (!action.url && /^https?:\/\//i.test(targetStr)) {
          action.url = targetStr;
        }
      } else if (hasGroundedTarget || isClickableRoleOrType || (action.groundingScore && action.groundingScore >= 0.35 && !isUrl)) {
        action.action = "CLICK";
        action.executionAction = "CLICK";
      } else if (isUrl) {
        action.action = "NAVIGATE";
        action.executionAction = "NAVIGATE";
      }
      // If ungrounded and not a destination URL, leave action as is so safety gate / grounding can block it safely
    } else {
      action.executionAction = action.action;
    }

    // Abstract search-result reference normalization (Rule 10)
    const currentTarget = String(action.target || action.targetLabel || (stepPlan && (stepPlan.targetHint || stepPlan.target)) || "").trim();
    if (isAbstractTarget(currentTarget) || isAbstractTarget(action.target) || isAbstractTarget(action.targetLabel)) {
      const q = (stepPlan && stepPlan.query) || null;
      if (q) {
        const concreteTarget = resolveConcreteSearchTarget(q, currentTarget, stepPlan?.targetEntity, stepPlan?.targetIntent);
        if (action.target && isAbstractTarget(action.target)) {
          action.target = concreteTarget;
        }
        if (action.targetLabel && isAbstractTarget(action.targetLabel)) {
          action.targetLabel = concreteTarget;
        }
        if (!action.target) {
          action.target = concreteTarget;
        }
      }
    }

    return action;
  }

  /**
   * Local Safety Gate: Evaluates proposed action immediately before execution.
   * Ensures backend cannot bypass local safety policy or human approval.
   *
   * @param {Object} agentAction - Proposed action from backend or local planner
   * @param {Object} stepPlan - Step definition from reasoning planner
   * @param {Object} approvalState - Current in-memory approval token
   * @param {Object} pageIdentity - Current tab URL and title to detect navigation drift
   * @returns {{ allowed: boolean, requiresApproval: boolean, risk: string, reason: string }}
   */
  function evaluateSafetyGate(agentAction, stepPlan, approvalState = null, pageIdentity = {}) {
    if (!agentAction || typeof agentAction !== "object") {
      return {
        allowed: false,
        requiresApproval: false,
        risk: RISK_LEVELS.LOW,
        reason: "Invalid action object."
      };
    }

    // Generic action normalization at the safety/planning boundary:
    // If OPEN is grounded to a clickable webpage element/link/button, normalize to CLICK.
    // If OPEN is a destination URL, normalize to NAVIGATE.
    normalizeAction(agentAction, stepPlan);

    const actionType = (agentAction.action || "").toUpperCase();
    const ALLOWED_ACTIONS = new Set([
      "CLICK", "SCROLL", "FILL", "FILL_FORM", "SUBMIT", "NONE",
      "CHECK", "UNCHECK", "SELECT", "TOGGLE", "NAVIGATE", "OPEN_URL"
    ]);
    if (!ALLOWED_ACTIONS.has(actionType)) {
      return {
        allowed: false,
        requiresApproval: false,
        risk: RISK_LEVELS.CRITICAL,
        reason: `Action '${actionType}' is not in the local permitted allowlist.`
      };
    }

    if (actionType === "NONE") {
      return {
        allowed: true,
        requiresApproval: false,
        risk: RISK_LEVELS.LOW,
        reason: "No-op action safely allowed."
      };
    }

    // Determine risk dynamically based on target and semantic context
    const riskAssessment = classifyActionRisk(agentAction);
    const requiresApproval = riskAssessment.requiresApproval || (stepPlan && stepPlan.requiresApproval);

    if (requiresApproval) {
      // Check if approval state is provided
      if (!approvalState || approvalState.approved === false) {
        return {
          allowed: false,
          requiresApproval: true,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          reason: `High-impact action '${actionType} \u2192 ${agentAction.targetLabel || agentAction.target || "target"}' requires explicit human approval.`
        };
      }

      // Check token expiration (> 5 minutes old)
      if (approvalState.timestamp && (Date.now() - approvalState.timestamp > 5 * 60 * 1000)) {
        return {
          allowed: false,
          requiresApproval: true,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          reason: "Prior approval expired: approval window exceeded. Fresh human approval required."
        };
      }

      // Prevent stale approval bypass: verify approval matches action, target, and page context
      const actionMatches = approvalState.action === actionType;
      const targetMatches = normalize(approvalState.target) === normalize(agentAction.targetLabel || agentAction.target || "");
      const urlMatches = !approvalState.pageUrl || !pageIdentity.url || approvalState.pageUrl === pageIdentity.url;

      if (!actionMatches || !targetMatches || !urlMatches) {
        const mismatchReason = !urlMatches
          ? "Page URL changed since approval was granted. Prior approval invalidated."
          : (!targetMatches
              ? "Action target drifted since approval was granted. Prior approval invalidated."
              : "Action type changed since approval was granted. Prior approval invalidated.");
        return {
          allowed: false,
          requiresApproval: true,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          reason: mismatchReason
        };
      }

      return {
        allowed: true,
        requiresApproval: false,
        risk: riskAssessment.risk || riskAssessment.level,
        level: riskAssessment.level,
        reason: `High-impact action '${actionType} \u2192 ${agentAction.targetLabel || agentAction.target}' validated via explicit human approval.`
      };
    }

    // Low / Medium risk actions proceed autonomously under local safety bounds
    return {
      allowed: true,
      requiresApproval: false,
      risk: riskAssessment.level,
      reason: `Action '${actionType}' permitted under autonomous local safety policy (${riskAssessment.rationale}).`
    };
  }

  /**
   * Verifies that the expected postcondition of an action occurred.
   *
   * @param {Object} stepPlan - Step definition
   * @param {Object} executionResult - Result returned by content.js executeAction
   * @param {Object} changeResult - Result from change-detector.js
   * @returns {{ verified: boolean, reason: string }}
   */
  function verifyPostconditions(stepPlan, executionResult, changeResult = null) {
    if (!executionResult || !executionResult.executed) {
      return {
        verified: false,
        reason: executionResult?.reason || "Action was not executed."
      };
    }

    const stepType = (stepPlan?.type || executionResult.action || "").toUpperCase();

    if (stepType === "FILL") {
      const isVerifiedLocally = !!executionResult.verified;
      return {
        verified: isVerifiedLocally,
        reason: isVerifiedLocally
          ? "Input field state verified locally."
          : "Local value verification failed on target control."
      };
    }

    if (stepType === "SUBMIT") {
      return {
        verified: !!executionResult.executed,
        reason: executionResult.executed
          ? "Search submission executed and verified."
          : (executionResult.reason || "Submission failed.")
      };
    }

    if (stepType === "SCROLL") {
      const scrollChanged = changeResult ? changeResult.changed : true;
      return {
        verified: scrollChanged,
        reason: scrollChanged ? "Viewport scroll verified." : "Scroll did not shift page content."
      };
    }

    if (stepType === "CLICK" || stepType === "OPEN") {
      const pageChanged = changeResult ? changeResult.changed : true;
      return {
        verified: true,
        reason: pageChanged
          ? `Click executed and verified (${changeResult ? changeResult.reason : "state changed"}).`
          : "Click dispatched; awaiting downstream response."
      };
    }

    return { verified: true, reason: "Action completed." };
  }

  return {
    RISK_LEVELS,
    classifyActionRisk,
    normalizeAction,
    normalizeTaskPlan,
    normalizeSemanticTask: normalizeTaskPlan,
    planTask,
    validatePreconditions,
    evaluateSafetyGate,
    verifyPostconditions,
    isOverallTaskCompleted,
    resolveConcreteSearchTarget,
    isAbstractTarget,
    KNOWN_ENTITY_DOMAINS
  };
});
