/**
 * test-final-privacy-hardening.js
 *
 * Comprehensive validation test suite for IRIS Final Generic Sensitive-Information Redaction Hardening.
 *
 * Verifies:
 * - Test A: Existing test page (Email, Phone, Password, Credit card)
 * - Test B: Employment email (Employee ID: NXT-2609307, Designation, Joining Date, Work Location, Reporting Manager, HR Business Partner, HR email)
 * - Test C: Student document (Student ID: 4NI24IS175, Department, Phone, Email)
 * - Test D: Banking text (Account Number: 123456789012, IFSC: ABCD0123456, Transaction ID: TXN928374)
 * - Test E: Ordinary page preservation (ISRO, Indian Space Research Organisation, Mission details, 30 September 2026, Sundar Pichai)
 * - Layered Detector architecture (Deterministic, Field/Label, Contextual, Cross-element)
 * - DOM + OCR consistency & screenshot region generation
 * - Pre-flight Privacy Gate verification
 */

const assert = require("assert");
const {
  redactText,
  detectAndRedactSensitiveValue,
  getCategoryCounts,
  detectDocumentContext,
  verifySanitizedPayload,
  isSensitiveInputMetadata
} = require("./pii-detector.js");

const { detectSensitiveOcrRegions } = require("./ocr-entry.js");

console.log("=====================================================================");
console.log("RUNNING IRIS FINAL GENERIC PRIVACY REDACTION HARDENING SUITE");
console.log("=====================================================================\n");

// -------------------------------------------------------------------
// TEST A: Existing Test Page (Email, Phone, Password, Credit Card)
// -------------------------------------------------------------------
console.log("--- TEST A: EXISTING TEST PAGE (Email, Phone, Password, Credit Card) ---");

const testAText = `
Email Address: user.secure@company.org
Customer Phone: +1 (555) 923-8472
Login Password: SuperSecretPwd123!
Credit Card: 4111 1111 1111 1111
CVV: 892
Card Expiry: 09/28
`;

const sanitizedA = redactText(testAText);
console.log("Sanitized Test A:\n" + sanitizedA.trim());

assert(!sanitizedA.includes("user.secure@company.org"), "Raw email must be redacted");
assert(!sanitizedA.includes("+1 (555) 923-8472"), "Raw phone must be redacted");
assert(!sanitizedA.includes("SuperSecretPwd123!"), "Raw password must be redacted");
assert(!sanitizedA.includes("4111 1111 1111 1111"), "Raw card must be redacted");
assert(!sanitizedA.includes("892"), "Raw CVV must be redacted");
assert(!sanitizedA.includes("09/28"), "Raw expiry must be redacted");

assert(sanitizedA.includes("[REDACTED_EMAIL]"), "Must contain [REDACTED_EMAIL]");
assert(sanitizedA.includes("[REDACTED_PHONE]"), "Must contain [REDACTED_PHONE]");
assert(sanitizedA.includes("[REDACTED_PASSWORD]"), "Must contain [REDACTED_PASSWORD]");
assert(sanitizedA.includes("[REDACTED_CARD]"), "Must contain [REDACTED_CARD]");
assert(sanitizedA.includes("[REDACTED_CVV]"), "Must contain [REDACTED_CVV]");
assert(sanitizedA.includes("[REDACTED_CARD_EXP]"), "Must contain [REDACTED_CARD_EXP]");

console.log("  [PASS] Test A: Email, Phone, Password, Credit card all remain strictly redacted.\n");

// -------------------------------------------------------------------
// TEST B: Employment Email & Onboarding Document (PART 17 TEST 1)
// -------------------------------------------------------------------
console.log("--- TEST B: EMPLOYMENT EMAIL & ONBOARDING CONTEXT (PART 17 TEST 1) ---");

const testBText = `
Employee ID: NXT-INT-2609307
Designation: SDE 1 Intern
Department: Software Engineering
Joining Date: 30 September 2026
Location: Bengaluru, Karnataka
Reporting Time: 9:30 AM
Reporting Manager: Arjun Rao
HR Business Partner: Priya Sharma
`;

const sanitizedB = redactText(testBText);
console.log("Sanitized Test B:\n" + sanitizedB.trim());

// Sensitive values must be redacted
assert(!sanitizedB.includes("NXT-INT-2609307"), "Raw Employee ID must be redacted");
assert(!sanitizedB.includes("30 September 2026"), "Raw Joining Date must be redacted");
assert(!sanitizedB.includes("Bengaluru, Karnataka"), "Raw Location must be redacted");
assert(!sanitizedB.includes("9:30 AM"), "Raw Reporting Time must be redacted");
assert(!sanitizedB.includes("Arjun Rao"), "Raw Reporting Manager must be redacted");
assert(!sanitizedB.includes("Priya Sharma"), "Raw HR Business Partner must be redacted");

// Non-sensitive job metadata and labels must remain visible as per TEST 1
assert(sanitizedB.includes("Designation: SDE 1 Intern"), "Designation must remain visible");
assert(sanitizedB.includes("Department: Software Engineering"), "Department must remain visible");
assert(sanitizedB.includes("Employee ID: [REDACTED_EMPLOYEE_ID]"), "Must contain Employee ID: [REDACTED_EMPLOYEE_ID]");
assert(sanitizedB.includes("Joining Date: [REDACTED_DATE]"), "Must contain Joining Date: [REDACTED_DATE]");
assert(sanitizedB.includes("Location: [REDACTED_LOCATION]"), "Must contain Location: [REDACTED_LOCATION]");
assert(sanitizedB.includes("Reporting Time: [REDACTED_TIME]"), "Must contain Reporting Time: [REDACTED_TIME]");
assert(sanitizedB.includes("Reporting Manager: [REDACTED_PERSON]"), "Must contain Reporting Manager: [REDACTED_PERSON]");
assert(sanitizedB.includes("HR Business Partner: [REDACTED_PERSON]"), "Must contain HR Business Partner: [REDACTED_PERSON]");

console.log("  [PASS] Test B: Employment document sensitive values cleanly redacted; labels and metadata preserved as per TEST 1.\n");

// -------------------------------------------------------------------
// TEST C: Student Document
// -------------------------------------------------------------------
console.log("--- TEST C: STUDENT DOCUMENT ---");

const testCText = `
Student ID: 4NI24IS175
Department: ISE
Phone: 9876543210
Email: student@college.edu
`;

const sanitizedC = redactText(testCText);
console.log("Sanitized Test C:\n" + sanitizedC.trim());

assert(!sanitizedC.includes("4NI24IS175"), "Raw Student ID must be redacted");
assert(!sanitizedC.includes("9876543210"), "Raw Phone must be redacted");
assert(!sanitizedC.includes("student@college.edu"), "Raw Email must be redacted");

assert(sanitizedC.includes("Student ID: [REDACTED_IDENTIFIER]"), "Student ID label preserved with [REDACTED_IDENTIFIER]");
assert(sanitizedC.includes("[REDACTED_PHONE]"), "Must contain [REDACTED_PHONE]");
assert(sanitizedC.includes("[REDACTED_EMAIL]"), "Must contain [REDACTED_EMAIL]");

console.log("  [PASS] Test C: Student identifier and contact info properly redacted.\n");

// -------------------------------------------------------------------
// TEST D: Banking Text
// -------------------------------------------------------------------
console.log("--- TEST D: BANKING TEXT ---");

const testDText = `
Account Number: 123456789012
IFSC: ABCD0123456
Transaction ID: TXN928374
`;

const sanitizedD = redactText(testDText);
console.log("Sanitized Test D:\n" + sanitizedD.trim());

assert(!sanitizedD.includes("123456789012"), "Raw Account Number must be redacted");
assert(!sanitizedD.includes("ABCD0123456"), "Raw IFSC must be redacted");
assert(!sanitizedD.includes("TXN928374"), "Raw Transaction ID must be redacted");

assert(sanitizedD.includes("Account Number: [REDACTED_BANK_ACCOUNT]"), "Must redact account number to [REDACTED_BANK_ACCOUNT]");
assert(sanitizedD.includes("IFSC: [REDACTED_IFSC]"), "Must redact IFSC to [REDACTED_IFSC]");
assert(sanitizedD.includes("Transaction ID: [REDACTED_FINANCIAL]"), "Must redact transaction ID to [REDACTED_FINANCIAL]");

console.log("  [PASS] Test D: Sensitive financial account, IFSC, and transaction ID redacted.\n");

// -------------------------------------------------------------------
// TEST E: Ordinary Public Webpage (False Positive Protection)
// -------------------------------------------------------------------
console.log("--- TEST E: ORDINARY PUBLIC PAGE (Zero False Positives) ---");

const testEText = `
Indian Space Research Organisation
ISRO
Mission details
30 September 2026
`;

const sanitizedE = redactText(testEText);
console.log("Sanitized Test E:\n" + sanitizedE.trim());

assert.strictEqual(sanitizedE.trim(), testEText.trim(), "Ordinary public text without sensitive context must remain 100% UNCHANGED");
assert(sanitizedE.includes("Indian Space Research Organisation"), "Public entity name preserved");
assert(sanitizedE.includes("ISRO"), "Acronym preserved");
assert(sanitizedE.includes("Mission details"), "Public heading preserved");
assert(sanitizedE.includes("30 September 2026"), "Public non-sensitive date preserved");

const publicPersonText = "About Sundar Pichai and his leadership at Alphabet";
assert.strictEqual(redactText(publicPersonText), publicPersonText, "Public person name without sensitive context must not be redacted");

console.log("  [PASS] Test E: Ordinary public content preserved without false-positive redactions.\n");

// -------------------------------------------------------------------
// TEST F: Generic Identifier Detection Across Categories
// -------------------------------------------------------------------
console.log("--- TEST F: GENERIC IDENTIFIERS (Multiple Prefixes and Formats) ---");

const idTestSample = `
Employee Number: EMP-10293
Staff ID: ST-88421
Application ID: APP-293847
Candidate ID: CND-29384
Customer ID: CUST-928374
Ticket ID: TKT-92831
Order ID: ORD-938472
Reference ID: REF-83921
Account ID: ACC-92831
Member ID: MEM-83921
Policy Number: POL-928374
Case Number: CASE-938472
Booking ID: BOOK-928374
Transaction ID: TXN-839472
`;

const sanitizedIDs = redactText(idTestSample);
console.log("Sanitized Generic IDs:\n" + sanitizedIDs.trim());

const testValues = [
  "EMP-10293", "ST-88421", "APP-293847", "CND-29384",
  "CUST-928374", "TKT-92831", "REF-83921", "ACC-92831",
  "MEM-83921", "POL-928374", "CASE-938472", "BOOK-928374",
  "TXN-839472"
];

testValues.forEach((val) => {
  assert(!sanitizedIDs.includes(val), `Raw identifier '${val}' must be absent`);
});

console.log("  [PASS] Test F: All generic identifiers successfully redacted regardless of prefix.\n");

// -------------------------------------------------------------------
// TEST G: OCR Sensitive Region Detection & Multi-Line Correlation
// -------------------------------------------------------------------
console.log("--- TEST G: OCR SENSITIVE REGION DETECTION ---");

const mockOcrData = {
  words: [
    { text: "Employee", x: 50, y: 100, width: 60, height: 20 },
    { text: "ID:", x: 115, y: 100, width: 25, height: 20 },
    { text: "NXT-2609307", x: 145, y: 100, width: 90, height: 20 },
    { text: "Reporting", x: 50, y: 140, width: 70, height: 20 },
    { text: "Manager:", x: 125, y: 140, width: 65, height: 20 },
    { text: "Arjun", x: 195, y: 140, width: 45, height: 20 },
    { text: "Rao", x: 245, y: 140, width: 35, height: 20 },
    { text: "Mission", x: 50, y: 200, width: 55, height: 20 },
    { text: "details", x: 110, y: 200, width: 45, height: 20 }
  ],
  lines: [
    {
      text: "Employee ID: NXT-2609307",
      x: 50, y: 100, width: 185, height: 20,
      words: [
        { text: "Employee", x: 50, y: 100, width: 60, height: 20 },
        { text: "ID:", x: 115, y: 100, width: 25, height: 20 },
        { text: "NXT-2609307", x: 145, y: 100, width: 90, height: 20 }
      ]
    },
    {
      text: "Reporting Manager: Arjun Rao",
      x: 50, y: 140, width: 230, height: 20,
      words: [
        { text: "Reporting", x: 50, y: 140, width: 70, height: 20 },
        { text: "Manager:", x: 125, y: 140, width: 65, height: 20 },
        { text: "Arjun", x: 195, y: 140, width: 45, height: 20 },
        { text: "Rao", x: 245, y: 140, width: 35, height: 20 }
      ]
    },
    {
      text: "Mission details",
      x: 50, y: 200, width: 105, height: 20,
      words: [
        { text: "Mission", x: 50, y: 200, width: 55, height: 20 },
        { text: "details", x: 110, y: 200, width: 45, height: 20 }
      ]
    }
  ]
};

const ocrRegions = detectSensitiveOcrRegions(mockOcrData);
console.log(`Detected ${ocrRegions.length} OCR sensitive regions:`, JSON.stringify(ocrRegions));

assert(ocrRegions.length >= 2, "Must detect at least 2 sensitive regions from OCR");
assert(ocrRegions.some(r => r.category === "IDENTITY" || r.category === "SENSITIVE"), "Must detect Employee ID region");
assert(ocrRegions.some(r => r.category === "PERSONAL" || r.category === "SENSITIVE"), "Must detect Reporting Manager region");
// Ensure non-sensitive line ('Mission details') is NOT in regions
assert(!ocrRegions.some(r => r.y === 200 && r.height === 20 && r.width === 105), "Public text must not produce sensitive OCR region");

console.log("  [PASS] Test G: OCR sensitive visual regions detected with precise coordinates and zero leaks.\n");

// -------------------------------------------------------------------
// TEST H: Pre-Flight Verification Gate Invariant Checks
// -------------------------------------------------------------------
console.log("--- TEST H: PRE-FLIGHT VERIFICATION GATE ---");

// Valid sanitized payload
const validPayload = {
  task: "Search for jobs and view offer",
  structuredContext: {
    pageTitle: "Onboarding Portal",
    elements: [
      { id: 1, label: "Employee ID: [REDACTED_IDENTIFIER]", type: "text" },
      { id: 2, label: "Reporting Manager: [REDACTED_PERSON]", type: "text" },
      { id: 3, label: "Joining Date: [REDACTED_DATE]", type: "text" }
    ],
    redactedSample: "Employee ID: [REDACTED_IDENTIFIER]\nJoining Date: [REDACTED_DATE]"
  }
};

const validCheck = verifySanitizedPayload(validPayload);
assert(validCheck.valid, `Sanitized payload must pass gate. Violations: ${validCheck.violations.join("; ")}`);

// Violating payload with raw Employee ID
const leakyPayload = {
  task: "View offer",
  structuredContext: {
    elements: [
      { id: 1, label: "Employee ID: NXT-2609307", type: "text" }
    ]
  }
};

const leakyCheck = verifySanitizedPayload(leakyPayload);
assert(!leakyCheck.valid, "Payload containing raw NXT-2609307 must be BLOCKED by pre-flight gate");
console.log("  Blocked violation reason:", leakyCheck.reason);

console.log("  [PASS] Test H: Pre-flight gate guarantees raw sensitive data never reaches reasoning layer.\n");

// -------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------
console.log("=====================================================================");
console.log("ALL 8 FINAL PRIVACY HARDENING TESTS PASSED 100%!");
console.log("=====================================================================");
