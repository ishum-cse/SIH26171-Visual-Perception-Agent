/**
 * task-parser.js - Deterministic, bounded, local natural language task parser.
 * Runs client-side ONLY inside the extension popup.
 *
 * CRITICAL PRIVACY CONTRACT:
 * Literal FILL values extracted by this parser MUST NEVER be sent to the backend,
 * included in any network payload, or logged to network destinations.
 * Only sanitized field hints (e.g. "name", "email") and action sequence structures
 * may be transmitted to the backend gateway for grounding.
 * Extracted values are kept strictly in-memory in the popup client and passed
 * directly to content.js via local Chrome IPC at execution time only.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SIHTaskParser = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_SCROLL_AMOUNT = 500;

  /**
   * Cleans and normalizes task text.
   * @param {string} text
   * @returns {string}
   */
  function normalizeText(text) {
    return (text || "").trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  }

  /**
   * Cleans field hints by stripping trailing control types and leading articles.
   * e.g. "Name field" -> "Name", "the email address" -> "email address"
   * @param {string} field
   * @returns {string}
   */
  function cleanFieldHint(field) {
    if (!field || typeof field !== "string") return "";
    let f = field.trim();
    f = f.replace(/\s+(?:field|input|box|area|textbox)$/i, "").trim();
    f = f.replace(/^(?:the|a|an|my|our|your)\s+/i, "").trim();
    return f;
  }

  /**
   * Cleans fill values by stripping outer quotes and trimming whitespace.
   * e.g. '"Sankii"' -> "Sankii", "'test'" -> "test"
   * @param {string} val
   * @returns {string}
   */
  function cleanValue(val) {
    if (!val || typeof val !== "string") return "";
    let v = val.trim();
    if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
        (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
      v = v.slice(1, -1).trim();
    }
    return v;
  }

  /**
   * Resolves known legacy keyword click targets.
   * @param {string} text
   * @returns {string|null}
   */
  function resolveLegacyClickTarget(text) {
    const lower = text.toLowerCase();
    if (/button/i.test(lower) && /search/i.test(lower)) return null;
    if (/cart|add to cart|bag/i.test(lower)) return "ADD_TO_CART_BUTTON";
    if (/login|sign in|log in/i.test(lower)) return "LOGIN_BUTTON";
    if (/next|continue|proceed|step/i.test(lower)) return "NEXT_BUTTON";
    if (/submit/i.test(lower)) return "SUBMIT_BUTTON";
    if (/(?:^|\s)(?:search\s+input|search\s+box|query\s+input|find\s+input)(?:$|\s)/i.test(lower)) return "SEARCH_INPUT";
    return null;
  }

  /**
   * Authoritative task search/fill query extractor.
   * Extracts clean query values (e.g. "iPhone 15", "machine learning", "wireless headphones")
   * without sentence continuation suffixes or action verbs.
   * Mirrors backend/main.py extract_task_query_or_value().
   */
  function extractTaskQueryOrValue(task) {
    if (!task || typeof task !== "string") return null;
    const taskClean = task.trim();

    // 1. Search query pattern (takes precedence when searching):
    // Strictly bounds the query before verbs like 'and identify', 'and find', 'and open', 'and click', 'and select', 'and visit', etc.
    const mSearch = taskClean.match(/(?<!\bfill\s)(?<!\benter\s)(?<!\btype\s)(?<!\bclick\s)(?<!\bfind\s)\bsearch\s+(?:for\s+)?(?!(?:the\s+)?(?:box|input|field|bar|area|button)\b)['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and\s+(?:identify|find|open|click|select|locate|choose|visit)|then\s+(?:identify|find|open|click|select|locate|choose|visit))\b|[.,;!?]|$)/i);
    if (mSearch) {
      const val = cleanValue(mSearch[1]);
      if (val && !/^(?:the|a|an|it|this|that|box|input|field|bar|area|button)$/i.test(val)) {
        return val;
      }
    }

    // 2. Explicit fill pattern: "enter/type/put <val> as [the] <field>" (CRITICAL: <val> is before 'as', <field> is after)
    const mEnterAs = taskClean.match(/\b(?:enter|type|put)\s+['"]?([^'",;]+?)['"]?\s+as\s+(?:the\s+)?[a-zA-Z0-9_\-\s]+/i);
    if (mEnterAs) {
      const val = cleanValue(mEnterAs[1]);
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }

    // 3. Explicit fill pattern: "enter/type/put <val> in/into/for [the] <field>"
    const mIn = taskClean.match(/\b(?:enter|type|put)\s+['"]?([^'",;]+?)['"]?\s+(?:in|into|for)\b/i);
    if (mIn) {
      const val = cleanValue(mIn[1]);
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }

    // 4. Explicit fill pattern: "fill/set [the] <field> as/with/to <val>"
    const mFill = taskClean.match(/\b(?:fill|set)\b.*?\b(?:as|with|value|to)\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and|then)\b|[.,;!?]|$)/i);
    if (mFill) {
      const val = cleanValue(mFill[1]);
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }

    // 5. Standalone type/write pattern: "type/write <val>"
    const mType = taskClean.match(/\b(?:type|write)\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and|then)\b|[.,;!?]|$)/i);
    if (mType) {
      const val = cleanValue(mType[1]);
      if (val && !/^(?:the|a|an|box|input|field|button|it|this|that)$/i.test(val)) return val;
    }

    return null;
  }

  /**
   * Parses a single FILL clause into a step object.
   * Supports:
   * - "enter/type/put <val> in/into/for <field>"
   * - "<val> in/into <field>"
   * - "fill/set/enter/type/put [in/into] [the] <field> with/to/as/is/:/= <val>"
   * - "[the] <field> with/to/as/is/:/= <val>"
   *
   * @param {string} clause
   * @returns {{type: string, fieldHint: string, value: string}|null}
   */
  function parseFillClause(clause) {
    const text = (clause || "").trim();
    if (!text) return null;

    // Explicit non-fill actions must never be parsed as fill clauses
    if (/^(?:click|press|tap|open|scroll|view|navigate|go\s+to|select|choose|check|uncheck|toggle)\b/i.test(text)) {
      return null;
    }

    // Pattern 1a: 'enter/type/put <val> as [the] <field>' (CRITICAL: val is BEFORE 'as', field is AFTER 'as')
    const enterAsMatch = text.match(/^(?:enter|type|put)\s+(.+?)\s+as\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+field|\s+input|\s+box|\s+area)?$/i);
    if (enterAsMatch) {
      const val = cleanValue(enterAsMatch[1]);
      const field = cleanFieldHint(enterAsMatch[2]);
      if (val && field && !isPronounOrReference(field) && !/^(?:the|a|an|to)$/i.test(val)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    // Pattern 1b: '[enter/type/put] <val> in/into/for <field>'
    const enterInMatch = text.match(/^(?:(?:enter|type|put)\s+)?(.+?)\s+in(?:to|for)?\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+field|\s+input|\s+box|\s+area)?$/i);
    if (enterInMatch) {
      const val = cleanValue(enterInMatch[1]);
      const field = cleanFieldHint(enterInMatch[2]);
      if (val && field && !isPronounOrReference(field) && !/^(?:the|a|an|to)$/i.test(val)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    // Pattern 2a: With explicit fill verb: '[fill/set] [in/into] [the] <field> with/to/as/is/:/= <val>'
    const explicitFillMatch = text.match(/^(?:fill|set)\s+(?:in\s+|into\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:with|to|as|is|:=|=)\s+|\s*:\s*)(.+)$/i);
    if (explicitFillMatch) {
      const rawField = explicitFillMatch[1].trim();
      // Guard: Do not parse form wrappers ("this form", "the form", "details") as a single text field
      if (!/^(?:(?:this|the|a|all)\s+)?(?:form|details|fields|profile|information|data)$/i.test(rawField)) {
        const field = cleanFieldHint(rawField);
        const val = cleanValue(explicitFillMatch[2]);
        if (field && val && !isPronounOrReference(field)) {
          return { type: "FILL", fieldHint: field, value: val };
        }
      }
    }

    // Pattern 2b: Without leading verb: '[the] <field> with/as/is/:/= <val>' (disallows 'to' without fill verb to prevent phrase collisions)
    const implicitFillMatch = text.match(/^(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:with|as|is|:=|=)\s+|\s*:\s*)(.+)$/i);
    if (implicitFillMatch) {
      const field = cleanFieldHint(implicitFillMatch[1]);
      const val = cleanValue(implicitFillMatch[2]);
      if (field && val && !isPronounOrReference(field) && !/^(?:search|click|press|tap|open|find|go|select|choose|check|uncheck|toggle)$/i.test(field)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    // Pattern 3: 'type/write <val>' (e.g. "type Hello" -> FILL body with value "Hello")
    const typeValMatch = text.match(/^(?:type|write)\s+['"]?([^'"]+?)['"]?$/i);
    if (typeValMatch) {
      const val = cleanValue(typeValMatch[1]);
      if (val && !/^(?:the|a|an|it|this|that)$/i.test(val)) {
        return { type: "FILL", fieldHint: "body", value: val };
      }
    }

    return null;
  }

  /**
   * Identifies ambiguous pronouns or referential placeholder terms that must never
   * be executed as independent click targets without contextual resolution.
   *
   * @param {string} str
   * @returns {boolean}
   */
  function isPronounOrReference(str) {
    const s = (str || "").toLowerCase().trim();
    return /^(?:it|this|that|them|that\s+button|this\s+button|the\s+button|button|that\s+link|this\s+link|the\s+link|link|the\s+above|above|the\s+field|that\s+field|this\s+field|field)$/i.test(s);
  }

  /**
   * M23: Normalizes relational connector into standard representation.
   * Supported controlled vocabulary: inside, within, under, in, from, of -> "inside"
   * @param {string} rel
   * @returns {string|null}
   */
  function normalizeRelation(rel) {
    if (!rel || typeof rel !== "string") return null;
    const r = rel.toLowerCase().trim();
    if (["inside", "in", "within", "under", "from", "of"].includes(r)) {
      return "inside";
    }
    return r;
  }

  /**
   * M23: Extracts ordinal indicator from phrase.
   * Supported: first (1), second (2), third (3), last (-1), and numeric variants (1st, 2nd, 3rd).
   * @param {string} text
   * @returns {number|null}
   */
  function extractOrdinal(text) {
    if (!text || typeof text !== "string") return null;
    const s = text.toLowerCase().trim();
    if (/\b(?:first|last)\s+(?:name|word|character)\b/i.test(s)) return null;
    if (/\b(?:first|1st)\b/i.test(s)) return 1;
    if (/\b(?:second|2nd)\b/i.test(s)) return 2;
    if (/\b(?:third|3rd)\b/i.test(s)) return 3;
    if (/\blast\b/i.test(s)) return -1;
    return null;
  }

  /**
   * M23: Extracts UI control target type if explicitly mentioned.
   * @param {string} text
   * @returns {string|null}
   */
  function extractTargetType(text) {
    if (!text || typeof text !== "string") return null;
    const s = text.toLowerCase().trim();
    if (/\bcheckbox\b/i.test(s)) return "checkbox";
    if (/\bradio\b/i.test(s)) return "radio";
    if (/\bdropdown\b/i.test(s)) return "dropdown";
    if (/\boption\b/i.test(s)) return "option";
    if (/\btoggle\b|\bswitch\b/i.test(s)) return "toggle";
    if (/\bbutton\b/i.test(s)) return "button";
    if (/\blink\b/i.test(s)) return "link";
    if (/\btab\b/i.test(s)) return "tab";
    if (/\binput\b|\btextbox\b/i.test(s)) return "input";
    if (/\bproduct\b|\bitem\b/i.test(s)) return "product";
    if (/\bsection\b|\bcontainer\b|\bcard\b/i.test(s)) return "section";
    if (/\bcoupon\b/i.test(s)) return "coupon";
    if (/\bfilter\b/i.test(s)) return "filter";
    return null;
  }

  /**
   * M23: Cleans container / section names for contextual propagation.
   * @param {string} str
   * @returns {string}
   */
  function cleanContextName(str) {
    if (!str || typeof str !== "string") return "";
    let s = str.trim();
    s = s.replace(/^(?:the|a|an)\s+/i, "").trim();
    s = s.replace(/\s+(?:section|container|card|panel|area|box|group)$/i, "").trim();
    return s;
  }

  /**
   * M23: Resolves active container/section context from a previous step or list of steps.
   * If a step was executed inside a container (e.g. step.context = "filters"), that container
   * remains the enclosing context for subsequent sibling actions.
   * Individual interactive controls (CHECK, UNCHECK, SELECT, TOGGLE, FILL) operate on leaf nodes
   * and do NOT become container contexts for subsequent sibling steps.
   *
   * @param {Object} step
   * @returns {string|null}
   */
  function resolveActiveContainerContext(step) {
    if (!step || typeof step !== "object") return null;
    if (step.context) {
      return cleanContextName(step.context);
    }
    if (["CHECK", "UNCHECK", "SELECT", "TOGGLE", "FILL", "FILL_FORM", "AUTOFILL"].includes(step.type)) {
      return null;
    }
    return cleanContextName(step.targetHint || step.target || "");
  }

  /**
   * Generic natural-language parser for direct field-value juxtaposition without explicit keywords.
   * Handles patterns like "my name Sanketh", "email sankii@gmail.com", "phone 4656", "address Mysore",
   * "first name Sanketh", "zip code 98101", without any website-specific or domain-specific hardcoding.
   *
   * @param {string} str
   * @returns {{type: string, fieldHint: string, value: string}|null}
   */
  function parseJuxtapositionFill(str) {
    if (!str || typeof str !== "string") return null;
    let s = str.trim();
    s = s.replace(/^(?:my|our|your|the|a|an)\s+/i, "").trim();
    if (!s) return null;

    // Must not start with action verbs
    if (/^(?:click|press|tap|open|scroll|select|choose|check|uncheck|toggle|tick|untick|find|locate|search|go|navigate|fill|enter|type|put|set|compose|send|submit)\b/i.test(s)) {
      return null;
    }

    // Must not contain relational or contextual connectors (which belong to parseContextualClause)
    if (/\b(?:inside|within|under|from|of)\b/i.test(s)) {
      return null;
    }

    // If explicit fill delimiters are present, let parseFillClause handle it
    if (/\b(?:as|is|with|to|in|into|for|:=|=)\b|:/i.test(s)) {
      return null;
    }

    const parts = s.split(/\s+/);
    if (parts.length < 2) return null;

    const actionVerbPattern = /^(?:click|press|tap|open|scroll|select|choose|check|uncheck|toggle|tick|untick|find|locate|search|go|navigate|fill|enter|type|put|set|compose|send|submit)$/i;

    // Check for 2-word compound field names where word 2 is a category noun
    const compoundFieldNouns = /^(?:name|number|no|code|id|address|line|date|word|mail)$/i;
    if (parts.length >= 3 && compoundFieldNouns.test(parts[1])) {
      if (actionVerbPattern.test(parts[0])) return null;
      const field = cleanFieldHint(parts[0] + " " + parts[1]);
      const val = cleanValue(parts.slice(2).join(" "));
      if (field && val && !isPronounOrReference(field)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    if (actionVerbPattern.test(parts[0])) return null;
    const field = cleanFieldHint(parts[0]);
    if (actionVerbPattern.test(field)) return null;
    const val = cleanValue(parts.slice(1).join(" "));
    if (field && val && !isPronounOrReference(field)) {
      return { type: "FILL", fieldHint: field, value: val };
    }
    return null;
  }

  /**
   * M23: Parses a single contextual or relational clause.
   * Produces a backward-compatible target descriptor:
   * { action, type, target, targetHint, context, relation, ordinal, targetType }
   *
   * @param {string} clause
   * @param {string|null} [prevContext=null]
   * @returns {Object|null}
   */
  function parseContextualClause(clause, prevContext = null) {
    if (!clause || typeof clause !== "string") return null;
    let text = clause.trim().replace(/[.,;!?]+$/, "").replace(/^(?:and\s+then|and|then|after\s+that)\s+/i, "");
    if (!text) return null;

    // Reject fill clauses from being misinterpreted as contextual clicks
    if (/\b(?:as|with|to|is|:=|=)\s+['"]?[^'"\s]+/i.test(text) && !/\b(?:inside|within|under|in|from|of)\b/i.test(text)) {
      return null;
    }
    if (/^(?:fill|enter|type|put|set)\b/i.test(text)) {
      return null;
    }
    // Reject pure scroll clauses
    if (/^scroll\b/i.test(text)) {
      return null;
    }

    let action = null;
    let rest = text;

    const mAction = text.match(/^(?:(check|uncheck|select|choose|toggle|tick|untick|click|press|tap|find|locate|open)\s+(?:on\s+)?)(.+)$/i);
    if (mAction) {
      const verb = mAction[1].toLowerCase();
      rest = mAction[2].trim();
      if (verb === "check" || verb === "tick") action = "CHECK";
      else if (verb === "uncheck" || verb === "untick") action = "UNCHECK";
      else if (verb === "select" || verb === "choose") action = "SELECT";
      else if (verb === "toggle") action = "TOGGLE";
      else action = "CLICK";
    }

    // Pattern 1: Relational connector: <targetPart> (inside|within|under|in|from|of) <contextPart>
    const mRel = rest.match(/^(.+?)\s+\b(inside|within|under|in|from|of)\s+(.+)$/i);
    if (mRel) {
      let targetPart = mRel[1].trim();
      const relWord = mRel[2].toLowerCase();
      let contextPart = mRel[3].trim();

      targetPart = targetPart.replace(/^(?:the|a|an)\s+/i, "").trim();
      contextPart = contextPart.replace(/^(?:the|a|an)\s+/i, "").trim();

      // Resolve pronoun reference like "it", "this", "that"
      if (isPronounOrReference(contextPart) || /^(?:it|this|that|them)$/i.test(contextPart)) {
        if (prevContext) {
          contextPart = prevContext;
        }
      }

      const relation = normalizeRelation(relWord);
      const ordinal = extractOrdinal(targetPart);
      const targetType = extractTargetType(targetPart);

      let cleanTarget = targetPart;
      if (!/^(?:option|checkbox|toggle|switch|product|item|coupon|button|link)$/i.test(cleanTarget.toLowerCase())) {
        cleanTarget = cleanTarget.replace(/\s+(?:option|checkbox|button|link|toggle|switch)$/i, "").trim();
      }

      if (!action) {
        if (targetType === "checkbox") action = "CHECK";
        else if (targetType === "option") action = "SELECT";
        else if (targetType === "toggle") action = "TOGGLE";
        else action = "SELECT";
      }

      return {
        type: action,
        action: action,
        target: cleanTarget,
        targetHint: cleanTarget,
        context: contextPart,
        relation: relation,
        ordinal: ordinal !== null ? ordinal : null,
        targetType: targetType
      };
    }

    // Pattern 2: Explicit action without relation keyword (CHECK, UNCHECK, SELECT, TOGGLE)
    if (action && ["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(action)) {
      let targetPart = rest.replace(/^(?:the|a|an)\s+/i, "").trim();
      const ordinal = extractOrdinal(targetPart);
      const targetType = extractTargetType(targetPart) || (action === "CHECK" || action === "UNCHECK" ? "checkbox" : (action === "TOGGLE" ? "toggle" : "option"));

      let cleanTarget = targetPart;
      if (!/^(?:option|checkbox|toggle|switch|product|item|coupon|button|link)$/i.test(cleanTarget.toLowerCase())) {
        cleanTarget = cleanTarget.replace(/\s+(?:option|checkbox|button|link|toggle|switch)$/i, "").trim();
      }

      return {
        type: action,
        action: action,
        target: cleanTarget,
        targetHint: cleanTarget,
        context: prevContext || null,
        relation: prevContext ? "inside" : null,
        ordinal: ordinal !== null ? ordinal : null,
        targetType: targetType
      };
    }

    // Pattern 3: CLICK / select intent with an ordinal (e.g. "click the first product" or "first product")
    const ordinal = extractOrdinal(rest);
    if (ordinal !== null && (action === "CLICK" || !action)) {
      let targetPart = rest.replace(/^(?:the|a|an)\s+/i, "").trim();
      const targetType = extractTargetType(targetPart) || "generic";
      return {
        type: "CLICK",
        action: "CLICK",
        target: targetPart,
        targetHint: targetPart,
        context: prevContext || null,
        relation: prevContext ? "inside" : null,
        ordinal: ordinal,
        targetType: targetType
      };
    }

    return null;
  }


  /**
   * Normalizes natural language idioms, connectors, and pronoun references in task text.
   * Ensures phrases like "find [the] <target> and/then click it" are interpreted as
   * a single click intent, avoiding spurious "click it" steps.
   *
   * @param {string} rawTask
   * @returns {string}
   */
  function normalizeTaskPhrasing(rawTask) {
    let text = normalizeText(rawTask);
    if (!text) return "";

    // 0a. Normalize "find/locate/go to [the] <FIELD> [field/input/box/area/textbox] and/then fill/enter/type/put [in/into] it with/as/to/:/= <VAL>"
    // -> "fill <FIELD> with <VAL>"
    text = text.replace(
      /\b(?:find|locate|go\s+to)\s+(?:the\s+)?((?:(?!\b(?:and|then|fill|enter|type|put)\b)[a-zA-Z0-9_\-\s])+?)(?:\s+(?:field|input|box|area|textbox))?\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(?:fill|enter|type|put)\s+(?:in\s+|into\s+)?(?:it|that|this|the\s+field|the\s+input|the\s+box)?\s*(?:with|to|as|value|is|:=|=)\s+/gi,
      (match, field) => {
        const cleanField = cleanFieldHint(field);
        return `fill ${cleanField} with `;
      }
    );

    // 0b. Normalize "find/locate/go to [the] <FIELD> [field/input/box/area/textbox] and/then enter/type/put <VAL> in/into it"
    // -> "fill <FIELD> with <VAL>"
    text = text.replace(
      /\b(?:find|locate|go\s+to)\s+(?:the\s+)?((?:(?!\b(?:and|then|fill|enter|type|put)\b)[a-zA-Z0-9_\-\s])+?)(?:\s+(?:field|input|box|area|textbox))?\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(?:enter|type|put)\s+(.+?)\s+(?:in|into)\s+(?:it|that|this|the\s+field|the\s+input|the\s+box)\b/gi,
      (match, field, val) => {
        const cleanField = cleanFieldHint(field);
        return `fill ${cleanField} with ${val.trim()}`;
      }
    );

    // 1. Normalize "find/locate/search for/look for [the] <TARGET> and/then/and then click/press/tap/select/use/open it/that/this/them/that button/that link/the above"
    // -> "<verb> [the] <TARGET>"
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(click|press|tap|select|use|open)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target, verb) => {
        const cleanTarget = target.trim();
        const v = (verb || "").toLowerCase();
        const act = (v === "select" ? "select" : (v === "open" ? "open" : "click"));
        return `${act} ${cleanTarget}`;
      }
    );

    // 2. Normalize "find/locate/search for/look for [the] <TARGET> button/link and/then click/press/tap/select/use/open it/that/that link/the above"
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)\s+(button|link)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(click|press|tap|select|use|open)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target, type, verb) => {
        const cleanTarget = target.trim();
        const v = (verb || "").toLowerCase();
        const act = (v === "select" ? "select" : (v === "open" ? "open" : "click"));
        return `${act} ${cleanTarget} ${type}`;
      }
    );

    // 3. Normalize "[the] <TARGET> [button/link] and then click/press/tap/select/use/open it" or ", then click it" when preceded by a clickable target
    text = text.replace(
      /(?:(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+button|\s+link)?))\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(click|press|tap|select|use|open)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target, verb) => {
        const cleanTarget = (target || "").trim();
        if (/^(?:fill|enter|type|put|set|is|as|with|in|into|then|and)$/i.test(cleanTarget)) {
          return match;
        }
        const v = (verb || "").toLowerCase();
        const act = (v === "select" ? "select" : (v === "open" ? "open" : "click"));
        return `${act} ${cleanTarget}`;
      }
    );

    // 4. Normalize "find/locate/go to [the] search [box/input/field/area] and search for <query>" -> "fill search as <query>"
    text = text.replace(
      /\b(?:find|locate|go\s+to)\s+(?:the\s+)?(?:search\s+(?:box|input|field|area)|search)\s*(?:,\s*|\s+)(?:and\s+then\s+|and\s+|then\s+)?search\s+(?:for\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)(?=(?:,\s*|\s+)(?:and\s+(?:then\s+)?|then\s+)?(?:find|click|press|tap|submit|send)|$)/i,
      (match, query) => {
        return `fill search as ${query.trim()}`;
      }
    );

    // 5. Normalize trailing verification phrases like ", and verify that the email was sent", ", verify that...", "and confirm that..."
    text = text.replace(
      /(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:(?:verify|confirm|ensure)(?:\s+(?:that|if|whether))?|check\s+(?:that|if|whether))(?:\s+.*)?$/i,
      ""
    );

    return text;
  }

  /**
   * Section 3: Recognizes generic multi-stage search workflows.
   * Generic across all search engines and content portals without site-specific rules.
   *
   * @param {string} rawTask
   * @returns {Array<Object>|null} Ordered step descriptors or null
   */
  function parseSearchWorkflow(rawTask) {
    const text = (rawTask || "").trim().replace(/[.!?]+$/, "");
    if (!text) return null;

    // 0. Optional navigation prefix: e.g. "Open YouTube, search for...", "Go to Amazon and search for..."
    const navPrefixMatch = text.match(/^(?:open|go\s+to|navigate\s+to|launch|visit)\s+(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?=search\b)/i);
    let navTarget = null;
    let searchTaskText = text;
    if (navPrefixMatch) {
      navTarget = navPrefixMatch[1].trim();
      searchTaskText = text.substring(navPrefixMatch[0].length).trim();
    }

    // 1. Authoritative search query extraction
    const query = extractTaskQueryOrValue(searchTaskText);
    if (!query) return null;

    if (!/\bsearch\b/i.test(searchTaskText)) return null;

    const hasSearchBoxPrefix = /^(?:find|locate|go\s+to|click)\s+(?:on\s+)?(?:the\s+)?(?:search\s+(?:box|input|field|bar|area)|search)(?:\s+(?:in|on|at|of)\s+[a-zA-Z0-9_\-]+)?\b/i.test(searchTaskText);

    let isExplicitTarget = false;
    let explicitTarget = null;
    let isMostRelevant = false;
    let hasProductOpen = false;
    let productTarget = null;

    // A. Explicit named target: "click the result called XYZ_NONEXISTENT_987654", "select result named X", "open product with title Y"
    const calledTargetMatch = searchTaskText.match(/(?:identify|find|select|choose|open|click|visit|view)\s+(?:on\s+)?(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry)?\s*(?:called|named|titled|with\s+(?:the\s+)?name|with\s+(?:the\s+)?title)\s+['"]?([^'",;]+?)['"]?(?:\s*[,;.]|\s+(?:and|then)|$)/i);

    if (calledTargetMatch) {
      explicitTarget = calledTargetMatch[1].trim();
      isExplicitTarget = true;
      isMostRelevant = false;
      hasProductOpen = true;
      productTarget = explicitTarget;
    } else {
      // B. Post-search action with named or generic target:
      // "search OpenAI and select XYZ", "search OpenAI and choose XYZ", "search OpenAI and open XYZ", "search OpenAI and open the most relevant result"
      const postSearchActionMatch = searchTaskText.match(/(?:,\s*|\s+)(?:and\s+then|and|then)?\s*(?:identify|find|select|choose|open|click|visit|view)\s+(?:on\s+)?(?:the\s+)?([^,;]+?)(?:\s*[,;.]|\s+(?:and\s+then|and|then)\s+(?:find|locate|click|press|tap|play|add)|$)/i);
      if (postSearchActionMatch) {
        const candidate = postSearchActionMatch[1].trim();
        const isGeneric = /^(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry|it|that|this|them)$/i.test(candidate);
        if (!isGeneric) {
          explicitTarget = candidate;
          isExplicitTarget = true;
          isMostRelevant = false;
          hasProductOpen = true;
          productTarget = explicitTarget;
        } else {
          const isPronoun = /^(?:it|that|this|them)$/i.test(candidate);
          isMostRelevant = /\bmost\s+relevant\b/i.test(candidate) || isPronoun;
          isExplicitTarget = false;
          hasProductOpen = true;
          productTarget = isPronoun ? "most relevant result" : candidate;
        }
      } else if (/\bopen\s+(?:it|that|the\s+product|the\s+result|the\s+video|the\s+item|the\s+website|the\s+site|the\s+page|the\s+link)\b/i.test(searchTaskText)) {
        hasProductOpen = true;
        productTarget = "most relevant product";
        isMostRelevant = false;
        isExplicitTarget = false;
      }
    }

    let trailingTarget = null;
    // Trailing pattern A: "open ..., and then find the Add to Cart button, and click it"
    const trailingFindClickMatch = searchTaskText.match(/(?:open\s+(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:[a-zA-Z0-9_\-]+\s+)?(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry|it)|open\s+it)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:find|locate|search\s+for)\s+(?:the\s+)?(.+?)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click|press|tap)\s+(?:on\s+)?(?:it|that|this)\b/i);
    if (trailingFindClickMatch) {
      trailingTarget = trailingFindClickMatch[1].trim();
    } else {
      // Trailing pattern B: "open ..., and click [the] <TARGET> [button]"
      const trailingClickMatch = searchTaskText.match(/(?:open\s+(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:[a-zA-Z0-9_\-]+\s+)?(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry|it)|open\s+it)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button)?$/i);
      if (trailingClickMatch) {
        trailingTarget = trailingClickMatch[1].trim();
      } else {
        // Trailing pattern C: "and play it", "and play", "and click play"
        const trailingPlayMatch = searchTaskText.match(/(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click\s+(?:on\s+)?(?:the\s+)?play(?:\s+button|\s+icon)?|play\s+(?:it|the\s+video|that|this)?|start\s+(?:playing|the\s+video)?)\b/i);
        if (trailingPlayMatch) {
          trailingTarget = "play";
        } else {
          // Trailing pattern D: "and add it to the cart", "and add to cart"
          const trailingAddToCartMatch = searchTaskText.match(/(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:add\s+(?:it\s+)?to\s+(?:the\s+)?cart|click\s+(?:on\s+)?(?:the\s+)?add\s+to\s+cart(?:\s+button)?)\b/i);
          if (trailingAddToCartMatch) {
            trailingTarget = "Add to Cart button";
          }
        }
      }
    }

    const steps = [];

    // Step 0: Initial navigation step if specified (e.g. "Open YouTube")
    if (navTarget) {
      steps.push({
        type: "CLICK",
        targetHint: navTarget,
        legacyTarget: null
      });
    }

    // Step 1: Explicit search input locator if task starts with finding/locating search box AND has subsequent product selection
    if (hasSearchBoxPrefix && hasProductOpen) {
      steps.push({
        type: "CLICK",
        targetHint: "search box",
        legacyTarget: "SEARCH_INPUT"
      });
    }

    // Step 2: Fill search input with the authoritative clean query
    steps.push({
      type: "FILL",
      fieldHint: "search",
      value: query
    });

    // Step 3: Submit search
    steps.push({
      type: "SUBMIT",
      targetHint: "search",
      query: query
    });

    // Step 4: Product / search result selection
    if (hasProductOpen) {
      steps.push({
        type: "CLICK",
        targetHint: productTarget,
        query: query,
        isProductSelection: true,
        isExplicitTarget: isExplicitTarget,
        explicitTarget: explicitTarget || null,
        isMostRelevant: isMostRelevant
      });
    }

    // Step 5: Trailing action (e.g. "find the Add to Cart button, and click it", "play it")
    if (trailingTarget) {
      const cleanTrailing = trailingTarget.trim();
      steps.push({
        type: "CLICK",
        targetHint: cleanTrailing,
        legacyTarget: resolveLegacyClickTarget(cleanTrailing)
      });
    }

    return steps.length > 0 ? steps : null;
  }

  /**
   * Parses free-text user task into structured local intent.
   * Deterministic, bounded rule-based parser (no LLM, no external network).
   *
   * @param {string} rawTask
   * @returns {Object} Structured intent with sanitized plan and private local values
   */
  function parseTask(rawTask) {
    if (!rawTask || !rawTask.trim()) {
      return createNoneResult("Empty task");
    }

    // Strip trailing verification assertions if present (e.g. ", and verify that the email was sent")
    const cleanRawTask = rawTask.trim().replace(
      /(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:(?:verify|confirm|ensure)(?:\s+(?:that|if|whether))?|check\s+(?:that|if|whether))(?:\s+.*)?$/i,
      ""
    );

    // Section 3: Recognize generic search workflows & multi-stage workflow check:
    // If the task contains sequential workflow stages across search or interactive actions,
    // split at the result selection boundary and parse each stage.
    const multiStageSplitPattern = /(?<=(?:open|click|select|view)\s+(?:on\s+)?(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:[a-zA-Z0-9_\-]+\s+)?(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry|it|that|them)|(?:submit\s+search|submit))\s*(?:,\s*(?:then|and\s+then|and)?|\s+(?:then|and\s+then|and)|\s*;\s*(?:then)?|\.\s*|\s+after\s+opening\s+[^,;]+,?\s*)\s*(?=(?:(?:find|locate|go\s+to|click)\s+(?:on\s+)?(?:the\s+)?(?:[a-zA-Z0-9_\-]+\s+)?(?:search\s+(?:box|input|field|bar|area)|search)\b|search\b|compose\b|enter\b|type\b|fill\b|send\b|write\b))/i;

    let stageParts = cleanRawTask.split(multiStageSplitPattern);
    if (stageParts.length <= 1) {
      const legacyPattern = /(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s+after\s+opening\s+(?:it|the\s+result|the\s+product|that|the\s+video|the\s+item))\s+(?=(?:find|locate|go\s+to|click|search|on\b|in\b))/i;
      const legacyParts = cleanRawTask.split(legacyPattern);
      if (legacyParts.length > 1 && legacyParts.every((p) => /\bsearch\b/i.test(p))) {
        stageParts = legacyParts;
      }
    }

    if (stageParts.length > 1) {
      let combinedSteps = [];
      let allValid = true;
      for (const part of stageParts) {
        const trimmedPart = part.trim();
        const stageWorkflow = parseSearchWorkflow(trimmedPart);
        if (stageWorkflow && stageWorkflow.length > 0) {
          combinedSteps = combinedSteps.concat(stageWorkflow);
        } else {
          const subRes = parseTask(trimmedPart);
          if (subRes.intent !== "NONE" && Array.isArray(subRes.steps) && subRes.steps.length > 0 && subRes.steps[0].type !== "NONE") {
            combinedSteps = combinedSteps.concat(subRes.steps);
          } else {
            allValid = false;
            break;
          }
        }
      }
      if (allValid && combinedSteps.length > 0) {
        return buildResultFromSteps(combinedSteps);
      }
    }

    const searchWorkflowSteps = parseSearchWorkflow(cleanRawTask);
    if (searchWorkflowSteps && searchWorkflowSteps.length > 0) {
      return buildResultFromSteps(searchWorkflowSteps);
    }

    const task = normalizeTaskPhrasing(cleanRawTask);
    if (!task) {
      return createNoneResult("Empty task");
    }

    const lower = task.toLowerCase();

    // 1. Check for sequential clauses: e.g. "..., then ...", "... and then ...", "... then ..."
    const sequentialSplit = task.split(/\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then)\s+/i);
    if (sequentialSplit.length > 1) {
      const parsedSeqSteps = [];
      let currentContext = null;
      let allValid = true;

      for (const part of sequentialSplit) {
        const trimmedPart = part.trim();
        if (isPronounOrReference(trimmedPart) || /^(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|this|that|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field|the\s+button|button|the\s+link|link)$/i.test(trimmedPart)) {
          if (parsedSeqSteps.length > 0) {
            const lastStep = parsedSeqSteps[parsedSeqSteps.length - 1];
            if (lastStep.type === "CLICK" || lastStep.type === "SELECT") {
              continue;
            }
          }
        }

        const fill = parseFillClause(trimmedPart);
        if (fill) {
          parsedSeqSteps.push(fill);
        } else {
          const contextual = parseContextualClause(trimmedPart, currentContext);
          if (contextual) {
            parsedSeqSteps.push(contextual);
            const activeCtx = resolveActiveContainerContext(contextual);
            if (activeCtx) {
              currentContext = activeCtx;
            }
          } else {
            const subRes = parseTask(trimmedPart);
            if (subRes.intent !== "NONE" && Array.isArray(subRes.steps) && subRes.steps.length > 0 && subRes.steps[0].type !== "NONE") {
              parsedSeqSteps.push(...subRes.steps);
              const last = subRes.steps[subRes.steps.length - 1];
              const candCtx = resolveActiveContainerContext(last);
              if (candCtx) currentContext = candCtx;
            } else {
              allValid = false;
              break;
            }
          }
        }
      }

      if (allValid && parsedSeqSteps.length > 0) {
        return buildResultFromSteps(parsedSeqSteps);
      }
    }

    // 2a. Multi-field form filling with explicit items: e.g. "Fill this form with my name Sanketh, email sankii@gmail.com, phone 4656 and address Mysore"
    const formWithItemsMatch = task.match(/^(?:fill|autofill|complete|populate)\s+(?:in\s+|into\s+|out\s+)?(?:(?:the|this|a|all)\s+)?(?:form|details|fields|profile|information|data)?\s*(?:with|:)\s*(.+)$/i);
    if (formWithItemsMatch) {
      const itemsBody = formWithItemsMatch[1].trim();
      let trailingSubmit = null;
      let fieldsOnlyText = itemsBody;
      const trailingSubmitMatch = itemsBody.match(/(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s*,\s*and|\s+and)\s+(?:click|press|tap|submit|send)\s+(?:on\s+)?(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
      if (trailingSubmitMatch) {
        trailingSubmit = trailingSubmitMatch[1].trim();
        fieldsOnlyText = itemsBody.substring(0, trailingSubmitMatch.index).trim();
      }

      const itemClauses = fieldsOnlyText.split(/\s*(?:,\s*and\s+|\s+and\s+|,\s*)\s*/i);
      const parsedFormSteps = [];
      for (const item of itemClauses) {
        const trimmed = item.trim();
        if (!trimmed) continue;
        const fill = parseFillClause(trimmed) || parseJuxtapositionFill(trimmed);
        if (fill) {
          parsedFormSteps.push(fill);
        }
      }

      if (parsedFormSteps.length > 0) {
        if (trailingSubmit) {
          parsedFormSteps.push({
            type: "CLICK",
            targetHint: trailingSubmit,
            legacyTarget: resolveLegacyClickTarget(trailingSubmit)
          });
        }
        return buildResultFromSteps(parsedFormSteps);
      }
    }

    // 2. Whole form filling with profile: "fill the form", "autofill form", "fill all details", "fill my details", "fill form simultaneously"
    const wholeFormMatch = task.match(/^(?:fill|autofill|complete|populate)\s+(?:in\s+|out\s+)?(?:the\s+|this\s+|all\s+|my\s+|out\s+the\s+)?(?:form|details|fields|profile|information|registration\s+form|contact\s+form|simple\s+form)(?:\s+simultaneously|\s+all\s+at\s+once)?$/i);
    if (wholeFormMatch) {
      return buildResultFromSteps([
        {
          type: "FILL_FORM",
          fieldHint: "all form fields",
          profileSource: "form-profile.json",
          simultaneous: true
        }
      ]);
    }

    // 2b. Whole form fill then click: "fill the form, then click submit", "fill form and submit"
    const wholeFormThenClickMatch = task.match(/^(?:fill|autofill|complete)\s+(?:in\s+|out\s+)?(?:the\s+|this\s+|all\s+|my\s+|out\s+the\s+)?(?:form|details|fields|profile|information)\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s+and)\s+(?:click|press|tap|submit|send)\s+(?:on\s+)?(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
    if (wholeFormThenClickMatch) {
      const clickTarget = wholeFormThenClickMatch[1].trim();
      return buildResultFromSteps([
        {
          type: "FILL_FORM",
          fieldHint: "all form fields",
          profileSource: "form-profile.json",
          simultaneous: true
        },
        {
          type: "CLICK",
          targetHint: clickTarget,
          legacyTarget: resolveLegacyClickTarget(clickTarget)
        }
      ]);
    }

    // 2c. Sequential FILL without values: "Fill the name and email, then click submit"
    const fillThenClickMatch = task.match(/^fill\s+(?:the\s+)?([a-z0-9_\-\s]+?)\s+and\s+(?:the\s+)?([a-z0-9_\-\s]+?)\s*,\s*then\s+(?:click|press)\s+(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
    if (fillThenClickMatch) {
      const field1 = fillThenClickMatch[1].trim();
      const field2 = fillThenClickMatch[2].trim();
      const clickTarget = fillThenClickMatch[3].trim();
      return buildResultFromSteps([
        { type: "FILL", fieldHint: field1, value: "..." },
        { type: "FILL", fieldHint: field2, value: "..." },
        {
          type: "CLICK",
          targetHint: clickTarget,
          legacyTarget: resolveLegacyClickTarget(clickTarget)
        }
      ]);
    }

    // 3. Multi-clause split on 'and' / ',' (e.g. "fill full name as sanketh and email address as sanketh@example.com")
    const andSplit = task.split(/\s*(?:,\s*and\s+|\s+and\s+(?!(?:above|up|over|higher|more)\b)|,\s*)\s*/i);
    if (andSplit.length > 1) {
      const parsedClauses = [];
      let allValid = true;
      for (const clause of andSplit) {
        const trimmedClause = clause.trim();

        // Skip standalone verification clauses like "verify that the email was sent", "and verify...", etc.
        if (/^(?:and\s+)?(?:then\s+)?(?:(?:verify|confirm|ensure)\b|check\s+(?:that|if|whether)\b)/i.test(trimmedClause)) {
          continue;
        }

        // Check if this clause is a pronoun referral like "click it", "then click it", "and click it", "select it"
        if (isPronounOrReference(trimmedClause) || /^(?:and\s+)?(?:then\s+)?(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|this|that|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field|the\s+button|button|the\s+link|link)$/i.test(trimmedClause)) {
          if (parsedClauses.length > 0) {
            const lastStep = parsedClauses[parsedClauses.length - 1];
            // If the preceding step was already a CLICK action, "click it" is redundant confirmation
            if (lastStep.type === "CLICK") {
              continue;
            }
          }
          // Standalone or unresolvable pronoun referral
          allValid = false;
          break;
        }

        const fillStep = parseFillClause(trimmedClause) || parseJuxtapositionFill(trimmedClause);
        if (fillStep) {
          if (parsedClauses.length > 0) {
            const prev = parsedClauses[parsedClauses.length - 1];
            if (prev.type === "CLICK") {
              const prevTarget = cleanFieldHint(prev.targetHint || "");
              if (prevTarget && prevTarget.toLowerCase() === fillStep.fieldHint.toLowerCase()) {
                parsedClauses.pop();
              }
            }
          }
          parsedClauses.push(fillStep);
        } else {
          const lastStep = parsedClauses.length > 0 ? parsedClauses[parsedClauses.length - 1] : null;
          const prevCtx = lastStep ? resolveActiveContainerContext(lastStep) : null;
          const contextualStep = parseContextualClause(trimmedClause, prevCtx);
          if (contextualStep) {
            parsedClauses.push(contextualStep);
          } else {
            const subTaskRes = parseTask(trimmedClause);
            if (subTaskRes.intent !== "NONE" && Array.isArray(subTaskRes.steps) && subTaskRes.steps.length > 0 && subTaskRes.steps[0].type !== "NONE") {
              parsedClauses.push(...subTaskRes.steps);
            } else {
              allValid = false;
              break;
            }
          }
        }
      }
      if (allValid && parsedClauses.length > 1) {
        return buildResultFromSteps(parsedClauses);
      }
    }

    // 4. Single-clause FILL pattern: "fill full name as sanketh", "enter sanketh in full name", etc.
    const singleFill = parseFillClause(task);
    if (singleFill) {
      return buildResultFromSteps([singleFill]);
    }

    // 5. SCROLL intents:
    // 5a. Bounded numeric scroll: "scroll down 500", "scroll down 500 pixels", "scroll 300px"
    const scrollNumMatch = lower.match(/^scroll(?:\s+down)?\s+(\d+)(?:\s*(?:pixels|px))?$/i);
    if (scrollNumMatch) {
      const rawAmt = parseInt(scrollNumMatch[1], 10);
      const safeAmt = isNaN(rawAmt) ? DEFAULT_SCROLL_AMOUNT : Math.min(Math.max(rawAmt, 50), 1500);
      return buildResultFromSteps([
        {
          type: "SCROLL",
          target: "PAGE",
          amount: safeAmt
        }
      ]);
    }

    // 5b. General scroll: "scroll down", "scroll", "scroll down the page", "scroll down a bit", "scroll to find the form"
    if (/^scroll(?:\s+down|\s+up)?(?:\s+a\s+bit|\s+more|\s+the\s+page|\s+page)?$/i.test(lower) || /^(?:view|read)\s+more$/i.test(lower) || /^scroll\s+to\s+/i.test(lower)) {
      return buildResultFromSteps([
        {
          type: "SCROLL",
          target: "PAGE",
          amount: DEFAULT_SCROLL_AMOUNT
        }
      ]);
    }

    // 5c. SEARCH intents: "search for <query>", "search <query>"
    const searchIntentMatch = task.match(/^search(?:\s+for)?\s+['"]?([^'"]+?)['"]?$/i);
    if (searchIntentMatch) {
      const query = searchIntentMatch[1].trim();
      if (query && !/^(?:the|a|an|input|box|field|button|it|that|this|them)$/i.test(query)) {
        return buildResultFromSteps([
          {
            type: "FILL",
            fieldHint: "search",
            value: query
          },
          {
            type: "SUBMIT",
            targetHint: "search",
            query: query
          }
        ]);
      }
    }

    // 5d. M23 Contextual / Selection / Ordinal intent:
    const contextualIntent = parseContextualClause(task);
    if (contextualIntent) {
      return buildResultFromSteps([contextualIntent]);
    }

    // 6. CLICK intents:
    // 6a. Explicitly labelled/named: "click the button labelled Register", "press link named Register"
    const labelledBtnMatch = task.match(/^(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?(?:button|link)\s+(?:labelled|labeled|named|with\s+text)\s+['"]?([a-zA-Z0-9_\-\s]+?)['"]?$/i);
    if (labelledBtnMatch) {
      const targetHint = labelledBtnMatch[1].trim();
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }

    // 6b. Open page / navigation: "open downloads", "open the downloads page", "go to documentation"
    const openMatch = task.match(/^(?:open|navigate\s+to|go\s+to)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+page|\s+link|\s+tab)?$/i);
    if (openMatch) {
      const targetHint = openMatch[1].trim();
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }

    // 6c. Standard CLICK / FIND: "click add to cart", "find english", "press submit", "click continue", "tap on search"
    const clickMatch = task.match(/^(?:click|press|tap|find|locate)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button|\s+link)?$/i);
    if (clickMatch) {
      const targetHint = clickMatch[1].trim();
      // Never create a standalone target named "it", "this", "that", "them", "the button", "the above", etc.
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }

    // 6d. COMPOSE intent: e.g. "compose a new email", "compose email", "compose new message", "compose"
    const composeMatch = task.match(/^compose(?:\s+(?:(?:a\s+|an\s+)?(?:new\s+)?([a-zA-Z0-9_\-\s]+?)))?$/i);
    if (composeMatch) {
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: "compose",
          legacyTarget: null
        }
      ]);
    }

    // 6e. SEND intent: e.g. "send the email", "send email", "send message", "send"
    const sendMatch = task.match(/^send(?:\s+(?:the\s+)?(?:email|mail|message))?$/i);
    if (sendMatch) {
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: "send",
          legacyTarget: resolveLegacyClickTarget("send")
        }
      ]);
    }

    // 7. Legacy standalone keyword rules: login, next, submit, search
    const legacyTarget = resolveLegacyClickTarget(lower);
    if (legacyTarget) {
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: legacyTarget.toLowerCase().replace(/_button|_input/, ""),
          legacyTarget: legacyTarget
        }
      ]);
    }

    // 8. Unsupported / ambiguous task -> fail closed with safe NONE result
    return createNoneResult("Unsupported or ambiguous task");
  }

  /**
   * Assembles a structured result from ordered steps, enforcing the privacy contract.
   * @param {Array<Object>} steps
   * @returns {Object}
   */
  function buildResultFromSteps(steps) {
    if (!steps || steps.length === 0) {
      return createNoneResult("No steps parsed");
    }

    const sanitizedPlan = [];
    const localValues = {};
    const goals = [];
    let currentGoal = null;

    let fillStepIndex = 0;
    steps.forEach((step, idx) => {
      step.stepId = idx;

      // Group low-level action steps into user-facing subgoals
      if (step.type === "CLICK" && (step.targetHint === "search box" || step.legacyTarget === "SEARCH_INPUT")) {
        currentGoal = {
          id: goals.length + 1,
          title: "Find search box",
          type: "LOCATE_SEARCH",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "FILL" && step.fieldHint === "search") {
        currentGoal = {
          id: goals.length + 1,
          title: `Search for '${step.value || "query"}'`,
          type: "SEARCH",
          query: step.value || null,
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "SUBMIT") {
        if (currentGoal && currentGoal.type === "SEARCH") {
          currentGoal.stepIds.push(idx);
        } else {
          currentGoal = {
            id: goals.length + 1,
            title: `Submit search${step.query ? " for '" + step.query + "'" : ""}`,
            type: "SEARCH",
            query: step.query || null,
            stepIds: [idx]
          };
          goals.push(currentGoal);
        }
      } else if (step.type === "CLICK" && (step.isProductSelection || /result|product|item|listing|video|movie|article|website|site|webpage|page|link|portal/i.test(step.targetHint || ""))) {
        const goalTarget = step.isExplicitTarget && step.explicitTarget ? step.explicitTarget : (step.targetHint || "relevant result");
        currentGoal = {
          id: goals.length + 1,
          title: `Open ${goalTarget}`,
          type: "OPEN_RESULT",
          target: goalTarget,
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "FILL_FORM") {
        currentGoal = {
          id: goals.length + 1,
          title: "Fill all form fields",
          type: "FILL_FORM",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "FILL") {
        currentGoal = {
          id: goals.length + 1,
          title: `Fill ${step.fieldHint || "form field"}`,
          type: "FILL_FIELD",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "CHECK" || step.type === "UNCHECK" || step.type === "SELECT" || step.type === "TOGGLE") {
        const verbName = step.type.charAt(0) + step.type.slice(1).toLowerCase();
        currentGoal = {
          id: goals.length + 1,
          title: `${verbName} ${step.targetHint || step.target || "element"}${step.context ? " in " + step.context : ""}`,
          type: step.type,
          target: step.targetHint || step.target || "element",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "CLICK") {
        currentGoal = {
          id: goals.length + 1,
          title: `Click ${step.targetHint || "element"}`,
          type: "CLICK",
          target: step.targetHint || "element",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "SCROLL") {
        currentGoal = {
          id: goals.length + 1,
          title: `Scroll down ${step.amount || DEFAULT_SCROLL_AMOUNT}px`,
          type: "SCROLL",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else {
        currentGoal = {
          id: goals.length + 1,
          title: `Action step ${idx + 1}`,
          type: "GENERIC",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      }
      step.goalId = currentGoal.id;

      if (step.type === "FILL_FORM") {
        sanitizedPlan.push({
          type: "FILL_FORM",
          fieldHint: step.fieldHint || "all form fields",
          stepId: idx,
          goalId: step.goalId
        });
        localValues[idx] = "[FORM_PROFILE_DATA]";
        localValues["form_profile"] = step.profileSource || "form-profile.json";
        localValues["simultaneous"] = true;
      } else if (step.type === "FILL") {
        sanitizedPlan.push({
          type: "FILL",
          fieldHint: step.fieldHint,
          stepId: idx,
          goalId: step.goalId
        });
        // Retain literal values strictly in local in-memory structure
        localValues[idx] = step.value;
        localValues[`fill_${fillStepIndex}`] = step.value;
        localValues[`step_${idx}`] = step.value;
        fillStepIndex++;
        const normHint = (step.fieldHint || "").toLowerCase().trim();
        if (normHint) {
          localValues[normHint] = step.value;
          if (normHint === "body") {
            localValues["message"] = step.value;
          } else if (normHint === "message") {
            localValues["body"] = step.value;
          }
        }
      } else if (step.type === "SUBMIT") {
        sanitizedPlan.push({
          type: "SUBMIT",
          targetHint: step.targetHint || "search",
          stepId: idx,
          goalId: step.goalId
        });
        if (step.query) {
          localValues["search_query"] = step.query;
          localValues[idx] = step.query;
          localValues[`step_${idx}`] = step.query;
        }
      } else if (step.type === "CHECK" || step.type === "UNCHECK" || step.type === "SELECT" || step.type === "TOGGLE") {
        sanitizedPlan.push({
          type: step.type,
          action: step.type,
          targetHint: step.targetHint || step.target,
          target: step.targetHint || step.target,
          context: step.context || null,
          relation: step.relation || null,
          ordinal: step.ordinal !== undefined ? step.ordinal : null,
          targetType: step.targetType || null,
          stepId: idx,
          goalId: step.goalId
        });
      } else if (step.type === "CLICK") {
        sanitizedPlan.push({
          type: "CLICK",
          action: "CLICK",
          targetHint: step.targetHint,
          target: step.targetHint,
          legacyTarget: step.legacyTarget || null,
          context: step.context || null,
          relation: step.relation || null,
          ordinal: step.ordinal !== undefined ? step.ordinal : null,
          targetType: step.targetType || null,
          stepId: idx,
          goalId: step.goalId
        });
        if (step.query) {
          localValues["search_query"] = step.query;
          localValues[`step_${idx}`] = step.query;
        }
      } else if (step.type === "SCROLL") {
        sanitizedPlan.push({
          type: "SCROLL",
          target: step.target || "PAGE",
          amount: step.amount || DEFAULT_SCROLL_AMOUNT,
          stepId: idx,
          goalId: step.goalId
        });
      } else {
        sanitizedPlan.push({ type: "NONE", stepId: idx, goalId: step.goalId });
      }
    });

    const isMultiStep = steps.length > 1;
    const primaryIntent = isMultiStep
      ? "MULTI_STEP"
      : (steps[0].type || "NONE");

    return {
      intent: primaryIntent,
      steps: steps,
      goals: goals,
      sanitizedPlan: sanitizedPlan,
      localValues: localValues,
      isMultiStep: isMultiStep
    };
  }

  /**
   * Helper to create safe fallback NONE result.
   * @param {string} reason
   * @returns {Object}
   */
  function createNoneResult(reason) {
    return {
      intent: "NONE",
      reason: reason || "Unrecognized task",
      steps: [{ type: "NONE" }],
      sanitizedPlan: [{ type: "NONE" }],
      localValues: {},
      isMultiStep: false
    };
  }

  return {
    parseTask,
    parseContextualClause,
    extractOrdinal,
    normalizeRelation,
    extractTargetType,
    cleanContextName,
    resolveActiveContainerContext,
    extractTaskQueryOrValue,
    resolveLegacyClickTarget,
    isPronounOrReference,
    cleanFieldHint,
    cleanValue,
    parseJuxtapositionFill,
    DEFAULT_SCROLL_AMOUNT
  };
});

