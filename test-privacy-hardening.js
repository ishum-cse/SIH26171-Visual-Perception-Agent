/**
 * test-privacy-hardening.js - Dedicated Verification Suite for IRIS Privacy Redaction Hardening
 * SIH26171 Milestone: Canonical Local Sensitive-Information Detection & Redaction
 *
 * Verifies:
 * 1. Positive detection and 100% masking for Categories A through H.
 * 2. Absolute absence of original raw values from sanitized outputs.
 * 3. False-positive protection for non-sensitive data (Orders, Products, Prices, Years, Quantities, Public text).
 * 4. Privacy category metric calculations without sensitive string exposure.
 * 5. Safe DOM metadata evaluation without reading input values.
 * 6. OCR sensitive region coordinate extraction with category tags and zero raw text leakage.
 */

const assert = require("assert");
const {
  redactText,
  detectAndRedactSensitiveValue,
  getCategoryCounts,
  isSensitiveInputMetadata,
  luhnCheck
} = require("./pii-detector.js");
const { detectSensitiveOcrRegions } = require("./ocr-entry.js");

console.log("=====================================================================");
console.log("RUNNING SIH26171 PRIVACY REDACTION HARDENING & REGRESSION SUITE");
console.log("=====================================================================");

let passedPositive = 0;
let passedNegative = 0;
let passedDom = 0;
let passedOcr = 0;

// =====================================================================
// SECTION 1: POSITIVE DETECTION TESTS (CATEGORIES A THROUGH H)
// For every positive case: ASSERT sensitive value is absent from sanitized text.
// =====================================================================

console.log("\n--- SECTION 1: POSITIVE DETECTION TESTS (CATEGORIES A–H) ---");

const positiveTestCases = [
  // Category A: Contact Information
  {
    category: "EMAIL",
    name: "Standard Email Address",
    raw: "alex.doe@company.org",
    text: "Please send your verification to alex.doe@company.org before midnight."
  },
  {
    category: "PHONE",
    name: "International Phone Number with Country Code",
    raw: "+91 9876543210",
    text: "Contact our representative at +91 9876543210 immediately."
  },
  {
    category: "PHONE",
    name: "Contextual Mobile Number",
    raw: "9876543210",
    text: "Mobile number: 9876543210."
  },

  // Category B: Authentication / Credentials
  {
    category: "PASSWORD",
    name: "Password with keyword context",
    raw: "Sup3rSecretPass!",
    text: "My password: Sup3rSecretPass! and do not share it."
  },
  {
    category: "PASSWORD",
    name: "Passcode string",
    raw: "Passcode9981",
    text: "Your passcode: Passcode9981."
  },
  {
    category: "PASSWORD",
    name: "Numeric PIN",
    raw: "4829",
    text: "Security PIN: 4829 for ATM access."
  },
  {
    category: "PASSWORD",
    name: "One-Time Password (OTP)",
    raw: "593812",
    text: "Your verification code: 593812 is valid for 5 minutes."
  },
  {
    category: "CREDENTIAL",
    name: "Credential Login ID",
    raw: "admin_super_user",
    text: "Login ID: admin_super_user."
  },

  // Category C: Payment Information
  {
    category: "CARD",
    name: "Credit Card (Visa/Mastercard 16-digit with spaces)",
    raw: "4111 1111 1111 1111",
    text: "Paying with credit card 4111 1111 1111 1111."
  },
  {
    category: "CVV",
    name: "Card CVV/CVC Security Code",
    raw: "842",
    text: "Card CVV: 842 on the back."
  },
  {
    category: "CARD",
    name: "Card Expiration Date in Payment Context",
    raw: "11/28",
    text: "Expiry Date: 11/28."
  },

  // Category D: Banking / Financial Information
  {
    category: "BANK",
    name: "Bank Account Number with Financial Label",
    raw: "123456789012",
    text: "Bank Account Number: 123456789012."
  },
  {
    category: "BANK",
    name: "IFSC Code",
    raw: "SBIN0001234",
    text: "Transfer to IFSC: SBIN0001234."
  },
  {
    category: "BANK",
    name: "UPI Payment Handle",
    raw: "sanketh@okhdfcbank",
    text: "Pay directly via UPI: sanketh@okhdfcbank."
  },
  {
    category: "BANK",
    name: "IBAN Identifier",
    raw: "GB82WEST12345698765432",
    text: "International IBAN: GB82WEST12345698765432."
  },
  {
    category: "BANK",
    name: "Routing Number",
    raw: "121000358",
    text: "Routing Number: 121000358."
  },

  // Category E: Government / Identity Documents
  {
    category: "IDENTITY",
    name: "Aadhaar Identifier with Context",
    raw: "1234 5678 9012",
    text: "Aadhaar: 1234 5678 9012."
  },
  {
    category: "IDENTITY",
    name: "Permanent Account Number (PAN)",
    raw: "ABCDE1234F",
    text: "Taxpayer PAN: ABCDE1234F."
  },
  {
    category: "IDENTITY",
    name: "Passport Number with Context",
    raw: "Z1234567",
    text: "Passport Number: Z1234567."
  },
  {
    category: "IDENTITY",
    name: "Driver's License Identifier",
    raw: "DL-1420110012345",
    text: "Driver's License: DL-1420110012345."
  },
  {
    category: "IDENTITY",
    name: "Employee ID",
    raw: "EMP-2026-991",
    text: "Employee ID: EMP-2026-991."
  },

  // Category F: Personal Information
  {
    category: "PERSONAL",
    name: "Date of Birth with Context",
    raw: "15/08/1995",
    text: "Date of Birth: 15/08/1995."
  },
  {
    category: "PERSONAL",
    name: "Residential Address with Context",
    raw: "42 MG Road, Indiranagar, Bengaluru",
    text: "Residential Address: 42 MG Road, Indiranagar, Bengaluru."
  },
  {
    category: "PERSONAL",
    name: "Emergency Contact",
    raw: "+91 9123456780",
    text: "Emergency Contact: +91 9123456780."
  },

  // Category G: Health / Medical Information
  {
    category: "HEALTH",
    name: "Medical Record Number (MRN)",
    raw: "MRN-884920",
    text: "Patient ID: MRN-884920."
  },
  {
    category: "HEALTH",
    name: "Health Insurance Policy Number",
    raw: "POL-7738219",
    text: "Health Insurance ID: POL-7738219."
  },

  // Category H: Software Secrets & Credentials
  {
    category: "CREDENTIAL",
    name: "Bearer Token",
    raw: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y53iMTZ3WbhSDJ_hzVQGhSw0",
    text: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y53iMTZ3WbhSDJ_hzVQGhSw0"
  },
  {
    category: "CREDENTIAL",
    name: "JWT-like Token",
    raw: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y53iMTZ3WbhSDJ_hzVQGhSw0",
    text: "Received token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y53iMTZ3WbhSDJ_hzVQGhSw0"
  },
  {
    category: "CREDENTIAL",
    name: "API Key (Prefix sk-)",
    raw: "sk-live1234567890abcdef123456",
    text: "Client API Key: sk-live1234567890abcdef123456."
  },
  {
    category: "CREDENTIAL",
    name: "Secret Key in Config Format",
    raw: "super_secret_production_key_9981",
    text: "SECRET_KEY: super_secret_production_key_9981"
  },
  {
    category: "CREDENTIAL",
    name: "Private Key PEM Block",
    raw: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0mockkeydatahere\n-----END RSA PRIVATE KEY-----",
    text: "Certificate:\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0mockkeydatahere\n-----END RSA PRIVATE KEY-----"
  }
];

positiveTestCases.forEach((tc, idx) => {
  const sanitized = redactText(tc.text);
  const result = detectAndRedactSensitiveValue(tc.text);

  assert.strictEqual(result.detected, true, `[${tc.category}] ${tc.name} must be detected as sensitive`);
  assert.strictEqual(
    sanitized.includes(tc.raw),
    false,
    `[SECURITY] Raw value '${tc.raw}' must NEVER appear in sanitized output for ${tc.name}`
  );
  passedPositive++;
  console.log(`[PASS] ${passedPositive}. [${tc.category}] ${tc.name} -> detected & masked safely`);
});

// =====================================================================
// SECTION 2: NEGATIVE TESTS (FALSE-POSITIVE PROTECTION)
// For every negative case: ASSERT text remains unchanged and unredacted.
// =====================================================================

console.log("\n--- SECTION 2: FALSE-POSITIVE PROTECTION TESTS (NEGATIVE CASES) ---");

const negativeTestCases = [
  {
    name: "Order ID with Alphanumeric format",
    text: "Your Order ID: ORD-2026-10452 has been confirmed."
  },
  {
    name: "Order Number with Numeric digits",
    text: "Order Number: 12345678 is currently being packaged."
  },
  {
    name: "Product Code with alphanumeric code",
    text: "Product Code: ABC123 is available in our regional warehouse."
  },
  {
    name: "Product ID with numeric sequence",
    text: "Product ID: 987654321 is currently in stock."
  },
  {
    name: "Rupee Price",
    text: "The discounted price is ₹1,299 including all taxes."
  },
  {
    name: "Dollar Price",
    text: "Total Amount: $99.99 billed to your invoice."
  },
  {
    name: "Year Identifier",
    text: "Smart India Hackathon Year: 2026 problem statements."
  },
  {
    name: "Item Quantity",
    text: "Selected Quantity: 100 units of standard equipment."
  },
  {
    name: "Search Query with digits",
    text: "Search Query: 123456 returned 0 results."
  },
  {
    name: "Public Company & Government Organization",
    text: "Indian Space Research Organisation (ISRO) Department of Space — SIH 2026."
  },
  {
    name: "Public Article Text containing 'Key'",
    text: "Key features of the product include high throughput and zero latency."
  },
  {
    name: "Public Text containing 'Token'",
    text: "Token ring network topology was an early local-area networking architecture."
  },
  {
    name: "Public Text containing 'Secret'",
    text: "The secret of success in software engineering is relentless attention to detail."
  },
  {
    name: "Normal City & Sentence",
    text: "Bangalore is known as the technology capital of India."
  }
];

negativeTestCases.forEach((tc) => {
  const sanitized = redactText(tc.text);
  const result = detectAndRedactSensitiveValue(tc.text);

  assert.strictEqual(
    result.detected,
    false,
    `[FALSE POSITIVE DETECTED] '${tc.text}' was falsely marked sensitive`
  );
  assert.strictEqual(
    sanitized,
    tc.text,
    `[MUTATION ERROR] Non-sensitive text was modified:\nExpected: '${tc.text}'\nGot:      '${sanitized}'`
  );
  passedNegative++;
  console.log(`[PASS] Non-sensitive control preserved: ${tc.name}`);
});

// =====================================================================
// SECTION 3: CATEGORY METRICS BREAKDOWN TESTS
// Verifies getCategoryCounts aggregates counts without raw string leakage.
// =====================================================================

console.log("\n--- SECTION 3: CATEGORY BREAKDOWN METRICS TESTS ---");

{
  const compositeText = `
    User email: test@example.com
    Phone: +91 9876543210
    Password: MySecretPassword123!
    Card: 4111 1111 1111 1111
    CVV: 123
    Bank Account: 123456789012
    IFSC: SBIN0001234
    Aadhaar: 1234 5678 9012
    API Key: sk-live1234567890abcdef123456
    Date of Birth: 01/01/1990
    Patient ID: MRN-998877
    Order ID: ORD-2026-8899
    Price: ₹500
  `;

  const counts = getCategoryCounts(compositeText);

  assert.strictEqual(counts.EMAIL >= 1, true, "EMAIL count must be >= 1");
  assert.strictEqual(counts.PHONE >= 1, true, "PHONE count must be >= 1");
  assert.strictEqual(counts.PASSWORD >= 1, true, "PASSWORD count must be >= 1");
  assert.strictEqual(counts.CARD >= 1, true, "CARD count must be >= 1");
  assert.strictEqual(counts.BANK >= 1, true, "BANK count must be >= 1");
  assert.strictEqual(counts.IDENTITY >= 1, true, "IDENTITY count must be >= 1");
  assert.strictEqual(counts.CREDENTIAL >= 1, true, "CREDENTIAL count must be >= 1");
  assert.strictEqual(counts.PERSONAL >= 1, true, "PERSONAL count must be >= 1");
  assert.strictEqual(counts.HEALTH >= 1, true, "HEALTH count must be >= 1");

  console.log("[PASS] Category metrics successfully computed:", counts);
}

// =====================================================================
// SECTION 4: DOM INPUT METADATA EVALUATOR TESTS (isSensitiveInputMetadata)
// Verifies safe evaluation of input elements without reading .value.
// =====================================================================

console.log("\n--- SECTION 4: DOM INPUT METADATA TESTS ---");

const domTestCases = [
  { meta: { type: "password" }, expected: true, label: "type='password'" },
  { meta: { type: "email" }, expected: true, label: "type='email'" },
  { meta: { type: "tel" }, expected: true, label: "type='tel'" },
  { meta: { type: "text", autocomplete: "cc-number" }, expected: true, label: "autocomplete='cc-number'" },
  { meta: { type: "text", autocomplete: "current-password" }, expected: true, label: "autocomplete='current-password'" },
  { meta: { type: "text", name: "cvv_code" }, expected: true, label: "name='cvv_code'" },
  { meta: { type: "text", placeholder: "Enter bank account" }, expected: true, label: "placeholder contains bank account" },
  { meta: { type: "text", ariaLabel: "Aadhaar Number" }, expected: true, label: "ariaLabel='Aadhaar Number'" },
  { meta: { type: "text", labelText: "Account Number" }, expected: true, label: "labelText='Account Number'" },
  { meta: { type: "text", name: "order_id" }, expected: false, label: "name='order_id' (exempt)" },
  { meta: { type: "text", placeholder: "Search products..." }, expected: false, label: "placeholder='Search products...' (exempt)" },
  { meta: { type: "text", name: "quantity" }, expected: false, label: "name='quantity' (exempt)" }
];

domTestCases.forEach((tc) => {
  const result = isSensitiveInputMetadata(tc.meta);
  assert.strictEqual(result, tc.expected, `DOM sensitivity mismatch for ${tc.label}`);
  passedDom++;
  console.log(`[PASS] DOM Metadata: ${tc.label} -> sensitive: ${result}`);
});

// =====================================================================
// SECTION 5: OCR SENSITIVE REGION BOUNDING BOXES & ZERO-LEAKAGE
// Verifies OCR outputs only coordinates + categories, NEVER raw strings.
// =====================================================================

console.log("\n--- SECTION 5: OCR SENSITIVE REGION TESTS ---");

{
  const mockOcrData = {
    lines: [
      {
        text: "Bank Account Number: 123456789012",
        x: 100, y: 200, width: 300, height: 25,
        words: [
          { text: "Bank", x: 100, y: 200, width: 50, height: 25 },
          { text: "Account", x: 155, y: 200, width: 60, height: 25 },
          { text: "Number:", x: 220, y: 200, width: 55, height: 25 },
          { text: "123456789012", x: 280, y: 200, width: 120, height: 25 }
        ]
      },
      {
        text: "Order ID: ORD-2026-99124",
        x: 100, y: 240, width: 250, height: 25,
        words: [
          { text: "Order", x: 100, y: 240, width: 50, height: 25 },
          { text: "ID:", x: 155, y: 240, width: 30, height: 25 },
          { text: "ORD-2026-99124", x: 190, y: 240, width: 160, height: 25 }
        ]
      },
      {
        text: "User Email: test.agent@example.com",
        x: 100, y: 280, width: 320, height: 25,
        words: [
          { text: "User", x: 100, y: 280, width: 40, height: 25 },
          { text: "Email:", x: 145, y: 280, width: 45, height: 25 },
          { text: "test.agent@example.com", x: 195, y: 280, width: 225, height: 25 }
        ]
      }
    ]
  };

  const ocrRegions = detectSensitiveOcrRegions(mockOcrData);

  assert.strictEqual(Array.isArray(ocrRegions), true, "OCR regions must be an array");
  assert.strictEqual(ocrRegions.length >= 2, true, "OCR should detect bank account and email lines");

  // CRITICAL PRIVACY INVARIANT: Ensure zero raw strings in any region object!
  ocrRegions.forEach((r, idx) => {
    assert.strictEqual(typeof r.x, "number", `Region ${idx} must have numeric x`);
    assert.strictEqual(typeof r.y, "number", `Region ${idx} must have numeric y`);
    assert.strictEqual(typeof r.width, "number", `Region ${idx} must have numeric width`);
    assert.strictEqual(typeof r.height, "number", `Region ${idx} must have numeric height`);
    assert.strictEqual(r.text, undefined, `[CRITICAL PRIVACY VIOLATION] Region ${idx} must NOT contain raw 'text' property!`);
    assert.strictEqual(typeof r.category, "string", `Region ${idx} should have a category tag`);
  });

  passedOcr++;
  console.log(`[PASS] OCR detection produced ${ocrRegions.length} sanitized bounding boxes with category tags and ZERO raw strings!`);
}

// =====================================================================
// SECTION 6: LUHN CHECKSUM ALGORITHM VERIFICATION
// =====================================================================

console.log("\n--- SECTION 6: LUHN CHECKSUM TESTS ---");

assert.strictEqual(luhnCheck("4111 1111 1111 1111"), true, "4111 1111 1111 1111 must pass Luhn");
assert.strictEqual(luhnCheck("4111111111111111"), true, "4111111111111111 must pass Luhn");
assert.strictEqual(luhnCheck("1234567890123456"), false, "Arbitrary 16 digits must fail Luhn");
assert.strictEqual(luhnCheck("9876543210"), false, "10-digit phone must not be treated as a card");
console.log("[PASS] Luhn checksum algorithm accurately differentiates payment cards from arbitrary numbers.");

console.log("\n=====================================================================");
console.log(`ALL PRIVACY REDACTION HARDENING TESTS PASSED!`);
console.log(`- Positive Categories A–H Tests Passed: ${passedPositive}`);
console.log(`- False-Positive Negative Tests Passed: ${passedNegative}`);
console.log(`- DOM Safe Metadata Tests Passed:       ${passedDom}`);
console.log(`- OCR Zero-Leakage Tests Passed:        ${passedOcr}`);
console.log("=====================================================================");
