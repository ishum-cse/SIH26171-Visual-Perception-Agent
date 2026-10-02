/**
 * pii-detector.js - Canonical Local Sensitive-Data Detection and Redaction Module
 * Upgraded for SIH26171 IRIS Browser Agent — Full 40-Category Privacy Redaction & Pre-Flight Gate.
 *
 * Runs 100% locally on-device in client memory; zero external network requests.
 * Detects Categories 1 through 40 with contextual intelligence and false-positive protection.
 * Enforces pre-flight privacy verification (verifySanitizedPayload) before transmission to /api/context.
 */

// =====================================================================
// CATEGORY PATTERNS & REGEXES (CATEGORIES 1 - 40)
// =====================================================================

// 1. Email Addresses
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// 2. Phone Numbers (International, formatted, and contextual)
const PHONE_INTL_REGEX = /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
const PHONE_CONTEXT_REGEX = /\b((?:phone|mobile|tel|cell|call(?:\s*me)?(?:\s*at)?|contact(?:\s*no|\s*number)?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([+\d \t().-]{7,20})\b/gi;
const PHONE_STANDALONE_REGEX = /\b[6-9]\d{9}\b|\b\d{3}[-.]\d{3}[-.]\d{4}\b/g;

// 3. Passwords
const PASSWORD_REGEX = /\b((?:password|passwd|pwd|passcode|secret\s*phrase)(?:[ \t]*[:=-][ \t]*(?:is[ \t]*[:=-]?[ \t]*)?|[ \t]+is[ \t]+))(?![\s]*\[REDACTED)([^\s\r\n,;!]+)/gi;

// 4. Usernames / Login Identifiers (when clearly identified as credentials)
const CREDENTIAL_USER_REGEX = /\b((?:login\s*id|credential\s*id|user\s*login|auth\s*user|account\s*username|login\s*username)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([^\s\r\n,;!]{3,40})\b/gi;

// 5. OTP / Verification codes
const OTP_REGEX = /\b((?:otp|one\s*time\s*(?:password|code|passcode)|verification\s*code|auth\s*code|security\s*code|2fa\s*code)[ \t]*[:=-][ \t]*(?:is[ \t]*[:=-]?[ \t]*)?)(?![\s]*\[REDACTED)([0-9]{4,8})\b/gi;
const PIN_REGEX = /\b((?:pin|security\s*pin|atm\s*pin|login\s*pin)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([0-9]{4,8})\b/gi;

// 6. Credit/Debit Card Numbers
const CREDIT_CARD_GROUPED_REGEX = /\b(?:\d{4}[ -]){3}\d{4}\b|\b(?:\d{4}[ -]){2}\d{4}[ -]\d{1,4}\b/g;
const CREDIT_CARD_CONTEXT_REGEX = /\b((?:credit\s*card|debit\s*card|card\s*number|card\s*no)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d[\d \t-]{11,18}\d)\b/gi;

// 7. CVV / CVC & Card Expiry
const CVV_REGEX = /\b((?:cvv|cvc|cid|security\s*code|card\s*verification)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([0-9]{3,4})\b/gi;
const CARD_EXP_REGEX = /\b((?:exp(?:iry|iration)?(?:\s*date)?|valid\s*thru|valid\s*upto)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)((?:0[1-9]|1[0-2])[\/\-](?:\d{2}|\d{4}))\b/gi;

// 8. Bank Account Numbers
const BANK_ACCOUNT_REGEX = /\b((?:bank\s*account(?:\s*no|\s*number)?|account\s*(?:no|number|id)|savings\s*account|current\s*account)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z0-9\-]{8,24})\b/gi;

// 8b. Transaction Identifiers
const TRANSACTION_ID_REGEX = /\b((?:transaction\s*(?:id|number|no|hash|ref|reference)|txn\s*(?:id|no)?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z0-9\-_]{6,35})\b/gi;
const TRANSACTION_STANDALONE_REGEX = /\b(?:TXN|TRX)[-_]?[A-Za-z0-9]{6,25}\b/g;

// 9. IFSC / SWIFT / Routing-Style Banking Identifiers
const IFSC_REGEX = /\b((?:IFSC(?:\s*code)?[ \t]*[:=-][ \t]*)?)(?![\s]*\[REDACTED)([A-Z]{4}0[A-Z0-9]{6})\b/g;
const IBAN_REGEX = /\b([A-Z]{2}\d{2}[A-Z0-9]{4}[A-Z0-9]{7,26})\b/g;
const SWIFT_BIC_REGEX = /\b(?:SWIFT|BIC)(?:[\s*code]*[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/gi;
const ROUTING_SORT_REGEX = /\b((?:routing\s*(?:number|no)?|sort\s*code|aba\s*(?:number)?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d{9}|\d{2}-\d{2}-\d{2})\b/gi;

// 10. UPI IDs
const UPI_HANDLE_REGEX = /\b[\w.-]+@(?:okhdfcbank|okaxis|oksbi|okicici|paytm|apl|ybl|upi|barodampay|icici|axl|ibl|allbank|postbank|idfcbank|sbi)\b/gi;
const UPI_CONTEXT_REGEX = /\b((?:upi(?:\s*id)?|payment\s*handle|vpa)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)\b/gi;

// 11. PAN Numbers
const PAN_REGEX = /\b((?:PAN(?:\s*number|\s*card)?[ \t]*[:=-][ \t]*)?)(?![\s]*\[REDACTED)([A-Z]{5}[0-9]{4}[A-Z])\b/g;

// 12. Aadhaar Numbers
const AADHAAR_CONTEXT_REGEX = /\b((?:aadhaar|adhaar|uidai|uid)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d{4}[\s-]?\d{4}[\s-]?\d{4}|\d{12})\b/gi;
const AADHAAR_STANDALONE_REGEX = /\b[2-9]\d{3}\s\d{4}\s\d{4}\b/g;

// 13. Passport Numbers
const PASSPORT_REGEX = /\b((?:passport(?:\s*no|\s*number)?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]|[A-Z0-9]{7,9})\b/gi;

// 14. Driver's License Identifiers
const DRIVERS_LICENSE_REGEX = /\b((?:driver'?s?\s*license|dl(?:\s*no)?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Z0-9\s\/-]{8,20})\b/gi;

// 15. Government ID References/Numbers
const SSN_REGEX = /\b((?:ssn|social\s*security(?:\s*number)?)[ \t]*[:=-][ \t]*)?(\d{3}-\d{2}-\d{4})\b/gi;
const NATIONAL_ID_REGEX = /\b((?:national\s*id|tax\s*id|tin\s*no|voter\s*id(?:\s*no|\s*card)?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z0-9\/-]{6,20})\b/gi;

// 16. API Keys
const API_KEY_PREFIX_REGEX = /\b(sk-[A-Za-z0-9]{20,})\b/g;
const API_KEY_CONTEXT_REGEX = /\b((?:api[_-]?key|client[_-]?secret)[ \t]*[:=-][ \t]*['"]?)(?![\s]*\[REDACTED)([A-Za-z0-9_\-]{16,})(['"]?)/gi;

// 17. Access Tokens
const ACCESS_TOKEN_REGEX = /\b((?:access[_-]?token|refresh[_-]?token|session[_-]?token)[ \t]*[:=-][ \t]*['"]?)(?![\s]*\[REDACTED)([A-Za-z0-9_\-\.]{16,})(['"]?)/gi;

// 18. Auth Tokens / Bearer Tokens
const BEARER_TOKEN_REGEX = /\b((?:Authorization:\s*)?Bearer\s+)(?![\s]*\[REDACTED)([A-Za-z0-9_\-\.]{20,})\b/gi;
const JWT_REGEX = /\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{10,})\b/g;

// 19. Secret Keys & Environment Secrets
const ENV_SECRET_REGEX = /\b((?:AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|GITHUB_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY|DATABASE_URL)[ \t]*[:=-][ \t]*['"]?)(?![\s]*\[REDACTED)([^\s'"]{8,})(['"]?)/gi;
const SECRET_KEY_REGEX = /\b((?:secret[_-]?key|client[_-]?secret|private[_-]?token)[ \t]*[:=-][ \t]*['"]?)(?![\s]*\[REDACTED)([A-Za-z0-9_\-]{16,})(['"]?)/gi;

// 20. Private Keys
const PRIVATE_KEY_REGEX = /-----BEGIN[ A-Z_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z_-]*PRIVATE KEY-----/g;

// 21. Session IDs / Authentication Cookies
const SESSION_COOKIE_REGEX = /\b((?:session[_-]?id|connect\.sid|phpsessid|jsessionid|auth_session|sid)[ \t]*[:=-][ \t]*['"]?)(?![\s]*\[REDACTED)([A-Za-z0-9_\-]{16,})(['"]?)/gi;

// 22. IP Addresses (excluding localhost 127.0.0.1 and 0.0.0.0)
const IP_CONTEXT_REGEX = /\b((?:ip\s*address|client\s*ip|server\s*ip)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d{1,3}(?:\.\d{1,3}){3})\b/gi;
const IP_STANDALONE_REGEX = /\b(?!(?:127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255)\b)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

// 23. MAC Addresses
const MAC_ADDRESS_REGEX = /\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b/g;

// 24. Sensitive Query Parameters in URLs
const SENSITIVE_URL_PARAM_REGEX = /(https?:\/\/[^\s"'<>]+[?&](?:token|api[_-]?key|secret|password|pwd|auth|access[_-]?token|session[_-]?id)=)[^&\s"'<>]+/gi;

// 25. Full Street Addresses / Work Locations
const ADDRESS_REGEX = /\b((?:work\s*location|office\s*location|reporting\s*location|residential\s*address|home\s*address|personal\s*address|delivery\s*address|shipping\s*address|billing\s*address|street\s*address|permanent\s*address|current\s*address|postal\s*address|physical\s*address|(?<!(?:email|e-mail|ip|mac|web)\s*)address)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([^\r\n;]{4,120})/gi;

// 26. Postal / PIN Codes when strongly associated with an address
const POSTAL_PIN_REGEX = /\b((?:pin(?:\s*code)?|postal(?:\s*code)?|zip(?:\s*code)?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d{5,6}(?:-\d{4})?)\b/gi;

// 27. Date of Birth & Sensitive Personal Dates
const DOB_REGEX = /\b((?:dob|date\s*of\s*birth|birth\s*date|born\s*on)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+\w+,?\s+\d{4})\b/gi;
const SENSITIVE_DATE_REGEX = /\b((?:joining\s*date|start\s*date|date\s*of\s*joining|doj|employment\s*date|interview\s*date|appointment\s*date|contract\s*date|travel\s*date)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/gi;

// 28. Age when clearly tied to a person
const AGE_REGEX = /\b((?:age|years\s*old)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d{1,3}(?:\s*(?:years|yrs))?)\b/gi;

// 29. Person Names in sensitive contexts
const PERSON_NAME_REGEX = /\b((?:reporting\s*manager|manager|reporting\s*to|hr\s*business\s*partner|hrbp|hr\s*contact|hr\s*lead|hr\s*manager|supervisor|employee\s*name|emp\s*name|candidate\s*name|applicant\s*name|student\s*name|patient\s*name|customer\s*name|passenger\s*name|full\s*name|person\s*name|user\s*name|cardholder\s*name|account\s*holder(?:\s*name)?|name\s*of\s*(?:employee|candidate|patient|student|person|applicant))[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z][A-Za-z .'-,]{1,40})\b/gi;

// 30. Employee / Customer / User / Application / Student IDs
const EMPLOYEE_STUDENT_ID_REGEX = /\b((?:employee\s*(?:id|number|no|code|#)|emp\s*(?:id|no|number|code)|staff\s*(?:id|number|no|code)|intern\s*(?:id|number|no|code)|student\s*(?:id|number|no|usn|roll\s*(?:no|number))|roll\s*(?:no|number)|usn)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z0-9\/-]{3,30})\b/gi;
const CUSTOMER_USER_ID_REGEX = /\b((?:customer\s*(?:id|no|number|code)|cust\s*(?:id|no)|user\s*(?:id|no|code)|application\s*(?:id|no|number|ref|reference)|app\s*(?:id|no)|candidate\s*(?:id|no|number)|member\s*(?:id|no|number)|registration\s*no|reg\s*no|policy\s*(?:number|no|id)|case\s*(?:number|no|id))[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z0-9\/-]{3,30})\b/gi;

// M28: Local Generalized Contextual Identifier Regexes
// 1. Employee Identifier (e.g. Employee ID: NXT-INT-2609307, Staff ID, Staff Number, Associate ID, Worker ID, Badge ID, Employee Code)
const CONTEXTUAL_EMPLOYEE_ID_REGEX = /\b((?:employee\s*(?:id|number|no|code|#)|emp\s*(?:id|no|number|code)|staff\s*(?:id|number|no|code)|associate\s*(?:id|number|no|code)|worker\s*(?:id|no|number|code)|badge\s*(?:id|no|number|code)|intern\s*(?:id|number|no|code))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 2. Student Identifier (e.g. Student ID: STU-88219, Roll No: 42, Enrollment Number, Admission Number)
const CONTEXTUAL_STUDENT_ID_REGEX = /\b((?:student\s*(?:id|number|no|usn|roll\s*(?:no|number))|roll\s*(?:no|number)|usn|hall\s*ticket\s*(?:no|number)|scholar\s*(?:id|no)|enrollment\s*(?:no|number|id)|admission\s*(?:no|number|id))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 3. Account Identifier (e.g. Account No: 12345678, Account ID: ACC-92831)
const CONTEXTUAL_ACCOUNT_ID_REGEX = /\b((?:bank\s*account(?:\s*no|\s*number)?|account\s*(?:no|number|id)|customer\s*account|savings\s*account|current\s*account|acct\s*(?:no|number))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{4,40})\b/gi;

// 4. Application Identifier (e.g. Application Ref: APP-2026-9832, Application ID: APP-2026-1234, Application Number: APP/2026/18492)
const CONTEXTUAL_APPLICATION_ID_REGEX = /\b((?:application\s*(?:id|no|number|ref|reference)|app\s*(?:id|no|ref|reference)|candidate\s*(?:id|no|number))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 5. Transaction Identifier (e.g. Transaction ID: TXN-998812)
const CONTEXTUAL_TRANSACTION_ID_REGEX = /\b((?:transaction\s*(?:id|number|no|hash|ref|reference)|txn\s*(?:id|no)?)[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{4,40})\b/gi;

// 6. Reference Identifier (e.g. Reference No: REF-482910, Reference ID: REF-2026-9912, Internal ID, Project ID, Project Code, Client ID)
const CONTEXTUAL_REFERENCE_ID_REGEX = /\b((?:reference\s*(?:id|no|number|code)|ref\s*(?:id|no|number|code)|internal\s*(?:id|ref|reference)|project\s*(?:id|code)|client\s*(?:id|no|number))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 7. Order Identifier (e.g. Order ID: ORD-88129, Order Number: 45892173, Invoice Number: INV-98214 - distinct from order quantity)
const CONTEXTUAL_ORDER_ID_REGEX = /\b((?:order\s*#)[ \t]*|(?:order\s*(?:id|number|no|code|ref|reference)|invoice\s*(?:id|number|no|code|ref|reference))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b|qty\b|quantity\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 8. Booking Identifier (e.g. Booking Reference: BKG-9921, Reservation Number: RSV-112, PNR: 8492049182)
const CONTEXTUAL_BOOKING_ID_REGEX = /\b((?:booking\s*#|reservation\s*#)[ \t]*|(?:booking\s*(?:id|no|number|ref|reference)|reservation\s*(?:id|no|number|ref|reference)|pnr(?:\s*(?:no|number|code))?)[ \t]*[:=-][ \t]*|(?:pnr)[ \t]+)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 9. Ticket Identifier (e.g. Ticket #INC-48291, Ticket ID: TKT-1029, Ticket Number: TKT-92831)
const CONTEXTUAL_TICKET_ID_REGEX = /\b((?:ticket\s*(?:id|no|number|code)?\s*#)[ \t]*|(?:ticket\s*(?:id|no|number|code))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 10. Document Identifier (e.g. Document Number: DOC-9921, Registration Number: REG-4412, Registration No: REG-4412)
const CONTEXTUAL_DOCUMENT_ID_REGEX = /\b((?:document\s*(?:number|no|id)|doc\s*(?:number|no|id)|passport\s*(?:no|number)|license\s*(?:no|number)|registration\s*(?:number|no)|reg\s*no)[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\s\/-]{4,30})\b/gi;

// 11. Membership Identifier (e.g. Membership ID: MEM-00912, Membership Number, Member ID, Customer ID: CUST-928374, Customer Number)
const CONTEXTUAL_MEMBERSHIP_ID_REGEX = /\b((?:membership\s*(?:id|no|number)|member\s*(?:id|no|number)|customer\s*(?:id|no|number)|cust\s*(?:id|no))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 12. Government Identifier (e.g. Government ID: GOV-88219, National ID, Tax ID)
const CONTEXTUAL_GOVERNMENT_ID_REGEX = /\b((?:government\s*id|govt\s*id|national\s*id|tax\s*id|tin\s*no|voter\s*id(?:\s*no|\s*card)?)[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\/-]{5,30})\b/gi;

// 13. Other Contextual Identifiers (e.g. Case Number: CS-99120, Case ID: CS-99120, Policy Number: POL-339218, Claim Number, Tracking Number: TRK-9912, User ID, Login ID)
const CONTEXTUAL_OTHER_ID_REGEX = /\b((?:case\s*#|policy\s*#|claim\s*#)[ \t]*|(?:user\s*(?:id|no|code)|username|login\s*(?:id|username)|case\s*(?:number|no|id)|policy\s*(?:number|no|id)|claim\s*(?:number|no|id)|tracking\s*(?:number|no|id))[ \t]*[:=-][ \t]*)(?![\s]*(?:\[REDACTED|number\b|code\b|no\b|id\b))([A-Za-z0-9\-_\/.:]{3,40})\b/gi;

// 30b. Structured Generic Identifiers (Layer 1 deterministic)
const STUDENT_USN_STANDALONE_REGEX = /\b[1-4][A-Z]{2}\d{2}[A-Z]{2}\d{3}\b/g;
const GENERIC_ALPHANUMERIC_ID_REGEX = /\b(?:EMP|NXT|ST|CND|CUST|TKT|REF|ACC|MEM|POL|CASE|BOOK)[-_][A-Za-z0-9]{3,20}\b/g;

// 30c. Contextual Employment Timing & Location (Layer 3 Contextual Semantic)
const REPORTING_TIME_REGEX = /\b((?:reporting\s*time|shift\s*timing)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?|[^\r\n,;]{2,30})\b/gi;
const GENERIC_LOCATION_REGEX = /\b((?:location)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([^\r\n;]{3,80})/gi;

// 31. Booking / Ticket / PNR / Reference Numbers (associated with person)
const BOOKING_TICKET_REF_REGEX = /\b((?:booking\s*(?:id|no|number|ref|reference)|ticket\s*(?:id|no|number)|pnr(?:\s*(?:no|number|code))?|reference\s*(?:id|no|number))[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z0-9\-]{4,25})\b/gi;

// 32. Salary / Stipend / Compensation information
const SALARY_STIPEND_REGEX = /\b((?:monthly\s*stipend|stipend|salary|monthly\s*salary|annual\s*salary|ctc|compensation|remuneration|wage|gross\s*pay|net\s*pay|base\s*pay|pay\s*package)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)((?:₹|Rs\.?|INR|\$|€|£)?[ \t]*[\d,]+(?:\.\d{1,2})?(?:[ \t]*(?:per\s*month|\/month|pm|p\.m\.|per\s*annum|\/year|pa|p\.a\.|lpa|k|lakhs?))?)\b/gi;

// 33. Tax & Financial Information
const TAX_FINANCIAL_REGEX = /\b((?:tax\s*(?:amount|paid|deducted|return)|tds(?:\s*amount)?|gross\s*income|net\s*income|annual\s*income|taxable\s*income|net\s*salary|gross\s*salary)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)((?:₹|Rs\.?|INR|\$|€|£)?[ \t]*[\d,]+(?:\.\d{1,2})?)\b/gi;

// 34. Emergency Contact Information
const EMERGENCY_CONTACT_REGEX = /\b((?:emergency\s*contact(?:\s*(?:name|number|phone|person|relation|details))?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([^\r\n,;]{3,60})\b/gi;
const EMERGENCY_CONTACT_STANDALONE_REGEX = /\bEmergency\s*contact(?:\s*information|\s*details)?\b/gi;

// 35. Medical / Health Information
const MEDICAL_DIAGNOSIS_REGEX = /\b((?:diagnosis|medical\s*condition|blood\s*group|health\s*record|prescription|treatment|medical\s*history)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([^\r\n,;]{2,50})\b/gi;
const MEDICAL_ID_REGEX = /\b((?:medical\s*record(?:\s*number)?|mrn|patient\s*id|health\s*insurance(?:\s*id|\s*number)?|policy\s*number|prescription\s*(?:id|no)|rx\s*number)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z0-9\-]{4,20})\b/gi;

// 36. Educational Records with PII
const EDUCATION_RECORD_REGEX = /\b((?:gpa|cgpa|marks\s*obtained|roll\s*(?:no|number)|hall\s*ticket(?:\s*no)?)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([^\r\n,;]{1,30})\b/gi;

// 37. Resume/CV Personal Identifiers (Handled via Person Name, Phone, Email, Address, Education identifiers)

// 38. Sensitive Document References & Exposed Document Numbers
const STANDALONE_DOC_REFERENCES = [
  { pattern: /\bPAN\s*Card\b/gi, replacement: "[REDACTED_DOCUMENT]" },
  { pattern: /\b(?:Aadhaar|Adhaar)\s*Card\b/gi, replacement: "[REDACTED_DOCUMENT]" },
  { pattern: /\bPassport\s*(?:Card|Document|Copy)\b/gi, replacement: "[REDACTED_DOCUMENT]" },
  { pattern: /\bBank\s*account\s*details\b/gi, replacement: "[REDACTED_FINANCIAL]" }
];
const SENSITIVE_DOC_NUMBER_REGEX = /\b((?:pan\s*card|aadhaar\s*card|adhaar\s*card|passport\s*copy|identity\s*card|voter\s*id\s*card)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([A-Za-z0-9\s\/-]{5,25})\b/gi;

// 39. Security Questions & Answers
const SECURITY_QA_REGEX = /\b((?:security\s*question|security\s*answer|mother'?s?\s*maiden\s*name|favorite\s*pet|first\s*school)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([^\r\n,;]+)\b/gi;

// 40. Other Clearly Identifiable Credentials
const OTHER_CREDENTIALS_REGEX = /\b((?:auth_secret|private_key_data)[ \t]*[:=-][ \t]*)(?![\s]*\[REDACTED)([^\s\r\n,;]{8,})\b/gi;

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
 * Protects: Quantity, Page numbers, Versions, Steps, Prices, Year, Non-sensitive phrases.
 */
const EXEMPTION_PATTERNS = [
  /\b(?:order\s+quantity|quantity|qty|count)[\s:=]+\d+\b/gi,
  /\b(?:page)[\s:=]+\d+(?:\s+of\s+\d+)?\b/gi,
  /\b(?:version|ver|v)[\s:=]+\d+(?:\.\d+)*\b/gi,
  /\b(?:step)[\s:=]+\d+\b/gi,
  /\b(?:chapter)[\s:=]+\d+\b/gi,
  /\b(?:product\s*(?:id|code|no|number)?)[\s:=]+[A-Za-z0-9\-]+/gi,
  /\b(?:sku|item\s*(?:no|number|code))[\s:=]+[A-Za-z0-9\-]+/gi,
  /\b(?:meeting\s+at|starts?\s+at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi,
  /\b\d+\s+(?:attachments?|items?|files?|results?|records?)\b/gi,
  /(?:₹|Rs\.?|INR|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?/gi,
  /\b(?:price|cost|amount)[\s:=]+(?:₹|Rs\.?|INR|\$|€|£)?\s*[\d,]+(?:\.\d{1,2})?/gi,
  /\b(?:year|yr)[\s:=]+20\d{2}\b/gi,
  /\b(?:search\s*query|query)[\s:=]+[A-Za-z0-9_\-.]+/gi,
  /\bkey\s+features\b/gi,
  /\bsecret\s+of\s+success\b/gi,
  /\btoken\s+ring\b/gi
];

// =====================================================================
// CANONICAL TEXT REDACTION
// =====================================================================

/**
 * LAYER 3 — CONTEXTUAL SEMANTIC DETECTION
 * Evaluates text or page content for sensitive document context.
 * Increases sensitivity for attributes (e.g. Designation, Department, Location, Reporting Time)
 * when in employment/student/financial context while protecting everyday public text.
 *
 * @param {string} text - Raw or partially sanitized text
 * @returns {{ isEmploymentContext: boolean, isStudentContext: boolean, isBankingContext: boolean, empScore: number, stuScore: number, bankScore: number }}
 */
function detectDocumentContext(text) {
  if (!text || typeof text !== "string") {
    return { isEmploymentContext: false, isStudentContext: false, isBankingContext: false, empScore: 0, stuScore: 0, bankScore: 0 };
  }
  const lower = text.toLowerCase();

  const employmentKeywords = [
    "employment", "internship", "joining", "onboarding", "employee", "designation",
    "department", "reporting manager", "stipend", "salary", "compensation",
    "joining date", "work location", "reporting location", "reporting time",
    "offer letter", "hr business partner", "hrbp", "hr contact", "reporting to"
  ];
  let empHits = 0;
  for (const kw of employmentKeywords) {
    if (lower.includes(kw)) empHits++;
  }

  const studentKeywords = [
    "student", "college", "university", "campus", "hall ticket", "marks",
    "gpa", "cgpa", "semester", "usn", "roll no", "roll number"
  ];
  let stuHits = 0;
  for (const kw of studentKeywords) {
    if (lower.includes(kw)) stuHits++;
  }

  const bankKeywords = [
    "bank", "account number", "ifsc", "statement", "transaction", "credit card",
    "debit card", "balance", "transfer", "neft", "rtgs", "imps", "upi id"
  ];
  let bankHits = 0;
  for (const kw of bankKeywords) {
    if (lower.includes(kw)) bankHits++;
  }

  return {
    isEmploymentContext: empHits >= 2,
    isStudentContext: stuHits >= 2,
    isBankingContext: bankHits >= 2,
    empScore: empHits,
    stuScore: stuHits,
    bankScore: bankHits
  };
}

/**
 * Scans a string and replaces sensitive personal, financial, authentication,
 * government, medical, and software credential information with standardized placeholders.
 *
 * Uses multi-stage context-aware replacement with false-positive protection.
 *
 * @param {string} text - Raw input text from webpage, DOM, or OCR
 * @param {Object} [options] - Optional contextual parameters (e.g. { contextText })
 * @returns {string} - Sanitized text with sensitive values completely removed
 */
function redactText(text, options = {}) {
  if (!text || typeof text !== "string") {
    return "";
  }

  try {
    // Combine options.contextText if passed from caller (e.g. content.js DOM extraction)
  const fullContextText = options && typeof options.contextText === "string"
    ? `${text} ${options.contextText}`
    : text;

  const docContext = detectDocumentContext(fullContextText);

  // Stage 1: Temporarily protect exempt non-sensitive spans (Orders, Prices, Years, etc.)
  const exemptions = [];
  let maskedText = text;

  EXEMPTION_PATTERNS.forEach((pattern) => {
    maskedText = maskedText.replace(pattern, (match, offset, fullStr) => {
      // Check surrounding context: If preceded by sensitive label (salary, stipend, joining date, etc.), DO NOT EXEMPT!
      const preContext = fullStr.slice(Math.max(0, offset - 40), offset).toLowerCase();
      if (/salary|stipend|compensation|wage|remuneration|ctc|income|pay|bonus|allowance|tax|tds/i.test(preContext)) {
        return match;
      }
      if (/joining|start\s*date|birth|dob|employee|staff|student|intern|candidate|customer|member|account|manager|reporting|hrbp|location/i.test(preContext)) {
        return match;
      }
      if (match.includes("__IRIS_EXEMPT_")) {
        return match;
      }
      const token = `__IRIS_EXEMPT_${exemptions.length}__`;
      exemptions.push({ token, original: match });
      return token;
    });
  });

  // Stage 2: Software Secrets, API Keys & Private Keys (Categories 16, 17, 18, 19, 20, 21, 24, 40)
  maskedText = maskedText.replace(PRIVATE_KEY_REGEX, "[REDACTED_PRIVATE_KEY]");
  maskedText = maskedText.replace(JWT_REGEX, "[REDACTED_JWT]");
  maskedText = maskedText.replace(BEARER_TOKEN_REGEX, "$1[REDACTED_TOKEN]");
  maskedText = maskedText.replace(API_KEY_PREFIX_REGEX, "[REDACTED_API_KEY]");
  maskedText = maskedText.replace(API_KEY_CONTEXT_REGEX, "$1[REDACTED_API_KEY]$3");
  maskedText = maskedText.replace(ACCESS_TOKEN_REGEX, "$1[REDACTED_TOKEN]$3");
  maskedText = maskedText.replace(SECRET_KEY_REGEX, "$1[REDACTED_SECRET]$3");
  maskedText = maskedText.replace(ENV_SECRET_REGEX, "$1[REDACTED_SECRET]$3");
  maskedText = maskedText.replace(SESSION_COOKIE_REGEX, "$1[REDACTED_CREDENTIAL]$3");
  maskedText = maskedText.replace(SENSITIVE_URL_PARAM_REGEX, "$1[REDACTED_CREDENTIAL]");
  maskedText = maskedText.replace(SECURITY_QA_REGEX, "$1[REDACTED_CREDENTIAL]");
  maskedText = maskedText.replace(OTHER_CREDENTIALS_REGEX, "$1[REDACTED_CREDENTIAL]");

  // Stage 3: Authentication & Credentials (Categories 3, 4, 5)
  maskedText = maskedText.replace(PASSWORD_REGEX, "$1[REDACTED_PASSWORD]");
  maskedText = maskedText.replace(OTP_REGEX, "$1[REDACTED_OTP]");
  maskedText = maskedText.replace(PIN_REGEX, "$1[REDACTED_PASSWORD]");
  maskedText = maskedText.replace(CREDENTIAL_USER_REGEX, "$1[REDACTED_CREDENTIAL]");

  // Stage 4: Payment Information (Categories 6, 7)
  maskedText = maskedText.replace(CVV_REGEX, "$1[REDACTED_CVV]");
  maskedText = maskedText.replace(CARD_EXP_REGEX, "$1[REDACTED_CARD_EXP]");
  maskedText = maskedText.replace(CREDIT_CARD_CONTEXT_REGEX, "$1[REDACTED_CARD]");

  maskedText = maskedText.replace(CREDIT_CARD_GROUPED_REGEX, (match) => {
    const digitsOnly = match.replace(/[\s-]/g, "");
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      if (luhnCheck(digitsOnly) || digitsOnly.length === 16) {
        return "[REDACTED_CARD]";
      }
    }
    return match;
  });

  // Stage 5: Email & Contextual Phone Information (Categories 1, 2)
  maskedText = maskedText.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
  maskedText = maskedText.replace(PHONE_CONTEXT_REGEX, "$1[REDACTED_PHONE]");

  // Stage 6: Banking, Financial & Compensation Information (Categories 8, 9, 10, 32, 33)
  maskedText = maskedText.replace(SALARY_STIPEND_REGEX, "$1[REDACTED_FINANCIAL]");
  maskedText = maskedText.replace(TAX_FINANCIAL_REGEX, "$1[REDACTED_FINANCIAL]");
  maskedText = maskedText.replace(BANK_ACCOUNT_REGEX, "$1[REDACTED_BANK_ACCOUNT]");
  maskedText = maskedText.replace(IFSC_REGEX, "$1[REDACTED_IFSC]");
  maskedText = maskedText.replace(SWIFT_BIC_REGEX, "[REDACTED_BANK_ACCOUNT]");
  maskedText = maskedText.replace(ROUTING_SORT_REGEX, "$1[REDACTED_BANK_ACCOUNT]");
  maskedText = maskedText.replace(UPI_HANDLE_REGEX, "[REDACTED_UPI]");
  maskedText = maskedText.replace(UPI_CONTEXT_REGEX, "$1[REDACTED_UPI]");
  maskedText = maskedText.replace(IBAN_REGEX, (match) => {
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(match)) {
      return "[REDACTED_BANK_ACCOUNT]";
    }
    return match;
  });
  maskedText = maskedText.replace(TRANSACTION_ID_REGEX, "$1[REDACTED_FINANCIAL]");
  maskedText = maskedText.replace(TRANSACTION_STANDALONE_REGEX, "[REDACTED_FINANCIAL]");

  // Stage 7: Government, Identity & Document References (Categories 11, 12, 13, 14, 15, 30, 31, 38)
  maskedText = maskedText.replace(SENSITIVE_DOC_NUMBER_REGEX, "$1[REDACTED_DOCUMENT]");
  STANDALONE_DOC_REFERENCES.forEach(({ pattern, replacement }) => {
    maskedText = maskedText.replace(pattern, replacement);
  });
  maskedText = maskedText.replace(AADHAAR_CONTEXT_REGEX, "$1[REDACTED_AADHAAR]");
  maskedText = maskedText.replace(AADHAAR_STANDALONE_REGEX, "[REDACTED_AADHAAR]");
  maskedText = maskedText.replace(PAN_REGEX, "$1[REDACTED_PAN]");
  maskedText = maskedText.replace(PASSPORT_REGEX, "$1[REDACTED_PASSPORT]");
  maskedText = maskedText.replace(DRIVERS_LICENSE_REGEX, "$1[REDACTED_ID]");
  maskedText = maskedText.replace(SSN_REGEX, (match, prefix) => {
    return prefix ? `${prefix}[REDACTED_ID]` : "[REDACTED_ID]";
  });

  // M28: Specific Contextual Identifiers
  maskedText = maskedText.replace(CONTEXTUAL_EMPLOYEE_ID_REGEX, "$1[REDACTED_EMPLOYEE_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_STUDENT_ID_REGEX, "$1[REDACTED_IDENTIFIER]");
  maskedText = maskedText.replace(CONTEXTUAL_ACCOUNT_ID_REGEX, "$1[REDACTED_ACCOUNT_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_APPLICATION_ID_REGEX, "$1[REDACTED_APPLICATION_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_TRANSACTION_ID_REGEX, "$1[REDACTED_TRANSACTION_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_REFERENCE_ID_REGEX, "$1[REDACTED_REFERENCE_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_ORDER_ID_REGEX, "$1[REDACTED_ORDER_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_BOOKING_ID_REGEX, "$1[REDACTED_BOOKING_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_TICKET_ID_REGEX, "$1[REDACTED_TICKET_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_DOCUMENT_ID_REGEX, "$1[REDACTED_DOCUMENT_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_MEMBERSHIP_ID_REGEX, "$1[REDACTED_MEMBERSHIP_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_GOVERNMENT_ID_REGEX, "$1[REDACTED_GOVERNMENT_ID]");
  maskedText = maskedText.replace(CONTEXTUAL_OTHER_ID_REGEX, "$1[REDACTED_CONTEXTUAL_ID]");

  maskedText = maskedText.replace(EMPLOYEE_STUDENT_ID_REGEX, (match, prefix, idVal) => {
    if (/employee|staff|intern|emp\b/i.test(prefix)) {
      return `${prefix}[REDACTED_EMPLOYEE_ID]`;
    }
    return `${prefix}[REDACTED_IDENTIFIER]`;
  });
  maskedText = maskedText.replace(CUSTOMER_USER_ID_REGEX, "$1[REDACTED_IDENTIFIER]");
  maskedText = maskedText.replace(BOOKING_TICKET_REF_REGEX, "$1[REDACTED_IDENTIFIER]");
  maskedText = maskedText.replace(NATIONAL_ID_REGEX, "$1[REDACTED_ID]");
  maskedText = maskedText.replace(STUDENT_USN_STANDALONE_REGEX, "[REDACTED_IDENTIFIER]");
  maskedText = maskedText.replace(GENERIC_ALPHANUMERIC_ID_REGEX, "[REDACTED_IDENTIFIER]");

  // Standalone unlabelled phone numbers
  maskedText = maskedText.replace(PHONE_INTL_REGEX, (match) => {
    const digitsOnly = match.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return "[REDACTED_PHONE]";
    }
    return match;
  });

  // Stage 8: Personal Identification, Names, Dates & Location (Categories 25, 26, 27, 28, 29, 34)
  maskedText = maskedText.replace(PERSON_NAME_REGEX, "$1[REDACTED_PERSON]");
  maskedText = maskedText.replace(AGE_REGEX, "$1[REDACTED_PERSON]");
  maskedText = maskedText.replace(DOB_REGEX, "$1[REDACTED_DATE]");
  maskedText = maskedText.replace(SENSITIVE_DATE_REGEX, "$1[REDACTED_DATE]");
  maskedText = maskedText.replace(ADDRESS_REGEX, (match, prefix) => {
    return `${prefix}[REDACTED_LOCATION]`;
  });
  maskedText = maskedText.replace(POSTAL_PIN_REGEX, "$1[REDACTED_LOCATION]");
  maskedText = maskedText.replace(EMERGENCY_CONTACT_REGEX, "$1[REDACTED_CONTACT]");
  maskedText = maskedText.replace(EMERGENCY_CONTACT_STANDALONE_REGEX, "[REDACTED_CONTACT]");

  // Contextual Employment Timing & Location (Layer 3 Contextual Semantic)
  if (docContext.isEmploymentContext || /employee|joining|reporting|hrbp|staff|intern|candidate/i.test(fullContextText)) {
    maskedText = maskedText.replace(REPORTING_TIME_REGEX, "$1[REDACTED_TIME]");
    maskedText = maskedText.replace(GENERIC_LOCATION_REGEX, "$1[REDACTED_LOCATION]");
  }

  // Stage 9: Health & Medical Information (Category 35)
  maskedText = maskedText.replace(MEDICAL_DIAGNOSIS_REGEX, "$1[REDACTED_DOCUMENT]");
  maskedText = maskedText.replace(MEDICAL_ID_REGEX, "$1[REDACTED_MEDICAL_ID]");

  // Stage 10: Education Records (Category 36)
  maskedText = maskedText.replace(EDUCATION_RECORD_REGEX, "$1[REDACTED_IDENTIFIER]");

  // Stage 11: Technical Machine Identifiers (Categories 22, 23)
  maskedText = maskedText.replace(MAC_ADDRESS_REGEX, "[REDACTED_IDENTIFIER]");
  maskedText = maskedText.replace(IP_CONTEXT_REGEX, "$1[REDACTED_IDENTIFIER]");
  maskedText = maskedText.replace(IP_STANDALONE_REGEX, "[REDACTED_IDENTIFIER]");

    // Stage 12: Restore exempt non-sensitive spans
    let restorePass = 0;
    while (maskedText.includes("__IRIS_EXEMPT_") && restorePass < 5) {
      restorePass++;
      exemptions.slice().reverse().forEach(({ token, original }) => {
        maskedText = maskedText.split(token).join(original);
      });
    }

    return maskedText;
  } catch (err) {
    console.warn("[IRIS Privacy] Redaction processing failed; sanitized fallback applied.", err);
    return "[REDACTED_PAGE_CONTENT]";
  }
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

  try {
    const redacted = redactText(value);
    const detected = redacted !== value;

    const categories = [];
    if (detected) {
      if (redacted.includes("[REDACTED_EMAIL]")) categories.push("EMAIL");
      if (redacted.includes("[REDACTED_PHONE]")) categories.push("PHONE");
      if (redacted.includes("[REDACTED_PASSWORD]") || redacted.includes("[REDACTED_OTP]")) categories.push("PASSWORD");
      if (redacted.includes("[REDACTED_CARD]") || redacted.includes("[REDACTED_CVV]") || redacted.includes("[REDACTED_CARD_EXP]")) categories.push("CARD");
      if (redacted.includes("[REDACTED_BANK_ACCOUNT]") || redacted.includes("[REDACTED_IFSC]") || redacted.includes("[REDACTED_UPI]") || redacted.includes("[REDACTED_FINANCIAL]")) categories.push("BANK");
      if (redacted.includes("[REDACTED_AADHAAR]") || redacted.includes("[REDACTED_PAN]") || redacted.includes("[REDACTED_PASSPORT]") || redacted.includes("[REDACTED_ID]") || redacted.includes("[REDACTED_DOCUMENT]") || redacted.includes("[REDACTED_IDENTIFIER]") || redacted.includes("[REDACTED_EMPLOYEE_ID]")) categories.push("IDENTITY");
      if (redacted.includes("[REDACTED_TOKEN]") || redacted.includes("[REDACTED_JWT]") || redacted.includes("[REDACTED_API_KEY]") || redacted.includes("[REDACTED_SECRET]") || redacted.includes("[REDACTED_PRIVATE_KEY]") || redacted.includes("[REDACTED_CREDENTIAL]")) categories.push("CREDENTIAL");
      if (redacted.includes("[REDACTED_DOB]") || redacted.includes("[REDACTED_DATE]") || redacted.includes("[REDACTED_ADDRESS]") || redacted.includes("[REDACTED_LOCATION]") || redacted.includes("[REDACTED_TIME]") || redacted.includes("[REDACTED_CONTACT]") || redacted.includes("[REDACTED_PERSON]") || redacted.includes("[REDACTED_PERSONAL]")) categories.push("PERSONAL");
      if (redacted.includes("[REDACTED_MEDICAL_ID]")) categories.push("HEALTH");

      // M28: Specific Contextual Identifier Categories
      if (redacted.includes("[REDACTED_EMPLOYEE_ID]")) {
        categories.push("EMPLOYEE_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_STUDENT_ID]")) {
        categories.push("STUDENT_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_ACCOUNT_ID]")) {
        categories.push("ACCOUNT_IDENTIFIER");
        if (!categories.includes("BANK")) categories.push("BANK");
      }
      if (redacted.includes("[REDACTED_APPLICATION_ID]")) {
        categories.push("APPLICATION_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_TRANSACTION_ID]")) {
        categories.push("TRANSACTION_IDENTIFIER");
        if (!categories.includes("BANK")) categories.push("BANK");
      }
      if (redacted.includes("[REDACTED_REFERENCE_ID]")) {
        categories.push("REFERENCE_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_ORDER_ID]")) {
        categories.push("ORDER_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_BOOKING_ID]")) {
        categories.push("BOOKING_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_TICKET_ID]")) {
        categories.push("TICKET_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_DOCUMENT_ID]")) {
        categories.push("DOCUMENT_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_MEMBERSHIP_ID]")) {
        categories.push("MEMBERSHIP_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_GOVERNMENT_ID]")) {
        categories.push("GOVERNMENT_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
      if (redacted.includes("[REDACTED_CONTEXTUAL_ID]")) {
        categories.push("OTHER_CONTEXTUAL_IDENTIFIER");
        if (!categories.includes("IDENTITY")) categories.push("IDENTITY");
      }
    }

    return {
      detected,
      redacted,
      categories
    };
  } catch (err) {
    console.warn("[IRIS Privacy] Redaction processing failed; sanitized fallback applied.", err);
    return { detected: true, redacted: "[REDACTED]", categories: ["PERSONAL"] };
  }
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
    HEALTH: 0,
    EMPLOYEE_IDENTIFIER: 0,
    STUDENT_IDENTIFIER: 0,
    ACCOUNT_IDENTIFIER: 0,
    APPLICATION_IDENTIFIER: 0,
    TRANSACTION_IDENTIFIER: 0,
    REFERENCE_IDENTIFIER: 0,
    ORDER_IDENTIFIER: 0,
    BOOKING_IDENTIFIER: 0,
    TICKET_IDENTIFIER: 0,
    DOCUMENT_IDENTIFIER: 0,
    MEMBERSHIP_IDENTIFIER: 0,
    GOVERNMENT_IDENTIFIER: 0,
    OTHER_CONTEXTUAL_IDENTIFIER: 0
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
  counts.BANK += countOccurrences("[REDACTED_BANK_ACCOUNT]") + countOccurrences("[REDACTED_IFSC]") + countOccurrences("[REDACTED_UPI]") + countOccurrences("[REDACTED_FINANCIAL]") + countOccurrences("[REDACTED_ACCOUNT_ID]") + countOccurrences("[REDACTED_TRANSACTION_ID]");
  counts.CREDENTIAL += countOccurrences("[REDACTED_TOKEN]") + countOccurrences("[REDACTED_JWT]") + countOccurrences("[REDACTED_API_KEY]") + countOccurrences("[REDACTED_SECRET]") + countOccurrences("[REDACTED_PRIVATE_KEY]") + countOccurrences("[REDACTED_CREDENTIAL]");
  counts.IDENTITY += countOccurrences("[REDACTED_AADHAAR]") + countOccurrences("[REDACTED_PAN]") + countOccurrences("[REDACTED_PASSPORT]") + countOccurrences("[REDACTED_ID]") + countOccurrences("[REDACTED_DOCUMENT]") + countOccurrences("[REDACTED_IDENTIFIER]") + countOccurrences("[REDACTED_EMPLOYEE_ID]") + countOccurrences("[REDACTED_STUDENT_ID]") + countOccurrences("[REDACTED_APPLICATION_ID]") + countOccurrences("[REDACTED_REFERENCE_ID]") + countOccurrences("[REDACTED_ORDER_ID]") + countOccurrences("[REDACTED_BOOKING_ID]") + countOccurrences("[REDACTED_TICKET_ID]") + countOccurrences("[REDACTED_DOCUMENT_ID]") + countOccurrences("[REDACTED_MEMBERSHIP_ID]") + countOccurrences("[REDACTED_GOVERNMENT_ID]") + countOccurrences("[REDACTED_CONTEXTUAL_ID]");
  counts.PERSONAL += countOccurrences("[REDACTED_DOB]") + countOccurrences("[REDACTED_DATE]") + countOccurrences("[REDACTED_ADDRESS]") + countOccurrences("[REDACTED_LOCATION]") + countOccurrences("[REDACTED_TIME]") + countOccurrences("[REDACTED_CONTACT]") + countOccurrences("[REDACTED_PERSON]") + countOccurrences("[REDACTED_PERSONAL]");
  counts.HEALTH += countOccurrences("[REDACTED_MEDICAL_ID]");

  // Contextual counts
  counts.EMPLOYEE_IDENTIFIER += countOccurrences("[REDACTED_EMPLOYEE_ID]");
  counts.STUDENT_IDENTIFIER += countOccurrences("[REDACTED_STUDENT_ID]");
  counts.ACCOUNT_IDENTIFIER += countOccurrences("[REDACTED_ACCOUNT_ID]");
  counts.APPLICATION_IDENTIFIER += countOccurrences("[REDACTED_APPLICATION_ID]");
  counts.TRANSACTION_IDENTIFIER += countOccurrences("[REDACTED_TRANSACTION_ID]");
  counts.REFERENCE_IDENTIFIER += countOccurrences("[REDACTED_REFERENCE_ID]");
  counts.ORDER_IDENTIFIER += countOccurrences("[REDACTED_ORDER_ID]");
  counts.BOOKING_IDENTIFIER += countOccurrences("[REDACTED_BOOKING_ID]");
  counts.TICKET_IDENTIFIER += countOccurrences("[REDACTED_TICKET_ID]");
  counts.DOCUMENT_IDENTIFIER += countOccurrences("[REDACTED_DOCUMENT_ID]");
  counts.MEMBERSHIP_IDENTIFIER += countOccurrences("[REDACTED_MEMBERSHIP_ID]");
  counts.GOVERNMENT_IDENTIFIER += countOccurrences("[REDACTED_GOVERNMENT_ID]");
  counts.OTHER_CONTEXTUAL_IDENTIFIER += countOccurrences("[REDACTED_CONTEXTUAL_ID]");

  return counts;
}

/**
 * M28: Scans text locally and returns structured sensitive spans.
 * Used for precise DOM Range bounding box calculation and OCR line-level correlation.
 *
 * @param {string} text - Raw local text to inspect
 * @returns {Array<{ label: string, value: string, category: string, start: number, end: number, valueStart: number, valueEnd: number }>}
 */
function detectContextualSensitiveSpans(text) {
  if (!text || typeof text !== "string") return [];
  const spans = [];
  const patterns = [
    { regex: CONTEXTUAL_EMPLOYEE_ID_REGEX, category: "EMPLOYEE_IDENTIFIER" },
    { regex: CONTEXTUAL_STUDENT_ID_REGEX, category: "STUDENT_IDENTIFIER" },
    { regex: CONTEXTUAL_ACCOUNT_ID_REGEX, category: "ACCOUNT_IDENTIFIER" },
    { regex: CONTEXTUAL_APPLICATION_ID_REGEX, category: "APPLICATION_IDENTIFIER" },
    { regex: CONTEXTUAL_TRANSACTION_ID_REGEX, category: "TRANSACTION_IDENTIFIER" },
    { regex: CONTEXTUAL_REFERENCE_ID_REGEX, category: "REFERENCE_IDENTIFIER" },
    { regex: CONTEXTUAL_ORDER_ID_REGEX, category: "ORDER_IDENTIFIER" },
    { regex: CONTEXTUAL_BOOKING_ID_REGEX, category: "BOOKING_IDENTIFIER" },
    { regex: CONTEXTUAL_TICKET_ID_REGEX, category: "TICKET_IDENTIFIER" },
    { regex: CONTEXTUAL_DOCUMENT_ID_REGEX, category: "DOCUMENT_IDENTIFIER" },
    { regex: CONTEXTUAL_MEMBERSHIP_ID_REGEX, category: "MEMBERSHIP_IDENTIFIER" },
    { regex: CONTEXTUAL_GOVERNMENT_ID_REGEX, category: "GOVERNMENT_IDENTIFIER" },
    { regex: CONTEXTUAL_OTHER_ID_REGEX, category: "OTHER_CONTEXTUAL_IDENTIFIER" }
  ];

  for (const { regex, category } of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const prefix = match[1] || "";
      const val = match[2] || fullMatch;
      const valStart = match.index + prefix.length;
      const valEnd = valStart + val.length;
      spans.push({
        label: prefix.replace(/[:*#_\-\/\\]+$/, "").trim(),
        value: val,
        category: category,
        start: match.index,
        end: match.index + fullMatch.length,
        valueStart: valStart,
        valueEnd: valEnd
      });
    }
  }
  return spans;
}

/**
 * Creates a unified local SensitiveSpan representation (Part 13).
 * Raw value remains strictly local; value_or_hash is hashed, and context is sanitized.
 *
 * @param {Object} options
 * @param {string} options.category
 * @param {string} [options.value]
 * @param {string} [options.source="DOM"] - "DOM" | "OCR" | "BOTH"
 * @param {number} [options.confidence=0.95]
 * @param {Object} [options.bbox=null]
 * @param {string} [options.context=""]
 * @returns {{ category: string, value_or_hash: string, source: string, confidence: number, bbox: Object|null, context: string }}
 */
function createSensitiveSpan({ category, value, source = "DOM", confidence = 0.95, bbox = null, context = "" }) {
  let hash = "";
  if (value && typeof value === "string") {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
      h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
    }
    hash = `hash_${Math.abs(h).toString(16)}`;
  }
  return {
    category: category || "SENSITIVE_IDENTIFIER",
    value_or_hash: hash,
    source: source || "DOM",
    confidence: typeof confidence === "number" ? confidence : 0.95,
    bbox: bbox || null,
    context: context ? redactText(context) : ""
  };
}

// =====================================================================
// PRE-FLIGHT PRIVACY VERIFICATION GATE
// =====================================================================

function testPattern(regex, str) {
  if (!regex || typeof str !== "string") return false;
  regex.lastIndex = 0;
  return regex.test(str);
}

/**
 * CRITICAL PRIVACY GATE:
 * Inspects a final outgoing payload (object, array, or string) before transmission to /api/context.
 * Verifies that all raw sensitive information has been redacted and NO unredacted
 * sensitive data remains.
 *
 * Explicitly verifies the 11 critical privacy invariants:
 * 1. raw email values absent
 * 2. raw phone values absent
 * 3. raw passwords absent
 * 4. raw OTP values absent
 * 5. raw card values absent
 * 6. raw Aadhaar/PAN values absent
 * 7. raw bank information absent
 * 8. raw addresses absent where detected
 * 9. raw employee/customer identifiers absent where detected
 * 10. raw sensitive OCR strings absent
 * 11. raw sensitive DOM strings absent
 *
 * If sensitive content is detected:
 * Returns { valid: false, violations: [...], reason: "..." }
 *
 * @param {any} payload - Outgoing payload to inspect
 * @returns {{ valid: boolean, violations: string[], reason: string }}
 */
function verifySanitizedPayload(payload) {
  const violations = [];
  if (payload === null || payload === undefined) {
    return { valid: true, violations: [], reason: "" };
  }

  // Extract all text strings across the payload
  const stringEntries = [];
  function collect(node, path = "payload") {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      stringEntries.push({ path, text: node });
    } else if (Array.isArray(node)) {
      node.forEach((item, idx) => collect(item, `${path}[${idx}]`));
    } else if (typeof node === "object") {
      if (typeof Blob !== "undefined" && node instanceof Blob) return;
      for (const k of Object.keys(node)) {
        if (["sanitizedScreenshot", "bounds", "x", "y", "width", "height", "timestamp", "requestId", "fieldId", "elementCount", "loopStep", "totalPlannedSteps"].includes(k)) {
          continue;
        }
        collect(node[k], `${path}.${k}`);
      }
    }
  }

  collect(payload);

  for (const { path, text } of stringEntries) {
    if (!text || typeof text !== "string") continue;

    // Check 1: Raw email values absent
    EMAIL_REGEX.lastIndex = 0;
    const emailMatches = text.match(EMAIL_REGEX);
    if (emailMatches && emailMatches.some(m => !m.includes("[REDACTED_"))) {
      violations.push(`Raw email detected at ${path}`);
    }

    // Check 2: Raw phone values absent (contextual or international)
    if (testPattern(PHONE_CONTEXT_REGEX, text)) {
      violations.push(`Raw phone number detected at ${path}`);
    }

    // Check 3: Raw passwords absent
    if (testPattern(PASSWORD_REGEX, text)) {
      violations.push(`Raw password detected at ${path}`);
    }

    // Check 4: Raw OTP values absent
    if (testPattern(OTP_REGEX, text)) {
      violations.push(`Raw OTP code detected at ${path}`);
    }

    // Check 5: Raw card values absent
    CREDIT_CARD_GROUPED_REGEX.lastIndex = 0;
    const cardMatches = text.match(CREDIT_CARD_GROUPED_REGEX);
    if (cardMatches && cardMatches.some(m => luhnCheck(m) || m.replace(/\D/g, "").length === 16)) {
      violations.push(`Raw credit/debit card detected at ${path}`);
    }
    if (testPattern(CVV_REGEX, text)) {
      violations.push(`Raw card CVV detected at ${path}`);
    }

    // Check 6: Raw Aadhaar/PAN values absent
    if (testPattern(AADHAAR_CONTEXT_REGEX, text)) {
      violations.push(`Raw Aadhaar number detected at ${path}`);
    }
    PAN_REGEX.lastIndex = 0;
    const panMatches = text.match(PAN_REGEX);
    if (panMatches && panMatches.some(m => !m.includes("[REDACTED_"))) {
      violations.push(`Raw PAN identifier detected at ${path}`);
    }

    // Check 7: Raw bank information absent
    if (testPattern(BANK_ACCOUNT_REGEX, text) || testPattern(UPI_CONTEXT_REGEX, text)) {
      violations.push(`Raw bank account/payment handle detected at ${path}`);
    }

    // Check 8: Raw addresses absent where detected
    if (testPattern(ADDRESS_REGEX, text) || testPattern(GENERIC_LOCATION_REGEX, text)) {
      violations.push(`Raw address/location detected at ${path}`);
    }

    // Check 9: Raw employee/customer/contextual identifiers absent where detected
    if (testPattern(CONTEXTUAL_EMPLOYEE_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_STUDENT_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_ACCOUNT_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_APPLICATION_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_TRANSACTION_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_REFERENCE_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_ORDER_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_BOOKING_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_TICKET_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_DOCUMENT_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_MEMBERSHIP_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_GOVERNMENT_ID_REGEX, text) ||
        testPattern(CONTEXTUAL_OTHER_ID_REGEX, text) ||
        testPattern(EMPLOYEE_STUDENT_ID_REGEX, text) ||
        testPattern(CUSTOMER_USER_ID_REGEX, text) ||
        testPattern(GENERIC_ALPHANUMERIC_ID_REGEX, text)) {
      violations.push(`Raw employee/customer/contextual identifier detected at ${path}`);
    }

    // Check 9b: Raw personal names in sensitive contexts absent
    if (testPattern(PERSON_NAME_REGEX, text)) {
      violations.push(`Raw personal name detected at ${path}`);
    }

    // Check 9c: Raw sensitive dates absent
    if (testPattern(SENSITIVE_DATE_REGEX, text) || testPattern(DOB_REGEX, text)) {
      violations.push(`Raw sensitive date detected at ${path}`);
    }

    // Check 10 & 11: General sensitive OCR strings and DOM strings absent
    const check = detectAndRedactSensitiveValue(text);
    if (check.detected) {
      const cats = check.categories && check.categories.length > 0 ? check.categories.join(", ") : "SENSITIVE";
      const alreadyReported = violations.some(v => v.includes(path));
      if (!alreadyReported) {
        violations.push(`Raw sensitive string (${cats}) detected at ${path}`);
      }
    }
  }

  const valid = violations.length === 0;
  return {
    valid,
    violations,
    reason: valid ? "" : `Critical privacy gate blocked payload: ${violations.slice(0, 3).join("; ")}`
  };
}

// =====================================================================
// DOM INPUT METADATA EVALUATION
// =====================================================================

const SENSITIVE_INPUT_KEYWORDS = [
  "card", "credit", "debit", "cvv", "cvc", "cid", "ssn", "phone", "mobile",
  "password", "passwd", "pwd", "passcode", "email", "bank", "account",
  "iban", "ifsc", "swift", "routing", "aadhaar", "adhaar", "pan", "passport",
  "dob", "birth", "patient", "medical", "secret", "token", "api_key", "apikey",
  "otp", "pin", "auth", "credential", "salary", "stipend", "compensation",
  "address", "emergency", "license", "tax", "income", "employee_id", "emp_id"
];

const SENSITIVE_AUTOCOMPLETE_VALUES = [
  "current-password", "new-password", "one-time-code", "cc-number",
  "cc-csc", "cc-exp", "cc-exp-month", "cc-exp-year", "cc-type", "cc-name",
  "email", "tel", "bday", "bday-day", "bday-month", "bday-year",
  "street-address", "address-line1", "address-line2", "address-level1", "address-level2",
  "postal-code", "transaction-amount"
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
  window.verifySanitizedPayload = verifySanitizedPayload;
  window.luhnCheck = luhnCheck;
  window.detectDocumentContext = detectDocumentContext;
  window.detectContextualSensitiveSpans = detectContextualSensitiveSpans;
  window.createSensitiveSpan = createSensitiveSpan;
}

if (typeof globalThis !== "undefined") {
  globalThis.redactText = redactText;
  globalThis.detectAndRedactSensitiveValue = detectAndRedactSensitiveValue;
  globalThis.getCategoryCounts = getCategoryCounts;
  globalThis.isSensitiveInputMetadata = isSensitiveInputMetadata;
  globalThis.verifySanitizedPayload = verifySanitizedPayload;
  globalThis.luhnCheck = luhnCheck;
  globalThis.detectDocumentContext = detectDocumentContext;
  globalThis.detectContextualSensitiveSpans = detectContextualSensitiveSpans;
  globalThis.createSensitiveSpan = createSensitiveSpan;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    redactText,
    detectAndRedactSensitiveValue,
    getCategoryCounts,
    isSensitiveInputMetadata,
    verifySanitizedPayload,
    luhnCheck,
    detectDocumentContext,
    detectContextualSensitiveSpans,
    createSensitiveSpan,
    PASSWORD_REGEX,
    CREDIT_CARD_REGEX,
    PHONE_REGEX,
    EMAIL_REGEX,
    CONTEXTUAL_EMPLOYEE_ID_REGEX,
    CONTEXTUAL_STUDENT_ID_REGEX,
    CONTEXTUAL_ACCOUNT_ID_REGEX,
    CONTEXTUAL_APPLICATION_ID_REGEX,
    CONTEXTUAL_TRANSACTION_ID_REGEX,
    CONTEXTUAL_REFERENCE_ID_REGEX,
    CONTEXTUAL_ORDER_ID_REGEX,
    CONTEXTUAL_BOOKING_ID_REGEX,
    CONTEXTUAL_TICKET_ID_REGEX,
    CONTEXTUAL_DOCUMENT_ID_REGEX,
    CONTEXTUAL_MEMBERSHIP_ID_REGEX,
    CONTEXTUAL_GOVERNMENT_ID_REGEX,
    CONTEXTUAL_OTHER_ID_REGEX
  };
}

