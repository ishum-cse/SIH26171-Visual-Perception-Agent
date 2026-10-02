/**
 * test-internship-privacy.js
 * Verification of IRIS privacy detection across the exact internship email example
 * and arbitrary generic webpage inputs.
 */

const assert = require("assert");
const {
  redactText,
  detectAndRedactSensitiveValue,
  verifySanitizedPayload,
  getCategoryCounts
} = require("./pii-detector.js");

console.log("=====================================================================");
console.log("TESTING INTERNSHIP EMAIL REDACTION & GENERIC ARBITRARY WEBPAGES");
console.log("=====================================================================");

// -------------------------------------------------------------------
// TEST 1: Exact Internship Email Example from Prompt
// -------------------------------------------------------------------
console.log("\n--- TEST 1: INTERNSHIP OFFER EMAIL ---");

const internshipEmailText = [
  "Employee Name: Sanketh M",
  "Employee ID: NXT-INT-2609307",
  "Joining Date: 30 September 2026",
  "Work Location: 5th Floor, Orion Business Park, Dr. Rajkumar Road, Rajajinagar, Bengaluru",
  "Monthly Stipend: ₹35,000",
  "PAN Card",
  "Aadhaar Card",
  "Bank account details",
  "Emergency contact information"
].join("\n");

console.log("Raw text:\n" + internshipEmailText);

const sanitizedEmail = redactText(internshipEmailText);
console.log("\nSanitized text:\n" + sanitizedEmail);

// Verify EVERY raw value is 100% absent
const rawSensitives = [
  "Sanketh M",
  "NXT-INT-2609307",
  "30 September 2026",
  "5th Floor, Orion Business Park, Dr. Rajkumar Road, Rajajinagar, Bengaluru",
  "₹35,000",
  "35,000"
];

rawSensitives.forEach((val) => {
  assert.strictEqual(
    sanitizedEmail.includes(val),
    false,
    `[SECURITY VIOLATION] Raw value '${val}' must NEVER appear in sanitized text!`
  );
  console.log(`[PASS] Raw value '${val}' is completely ABSENT from sanitized text.`);
});

// Verify required standardized placeholders are present
assert.strictEqual(sanitizedEmail.includes("[REDACTED_PERSON]"), true, "Must include [REDACTED_PERSON]");
assert.strictEqual(sanitizedEmail.includes("[REDACTED_EMPLOYEE_ID]") || sanitizedEmail.includes("[REDACTED_IDENTIFIER]"), true, "Must include [REDACTED_EMPLOYEE_ID] or [REDACTED_IDENTIFIER]");
assert.strictEqual(sanitizedEmail.includes("[REDACTED_DATE]"), true, "Must include [REDACTED_DATE]");
assert.strictEqual(sanitizedEmail.includes("[REDACTED_LOCATION]") || sanitizedEmail.includes("[REDACTED_ADDRESS]"), true, "Must include [REDACTED_LOCATION] or [REDACTED_ADDRESS]");
assert.strictEqual(sanitizedEmail.includes("[REDACTED_FINANCIAL]"), true, "Must include [REDACTED_FINANCIAL]");
assert.strictEqual(sanitizedEmail.includes("[REDACTED_DOCUMENT]"), true, "Must include [REDACTED_DOCUMENT]");
assert.strictEqual(sanitizedEmail.includes("[REDACTED_CONTACT]"), true, "Must include [REDACTED_CONTACT]");

console.log("[PASS] All required standardized placeholders verified in sanitized output!");

// -------------------------------------------------------------------
// TEST 2: Critical Privacy Verification Gate (verifySanitizedPayload)
// -------------------------------------------------------------------
console.log("\n--- TEST 2: CRITICAL PRIVACY PRE-FLIGHT VERIFICATION GATE ---");

// Case A: Clean sanitized payload -> must PASS gate
const cleanPayload = {
  title: "Internship Offer Letter",
  url: "https://mail.google.com/mail/u/0/#inbox/18fa2",
  redactedSample: sanitizedEmail
};
const cleanVerification = verifySanitizedPayload(cleanPayload);
assert.strictEqual(cleanVerification.valid, true, "Sanitized payload must PASS privacy gate");
assert.strictEqual(cleanVerification.violations.length, 0, "Sanitized payload must have 0 violations");
console.log("[PASS] Sanitized payload passed privacy gate with 0 violations.");

// Case B: Raw unredacted payload -> must be BLOCKED
const rawPayload = {
  title: "Internship Offer Letter",
  url: "https://mail.google.com/mail/u/0/#inbox/18fa2",
  redactedSample: internshipEmailText
};
const rawVerification = verifySanitizedPayload(rawPayload);
assert.strictEqual(rawVerification.valid, false, "Raw payload must be BLOCKED by privacy gate");
assert.strictEqual(rawVerification.violations.length > 0, true, "Raw payload must have violations");
console.log(`[PASS] Raw payload correctly BLOCKED with ${rawVerification.violations.length} violations:`);
rawVerification.violations.forEach((v) => console.log(`   - ${v}`));

// -------------------------------------------------------------------
// TEST 3: Generic Arbitrary Webpages (E-Commerce, Government, Portal, Health)
// -------------------------------------------------------------------
console.log("\n--- TEST 3: GENERIC ARBITRARY WEBPAGES (ACROSS SITES) ---");

const genericPages = [
  {
    name: "Medical Clinic Portal",
    raw: "Patient Name: Robert Johnson\nPatient ID: MRN-9948201\nDiagnosis: Hypertension\nContact No: +1-555-234-5678",
    unredactedToMask: ["Robert Johnson", "MRN-9948201", "Hypertension", "+1-555-234-5678"]
  },
  {
    name: "Banking & Tax Profile",
    raw: "Customer Name: Priya Sharma\nAccount Number: 987654321012\nIFSC: HDFC0001234\nPAN: ABCDE1234F\nAnnual Income: ₹12,00,000",
    unredactedToMask: ["Priya Sharma", "987654321012", "HDFC0001234", "ABCDE1234F", "₹12,00,000"]
  },
  {
    name: "Travel Booking Confirmation",
    raw: "Passenger Name: David Miller\nPNR Number: 8492049182\nTravel Date: 12/10/2026\nSeat: 14B\nEmergency Contact: 9876543210",
    unredactedToMask: ["David Miller", "8492049182", "12/10/2026", "9876543210"]
  },
  {
    name: "Developer Dashboard & Auth",
    raw: "Client ID: app_prod_99182\nAPI Key: sk-live99887766554433221100aabbcc\nSession ID: sess_9988112233445566\nServer IP: 198.51.100.42",
    unredactedToMask: ["sk-live99887766554433221100aabbcc", "sess_9988112233445566", "198.51.100.42"]
  }
];

genericPages.forEach((page) => {
  const result = redactText(page.raw);
  page.unredactedToMask.forEach((val) => {
    assert.strictEqual(
      result.includes(val),
      false,
      `[SECURITY] In ${page.name}, raw value '${val}' must be redacted!`
    );
  });
  const gateCheck = verifySanitizedPayload({ sample: result });
  assert.strictEqual(gateCheck.valid, true, `Sanitized ${page.name} must pass privacy gate`);
  console.log(`[PASS] ${page.name}: All sensitive values masked & verified clean.`);
});

// -------------------------------------------------------------------
// TEST 4: Preservation of Non-Sensitive Everyday Content (False Positives)
// -------------------------------------------------------------------
console.log("\n--- TEST 4: PRESERVATION OF NON-SENSITIVE EVERYDAY CONTENT ---");

const everydayContent = [
  "Search Query: best wireless headphones 2026",
  "Product Code: WH-1000XM5 in stock",
  "Order Quantity: 2 items shipped",
  "Special Discount Price: ₹4,999.00 with free delivery",
  "Year: 2026 conference schedule",
  "Quantity: 2 items in shopping cart",
  "Key features of quantum computing include superposition and entanglement",
  "Add to Cart",
  "Submit Application",
  "Next Page"
];

everydayContent.forEach((txt) => {
  const sanitized = redactText(txt);
  assert.strictEqual(sanitized, txt, `Everyday content was improperly mutated: '${txt}' !== '${sanitized}'`);
  console.log(`[PASS] Everyday content preserved unchanged: "${txt}"`);
});

// Explicitly verify that sensitive Order ID is redacted
const sensitiveOrder = "Order ID: ORD-2026-99214 has shipped";
assert.strictEqual(redactText(sensitiveOrder).includes("ORD-2026-99214"), false, "Sensitive Order ID must be redacted");
console.log("[PASS] Sensitive Order ID correctly redacted per generic privacy requirements.");

console.log("\n=====================================================================");
console.log("ALL INTERNSHIP AND GENERIC WEBPAGE TESTS PASSED 100%!");
console.log("=====================================================================");
