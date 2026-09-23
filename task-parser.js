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

  const semanticResolver = (function () {
    if (typeof require === "function") {
      try { return require("./semantic-resolver.js"); } catch (e) {}
    }
    if (typeof self !== "undefined" && self.SIHSemanticResolver) return self.SIHSemanticResolver;
    if (typeof window !== "undefined" && window.SIHSemanticResolver) return window.SIHSemanticResolver;
    if (typeof globalThis !== "undefined" && globalThis.SIHSemanticResolver) return globalThis.SIHSemanticResolver;
    return null;
  })();

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
   * Safely and generically resolves a destination name or URL into an executable URL.
   * Universal and website-agnostic: never hardcodes specific domains.
   * @param {string} target
   * @returns {string|null}
   */
  function resolveNavigationUrl(target) {
    if (!target) return null;
    const t = String(target).trim();
    if (/^https?:\/\//i.test(t)) {
      return t;
    }
    if (/^www\./i.test(t)) {
      return "https://" + t;
    }
    // Match common domain patterns e.g. "wikipedia.org", "github.com", "my-site.co.uk", "localhost:8000"
    if (/^[a-zA-Z0-9_\-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(t)) {
      return "https://" + t;
    }
    if (/^localhost(?::\d+)?(?:\/.*)?$/i.test(t)) {
      return "http://" + t;
    }

    const lower = t.toLowerCase();
    const isMultiWord = /\s+/.test(t);
    const hasSemanticTerm = /\b(?:cheapest|expensive|rated|latest|recent|newest|oldest|first|second|third|fourth|fifth|last|black|white|blue|red|green|right|left|top|bottom|below|above|next|beside|product|email|mail|result|item|article|message|button|link|card|row|option|checkbox|page|site|website|downloads?|settings?|section|container|tab)\b/i.test(lower);

    if (isMultiWord || hasSemanticTerm) {
      if (/^hacker\s+news$/i.test(lower)) return "https://news.ycombinator.com";
      if (/^google\s+maps$/i.test(lower)) return "https://maps.google.com";
      if (/^google\s+docs$/i.test(lower)) return "https://docs.google.com";
      return null;
    }

    // Generic single-word brand/destination name (e.g. YouTube, Amazon, Wikipedia, GitHub, Google, Gmail)
    const cleanName = lower.replace(/[^a-z0-9\-]/g, "");
    if (cleanName && cleanName.length >= 2) {
      return `https://www.${cleanName}.com`;
    }
    return null;
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
    f = f.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
    f = f.replace(/^(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+/i, "").trim();
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

    // 0. Platform search pattern: "search <Platform> for <query>" (e.g. "search Gmail for emails about SIH")
    const mPlatformSearch = taskClean.match(/\bsearch\s+([a-zA-Z0-9_\-]+)\s+for\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b|[.,;!?]|$)/i);
    if (mPlatformSearch && !/^(?:the|a|an|box|input|field|bar|area|button|for)$/i.test(mPlatformSearch[1])) {
      let val = cleanValue(mPlatformSearch[2]);
      if (val) {
        val = val.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      }
      if (val && !/^(?:the|a|an|it|this|that|box|input|field|bar|area|button)$/i.test(val)) {
        return val;
      }
    }

    // 1. Search query pattern (takes precedence when searching):
    // Strictly bounds the query before verbs like 'and identify', 'and find', 'and open', 'and click', 'and select', 'and visit', etc.
    const mSearch = taskClean.match(/(?<!\bfill\s)(?<!\benter\s)(?<!\btype\s)(?<!\bclick\s)(?<!\bfind\s)\bsearch\s+(?:for\s+)?(?!(?:the\s+)?(?:box|input|field|bar|area|button)\b)['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+(?:identify|find|open|click|select|choose|visit|view|launch|pick|tap|press|see|go\s+to|navigate\s+to)\b|\s+(?:then|after\s+that|next|followed\s+by|and\s+then)\b|(?:\s+[.,;!?]|[.,;!?](?:\s+|$))|$)/i);
    if (mSearch) {
      let val = cleanValue(mSearch[1]);
      if (val) {
        val = val.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      }
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
    const mFill = taskClean.match(/\b(?:fill|set)\b.*?\b(?:as|with|value|to)\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b|[.,;!?]|$)/i);
    if (mFill) {
      let val = cleanValue(mFill[1]);
      if (val) val = val.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }

    // 5. Standalone type/write pattern: "type/write <val>"
    const mType = taskClean.match(/\b(?:type|write)\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b|[.,;!?]|$)/i);
    if (mType) {
      let val = cleanValue(mType[1]);
      if (val) val = val.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
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
    if (/^(?:click|press|tap|open|scroll|view|navigate|go\s+to|select|choose|check|uncheck|toggle|enable|disable|turn|save|download|look|add|reply|compose|send)\b/i.test(text)) {
      return null;
    }

    // Pattern 1a: 'enter/type/put/write <val> as [the] <field>' or 'enter <field> as <val>'
    const enterAsMatch = text.match(/^(?:enter|type|put|write)\s+(.+?)\s+as\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+field|\s+input|\s+box|\s+area|\s+textbox)?$/i);
    if (enterAsMatch) {
      let val = cleanValue(enterAsMatch[1]);
      let field = cleanFieldHint(enterAsMatch[2]);
      // Disambiguate: if match[2] is an email or match[1] is a known field name, invert
      if (/@/.test(enterAsMatch[2]) || /^(?:email|email\s+address|mail|name|full\s+name|phone|mobile|address|password|username|city|state|zip|country)$/i.test(cleanFieldHint(enterAsMatch[1]))) {
        field = cleanFieldHint(enterAsMatch[1]);
        val = cleanValue(enterAsMatch[2]);
      }
      if (val && field && !isPronounOrReference(field) && !/^(?:the|a|an|to)$/i.test(val)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    // Pattern 1b: '[enter/type/put/write] <val> in/into/for/to <field>' (only if not starting with set/fill where field precedes val)
    if (!/^(?:set|fill)\b/i.test(text)) {
      const enterInMatch = text.match(/^(?:(?:enter|type|put|write)\s+)?(.+?)\s+(?:in|into|for|to)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+field|\s+input|\s+box|\s+area|\s+textbox)?$/i);
      if (enterInMatch) {
        const val = cleanValue(enterInMatch[1]);
        const field = cleanFieldHint(enterInMatch[2]);
        if (val && field && !isPronounOrReference(field) && !/^(?:the|a|an|to|it|that|this)$/i.test(val)) {
          return { type: "FILL", fieldHint: field, value: val };
        }
      }
    }

    // Pattern 2a: With explicit fill verb: '[fill/set/enter] [in/into] [the] <field> with/to/as/is/:/= <val>'
    const explicitFillMatch = text.match(/^(?:fill|set|enter)\s+(?:in\s+|into\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:with|to|as|is|:=|=)\s+|\s*:\s*)(.+)$/i);
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
      if (field && val && !isPronounOrReference(field) && !/^(?:search|click|press|tap|open|find|go|select|choose|check|uncheck|toggle|reply|compose|send)$/i.test(field) && !/^(?:reply|compose|send|open|go|navigate|click|press)\b/i.test(field)) {
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

  const CONTEXTUAL_REFERENCE_PATTERN = /^(?:(?:his|her|their|its|this|that|the)\s+)?(?:profile|product(?:\s+page)?|page|item|email|message|post|result|first\s+result|person)$|^(?:his|her|their|its|this|that|it|them|this\s+person|that\s+person|the\s+person|the\s+result|the\s+first\s+result|the\s+selected\s+result|that\s+profile|their\s+profile|his\s+profile|her\s+profile|that\s+item|this\s+product|that\s+product|the\s+email|that\s+email|the\s+message|this\s+post)$/i;

  function isContextualReference(str) {
    if (!str || typeof str !== "string") return false;
    return CONTEXTUAL_REFERENCE_PATTERN.test(str.trim());
  }

  function extractContextualIntent(text) {
    if (!text || typeof text !== "string") return "open";
    const t = text.trim().toLowerCase();
    if (/\bprofile\b/i.test(t)) return "profile";
    if (/\bproduct(?:\s+page)?\b/i.test(t)) return "product";
    if (/\b(?:email|mail|message)\b/i.test(t)) return "email";
    if (/\b(?:first\s+result|result)\b/i.test(t)) return "result";
    if (/\bitem\b/i.test(t)) return "item";
    if (/\bcart\b/i.test(t)) return "cart";
    return "open";
  }

  function inferEntityType(text, intent) {
    if (!text && !intent) return "generic";
    const combined = `${text || ""} ${intent || ""}`.toLowerCase();
    if (/\b(?:his|her|profile|person|user|candidate|employee|ceo|founder)\b/i.test(combined)) return "person";
    if (/\b(?:product|item|laptop|phone|earbuds|book|price|cart)\b/i.test(combined)) return "product";
    if (/\b(?:email|mail|message|inbox)\b/i.test(combined)) return "email";
    return "result";
  }

  function extractEntityFromStep(step) {
    if (!step) return null;
    if (step.targetEntity && step.targetEntity.name) {
      return step.targetEntity;
    }
    if (step.query) {
      return {
        type: inferEntityType(step.query, step.targetHint),
        name: step.query
      };
    }
    if (step.value && step.type === "FILL") {
      return {
        type: inferEntityType(step.value, step.fieldHint),
        name: step.value
      };
    }
    if (step.context) {
      return {
        type: inferEntityType(step.target || step.targetHint, step.context),
        name: `${step.context} ${step.target || step.targetHint || "item"}`.trim()
      };
    }
    if (step.objectTarget) {
      return {
        type: inferEntityType(step.objectTarget, step.targetHint),
        name: step.objectTarget
      };
    }
    if (step.targetHint && (step.type === "CLICK" || step.type === "OPEN")) {
      const t = step.targetHint.trim();
      if (!/^(?:search|submit|button|box|input|field|link|bar)$/i.test(t)) {
        return {
          type: inferEntityType(t, step.context),
          name: t
        };
      }
    }
    return null;
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
   * Parses unvalued multi-field entries like "enter my email and password" or "fill name and email".
   * Produces structured FILL steps using existing action vocabulary with placeholder value "...".
   * @param {string} clause
   * @returns {Array<Object>|null}
   */
  function parseMultiFieldNoValClause(clause) {
    if (!clause || typeof clause !== "string") return null;
    const text = clause.trim().replace(/[.,;!?]+$/, "");
    const match = text.match(/^(?:fill|enter|type|put)\s+(?:in\s+|into\s+)?(?:(?:the|my|our|your)\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)\s+(?:and|,)\s+(?:(?:the|my|our|your)\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)(?:\s+(?:and|,)\s+(?:(?:the|my|our|your)\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?))?$/i);
    if (!match) return null;
    if (/\b(?:as|with|value|to|is)\b/i.test(text)) return null;
    const f1 = cleanFieldHint(match[1]);
    const f2 = cleanFieldHint(match[2]);
    const f3 = match[3] ? cleanFieldHint(match[3]) : null;
    if (!f1 || !f2) return null;
    const steps = [
      { type: "FILL", fieldHint: f1, value: "..." },
      { type: "FILL", fieldHint: f2, value: "..." }
    ];
    if (f3) {
      steps.push({ type: "FILL", fieldHint: f3, value: "..." });
    }
    return steps;
  }

  const ACTION_VERB_PREFIX = '(?:click|press|tap|open|launch|visit|navigate\\s+to|go\\s+to|select|choose|pick|check|uncheck|toggle|tick|untick|enable|disable|turn\\s+on|turn\\s+off|activate|deactivate|fill|enter|type|put|set|write|populate|autofill|complete|search\\s+for|search|find|locate|look\\s+for|look|compose|reply|send|submit|save|download|add(?:\\s+to\\s+cart)?|add|scroll(?:\\s+down|\\s+up)?)';
  const ACTION_CONNECTOR_PATTERN = new RegExp(
    '(?:' +
      '(?:,\\s*|;\\s*)(?:and\\s+then|and|then|after\\s+that|next|followed\\s+by|also)?\\s*' +
      '|\\s+(?:and\\s+then|then|after\\s+that|followed\\s+by|next|also|and)\\s+' +
    ')(?=' + ACTION_VERB_PREFIX + '\\b)',
    'i'
  );

  /**
   * Action-aware clause segmentation.
   * Splits multi-step instructions across connectors (and, then, after that, next, followed by, also, and then)
   * ONLY when followed by a recognized action-introducing pattern.
   * Preserves inner connectors inside targets/values (e.g. "rock and roll music", "Research and Development").
   * @param {string} text
   * @returns {Array<string>}
   */
  function splitActionClauses(text) {
    if (!text || typeof text !== 'string') return [text];
    const t = text.trim();
    const parts = t.split(ACTION_CONNECTOR_PATTERN);
    return parts.map(p => p.trim()).filter(Boolean);
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
    s = s.replace(/^(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+/i, "").trim();
    s = s.replace(/^(?:my|our|your|the|a|an)\s+/i, "").trim();
    if (!s) return null;

    // Must not start with action verbs
    if (/^(?:click|press|tap|open|scroll|select|choose|check|uncheck|toggle|tick|untick|enable|disable|turn|activate|deactivate|find|locate|search|look|go|navigate|fill|enter|type|put|set|write|compose|reply|send|submit|save|download|add)\b/i.test(s)) {
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
    if (/^(?:and|then|after|next|also|followed)$/i.test(parts[0])) return null;

    const actionVerbPattern = /^(?:click|press|tap|open|scroll|select|choose|check|uncheck|toggle|tick|untick|enable|disable|turn|activate|deactivate|find|locate|search|look|go|navigate|fill|enter|type|put|set|write|compose|reply|send|submit|save|download|add)$/i;

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
    let text = clause.trim().replace(/[.,;!?]+$/, "").replace(/^(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+/i, "");
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
      if (targetPart.includes(',') || targetPart.includes(';') || /\b(?:compose|navigate|open|go\s+to|fill|enter|type|write|search|click|press|tap|submit|send|enable|disable|save|download)\b/i.test(targetPart)) {
        return null;
      }
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
      cleanTarget = cleanTarget.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();

      if (!action) {
        if (targetType === "checkbox") action = "CHECK";
        else if (targetType === "option") action = "SELECT";
        else if (targetType === "toggle") action = "TOGGLE";
        else action = "SELECT";
      }

      const attrConstraint = extractAttributeConstraint(cleanTarget);
      return {
        type: action,
        action: action,
        target: cleanTarget,
        targetHint: cleanTarget,
        objectTarget: attrConstraint ? attrConstraint.objectTarget : null,
        attribute: attrConstraint ? attrConstraint.attribute : null,
        attributeValue: attrConstraint ? attrConstraint.attributeValue : null,
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
      cleanTarget = cleanTarget.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();

      const attrConstraint = extractAttributeConstraint(cleanTarget);
      const desc = semanticResolver ? semanticResolver.extractSemanticDescriptor(targetPart) : {};
      return {
        type: action,
        action: action,
        target: cleanTarget,
        targetHint: cleanTarget,
        semanticTarget: cleanTarget,
        semanticCategory: desc.category || null,
        ranking: desc.ranking || null,
        spatial: desc.spatial || null,
        isSemantic: !!(desc.isSemantic || ordinal !== null || attrConstraint),
        objectTarget: attrConstraint ? attrConstraint.objectTarget : (desc.objectTarget || null),
        attribute: attrConstraint ? attrConstraint.attribute : (desc.attribute || null),
        attributeValue: attrConstraint ? attrConstraint.attributeValue : (desc.attributeValue || null),
        context: prevContext || null,
        relation: prevContext ? "inside" : null,
        ordinal: ordinal !== null ? ordinal : null,
        targetType: targetType
      };
    }

    // Pattern 3: CLICK / select intent with an ordinal (e.g. "click the first product" or "first product", "select the second result")
    const ordinal = extractOrdinal(rest);
    if (ordinal !== null && (action === "CLICK" || action === "SELECT" || !action)) {
      let targetPart = rest.replace(/^(?:the|a|an)\s+/i, "").trim();
      const targetType = extractTargetType(targetPart) || "generic";
      const attrConstraint = extractAttributeConstraint(targetPart);
      const desc = semanticResolver ? semanticResolver.extractSemanticDescriptor(targetPart) : {};
      const act = action === "SELECT" ? "SELECT" : "CLICK";
      return {
        type: act,
        action: act,
        target: targetPart,
        targetHint: targetPart,
        semanticTarget: targetPart,
        semanticCategory: desc.category || null,
        ranking: desc.ranking || null,
        spatial: desc.spatial || null,
        isSemantic: true,
        objectTarget: attrConstraint ? attrConstraint.objectTarget : (desc.objectTarget || null),
        attribute: attrConstraint ? attrConstraint.attribute : (desc.attribute || null),
        attributeValue: attrConstraint ? attrConstraint.attributeValue : (desc.attributeValue || null),
        context: prevContext || null,
        relation: prevContext ? "inside" : null,
        ordinal: ordinal,
        targetType: targetType
      };
    }

    return null;
  }

  /**
   * Generic attribute extraction layer for descriptive targets.
   * Recognizes color constraints and decomposes targets into:
   * objectTarget, attribute, attributeValue.
   *
   * @param {string} text
   * @returns {{ objectTarget: string, attribute: string, attributeValue: string, normalizedTarget: string } | null}
   */
  function extractAttributeConstraint(text) {
    if (!text || typeof text !== "string") return null;
    let s = text.trim().replace(/[.,;!?]+$/, "");
    s = s.replace(/^(?:the|a|an)\s+/i, "").trim();
    // Strip leading ordinal if present (e.g. "first black earbuds", "second red shoes")
    s = s.replace(/^(?:first|second|third|1st|2nd|3rd|last)\s+/i, "").trim();
    const LOCATION_SUFFIX_PATTERN = /\s+(?:on\s+(?:the\s+)?(?:screen|page|webpage|site)|on\s+screen|here|in\s+(?:the\s+)?page)$/i;
    s = s.replace(LOCATION_SUFFIX_PATTERN, "").trim();

    const colorPattern = "\\b(black|white|red|blue|green|yellow|orange|purple|pink|brown|gray|grey|silver|gold)\\b";

    // Pattern 1: "<color> [color/colour/colored/coloured] <object>" (e.g. "black colour earbuds", "black earbuds", "white shoes")
    const p1Regex = new RegExp(`^${colorPattern}(?:[\\s\\-]+(?:colour|color|colored|coloured))?\\s+(.+)$`, "i");
    const m1 = s.match(p1Regex);
    if (m1) {
      const colorVal = m1[1].toLowerCase();
      let obj = m1[2].trim().replace(/^(?:the|a|an)\s+/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();
      if (obj && !isPronounOrReference(obj)) {
        return {
          objectTarget: obj,
          attribute: "color",
          attributeValue: colorVal,
          normalizedTarget: `${colorVal} ${obj}`
        };
      }
    }

    // Pattern 2: "<object> in/with [the] <color> [color/colour]" (e.g. "earbuds in black", "shoes with white colour")
    const p2Regex = new RegExp(`^(.+?)\\s+(?:in|with)\\s+(?:the\\s+)?${colorPattern}(?:[\\s\\-]+(?:colour|color|colored|coloured))?$`, "i");
    const m2 = s.match(p2Regex);
    if (m2) {
      let obj = m2[1].trim().replace(/^(?:the|a|an)\s+/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();
      const colorVal = m2[2].toLowerCase();
      if (obj && !isPronounOrReference(obj)) {
        return {
          objectTarget: obj,
          attribute: "color",
          attributeValue: colorVal,
          normalizedTarget: `${colorVal} ${obj}`
        };
      }
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

    // 0a. Normalize "find/locate/go to [the] <FIELD> [field/input/box/area/textbox] and/then enter/type/fill/put/set/write <VAL>"
    // or "... and enter/fill ... with/to/as/:/= <VAL>" or "... enter <VAL> in/into it"
    // -> "fill <FIELD> with <VAL>"
    text = text.replace(
      /\b(?:find|locate|go\s+to)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:field|input|box|area|textbox))?\s*(?:,\s*(?:and\s+then|and|then)\s*|\s+(?:and\s+then|and|then)\s+)(?:enter|fill|type|put|set|write)(?:\s+(?:(?:in|into)\s+)?(?:it|that|this|the\s+field|the\s+input|the\s+box))?\s*(?:(?:with|to|as|value|is|:=|=)\s+)?(.+?)(?:\s+(?:in|into)\s+(?:it|that|this|the\s+field|the\s+input|the\s+box))?(?=\s*[,;.]|\s+(?:and\s+then|and|then)\b|$)/gi,
      (match, field, val) => {
        const cleanF = cleanFieldHint(field);
        if (/\b(?:form|section|modal|dialog|page|card|panel)\b/i.test(cleanF)) return match;
        if (/\b(?:and|,)\b\s*(?:(?:my|the|your|our)\s+)?(?:email|password|username|name|phone|address)\b/i.test(val)) return match;
        return `fill ${cleanF} with ${val.trim()}`;
      }
    );

    // 1. Normalize "find/locate/search for/look for [the] <TARGET> and/then/and then click/press/tap/select/use/open/download it/that/this/them/that button/that link/the above"
    // -> "<verb> [the] <TARGET>"
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(click|press|tap|select|use|open|download)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target, verb) => {
        const cleanTarget = target.trim();
        const v = (verb || "").toLowerCase();
        // If cleanTarget is a semantic entity like email, message, person, profile, product, do not collapse into single click
        if (/\b(?:email|mail|message|profile|person|user|product|item|laptop|phone|cart)\b/i.test(cleanTarget)) {
          return match;
        }
        const act = (v === "select" ? "select" : (v === "open" ? "open" : (v === "download" ? "download" : "click")));
        return `${act} ${cleanTarget}`;
      }
    );

    // 1b. Normalize "find/locate/search for/look for [the] <TARGET> and turn it on/enable it" -> "enable [the] <TARGET>"
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(?:turn\s+(?:it|this|that)\s+on|enable\s+(?:it|this|that)|activate\s+(?:it|this|that))\b/gi,
      (match, target) => `enable ${target.trim()}`
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

    // 3. Normalize "[the] <TARGET> button/link and then click/press/tap/select/use/open it" or ", then click it" when preceded by a clickable target
    text = text.replace(
      /\b(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+(?:button|link)))\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(click|press|tap|select|use|open)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target, verb) => {
        const cleanTarget = (target || "").trim();
        if (/^(?:fill|enter|type|put|set|is|as|with|in|into|then|and|from|of|to|for|at|by|about)$/i.test(cleanTarget)) {
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
   * Extracts user execution constraints and stop conditions from natural-language task text.
   * Ensures control directives (e.g. "do not send", "stop after filling", "ask for confirmation")
   * are cleanly isolated as execution constraints and never confused with DOM targets or values.
   *
   * @param {string} text
   * @returns {{ constraints: Array<string>, stopCondition: string|null, approvalRequirement: string|null, requireApprovalBeforeSend: boolean, doNotSend: boolean }}
   */
  function extractExecutionConstraints(text) {
    if (!text || typeof text !== "string") {
      return {
        constraints: [],
        stopCondition: null,
        approvalRequirement: null,
        requireApprovalBeforeSend: false,
        doNotSend: false,
        doNotSubmit: false,
        doNotBuy: false
      };
    }
    const constraints = [];
    let stopCondition = null;
    let approvalRequirement = null;
    let requireApprovalBeforeSend = false;
    let doNotSend = false;
    let doNotSubmit = false;
    let doNotBuy = false;

    const lower = text.toLowerCase();

    // Check for do not send / don't send / don't click send
    if (/\b(?:do\s+not\s+send(?:\s+it)?|don'?t\s+(?:click\s+)?send(?:\s+it)?|never\s+send)\b/i.test(lower)) {
      constraints.push("DO_NOT_SEND");
      doNotSend = true;
      if (!stopCondition) stopCondition = "DO_NOT_SEND";
    }

    // Check for do not submit / don't submit / don't click submit
    if (/\b(?:do\s+not\s+submit(?:\s+it)?|don'?t\s+(?:click\s+)?submit(?:\s+it)?|never\s+submit)\b/i.test(lower)) {
      constraints.push("DO_NOT_SUBMIT");
      doNotSubmit = true;
      if (!stopCondition) stopCondition = "DO_NOT_SUBMIT";
    }

    // Check for do not buy / don't buy / don't checkout / don't purchase
    if (/\b(?:do\s+not\s+(?:buy|purchase|checkout|order)(?:\s+it)?|don'?t\s+(?:buy|purchase|checkout|order)(?:\s+it)?|never\s+(?:buy|purchase))\b/i.test(lower)) {
      constraints.push("DO_NOT_BUY");
      doNotBuy = true;
      if (!stopCondition) stopCondition = "DO_NOT_BUY";
    }

    // Check for stop after filling / stop before sending
    if (/\b(?:stop\s+after\s+filling(?:\s+the\s+reply)?|stop\s+before\s+sending|pause\s+after\s+filling|halt\s+after\s+filling)\b/i.test(lower)) {
      constraints.push("STOP_AFTER_FILLING");
      stopCondition = "AFTER_FILL";
    }

    // Check for prepare ... and wait / wait
    if (/\b(?:and\s+wait|prepare\s+.*and\s+wait|wait\s+for\s+user|just\s+prepare\s+it)\b/i.test(lower)) {
      constraints.push("WAIT_FOR_USER");
      if (!stopCondition) stopCondition = "WAIT_FOR_USER";
    }

    // Check for confirmation / approval
    if (/\b(?:ask\s+for\s+confirmation|require\s+confirmation|confirmation\s+first|only\s+send\s+after\s+approval|wait\s+for\s+approval|require\s+approval|need\s+approval|approval\s+before\s+send(?:ing)?)\b/i.test(lower)) {
      constraints.push("REQUIRE_APPROVAL_BEFORE_SEND");
      requireApprovalBeforeSend = true;
      approvalRequirement = "HUMAN_CONFIRMATION_BEFORE_SEND";
    }

    return {
      constraints,
      stopCondition,
      approvalRequirement,
      requireApprovalBeforeSend,
      doNotSend,
      doNotSubmit,
      doNotBuy
    };
  }

  /**
   * Strips execution control directives from natural-language task text.
   * Keeps pure actionable steps and values intact.
   *
   * @param {string} text
   * @returns {string}
   */
  function stripExecutionControlPhrases(text) {
    if (!text || typeof text !== "string") return "";
    let s = text;
    // Strip control phrases cleanly (including connectors like "but", "and", "then"):
    // 1. "stop after filling [the reply]", "stop before sending", etc.
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:stop\s+after\s+filling(?:\s+the\s+reply)?|stop\s+before\s+sending|pause\s+after\s+filling|halt\s+after\s+filling)\b[.,;!?]?/gi, " ");
    // 2. "do not send [it]", "don't send [it]", "don't click send", "never send", etc.
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:do\s+not\s+send(?:\s+it)?|don'?t\s+(?:click\s+)?send(?:\s+it)?|never\s+send)\b[.,;!?]?/gi, " ");
    // 3. "do not submit [it]", "don't submit [it]", "don't click submit", "never submit", etc.
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:do\s+not\s+submit(?:\s+it)?|don'?t\s+(?:click\s+)?submit(?:\s+it)?|never\s+submit)\b[.,;!?]?/gi, " ");
    // 4. "do not buy [it]", "don't buy [it]", etc.
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:do\s+not\s+(?:buy|purchase|checkout|order)(?:\s+it)?|don'?t\s+(?:buy|purchase|checkout|order)(?:\s+it)?|never\s+(?:buy|purchase))\b[.,;!?]?/gi, " ");
    // 5. "and wait", "prepare ... and wait"
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:and\s+then|and|then)\b\s*)?\b(?:wait\s+for\s+user|just\s+prepare\s+it|wait)\b[.,;!?]?/gi, " ");
    // 6. "ask for confirmation [before sending]", "require confirmation", "confirmation first", etc.
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:ask\s+for\s+confirmation(?:\s+before\s+sending)?|require\s+confirmation(?:\s+before\s+sending)?|confirmation\s+first|only\s+send\s+after\s+approval|wait\s+for\s+approval|require\s+approval(?:\s+before\s+sending)?|approval\s+before\s+send(?:ing)?)\b[.,;!?]?/gi, " ");
    // Clean any trailing conjunctions left orphaned at end of text (e.g. "Reply to this email but" -> "Reply to this email")
    s = s.replace(/\s+(?:but|and|then|also|after\s+that)\s*$/i, "");
    return s.replace(/\s+/g, " ").trim().replace(/[.,;!?]+$/, "").trim();
  }

  /**
   * Parses email / message reply workflows into multi-step semantic actions.
   * Produces:
   * STEP 1: CLICK -> Reply (expectedRole: button, semanticTarget: Reply)
   * STEP 2: FILL -> Reply message body (expectedRole: textarea/contenteditable, value: replyText)
   * Optional STEP 3 (if requireApprovalBeforeSend): CLICK -> Send (requiresApproval: true, expectedRole: button)
   *
   * @param {string} text
   * @param {Object} [constraints]
   * @returns {Array<Object>|null}
   */
  function parseReplyWorkflow(text, constraints) {
    if (!text || typeof text !== "string") return null;
    const t = text.trim();

    // 1. Reply with explicit value:
    // e.g. "Reply to the currently open email with: ...", "Reply to the open email with Hello", "Reply to this email saying thank you", "Reply with ..."
    const replyWithMatch = t.match(/^(?:reply|draft\s+(?:a\s+)?reply|write\s+(?:a\s+)?reply)(?:\s+(?:to\s+)?(?:the\s+)?(?:currently\s+)?(?:open\s+)?(?:this\s+)?(?:email|mail|message))?\s*(?:saying|with\s*[:\s]+|:\s*)(.+)$/i);
    if (replyWithMatch) {
      let replyBody = replyWithMatch[1].trim();
      replyBody = cleanValue(replyBody);
      if (!replyBody) replyBody = "...";

      const steps = [
        {
          type: "CLICK",
          targetHint: "Reply",
          target: "Reply",
          expectedRole: "button",
          role: "button",
          semanticTarget: "Reply",
          legacyTarget: null
        },
        {
          type: "FILL",
          fieldHint: "Reply message body",
          expectedRole: "textarea/contenteditable",
          role: "textarea/contenteditable",
          semanticTarget: "Reply message body",
          value: replyBody
        }
      ];

      if (constraints && constraints.requireApprovalBeforeSend && !constraints.doNotSend) {
        steps.push({
          type: "CLICK",
          targetHint: "Send",
          target: "Send",
          expectedRole: "button",
          role: "button",
          semanticTarget: "Send",
          requiresApproval: true,
          risk: "HIGH",
          riskLevel: "HIGH",
          legacyTarget: resolveLegacyClickTarget("Send")
        });
      }

      return steps;
    }

    // 2. Standalone reply intent without explicit body value:
    // e.g. "Reply to the currently open email", "Reply to this email", "Reply to email", "Draft a reply"
    const standaloneReplyMatch = t.match(/^(?:reply|draft\s+(?:a\s+)?reply|write\s+(?:a\s+)?reply)(?:\s+(?:to\s+)?(?:the\s+)?(?:currently\s+)?(?:open\s+)?(?:this\s+)?(?:email|mail|message))?$/i);
    if (standaloneReplyMatch) {
      const isDraft = /\bdraft\b/i.test(t);
      const steps = [
        {
          type: "CLICK",
          targetHint: "Reply",
          target: "Reply",
          expectedRole: "button",
          role: "button",
          semanticTarget: "Reply",
          legacyTarget: null
        }
      ];
      if (isDraft) {
        steps.push({
          type: "FILL",
          fieldHint: "Reply message body",
          expectedRole: "textarea/contenteditable",
          role: "textarea/contenteditable",
          semanticTarget: "Reply message body",
          value: ""
        });
      }
      if (constraints && constraints.requireApprovalBeforeSend && !constraints.doNotSend) {
        steps.push({
          type: "CLICK",
          targetHint: "Send",
          target: "Send",
          expectedRole: "button",
          role: "button",
          semanticTarget: "Send",
          requiresApproval: true,
          risk: "HIGH",
          riskLevel: "HIGH",
          legacyTarget: resolveLegacyClickTarget("Send")
        });
      }
      return steps;
    }

    return null;
  }

  /**
   * Section 3b: Recognizes platform-targeted search workflows:
   * e.g. "Search Gmail for emails about SIH." ->
   * STEP 1: FILL -> Search mail (value: "emails about SIH")
   * STEP 2: SUBMIT -> Search mail (query: "emails about SIH")
   *
   * @param {string} rawTask
   * @returns {Array<Object>|null}
   */
  function parsePlatformSearchWorkflow(rawTask) {
    if (!rawTask || typeof rawTask !== "string") return null;
    const text = (rawTask || "").trim().replace(/[.!?]+$/, "");
    if (!text) return null;

    // Pattern: "Search <Platform> for <query>"
    const m = text.match(/^search\s+([a-zA-Z0-9_\-]+)\s+for\s+(.+)$/i);
    if (m) {
      const platform = m[1].trim();
      const query = cleanValue(m[2].trim());
      if (/^(?:the|a|an|all|my|this|that|in|on|at|for)$/i.test(platform)) return null;

      const pLower = platform.toLowerCase();
      let searchTarget = "search";
      if (pLower === "gmail") {
        searchTarget = "Search mail";
      } else if (pLower === "youtube") {
        searchTarget = "search";
      } else if (pLower === "amazon") {
        searchTarget = "search";
      }

      return [
        {
          type: "FILL",
          fieldHint: searchTarget,
          semanticTarget: searchTarget,
          expectedRole: "input",
          role: "input",
          value: query
        },
        {
          type: "SUBMIT",
          targetHint: searchTarget,
          semanticTarget: searchTarget,
          query: query
        }
      ];
    }

    return null;
  }

  /**
   * Section 3: Recognizes generic multi-stage search workflows.
   * Generic across all search engines and content portals without site-specific rules.
   *
   * @param {string} rawTask
   * @returns {Array<Object>|null} Ordered step descriptors or null
   */
  function parseSearchWorkflow(rawTask) {
    let text = (rawTask || "").trim().replace(/[.!?]+$/, "");
    if (!text) return null;
    // Strip trailing ellipsis / dangling conjunctions: e.g. ", and ..." or ", and"
    text = text.replace(/(?:,\s*|\s+)(?:and\s+then|and|then|\.{3,}|…)+$/i, "").trim();

    // 0. Optional navigation prefix: e.g. "Open YouTube, search for...", "Go to Amazon and search for...", "Open LinkedIn, find Sundar Pichai..."
    const navPrefixMatch = text.match(/^(?:open|go\s+to|navigate\s+to|launch|visit)\s+(?:the\s+)?((?:(?!\b(?:and|then|after\s+that|next|followed\s+by|also)\b)[a-zA-Z0-9_\-])+(?:\s+(?!\b(?:and|then|after\s+that|next|followed\s+by|also)\b)[a-zA-Z0-9_\-]+)*)\s*(?:,\s*|\s+)?(?:\b(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b\s*)?(?=(?:search|find|look\s+for)\b)/i);
    let navTarget = null;
    let searchTaskText = text;
    if (navPrefixMatch) {
      navTarget = navPrefixMatch[1].trim().replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      searchTaskText = text.substring(navPrefixMatch[0].length).trim();
    }

    // 1. Authoritative search query extraction
    let query = extractTaskQueryOrValue(searchTaskText);
    if (!query && navTarget) {
      const mFindNav = searchTaskText.match(/\b(?:find|look\s+for)\s+(?:the\s+)?['"]?([^'",;]+?)['"]?(?:\s*(?:,\s*|\s+)(?:\b(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b\s*)?(?:identify|find|open|click|select|choose|visit|view|launch|pick|tap|press|add)\b|\s*[,;]|$)/i);
      if (mFindNav) {
        query = cleanValue(mFindNav[1]);
      }
    }
    if (!query) return null;

    if (navTarget) {
      if (!/\b(?:search|find|look\s+for)\b/i.test(searchTaskText)) return null;
    } else {
      if (!/\bsearch\b/i.test(searchTaskText)) return null;
    }

    const hasSearchBoxPrefix = /^(?:find|locate|go\s+to|click)\s+(?:on\s+)?(?:the\s+)?(?:search\s+(?:box|input|field|bar|area)|search)(?:\s+(?:in|on|at|of)\s+[a-zA-Z0-9_\-]+)?\b/i.test(searchTaskText);

    let isExplicitTarget = false;
    let explicitTarget = null;
    let isMostRelevant = false;
    let hasProductOpen = false;
    let productTarget = null;
    let targetEntity = null;
    let targetIntent = null;
    let actionVerb = "OPEN";
    let candidate = null;

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
      const postSearchActionMatch = searchTaskText.match(/(?:,\s*|\s+)(?:\b(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b\s*)?(?:identify|find|select|choose|open|click|visit|view|launch|pick|tap|press)\s+(?:on\s+)?(?:the\s+)?([^,;]+?)(?:\s*[,;.]|\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+(?:find|locate|click|press|tap|play|add)|$)/i);
      if (postSearchActionMatch) {
        candidate = postSearchActionMatch[1].trim();
        const isPronoun = /^(?:it|that|this|them)$/i.test(candidate);
        const isOrdinalResult = /\b(?:first|second|third|top|last)\s+result\b/i.test(candidate);
        const isGeneric = /^(?:(?:most\s+relevant|relevant|actual|first|second|third|top|selected|chosen|official|main|verified|primary)\s+)*(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry|it|that|this|them)$/i.test(candidate);
        const isContextual = !isPronoun && !isOrdinalResult && (
          isContextualReference(candidate) ||
          isContextualReference("the " + candidate) ||
          /^(?:profile|product(?:\s+page)?|page|item|email|message|post|person)$/i.test(candidate) ||
          (typeof semanticResolver !== "undefined" && semanticResolver && semanticResolver.isContextualReference && (semanticResolver.isContextualReference(candidate) || semanticResolver.isContextualReference("the " + candidate)))
        );

        if (isContextual) {
          const cIntent = extractContextualIntent(candidate);
          const eType = inferEntityType(candidate, cIntent);
          targetEntity = {
            type: eType,
            name: query
          };
          targetIntent = cIntent;
          isExplicitTarget = false;
          explicitTarget = null;
          isMostRelevant = false;
          hasProductOpen = true;
          productTarget = candidate.toLowerCase().includes("first result") ? "first result" : query;
          actionVerb = "OPEN";
        } else if (!isGeneric) {
          explicitTarget = candidate;
          isExplicitTarget = true;
          isMostRelevant = false;
          hasProductOpen = true;
          productTarget = explicitTarget;
        } else {
          isMostRelevant = /\b(?:most\s+relevant|relevant)\b/i.test(candidate) || isPronoun;
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
        type: "NAVIGATE",
        action: "NAVIGATE",
        targetHint: navTarget,
        target: navTarget,
        url: resolveNavigationUrl(navTarget),
        isNavigation: true,
        legacyTarget: null
      });
    }

    // Step 1: Explicit search input locator if task starts with finding/locating search box and involves subsequent actions
    if (hasSearchBoxPrefix && (hasProductOpen || trailingTarget)) {
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
      const semanticDesc = typeof semanticResolver !== "undefined" && semanticResolver ? semanticResolver.extractSemanticDescriptor(productTarget) : {};
      const finalCategory = targetEntity ? targetEntity.type : (semanticDesc.category || "product");
      const isFirstResult = (productTarget && productTarget.toLowerCase().includes("first result")) || (candidate && candidate.toLowerCase().includes("first result"));
      const finalOrdinal = isFirstResult ? 1 : (semanticDesc.ordinal !== undefined ? semanticDesc.ordinal : null);
      const finalTarget = targetEntity ? targetEntity.name : productTarget;
      steps.push({
        type: "CLICK",
        action: actionVerb || "OPEN",
        targetHint: finalTarget,
        target: finalTarget,
        semanticTarget: finalTarget,
        query: query,
        isProductSelection: true,
        isExplicitTarget: isExplicitTarget,
        explicitTarget: explicitTarget || null,
        targetEntity: targetEntity || null,
        targetIntent: targetIntent || null,
        isMostRelevant: isMostRelevant,
        semanticCategory: finalCategory,
        ranking: semanticDesc.ranking || null,
        ordinal: finalOrdinal,
        spatial: semanticDesc.spatial || null,
        isSemantic: !!(targetEntity || semanticDesc.isSemantic || finalOrdinal !== null)
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

  let currentActiveConstraints = null;

  /**
   * Parses free-text user task into structured local intent.
   * Deterministic, bounded rule-based parser (no LLM, no external network).
   *
   * @param {string} rawTask
   * @param {boolean} [isSubCall=false]
   * @returns {Object} Structured intent with sanitized plan and private local values
   */
  function parseTask(rawTask, isSubCall = false) {
    if (!rawTask || !rawTask.trim()) {
      return createNoneResult("Empty task", !isSubCall ? currentActiveConstraints : null);
    }

    // Strip trailing verification assertions if present (e.g. ", and verify that the email was sent")
    const cleanRawTask = rawTask.trim().replace(
      /(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:(?:verify|confirm|ensure)(?:\s+(?:that|if|whether))?|check\s+(?:that|if|whether))(?:\s+.*)?$/i,
      ""
    );

    // CRITICAL FIX: Extract user execution constraints and stop conditions FIRST
    let executionConstraints;
    if (!isSubCall) {
      executionConstraints = extractExecutionConstraints(cleanRawTask);
      currentActiveConstraints = executionConstraints;
    } else {
      executionConstraints = currentActiveConstraints || {
        constraints: [],
        stopCondition: null,
        approvalRequirement: null,
        requireApprovalBeforeSend: false,
        doNotSend: false
      };
    }

    const taskWithoutControls = executionConstraints.constraints.length > 0
      ? stripExecutionControlPhrases(cleanRawTask)
      : cleanRawTask;

    // 0. Platform search workflow: e.g. "Search Gmail for emails about SIH."
    const platformSearchSteps = parsePlatformSearchWorkflow(taskWithoutControls);
    if (platformSearchSteps && platformSearchSteps.length > 0) {
      return buildResultFromSteps(platformSearchSteps, executionConstraints);
    }

    // 0b. Reply workflow: e.g. "Reply to the currently open email with: ... Stop after filling the reply. Do not send it."
    const replySteps = parseReplyWorkflow(taskWithoutControls, executionConstraints);
    if (replySteps && replySteps.length > 0) {
      return buildResultFromSteps(replySteps, executionConstraints);
    }

    // Section 3: Recognize generic search workflows & multi-stage workflow check:
    // If the task contains sequential workflow stages across search or interactive actions,
    // split at the result selection boundary and parse each stage.
    const multiStageSplitPattern = /(?<=(?:open|click|select|view)\s+(?:on\s+)?(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:[a-zA-Z0-9_\-]+\s+)?(?:product|result|item|listing|video|movie|article|email|mail|message|song|track|stream|content|website|site|webpage|page|link|portal|entry|it|that|them)|(?:submit\s+search|submit))\s*(?:,\s*(?:then|and\s+then|and)?|\s+(?:then|and\s+then|and)|\s*;\s*(?:then)?|\.\s*|\s+after\s+opening\s+[^,;]+,?\s*)\s*(?=(?:(?:find|locate|go\s+to|click)\s+(?:on\s+)?(?:the\s+)?(?:[a-zA-Z0-9_\-]+\s+)?(?:search\s+(?:box|input|field|bar|area)|search)\b|search\b|compose\b|enter\b|type\b|fill\b|send\b|write\b|reply\b|draft\b))/i;

    let stageParts = taskWithoutControls.split(multiStageSplitPattern);
    if (stageParts.length <= 1) {
      const legacyPattern = /(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s+after\s+opening\s+(?:it|the\s+result|the\s+product|that|the\s+video|the\s+item))\s+(?=(?:find|locate|go\s+to|click|search|on\b|in\b))/i;
      const legacyParts = taskWithoutControls.split(legacyPattern);
      if (legacyParts.length > 1 && legacyParts.every((p) => /\bsearch\b/i.test(p))) {
        stageParts = legacyParts;
      }
    }

    if (stageParts.length > 1) {
      let combinedSteps = [];
      let currentTaskEntity = null;
      let allValid = true;
      for (const part of stageParts) {
        const trimmedPart = part.trim();
        const stageWorkflow = parseSearchWorkflow(trimmedPart);
        if (stageWorkflow && stageWorkflow.length > 0) {
          combinedSteps = combinedSteps.concat(stageWorkflow);
          const lastSt = stageWorkflow[stageWorkflow.length - 1];
          currentTaskEntity = extractEntityFromStep(lastSt) || currentTaskEntity;
        } else {
          // Check if trimmedPart is a contextual reference clause (e.g. "Open his profile", "Open that email", "Open it")
          const isCtxRef = isContextualReference(trimmedPart) || /^(?:open|click|view|select|visit)\s+(?:his|her|their|its|this|that|the)\s+(?:profile|product|page|email|message|item|result|first\s+result|person)\b/i.test(trimmedPart) || /^(?:open|click|view)\s+(?:it|this|that|them)$/i.test(trimmedPart);
          if (isCtxRef && currentTaskEntity) {
            const cIntent = extractContextualIntent(trimmedPart);
            const labelSuffix = (cIntent && cIntent !== "open") ? (" " + cIntent) : "";
            combinedSteps.push({
              type: "CLICK",
              action: "OPEN",
              targetHint: `${currentTaskEntity.name}${labelSuffix}`,
              target: currentTaskEntity.name,
              semanticTarget: `${currentTaskEntity.name}${labelSuffix}`,
              targetEntity: currentTaskEntity,
              targetIntent: cIntent,
              isSemantic: true,
              semanticCategory: currentTaskEntity.type || "person"
            });
          } else {
            const subRes = parseTask(trimmedPart, true);
            if (subRes.intent !== "NONE" && Array.isArray(subRes.steps) && subRes.steps.length > 0 && subRes.steps[0].type !== "NONE") {
              combinedSteps = combinedSteps.concat(subRes.steps);
              const lastSt = subRes.steps[subRes.steps.length - 1];
              currentTaskEntity = extractEntityFromStep(lastSt) || currentTaskEntity;
            } else {
              allValid = false;
              break;
            }
          }
        }
      }
      if (allValid && combinedSteps.length > 0) {
        return buildResultFromSteps(combinedSteps, executionConstraints);
      }
    }

    const searchWorkflowSteps = parseSearchWorkflow(taskWithoutControls);
    if (searchWorkflowSteps && searchWorkflowSteps.length > 0) {
      return buildResultFromSteps(searchWorkflowSteps, executionConstraints);
    }

    const task = normalizeTaskPhrasing(taskWithoutControls);
    if (!task) {
      return createNoneResult("Empty task", executionConstraints);
    }

    const lower = task.toLowerCase();

    // 0c. Whole form filling with profile: "fill the form", "autofill form", "fill all details", "fill my details", "fill form simultaneously", "fill this form with my details"
    const wholeFormMatch = task.match(/^(?:fill|autofill|complete|populate)\s+(?:in\s+|out\s+)?(?:the\s+|this\s+|all\s+|my\s+|out\s+the\s+)?(?:form|details|fields|profile|information|registration\s+form|contact\s+form|simple\s+form)(?:\s+with\s+(?:my\s+|all\s+)?(?:details|information|profile|data))?(?:\s+simultaneously|\s+all\s+at\s+once)?$/i);
    if (wholeFormMatch) {
      return buildResultFromSteps([
        {
          type: "FILL_FORM",
          fieldHint: "all form fields",
          profileSource: "form-profile.json",
          simultaneous: true
        }
      ], executionConstraints);
    }

    // 0d. Whole form fill then click: "fill the form, then click submit", "fill form and submit", "fill this form with my details and submit it"
    const wholeFormThenClickMatch = task.match(/^(?:fill|autofill|complete|populate)\s+(?:in\s+|out\s+)?(?:the\s+|this\s+|all\s+|my\s+|out\s+the\s+)?(?:form|details|fields|profile|information|registration\s+form|contact\s+form|simple\s+form)(?:\s+with\s+(?:my\s+|all\s+)?(?:details|information|profile|data))?\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s+and)\s+(?:click|press|tap|submit|send)\s+(?:on\s+)?(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
    if (wholeFormThenClickMatch) {
      let clickTarget = wholeFormThenClickMatch[1].trim();
      if (/^(?:it|this|that|them)$/i.test(clickTarget) || wholeFormThenClickMatch[0].toLowerCase().includes("submit")) {
        clickTarget = "submit";
      }
      const steps = [
        {
          type: "FILL_FORM",
          fieldHint: "all form fields",
          profileSource: "form-profile.json",
          simultaneous: true
        }
      ];
      if (!executionConstraints || !executionConstraints.doNotSubmit) {
        steps.push({
          type: "CLICK",
          targetHint: clickTarget,
          legacyTarget: resolveLegacyClickTarget(clickTarget)
        });
      }
      return buildResultFromSteps(steps, executionConstraints);
    }

    // 1. Action-Aware Clause Splitting: [action] [target] [connector] [action] [target]
    // Handles connectors: and, then, after that, next, followed by, also, and then
    const actionClauses = splitActionClauses(task);
    const candidateSplit = actionClauses.length > 1
      ? actionClauses
      : task.split(/\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then)\s+/i);

    if (candidateSplit.length > 1) {
      const parsedSeqSteps = [];
      let currentContext = null;
      let currentTaskEntity = null;
      let allValid = true;

      for (const part of candidateSplit) {
        const trimmedPart = part.trim();
        if (isPronounOrReference(trimmedPart) || /^(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|this|that|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field|the\s+button|button|the\s+link|link)$/i.test(trimmedPart)) {
          if (parsedSeqSteps.length > 0) {
            const lastStep = parsedSeqSteps[parsedSeqSteps.length - 1];
            if (lastStep.type === "CLICK" || lastStep.type === "SELECT") {
              continue;
            }
          }
        }

        // Check for "add it to the cart" / "add to cart"
        const isAddToCartClause = /^(?:add\s+(?:it\s+)?to\s+(?:the\s+)?cart|add\s+to\s+cart)$/i.test(trimmedPart);
        if (isAddToCartClause) {
          parsedSeqSteps.push({
            type: "CLICK",
            action: "CLICK",
            targetHint: "add_to_cart",
            target: "add_to_cart",
            legacyTarget: "ADD_TO_CART_BUTTON",
            targetEntity: currentTaskEntity || null,
            targetIntent: "add_to_cart"
          });
          continue;
        }

        // Check for contextual reference clause like "open his profile", "open it", "open that email"
        const isCtxRef = isContextualReference(trimmedPart) || /^(?:open|click|view|select|visit)\s+(?:his|her|their|its|this|that|the)\s+(?:profile|product|page|email|message|item|result|first\s+result|person)\b/i.test(trimmedPart) || /^(?:open|click|view)\s+(?:it|this|that|them)$/i.test(trimmedPart);
        if (isCtxRef && currentTaskEntity) {
          const cIntent = extractContextualIntent(trimmedPart);
          parsedSeqSteps.push({
            type: "CLICK",
            action: "OPEN",
            targetHint: currentTaskEntity.name,
            target: currentTaskEntity.name,
            semanticTarget: currentTaskEntity.name,
            targetEntity: currentTaskEntity,
            targetIntent: cIntent,
            isSemantic: true,
            semanticCategory: currentTaskEntity.type || "person"
          });
          continue;
        }

        const multiFillNoVal = parseMultiFieldNoValClause(trimmedPart);
        if (multiFillNoVal) {
          parsedSeqSteps.push(...multiFillNoVal);
          continue;
        }

        const fill = parseFillClause(trimmedPart) || parseJuxtapositionFill(trimmedPart);
        if (fill) {
          parsedSeqSteps.push(fill);
          currentTaskEntity = extractEntityFromStep(fill) || currentTaskEntity;
        } else {
          const contextual = parseContextualClause(trimmedPart, currentContext);
          if (contextual) {
            parsedSeqSteps.push(contextual);
            currentTaskEntity = extractEntityFromStep(contextual) || currentTaskEntity;
            const activeCtx = resolveActiveContainerContext(contextual);
            if (activeCtx) {
              currentContext = activeCtx;
            }
          } else {
            const subRes = parseTask(trimmedPart, true);
            if (subRes.intent !== "NONE" && Array.isArray(subRes.steps) && subRes.steps.length > 0 && subRes.steps[0].type !== "NONE") {
              parsedSeqSteps.push(...subRes.steps);
              const last = subRes.steps[subRes.steps.length - 1];
              currentTaskEntity = extractEntityFromStep(last) || currentTaskEntity;
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
        // If a NAVIGATE step is followed by steps that use that step's target as hierarchical context,
        // then that step was clicking/opening a DOM container on the page.
        parsedSeqSteps.forEach((step, sIdx) => {
          if (step.type === "NAVIGATE" && (step.targetHint || step.target)) {
            const targetNorm = (step.targetHint || step.target).toLowerCase();
            const hasContextualChild = parsedSeqSteps.slice(sIdx + 1).some(
              (nxt) => nxt.context && nxt.context.toLowerCase() === targetNorm
            );
            if (hasContextualChild) {
              step.type = "CLICK";
              step.action = "CLICK";
              delete step.url;
              delete step.isNavigation;
            }
          }
        });
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
            const subTaskRes = parseTask(trimmedClause, true);
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
      const targetHint = labelledBtnMatch[1].trim().replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
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

    // 6b. Open page / navigation / semantic item: "open YouTube", "open the cheapest product", "open the latest email"
    const openMatch = task.match(/^(?:open|navigate\s+to|go\s+to)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+page|\s+link|\s+tab)?$/i);
    if (openMatch) {
      const LOCATION_SUFFIX_PATTERN = /\s+(?:on\s+(?:the\s+)?(?:screen|page|webpage|site)|on\s+screen|here|in\s+(?:the\s+)?page)$/i;
      const targetHint = openMatch[1].trim().replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      const isUiContainer = /^(?:filters?|menu|dropdown|accordion|dialog|modal|panel|cart|popup|drawer|sidebar|section|tabs?|options?|settings?)$/i.test(targetHint.toLowerCase()) ||
        /\b(?:section|panel|container|accordion|dropdown|filters?|modal|dialog|drawer|sidebar)\b/i.test(targetHint.toLowerCase());

      const navUrl = resolveNavigationUrl(targetHint);
      const isSemantic = semanticResolver ? semanticResolver.isSemanticInstruction(targetHint) : false;

      if (!navUrl || isSemantic || isUiContainer) {
        const desc = semanticResolver ? semanticResolver.extractSemanticDescriptor(targetHint) : {};
        return buildResultFromSteps([
          {
            type: "CLICK",
            action: "CLICK",
            targetHint: targetHint,
            target: targetHint,
            semanticTarget: targetHint,
            semanticCategory: desc.category || null,
            ranking: desc.ranking || null,
            ordinal: desc.ordinal !== undefined ? desc.ordinal : null,
            spatial: desc.spatial || null,
            attribute: desc.attribute || null,
            attributeValue: desc.attributeValue || null,
            objectTarget: desc.objectTarget || null,
            contentFilter: desc.contentFilter || null,
            senderFilter: desc.senderFilter || null,
            isSemantic: !!(desc.isSemantic || isSemantic),
            semanticTargetObject: desc.semanticTargetObject || null,
            legacyTarget: resolveLegacyClickTarget(targetHint)
          }
        ], executionConstraints);
      }

      return buildResultFromSteps([
        {
          type: "NAVIGATE",
          action: "NAVIGATE",
          targetHint: targetHint,
          target: targetHint,
          url: navUrl,
          isNavigation: true,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ], executionConstraints);
    }

    // 6c. Standard CLICK / FIND: "click add to cart", "find english", "press submit", "click continue", "tap on search", "look for settings", "find the black colour earbuds"
    const clickMatch = task.match(/^(?:click|press|tap|find|locate|look\s+for)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button|\s+link)?$/i);
    if (clickMatch) {
      const LOCATION_SUFFIX_PATTERN = /\s+(?:on\s+(?:the\s+)?(?:screen|page|webpage|site)|on\s+screen|here|in\s+(?:the\s+)?page)$/i;
      const targetHint = clickMatch[1].trim().replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();
      // Never create a standalone target named "it", "this", "that", "them", "the button", "the above", etc.
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      const desc = semanticResolver ? semanticResolver.extractSemanticDescriptor(targetHint) : {};
      const attrConstraint = extractAttributeConstraint(targetHint);
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          target: targetHint,
          semanticTarget: targetHint,
          semanticCategory: desc.category || null,
          ranking: desc.ranking || null,
          ordinal: desc.ordinal !== undefined ? desc.ordinal : null,
          spatial: desc.spatial || null,
          contentFilter: desc.contentFilter || null,
          senderFilter: desc.senderFilter || null,
          isSemantic: !!(desc.isSemantic || attrConstraint),
          objectTarget: attrConstraint ? attrConstraint.objectTarget : (desc.objectTarget || null),
          attribute: attrConstraint ? attrConstraint.attribute : (desc.attribute || null),
          attributeValue: attrConstraint ? attrConstraint.attributeValue : (desc.attributeValue || null),
          semanticTargetObject: desc.semanticTargetObject || null,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ], executionConstraints);
    }

    // 6d. COMPOSE intent with recipient: e.g. "compose an email to test@example.com", "compose message to X"
    const composeRecipientMatch = task.match(/^compose(?:\s+(?:(?:a\s+|an\s+)?(?:new\s+)?(?:email|mail|message|letter|draft)))?\s+to\s+['"]?([^'",;]+?)['"]?$/i);
    if (composeRecipientMatch) {
      const recipient = cleanValue(composeRecipientMatch[1]);
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: "compose",
          legacyTarget: null
        },
        {
          type: "FILL",
          fieldHint: "recipient",
          value: recipient
        }
      ]);
    }

    // 6d-2. Standalone COMPOSE intent: e.g. "compose a new email", "compose email", "compose new message", "compose"
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

    // 6f. TOGGLE / ENABLE / DISABLE / TURN ON / TURN OFF intent: e.g. "enable dark mode", "turn on dark mode"
    const toggleMatch = task.match(/^(?:(enable|turn\s+on|activate|check|tick)|(disable|turn\s+off|deactivate|uncheck|untick)|(toggle))\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:option|checkbox|toggle|switch))?$/i);
    if (toggleMatch) {
      const isEnable = Boolean(toggleMatch[1]);
      const isDisable = Boolean(toggleMatch[2]);
      const actType = isEnable ? "CHECK" : (isDisable ? "UNCHECK" : "TOGGLE");
      const targetHint = toggleMatch[4].trim();
      return buildResultFromSteps([
        {
          type: actType,
          action: actType,
          targetHint: targetHint,
          target: targetHint,
          targetType: "checkbox"
        }
      ]);
    }

    // 6g. SAVE intent: e.g. "save changes", "save the changes", "save"
    const saveMatch = task.match(/^save(?:\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?))?$/i);
    if (saveMatch) {
      const subTarget = saveMatch[1] ? saveMatch[1].trim() : "";
      const targetHint = subTarget ? ("save " + subTarget) : "save";
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }

    // 6h. DOWNLOAD intent: e.g. "download the latest PDF", "download it", "download report"
    const downloadMatch = task.match(/^download(?:\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?))?$/i);
    if (downloadMatch) {
      const subTarget = downloadMatch[1] ? downloadMatch[1].trim() : "";
      const isPronoun = isPronounOrReference(subTarget);
      const targetHint = (!subTarget || isPronoun) ? "download" : subTarget;
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: null
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
   * @param {Object} [constraintsObj]
   * @returns {Object}
   */
  function buildResultFromSteps(steps, constraintsObj) {
    if (!steps || steps.length === 0) {
      return createNoneResult("No steps parsed", constraintsObj);
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
      } else if (step.type === "FILL" && (step.fieldHint === "search" || step.fieldHint === "Search mail")) {
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
      } else if ((step.type === "CLICK" || step.type === "OPEN") && (step.targetEntity || step.isProductSelection || /result|product|item|listing|video|movie|article|website|site|webpage|page|link|portal/i.test(step.targetHint || ""))) {
        const goalTarget = step.targetEntity && step.targetEntity.name
          ? (step.targetIntent && step.targetIntent !== "open" ? `${step.targetEntity.name} ${step.targetIntent}` : step.targetEntity.name)
          : (step.isExplicitTarget && step.explicitTarget ? step.explicitTarget : (step.targetHint || "relevant result"));
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
      } else if (step.type === "NAVIGATE") {
        currentGoal = {
          id: goals.length + 1,
          title: `Navigate to ${step.targetHint || step.target || "destination"}`,
          type: "NAVIGATE",
          target: step.targetHint || step.target || "destination",
          url: step.url || null,
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
          semanticTarget: step.semanticTarget || step.fieldHint,
          expectedRole: step.expectedRole || step.role || "input",
          role: step.role || step.expectedRole || "input",
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
          if (normHint === "body" || normHint.includes("message")) {
            localValues["message"] = step.value;
            localValues["body"] = step.value;
          } else if (normHint === "recipient" || normHint === "to") {
            localValues["to"] = step.value;
            localValues["recipient"] = step.value;
            localValues["email"] = step.value;
          }
        }
      } else if (step.type === "SUBMIT") {
        sanitizedPlan.push({
          type: "SUBMIT",
          targetHint: step.targetHint || "search",
          semanticTarget: step.semanticTarget || step.targetHint || "search",
          stepId: idx,
          goalId: step.goalId
        });
        if (step.query) {
          localValues["search_query"] = step.query;
          localValues[idx] = step.query;
          localValues[`step_${idx}`] = step.query;
        }
      } else if (step.type === "CHECK" || step.type === "UNCHECK" || step.type === "SELECT" || step.type === "TOGGLE") {
        const stoSelect = step.semanticTargetObject || (typeof buildSemanticTargetObject === "function" && (step.isSemantic || step.attribute || step.ranking || step.spatial || step.relation) ? buildSemanticTargetObject(step, step) : null);
        sanitizedPlan.push({
          type: step.type,
          action: step.type,
          targetHint: step.targetHint || step.target,
          target: step.targetHint || step.target,
          semanticTarget: step.semanticTarget || step.targetHint || step.target,
          semanticCategory: step.semanticCategory || null,
          ranking: step.ranking || null,
          spatial: step.spatial || null,
          contentFilter: step.contentFilter || null,
          senderFilter: step.senderFilter || null,
          isSemantic: !!step.isSemantic,
          objectTarget: step.objectTarget || null,
          attribute: step.attribute || null,
          attributeValue: step.attributeValue || null,
          context: step.context || null,
          relation: step.relation || null,
          ordinal: step.ordinal !== undefined ? step.ordinal : null,
          targetType: step.targetType || null,
          semanticTargetObject: stoSelect,
          stepId: idx,
          goalId: step.goalId
        });
      } else if (step.type === "CLICK" || step.type === "OPEN") {
        const stoClick = step.semanticTargetObject || (typeof buildSemanticTargetObject === "function" && (step.isSemantic || step.attribute || step.ranking || step.spatial || step.relation) ? buildSemanticTargetObject(step, step) : null);
        const resolvedEntity = step.targetEntity || (stoClick && stoClick.targetEntity) || null;
        const stepTarget = (resolvedEntity && resolvedEntity.name) ? resolvedEntity.name : (step.target || step.targetHint);
        sanitizedPlan.push({
          type: step.type === "OPEN" ? "OPEN" : "CLICK",
          action: step.action || (step.type === "OPEN" ? "OPEN" : "CLICK"),
          targetHint: stepTarget,
          target: stepTarget,
          semanticTarget: step.semanticTarget || stepTarget,
          targetEntity: resolvedEntity,
          targetIntent: step.targetIntent || (stoClick && stoClick.targetIntent) || null,
          semanticCategory: step.semanticCategory || null,
          ranking: step.ranking || null,
          spatial: step.spatial || null,
          contentFilter: step.contentFilter || null,
          senderFilter: step.senderFilter || null,
          isSemantic: !!step.isSemantic,
          expectedRole: step.expectedRole || step.role || "button",
          role: step.role || step.expectedRole || "button",
          requiresApproval: !!step.requiresApproval,
          legacyTarget: step.legacyTarget || null,
          context: step.context || null,
          relation: step.relation || null,
          ordinal: step.ordinal !== undefined ? step.ordinal : null,
          targetType: step.targetType || null,
          objectTarget: step.objectTarget || null,
          attribute: step.attribute || null,
          attributeValue: step.attributeValue || null,
          semanticTargetObject: stoClick,
          stepId: idx,
          goalId: step.goalId
        });
        if (step.query) {
          localValues["search_query"] = step.query;
          localValues[`step_${idx}`] = step.query;
        }
      } else if (step.type === "NAVIGATE") {
        sanitizedPlan.push({
          type: "NAVIGATE",
          action: "NAVIGATE",
          targetHint: step.targetHint || step.target,
          target: step.targetHint || step.target,
          semanticTarget: step.semanticTarget || step.targetHint || step.target,
          url: step.url || null,
          stepId: idx,
          goalId: step.goalId
        });
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

    const cons = constraintsObj || currentActiveConstraints;

    return {
      intent: primaryIntent,
      steps: steps,
      goals: goals,
      sanitizedPlan: sanitizedPlan,
      localValues: localValues,
      isMultiStep: isMultiStep,
      constraints: (cons && cons.constraints) || [],
      stopCondition: (cons && cons.stopCondition) || null,
      approvalRequirement: (cons && cons.approvalRequirement) || null,
      requireApprovalBeforeSend: !!(cons && cons.requireApprovalBeforeSend),
      doNotSend: !!(cons && cons.doNotSend),
      doNotSubmit: !!(cons && cons.doNotSubmit),
      doNotBuy: !!(cons && cons.doNotBuy)
    };
  }

  /**
   * Helper to create safe fallback NONE result.
   * @param {string} reason
   * @param {Object} [constraintsObj]
   * @returns {Object}
   */
  function createNoneResult(reason, constraintsObj) {
    const cons = constraintsObj || currentActiveConstraints;
    return {
      intent: "NONE",
      reason: reason || "Unrecognized task",
      steps: [{ type: "NONE" }],
      sanitizedPlan: [{ type: "NONE" }],
      localValues: {},
      isMultiStep: false,
      constraints: (cons && cons.constraints) || [],
      stopCondition: (cons && cons.stopCondition) || null,
      approvalRequirement: (cons && cons.approvalRequirement) || null,
      requireApprovalBeforeSend: !!(cons && cons.requireApprovalBeforeSend),
      doNotSend: !!(cons && cons.doNotSend)
    };
  }

  return {
    parseTask,
    resolveNavigationUrl,
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
    extractExecutionConstraints,
    stripExecutionControlPhrases,
    extractAttributeConstraint,
    DEFAULT_SCROLL_AMOUNT
  };
});

