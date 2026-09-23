/**
 * pii-detector.js - Canonical Local Sensitive-Data Detection and Redaction Module
 * Upgraded for SIH26171 IRIS Browser Agent — Privacy Redaction Hardening.
 *
 * Runs 100% locally on-device in client memory; zero external network requests.
 * Detects Categories A through H with contextual intelligence and false-positive protection.
 */

// =====================================================================
// CATEGORY PATTERNS & REGEXES
// =====================================================================

// Category A: Contact Information
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_INTL_REGEX = /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
const PHONE_CONTEXT_REGEX = /\b((?:phone|mobile|tel|cell|call(?:\s*me)?(?:\s*at)?|contact(?:\s*no|\s*number)?)[\s:=]+)([+\d\s().-]{7,20})\b/gi;
const PHONE_STANDALONE_REGEX = /\b[6-9]\d{9}\b|\b\d{3}[-.]\d{3}[-.]\d{4}\b/g;

// Category B: Authentication / Credentials
const PASSWORD_REGEX = /\b((?:password|passwd|pwd|passcode|secret\s*phrase)[\s:=]+(?:is[\s:=]*)?)([^\s\r\n,;!]+)/gi;
const OTP_REGEX = /\b((?:otp|one\s*time\s*(?:password|code|passcode)|verification\s*code|auth\s*code|security\s*code)[\s:=]+(?:is[\s:=]*)?)([0-9]{4,8})\b/gi;
const PIN_REGEX = /\b((?:pin|security\s*pin|atm\s*pin|login\s*pin)[\s:=]+)([0-9]{4,8})\b/gi;
const CREDENTIAL_USER_REGEX = /\b((?:login\s*id|credential\s*id|user\s*login|auth\s*user)[\s:=]+)([^\s\r\n,;!]{3,30})\b/gi;

// Category C: Payment Information
const CREDIT_CARD_GROUPED_REGEX = /\b(?:\d{4}[ -]){3}\d{4}\b|\b(?:\d{4}[ -]){2}\d{4}[ -]\d{1,4}\b/g;
const CREDIT_CARD_CONTEXT_REGEX = /\b((?:credit\s*card|debit\s*card|card\s*number|card\s*no)[\s:=]+)(\d[\d\s-]{11,18}\d)\b/gi;
const CVV_REGEX = /\b((?:cvv|cvc|cid|security\s*code|card\s*verification)[\s:=]+)([0-9]{3,4})\b/gi;
const CARD_EXP_REGEX = /\b((?:exp(?:iry|iration)?(?:\s*date)?|valid\s*thru|valid\s*upto)[\s:=]+)((?:0[1-9]|1[0-2])[\/\-](?:\d{2}|\d{4}))\b/gi;

// Category D: Banking & Financial Information
const BANK_ACCOUNT_REGEX = /\b((?:bank\s*account(?:\s*no|\s*number)?|account\s*(?:no|number)|savings\s*account|current\s*account)[\s:=]+)(\d{8,18})\b/gi;
const IFSC_REGEX = /\b(?:IFSC(?:\s*code)?[\s:=]+)?([A-Z]{4}0[A-Z0-9]{6})\b/g;
const IBAN_REGEX = /\b([A-Z]{2}\d{2}[A-Z0-9]{4}[A-Z0-9]{7,26})\b/g;
const SWIFT_BIC_REGEX = /\b(?:SWIFT|BIC)(?:[\s*code]*[\s:=]+)([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/gi;
const ROUTING_SORT_REGEX = /\b((?:routing\s*(?:number|no)?|sort\s*code|aba\s*(?:number)?)[\s:=]+)(\d{9}|\d{2}-\d{2}-\d{2})\b/gi;
const UPI_HANDLE_REGEX = /\b[\w.-]+@(?:okhdfcbank|okaxis|oksbi|okicici|paytm|apl|ybl|upi|barodampay|icici|axl|ibl|allbank|postbank|idfcbank|sbi)\b/gi;
const UPI_CONTEXT_REGEX = /\b((?:upi(?:\s*id)?|payment\s*handle|vpa)[\s:=]+)([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)\b/gi;

// Category E: Government & Identity Documents
const AADHAAR_CONTEXT_REGEX = /\b((?:aadhaar|adhaar|uidai|uid)[\s:=]+)(\d{4}[\s-]?\d{4}[\s-]?\d{4}|\d{12})\b/gi;
const PAN_REGEX = /\b(?:PAN(?:\s*number|\s*card)?[\s:=]+)?([A-Z]{5}[0-9]{4}[A-Z])\b/g;
const PASSPORT_REGEX = /\b((?:passport(?:\s*no|\s*number)?)[\s:=]+)([A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]|[A-Z0-9]{7,9})\b/gi;
const DRIVERS_LICENSE_REGEX = /\b((?:driver'?s?\s*license|dl(?:\s*no)?)[\s:=]+)([A-Z0-9\s\/-]{8,20})\b/gi;
const SSN_REGEX = /\b((?:ssn|social\s*security(?:\s*number)?)[\s:=]+)?(\d{3}-\d{2}-\d{4})\b/gi;
const EMPLOYEE_STUDENT_ID_REGEX = /\b((?:employee\s*id|emp\s*id|staff\s*id|student\s*id)[\s:=]+)([A-Za-z0-9\-]{4,15})\b/gi;
const NATIONAL_ID_REGEX = /\b((?:national\s*id|tax\s*id|tin\s*no|voter\s*id)[\s:=]+)([A-Za-z0-9\/-]{6,16})\b/gi;

// Category F: Personal Information
const DOB_REGEX = /\b((?:dob|date\s*of\s*birth|birth\s*date)[\s:=]+)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b/gi;
const ADDRESS_REGEX = /\b((?:residential\s*address|home\s*address|personal\s*address)[\s:=]+)([^\r\n,;]{5,80})/gi;
const EMERGENCY_CONTACT_REGEX = /\b((?:emergency\s*contact(?:\s*(?:name|number|phone))?)[\s:=]+)([^\r\n,;]{3,50})/gi;

// Category G: Health / Medical Information
const MEDICAL_ID_REGEX = /\b((?:medical\s*record(?:\s*number)?|mrn|patient\s*id|health\s*insurance(?:\s*id|\s*number)?|policy\s*number|prescription\s*(?:id|no)|rx\s*number)[\s:=]+)([A-Za-z0-9\-]{4,20})\b/gi;

// Category H: Software Secrets & Credentials
const BEARER_TOKEN_REGEX = /\b((?:Authorization:\s*)?Bearer\s+)([A-Za-z0-9_\-\.]{20,})\b/gi;
const JWT_REGEX = /\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{10,})\b/g;
const PRIVATE_KEY_REGEX = /-----BEGIN[ A-Z_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z_-]*PRIVATE KEY-----/g;
const API_KEY_PREFIX_REGEX = /\b(sk-[A-Za-z0-9]{20,})\b/g;
const API_KEY_CONTEXT_REGEX = /\b((?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|session[_-]?token|refresh[_-]?token)[\s:=]+['"]?)([A-Za-z0-9_\-]{16,})(['"]?)/gi;
const ENV_SECRET_REGEX = /\b((?:AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|GITHUB_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY|DATABASE_URL)[\s:=]+['"]?)([^\s'"]{8,})(['"]?)/gi;

// Backward-compatible exported regex handles
const CREDIT_CARD_REGEX = CREDIT_CARD_GROUPED_REGEX;
const PHONE_REGEX = PHONE_INTL_REGEX;

// =====================================================================
// LUHN CHECKSUM ALGORITHM FOR CREDIT CARDS
// =====================================================================

/**
 * Validates a credit/debit card number using the Luhn checksum formula.
 *
 * @param {string} numStr - Numeric sequence with optional spaces or dashes
 * @returns {boolean} True if passes Luhn checksum
 */
function luhnCheck(numStr) {
  if (!numStr || typeof numStr !== "string") return false;
  const sanitized = numStr.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(sanitized)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// =====================================================================
// FALSE-POSITIVE PROTECTION (EXEMPTION RULES)
// =====================================================================

/**
 * Explicit non-sensitive patterns that MUST NOT be redacted.
 * Protects: Order IDs, Product Codes, SKU, Price, Year, Quantity, Public text phrases.
 */
const EXEMPTION_PATTERNS = [
  /\b(?:order\s*(?:id|number|no|code|#)?)[\s:=]+[A-Za-z0-9\-]+/gi,
  /\b(?:product\s*(?:id|code|no|number)?)[\s:=]+[A-Za-z0-9\-]+/gi,
  /\b(?:sku|item\s*(?:no|number|code))[\s:=]+[A-Za-z0-9\-]+/gi,
  /(?:₹|Rs\.?|INR|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?/gi,
  /\b(?:price|cost|amount)[\s:=]+(?:₹|Rs\.?|INR|\$|€|£)?\s*[\d,]+(?:\.\d{1,2})?/gi,
  /\b(?:year|yr)[\s:=]+20\d{2}\b/gi,
  /\b(?:qty|quantity|count)[\s:=]+\d+\b/gi,
  /\b(?:search\s*query|query)[\s:=]+[^\r\n,;]+/gi,
  /\bkey\s+features\b/gi,
  /\bsecret\s+of\s+success\b/gi,
  /\btoken\s+ring\b/gi
];

// =====================================================================
// CANONICAL TEXT REDACTION
// =====================================================================

/**
 * Scans a string and replaces sensitive personal, financial, authentication,
 * government, medical, and software credential information with standardized placeholders.
 *
 * Uses multi-stage context-aware replacement with false-positive protection.
 *
 * @param {string} text - Raw input text from webpage, DOM, or OCR
 * @returns {string} - Sanitized text with sensitive values completely removed
 */
function redactText(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Stage 1: Temporarily protect exempt non-sensitive spans (Orders, Prices, Years, etc.)
  const exemptions = [];
  let maskedText = text;

  EXEMPTION_PATTERNS.forEach((pattern) => {
    maskedText = maskedText.replace(pattern, (match) => {
      // Safety check: if the exempt match explicitly contains an email or card keyword, don't exempt
      if (/@/.test(match) || /password|cvv/i.test(match)) {
        return match;
      }
      const token = `__IRIS_EXEMPT_${exemptions.length}__`;
      exemptions.push({ token, original: match });
      return token;
    });
  });

  // Stage 2: Category H - Software Secrets & Private Keys (Highest specificity)
  maskedText = maskedText.replace(PRIVATE_KEY_REGEX, "[REDACTED_PRIVATE_KEY]");
  maskedText = maskedText.replace(JWT_REGEX, "[REDACTED_JWT]");
  maskedText = maskedText.replace(BEARER_TOKEN_REGEX, "$1[REDACTED_TOKEN]");
  maskedText = maskedText.replace(API_KEY_PREFIX_REGEX, "[REDACTED_API_KEY]");
  maskedText = maskedText.replace(API_KEY_CONTEXT_REGEX, "$1[REDACTED_API_KEY]$3");
  maskedText = maskedText.replace(ENV_SECRET_REGEX, "$1[REDACTED_SECRET]$3");

  // Stage 3: Category B - Authentication & Credentials
  maskedText = maskedText.replace(PASSWORD_REGEX, "$1[REDACTED_PASSWORD]");
  maskedText = maskedText.replace(OTP_REGEX, "$1[REDACTED_OTP]");
  maskedText = maskedText.replace(PIN_REGEX, "$1[REDACTED_PASSWORD]");
  maskedText = maskedText.replace(CREDENTIAL_USER_REGEX, "$1[REDACTED_CREDENTIAL]");

  // Stage 4: Category C - Payment Information
  maskedText = maskedText.replace(CVV_REGEX, "$1[REDACTED_CVV]");
  maskedText = maskedText.replace(CARD_EXP_REGEX, "$1[REDACTED_CARD_EXP]");
  maskedText = maskedText.replace(CREDIT_CARD_CONTEXT_REGEX, "$1[REDACTED_CARD]");

  // Luhn-verified or grouped card sequences
  maskedText = maskedText.replace(CREDIT_CARD_GROUPED_REGEX, (match) => {
    // If it looks like grouped 16 digits, verify Luhn or digit structure
    const digitsOnly = match.replace(/[\s-]/g, "");
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      if (luhnCheck(digitsOnly) || digitsOnly.length === 16) {
        return "[REDACTED_CARD]";
      }
    }
    return match;
  });

  // Stage 5: Category D - Banking & Financial Information
  maskedText = maskedText.replace(BANK_ACCOUNT_REGEX, "$1[REDACTED_BANK_ACCOUNT]");
  maskedText = maskedText.replace(IFSC_REGEX, "[REDACTED_IFSC]");
  maskedText = maskedText.replace(SWIFT_BIC_REGEX, "[REDACTED_BANK_ACCOUNT]");
  maskedText = maskedText.replace(ROUTING_SORT_REGEX, "$1[REDACTED_BANK_ACCOUNT]");
  maskedText = maskedText.replace(UPI_HANDLE_REGEX, "[REDACTED_UPI]");
  maskedText = maskedText.replace(UPI_CONTEXT_REGEX, "$1[REDACTED_UPI]");
  maskedText = maskedText.replace(IBAN_REGEX, (match) => {
    // Basic format: 2 letters + 2 digits + at least 11 alphanumeric
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(match)) {
      return "[REDACTED_BANK_ACCOUNT]";
    }
    return match;
  });

  // Stage 6: Category E - Government & Identity Documents
  maskedText = maskedText.replace(AADHAAR_CONTEXT_REGEX, "$1[REDACTED_AADHAAR]");
  maskedText = maskedText.replace(PAN_REGEX, "[REDACTED_PAN]");
  maskedText = maskedText.replace(PASSPORT_REGEX, "$1[REDACTED_PASSPORT]");
  maskedText = maskedText.replace(DRIVERS_LICENSE_REGEX, "$1[REDACTED_ID]");
  maskedText = maskedText.replace(SSN_REGEX, (match, prefix, ssn) => {
    return prefix ? `${prefix}[REDACTED_ID]` : "[REDACTED_ID]";
  });
  maskedText = maskedText.replace(EMPLOYEE_STUDENT_ID_REGEX, "$1[REDACTED_ID]");
  maskedText = maskedText.replace(NATIONAL_ID_REGEX, "$1[REDACTED_ID]");

  // Stage 7: Category F - Personal Information
  maskedText = maskedText.replace(DOB_REGEX, "$1[REDACTED_DOB]");
  maskedText = maskedText.replace(ADDRESS_REGEX, "$1[REDACTED_ADDRESS]");
  maskedText = maskedText.replace(EMERGENCY_CONTACT_REGEX, "$1[REDACTED_CONTACT]");

  // Stage 8: Category G - Health / Medical Information
  maskedText = maskedText.replace(MEDICAL_ID_REGEX, "$1[REDACTED_MEDICAL_ID]");

  // Stage 9: Category A - Contact Information
  // Email addresses
  maskedText = maskedText.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");

  // Phone numbers (contextual, international, or standalone)
  maskedText = maskedText.replace(PHONE_CONTEXT_REGEX, "$1[REDACTED_PHONE]");
  maskedText = maskedText.replace(PHONE_INTL_REGEX, (match) => {
    // Only redact if reasonable phone character count and not an order/exemption token
    const digitsOnly = match.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return "[REDACTED_PHONE]";
    }
    return match;
  });

  // Stage 10: Restore exempt non-sensitive spans
  exemptions.forEach(({ token, original }) => {
    maskedText = maskedText.replace(token, original);
  });

  return maskedText;
}

// =====================================================================
// VALUE INSPECTION & CATEGORY METRICS
// =====================================================================

/**
 * Inspects a single field value or string locally for sensitive PII.
 * Reuses the canonical redactText() pipeline.
 * NEVER returns the original raw value.
 *
 * @param {string} value - Value to inspect locally
 * @returns {{ detected: boolean, redacted: string, categories: Array<string> }} Sanitized detection result
 */
function detectAndRedactSensitiveValue(value) {
  if (!value || typeof value !== "string") {
    return { detected: false, redacted: "", categories: [] };
  }

  const redacted = redactText(value);
  const detected = redacted !== value;

  const categories = [];
  if (detected) {
    if (redacted.includes("[REDACTED_EMAIL]")) categories.push("EMAIL");
    if (redacted.includes("[REDACTED_PHONE]")) categories.push("PHONE");
    if (redacted.includes("[REDACTED_PASSWORD]")) categories.push("PASSWORD");
    if (redacted.includes("[REDACTED_CARD]")) categories.push("CARD");
    if (redacted.includes("[REDACTED_CVV]")) categories.push("CVV");
    if (redacted.includes("[REDACTED_BANK_ACCOUNT]") || redacted.includes("[REDACTED_IFSC]") || redacted.includes("[REDACTED_UPI]")) categories.push("BANK");
    if (redacted.includes("[REDACTED_AADHAAR]") || redacted.includes("[REDACTED_PAN]") || redacted.includes("[REDACTED_PASSPORT]") || redacted.includes("[REDACTED_ID]")) categories.push("IDENTITY");
    if (redacted.includes("[REDACTED_TOKEN]") || redacted.includes("[REDACTED_JWT]") || redacted.includes("[REDACTED_API_KEY]") || redacted.includes("[REDACTED_SECRET]") || redacted.includes("[REDACTED_PRIVATE_KEY]")) categories.push("CREDENTIAL");
    if (redacted.includes("[REDACTED_DOB]") || redacted.includes("[REDACTED_ADDRESS]") || redacted.includes("[REDACTED_CONTACT]")) categories.push("PERSONAL");
    if (redacted.includes("[REDACTED_MEDICAL_ID]")) categories.push("HEALTH");
  }

  return {
    detected,
    redacted,
    categories
  };
}

/**
 * Computes category breakdown counts across a text or set of values.
 * NEVER returns or logs any raw sensitive string values.
 *
 * @param {string} text - Text to analyze
 * @returns {Object} Category counts, e.g. { EMAIL: 1, PHONE: 2, CARD: 1, ... }
 */
function getCategoryCounts(text) {
  const counts = {
    EMAIL: 0,
    PHONE: 0,
    PASSWORD: 0,
    CARD: 0,
    BANK: 0,
    CREDENTIAL: 0,
    IDENTITY: 0,
    PERSONAL: 0,
    HEALTH: 0
  };

  if (!text || typeof text !== "string") {
    return counts;
  }

  const sanitized = redactText(text);

  const countOccurrences = (target) => {
    let count = 0;
    let pos = sanitized.indexOf(target);
    while (pos !== -1) {
      count++;
      pos = sanitized.indexOf(target, pos + target.length);
    }
    return count;
  };

  counts.EMAIL += countOccurrences("[REDACTED_EMAIL]");
  counts.PHONE += countOccurrences("[REDACTED_PHONE]");
  counts.PASSWORD += countOccurrences("[REDACTED_PASSWORD]") + countOccurrences("[REDACTED_OTP]");
  counts.CARD += countOccurrences("[REDACTED_CARD]") + countOccurrences("[REDACTED_CVV]") + countOccurrences("[REDACTED_CARD_EXP]");
  counts.BANK += countOccurrences("[REDACTED_BANK_ACCOUNT]") + countOccurrences("[REDACTED_IFSC]") + countOccurrences("[REDACTED_UPI]");
  counts.CREDENTIAL += countOccurrences("[REDACTED_TOKEN]") + countOccurrences("[REDACTED_JWT]") + countOccurrences("[REDACTED_API_KEY]") + countOccurrences("[REDACTED_SECRET]") + countOccurrences("[REDACTED_PRIVATE_KEY]") + countOccurrences("[REDACTED_CREDENTIAL]");
  counts.IDENTITY += countOccurrences("[REDACTED_AADHAAR]") + countOccurrences("[REDACTED_PAN]") + countOccurrences("[REDACTED_PASSPORT]") + countOccurrences("[REDACTED_ID]");
  counts.PERSONAL += countOccurrences("[REDACTED_DOB]") + countOccurrences("[REDACTED_ADDRESS]") + countOccurrences("[REDACTED_CONTACT]");
  counts.HEALTH += countOccurrences("[REDACTED_MEDICAL_ID]");

  return counts;
}

// =====================================================================
// DOM INPUT METADATA EVALUATION
// =====================================================================

const SENSITIVE_INPUT_KEYWORDS = [
  "card", "credit", "debit", "cvv", "cvc", "cid", "ssn", "phone", "mobile",
  "password", "passwd", "pwd", "passcode", "email", "bank", "account",
  "iban", "ifsc", "swift", "routing", "aadhaar", "adhaar", "pan", "passport",
  "dob", "birth", "patient", "medical", "secret", "token", "api_key", "apikey",
  "otp", "pin", "auth", "credential"
];

const SENSITIVE_AUTOCOMPLETE_VALUES = [
  "current-password", "new-password", "one-time-code", "cc-number",
  "cc-csc", "cc-exp", "cc-exp-month", "cc-exp-year", "cc-type", "cc-name",
  "email", "tel", "bday", "bday-day", "bday-month", "bday-year",
  "street-address", "postal-code", "transaction-amount"
];

/**
 * Evaluates whether a DOM form element is sensitive based on its safe metadata.
 * SECURITY: Never reads or inspects `.value` of the element.
 *
 * @param {Object} metadata - { type, name, id, placeholder, autocomplete, ariaLabel, labelText }
 * @returns {boolean} True if the metadata indicates a sensitive field
 */
function isSensitiveInputMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return false;

  const type = (metadata.type || "").toLowerCase();
  const name = (metadata.name || "").toLowerCase();
  const id = (metadata.id || "").toLowerCase();
  const placeholder = (metadata.placeholder || "").toLowerCase();
  const autocomplete = (metadata.autocomplete || "").toLowerCase();
  const ariaLabel = (metadata.ariaLabel || "").toLowerCase();
  const labelText = (metadata.labelText || "").toLowerCase();

  // 1. Direct input type checks
  if (type === "password" || type === "email" || type === "tel") {
    return true;
  }

  // 2. Safe autocomplete attribute check
  if (autocomplete) {
    if (SENSITIVE_AUTOCOMPLETE_VALUES.some(v => autocomplete.includes(v))) {
      return true;
    }
  }

  // 3. Keyword check across safe attribute names and associated labels
  const combined = `${name} ${id} ${placeholder} ${ariaLabel} ${labelText}`.toLowerCase();

  // Exemption check: explicitly non-sensitive words without sensitive credentials
  const hasExemptWord = combined.includes("order") || combined.includes("product") || combined.includes("search") || combined.includes("quantity");
  const hasHighSensitivityWord = combined.includes("password") || combined.includes("card") || combined.includes("cvv") || combined.includes("pin") || combined.includes("account");

  if (hasExemptWord && !hasHighSensitivityWord) {
    return false;
  }

  return SENSITIVE_INPUT_KEYWORDS.some(kw => combined.includes(kw));
}

// =====================================================================
// EXPORTS & GLOBAL ENVIRONMENT REGISTRATION
// =====================================================================

if (typeof window !== "undefined") {
  window.redactText = redactText;
  window.detectAndRedactSensitiveValue = detectAndRedactSensitiveValue;
  window.getCategoryCounts = getCategoryCounts;
  window.isSensitiveInputMetadata = isSensitiveInputMetadata;
  window.luhnCheck = luhnCheck;
}

if (typeof globalThis !== "undefined") {
  globalThis.redactText = redactText;
  globalThis.detectAndRedactSensitiveValue = detectAndRedactSensitiveValue;
  globalThis.getCategoryCounts = getCategoryCounts;
  globalThis.isSensitiveInputMetadata = isSensitiveInputMetadata;
  globalThis.luhnCheck = luhnCheck;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    redactText,
    detectAndRedactSensitiveValue,
    getCategoryCounts,
    isSensitiveInputMetadata,
    luhnCheck,
    PASSWORD_REGEX,
    CREDIT_CARD_REGEX,
    PHONE_REGEX,
    EMAIL_REGEX
  };
}

