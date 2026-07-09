import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import OpenAI from 'openai';
import type { CRMRecord, SkippedRecord, BatchResult } from '../types';

const BATCH_SIZE = 10;       // Reduced token pressure
const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 3000;
const INTER_BATCH_DELAY_MS = 2000; // Wait between batches

const CRM_STATUS_VALUES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;

const DATA_SOURCE_VALUES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;

type CRMStatusValue = typeof CRM_STATUS_VALUES[number];
type DataSourceValue = typeof DATA_SOURCE_VALUES[number];

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+|00)?\d[\d\s().-]{6,}\d/g;

const COUNTRY_CODE_CANDIDATES = [
  '+91',
  '+1',
  '+44',
  '+971',
  '+61',
  '+65',
  '+81',
  '+49',
  '+33',
  '+39',
  '+34',
  '+31',
];

// ─── Multi-Provider Fallback Chain ─────────────────────────────────────────────
// The system will try these models in order. If OpenAI is missing a key or fails, 
// it falls back to Gemini.
const MODEL_CHAIN = [
  { provider: 'gemini', model: 'gemini-2.5-pro' },
  { provider: 'gemini', model: 'gemini-2.5-flash' },
  { provider: 'openai', model: 'gpt-4o-mini' },
  { provider: 'openai', model: 'gpt-4o' },
];

let geminiClient: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;
let geminiModels = new Map<string, GenerativeModel>();

function getGeminiModel(modelName: string): GenerativeModel {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set in backend/.env');
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  if (!geminiModels.has(modelName)) {
    geminiModels.set(modelName, geminiClient.getGenerativeModel({ model: modelName }));
  }
  return geminiModels.get(modelName)!;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set in backend/.env');
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate content using the specified provider and model.
 */
async function generateWithProvider(provider: string, modelName: string, prompt: string): Promise<string> {
  if (provider === 'openai') {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    return response.choices[0].message.content || '';
  } else if (provider === 'gemini') {
    const m = getGeminiModel(modelName);
    const result = await m.generateContent(prompt);
    return result.response.text();
  }
  throw new Error(`Unknown AI provider: ${provider}`);
}

/**
 * Build the AI extraction prompt.
 */
function buildPrompt(
  headers: string[],
  rows: Record<string, string>[],
  batchIndex: number
): string {
  const rowsJson = JSON.stringify(rows, null, 2);

  return `You are an expert CRM Data Extraction and Normalization system for GrowEasy CRM.

Your task is to intelligently extract structured CRM records from CSV data originating from ANY source.

Examples include (but are not limited to):

- Facebook Lead exports
- Google Ads exports
- Excel sheets
- Real Estate CRM exports
- Marketing agency reports
- Sales reports
- User-created spreadsheets
- Unknown/custom CSV formats

The CSV schema is NEVER fixed.

Your job is to understand the meaning of the data, normalize it, and return valid GrowEasy CRM records.

========================================
INPUT CSV HEADERS
========================================

${headers.join(", ")}

========================================
INPUT RECORDS (Batch ${batchIndex + 1})
========================================

${rowsJson}

========================================
TARGET CRM FIELDS
========================================

Return the following fields for every valid record.

created_at
name
email
country_code
mobile_without_country_code
company
city
state
country
lead_owner
crm_status
crm_note
data_source
possession_time
description

========================================
GENERAL REASONING RULES
========================================

For every record:

1. Understand the meaning of the entire row before extracting fields.

2. Do NOT rely only on column names.

Always use BOTH:

- column headers
- the values inside the column

to determine the correct mapping.

Example:

A column named "Info" may actually contain email addresses.

A column named "Customer Details" may contain phone numbers.

The meaning of the data is more important than the column title.

3. Never fabricate information.

If something cannot be determined confidently,

return an empty string "".

4. Never invent dates, names, phone numbers, companies or emails.

5. Normalize values into GrowEasy CRM format.

6. Preserve useful business information.

7. Every output record must be independent.

8. Produce deterministic output.

========================================
HEADER VARIATIONS
========================================

Treat similar headers as equivalent whenever appropriate.

Name

- Name
- Full Name
- Customer
- Customer Name
- Client
- Client Name
- Prospect
- Contact Person
- Applicant

Phone

- Phone
- Phone Number
- Mobile
- Mobile Number
- Mob
- Telephone
- Contact
- Primary Contact
- WhatsApp

Email

- Email
- Email ID
- E-mail
- Mail
- Official Email
- Work Email

Company

- Company
- Organisation
- Organization
- Employer
- Business
- Firm

Notes

- Remarks
- Notes
- Comments
- Description
- Follow-up
- Follow Up
- Disposition
- Observation

Lead Owner

- Owner
- Salesperson
- Assigned To
- Executive
- Agent
- Counselor
- Relationship Manager

========================================
FIELD EXTRACTION RULES
========================================

created_at

Extract any lead creation date or timestamp.

Accepted formats include any standard date representation.

Return a JavaScript-parseable date.

Prefer ISO-8601 format.

Example:

2026-05-13T14:20:48

If unavailable,

return "".

----------------------------------------

name

Return the customer's complete name.

Combine first and last names if required.

Trim whitespace.

----------------------------------------

email

Return the PRIMARY email.

Only return valid email addresses.

Ignore invalid emails.

If multiple valid emails exist,

Use the first one.

Append remaining emails into crm_note as:

Additional emails:
email2@example.com, email3@example.com

----------------------------------------

country_code

Extract the international dialing code.

Examples

+91
+1
+44
+971

If unavailable,

return "".

----------------------------------------

mobile_without_country_code

Normalize phone numbers.

Remove

spaces
-
.
()

Extract only digits.

Separate the country code.

Example

Input

+91 98765-43210

Output

country_code

+91

mobile_without_country_code

9876543210

If multiple numbers exist,

Use the first.

Append remaining numbers into crm_note.

----------------------------------------

company

Company or organization name.

----------------------------------------

city

Extract city.

----------------------------------------

state

Extract state or province.

----------------------------------------

country

Return full country name.

Example

India
United States
United Kingdom

----------------------------------------

lead_owner

Owner
Salesperson
Agent
Executive
Relationship manager

Email or name.

========================================
CRM STATUS
========================================

crm_status MUST be EXACTLY one of:

${CRM_STATUS_VALUES.join(", ")}

Determine crm_status using ALL available fields including:

Status
Lead Stage
Disposition
Remarks
Comments
Notes
Description
Call Outcome
Follow-up
Additional Details

For each record:

1. Understand the customer's journey.
2. Determine the final business outcome.
3. Then classify into exactly one CRM status.

Do not classify based on individual keywords alone.

Consider the entire context before deciding.
When multiple fields provide conflicting information, prefer the field that reflects the most recent or final customer outcome.

For example:

Lead Stage: Interested
Remarks: Customer completed payment today

→ SALE_DONE

Lead Stage: Hot Lead
Remarks: Customer later declined the offer

→ BAD_LEAD

Lead Stage: Interested
Remarks: Phone switched off, could not connect

→ DID_NOT_CONNECT

STATUS DEFINITIONS

GOOD_LEAD_FOLLOW_UP

Customer has shown buying intent and requires future engagement.

Examples

Interested
Warm Lead
Hot Lead
Qualified
Requested callback
Asked for brochure
Requested quotation
Demo scheduled
Site visit
Budget shared
Needs more information

----------------------------------------

DID_NOT_CONNECT

No meaningful conversation occurred.

Examples

Busy
No answer
Didn't pick
Switched off
Call later
Not reachable
Voicemail
Retry tomorrow

----------------------------------------

BAD_LEAD

Lead should no longer be pursued.

Examples

Not interested
Rejected
Wrong number
Invalid contact
Fake lead
Spam
Duplicate
Already purchased
No requirement
Outside service area

----------------------------------------

SALE_DONE

Customer successfully converted.

Examples

Deal closed
Converted
Booked
Payment received
Agreement signed
Purchased
Onboarded
Booking confirmed

========================================
STATUS PRIORITY
========================================

If multiple signals exist,

Always use this priority.

SALE_DONE
>
BAD_LEAD
>
DID_NOT_CONNECT
>
GOOD_LEAD_FOLLOW_UP

Examples

Interested but booked yesterday
→ SALE_DONE

Initially interested but later rejected
→ BAD_LEAD

Interested but phone switched off
→ DID_NOT_CONNECT

If there is insufficient evidence,

default to

GOOD_LEAD_FOLLOW_UP

Never invent negative outcomes.

========================================
CRM NOTE
========================================

crm_note should preserve useful business context.

Include

Remarks
Comments
Follow-up notes
Call outcomes
Extra phone numbers
Extra email addresses
Customer preferences

Anything useful that doesn't belong elsewhere.

Do NOT duplicate information already stored in dedicated CRM fields.

Replace actual line breaks with \\n.

========================================
DATA SOURCE
========================================

Must be EXACTLY one of

${DATA_SOURCE_VALUES.join(", ")}

Only map when there is a clear semantic match.

Examples

Leads On Demand
LOD
Lead On Demand
↓
leads_on_demand

Meridian Tower
↓
meridian_tower

Eden Park
↓
eden_park

Varah Swamy
↓
varah_swamy

Sarjapur Plots
↓
sarjapur_plots

Minor spelling differences are acceptable.

If uncertain,

return "".

========================================
POSSESSION TIME
========================================

Extract if available.

Examples

Immediate
Ready to Move
6 Months
Q3 2026
December 2026

Otherwise,

return "".

========================================
DESCRIPTION
========================================

Store business information that does not belong in other fields.

Examples

Property preference
Budget
Requirements
Timeline
Apartment type
Villa
Commercial
Investment purpose
Location preference

Do not duplicate crm_note.

========================================
VALIDATION RULES
========================================

SKIP a record ONLY if BOTH

email

AND

mobile number

are missing or invalid.

Never skip for any other reason.

========================================
OUTPUT FORMAT
========================================

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return explanations.

Do NOT return code fences.

Return EXACTLY this structure.

{
  "records": [
    {
      "created_at": "",
      "name": "",
      "email": "",
      "country_code": "",
      "mobile_without_country_code": "",
      "company": "",
      "city": "",
      "state": "",
      "country": "",
      "lead_owner": "",
      "crm_status": "",
      "crm_note": "",
      "data_source": "",
      "possession_time": "",
      "description": ""
    }
  ],
  "skipped": [
    {
      "row": 0,
      "reason": "No valid email or mobile number found",
      "data": {}
    }
  ]
}

Process all ${rows.length} records.

The "row" field inside skipped is the 0-based index within this batch.`;
}

/**
 * Sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitize(value: unknown): string {
  return String(value ?? '').replace(/\r?\n/g, '\\n').trim();
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeLoose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map(sanitize).filter(Boolean)) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function getRowText(row: Record<string, string>): string {
  return Object.values(row).map(sanitize).filter(Boolean).join(' ');
}

function findByHeader(
  headers: string[],
  row: Record<string, string>,
  exact: string[],
  contains: string[] = []
): string {
  const normalizedExact = exact.map(normalizeHeader);
  const normalizedContains = contains.map(normalizeHeader);

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (normalizedExact.includes(normalized)) {
      const value = sanitize(row[header]);
      if (value) return value;
    }
  }

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (normalizedContains.some((term) => normalized.includes(term))) {
      const value = sanitize(row[header]);
      if (value) return value;
    }
  }

  return '';
}

function collectByHeader(
  headers: string[],
  row: Record<string, string>,
  contains: string[]
): string[] {
  const normalizedContains = contains.map(normalizeHeader);
  const values: string[] = [];

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (normalizedContains.some((term) => normalized.includes(term))) {
      const value = sanitize(row[header]);
      if (value) values.push(value);
    }
  }

  return values;
}

function extractEmailsFromText(text: string): string[] {
  return uniq(text.match(EMAIL_REGEX) ?? []);
}

function extractEmails(headers: string[], row: Record<string, string>): string[] {
  const preferred = collectByHeader(headers, row, ['email', 'e mail', 'mail']);
  const emails = preferred.flatMap(extractEmailsFromText);
  if (emails.length > 0) return uniq(emails);
  return extractEmailsFromText(getRowText(row));
}

function normalizeCountryCode(raw: string): string {
  const cleaned = sanitize(raw);
  if (!cleaned) return '';

  const plusMatch = cleaned.match(/\+\d{1,4}/);
  if (plusMatch) return plusMatch[0];

  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  const candidate = `+${digits.slice(0, 4)}`;
  const known = COUNTRY_CODE_CANDIDATES.find((code) => candidate.startsWith(code));
  return known || `+${digits}`;
}

function parsePhone(raw: string, explicitCountryCode = ''): { countryCode: string; mobile: string } | null {
  const value = sanitize(raw);
  if (!value) return null;

  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;

  let countryCode = normalizeCountryCode(explicitCountryCode);
  let mobile = digits;
  const trimmed = value.trim();
  const internationalValue = trimmed.startsWith('+') || trimmed.startsWith('00');

  if (!countryCode && internationalValue) {
    const normalizedDigits = trimmed.startsWith('00') ? digits.slice(2) : digits;
    const known = COUNTRY_CODE_CANDIDATES.find((code) => normalizedDigits.startsWith(code.slice(1)));
    if (known) {
      countryCode = known;
      mobile = normalizedDigits.slice(known.length - 1);
    }
  }

  if (countryCode && mobile.startsWith(countryCode.slice(1)) && mobile.length > 10) {
    mobile = mobile.slice(countryCode.length - 1);
  }

  if (!countryCode && digits.length === 12 && digits.startsWith('91')) {
    countryCode = '+91';
    mobile = digits.slice(2);
  } else if (!countryCode && digits.length === 11 && digits.startsWith('1')) {
    countryCode = '+1';
    mobile = digits.slice(1);
  } else if (!countryCode && digits.length > 10) {
    mobile = digits.slice(-10);
  }

  if (mobile.length < 7) return null;
  return { countryCode, mobile };
}

function extractPhones(
  headers: string[],
  row: Record<string, string>,
  explicitCountryCode: string
): Array<{ countryCode: string; mobile: string }> {
  const preferred = collectByHeader(headers, row, [
    'phone',
    'mobile',
    'whatsapp',
    'contact',
    'telephone',
    'cell',
  ]);

  const sourceTexts = preferred.length > 0 ? preferred : Object.values(row).map(sanitize);
  const parsed = sourceTexts
    .flatMap((text) => text.match(PHONE_REGEX) ?? [])
    .map((phone) => parsePhone(phone, explicitCountryCode))
    .filter((phone): phone is { countryCode: string; mobile: string } => Boolean(phone));

  const seen = new Set<string>();
  return parsed.filter((phone) => {
    const key = `${phone.countryCode}:${phone.mobile}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapStatus(text: string): CRMStatusValue {
  const haystack = normalizeLoose(text);
  if (/(sold|dealdone|closedwon|converted|purchased|saledone)/.test(haystack)) {
    return 'SALE_DONE';
  }
  if (/(notinterested|bad|junk|spam|invalid|closedlost|disqualified|wrongnumber)/.test(haystack)) {
    return 'BAD_LEAD';
  }
  if (/(noanswer|notreached|busy|unreachable|noresponse|didnotconnect|notconnected)/.test(haystack)) {
    return 'DID_NOT_CONNECT';
  }
  return 'GOOD_LEAD_FOLLOW_UP';
}

function mapDataSource(text: string): DataSourceValue | '' {
  const haystack = normalizeLoose(text);
  if (haystack.includes('leadsondemand') || /\blod\b/i.test(text)) return 'leads_on_demand';
  if (haystack.includes('meridiantower') || haystack.includes('meridian')) return 'meridian_tower';
  if (haystack.includes('edenpark') || haystack.includes('eden')) return 'eden_park';
  if (haystack.includes('varahswamy') || haystack.includes('varah')) return 'varah_swamy';
  if (haystack.includes('sarjapurplots') || haystack.includes('sarjapur')) return 'sarjapur_plots';
  return '';
}

function parseCreatedAt(value: string): string {
  const sanitized = sanitize(value);
  if (sanitized) {
    const parsed = new Date(sanitized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function buildLocalRecord(
  headers: string[],
  row: Record<string, string>
): { record?: CRMRecord; skipped?: SkippedRecord } {
  const firstName = findByHeader(headers, row, ['first name', 'firstname', 'first']);
  const lastName = findByHeader(headers, row, ['last name', 'lastname', 'surname', 'last']);
  const fullName = findByHeader(headers, row, [
    'name',
    'full name',
    'customer name',
    'lead name',
    'prospect name',
    'client name',
    'contact person',
  ], ['name', 'customer', 'prospect', 'client']);
  const name = fullName || [firstName, lastName].filter(Boolean).join(' ');

  const explicitCountryCode = findByHeader(headers, row, [
    'country code',
    'country_code',
    'dial code',
    'phone code',
    'isd code',
  ], ['country code', 'dial code', 'phone code', 'isd']);
  const emails = extractEmails(headers, row);
  const phones = extractPhones(headers, row, explicitCountryCode);

  if (emails.length === 0 && phones.length === 0) {
    return {
      skipped: {
        row: 0,
        reason: 'No email or mobile number found',
        data: row,
      },
    };
  }

  const noteParts = collectByHeader(headers, row, [
    'note',
    'remark',
    'comment',
    'follow',
    'feedback',
  ]);
  if (emails.length > 1) {
    noteParts.push(`Additional emails: ${emails.slice(1).join(', ')}`);
  }
  if (phones.length > 1) {
    noteParts.push(`Additional phones: ${phones.slice(1).map((phone) => `${phone.countryCode}${phone.mobile}`).join(', ')}`);
  }

  const rowText = getRowText(row);
  const createdAt = findByHeader(headers, row, [
    'created_at',
    'created at',
    'created',
    'date',
    'lead date',
    'created time',
    'timestamp',
  ], ['created', 'date', 'time']);
  const primaryPhone = phones[0];

  return {
    record: {
      created_at: parseCreatedAt(createdAt),
      name,
      email: emails[0] || '',
      country_code: primaryPhone?.countryCode || normalizeCountryCode(explicitCountryCode),
      mobile_without_country_code: primaryPhone?.mobile || '',
      company: findByHeader(headers, row, [
        'company',
        'organization',
        'organisation',
        'employer',
        'business',
      ], ['company', 'organisation', 'organization']),
      city: findByHeader(headers, row, ['city', 'town'], ['city', 'town']),
      state: findByHeader(headers, row, ['state', 'province', 'region'], ['state', 'province']),
      country: findByHeader(headers, row, ['country'], ['country']),
      lead_owner: findByHeader(headers, row, [
        'lead owner',
        'owner',
        'agent',
        'assigned to',
        'sales person',
        'salesperson',
      ], ['owner', 'agent', 'assigned', 'sales']),
      crm_status: mapStatus(rowText),
      crm_note: uniq(noteParts).join(' | '),
      data_source: mapDataSource(rowText),
      possession_time: findByHeader(headers, row, [
        'possession_time',
        'possession time',
        'possession',
      ], ['possession']),
      description: findByHeader(headers, row, [
        'description',
        'requirement',
        'requirements',
        'preference',
        'property preference',
        'budget',
      ], ['description', 'requirement', 'preference', 'budget']),
    },
  };
}

function extractBatchLocally(
  headers: string[],
  batchRows: Record<string, string>[],
  failureReason?: string
): BatchResult {
  const records: CRMRecord[] = [];
  const skippedRecords: SkippedRecord[] = [];

  batchRows.forEach((row, index) => {
    const result = buildLocalRecord(headers, row);
    if (result.record) {
      records.push(result.record);
    } else if (result.skipped) {
      skippedRecords.push({
        ...result.skipped,
        row: index,
        reason: failureReason
          ? `${result.skipped.reason}. AI fallback reason: ${failureReason.slice(0, 120)}`
          : result.skipped.reason,
      });
    }
  });

  return { records, skippedRecords };
}

/**
 * Extract retry-after delay in milliseconds from a 429 error message.
 */
function extractRetryDelayMs(errorMessage: string): number {
  const matchSeconds = errorMessage.match(/retry[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*s/i);
  if (matchSeconds) {
    const seconds = parseFloat(matchSeconds[1]);
    if (!isNaN(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000) + 2000; // add 2s buffer
    }
  }
  return BASE_RETRY_DELAY_MS;
}

/**
 * Returns true if error is a 429 rate-limit error.
 */
function isRateLimitError(error: Error): boolean {
  return error.message.includes('429') || error.message.includes('Too Many Requests') || error.message.includes('quota');
}

/**
 * Parse and validate AI response JSON.
 */
function parseAIResponse(
  raw: string,
  batchRows: Record<string, string>[]
): BatchResult {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: { records: CRMRecord[]; skipped: SkippedRecord[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('AI response parse error. Raw:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON');
  }

  // Validate and sanitize records
  const records: CRMRecord[] = (parsed.records || []).map((rec) => ({
    created_at: String(rec.created_at || ''),
    name: String(rec.name || ''),
    email: String(rec.email || ''),
    country_code: String(rec.country_code || ''),
    mobile_without_country_code: String(rec.mobile_without_country_code || ''),
    company: String(rec.company || ''),
    city: String(rec.city || ''),
    state: String(rec.state || ''),
    country: String(rec.country || ''),
    lead_owner: String(rec.lead_owner || ''),
    crm_status: CRM_STATUS_VALUES.includes(rec.crm_status as typeof CRM_STATUS_VALUES[number])
      ? rec.crm_status
      : '',
    crm_note: String(rec.crm_note || ''),
    data_source: DATA_SOURCE_VALUES.includes(rec.data_source as typeof DATA_SOURCE_VALUES[number])
      ? rec.data_source
      : '',
    possession_time: String(rec.possession_time || ''),
    description: String(rec.description || ''),
  }));

  // Validate and sanitize skipped records
  const skippedRecords: SkippedRecord[] = (parsed.skipped || []).map((s, idx) => ({
    row: typeof s.row === 'number' ? s.row : idx,
    reason: String(s.reason || 'Unknown reason'),
    data: batchRows[typeof s.row === 'number' ? s.row : idx] || {},
  }));

  return { records, skippedRecords };
}

/**
 * Process a single batch — tries each provider and model in the fallback chain.
 */
async function processBatchWithRetry(
  headers: string[],
  batchRows: Record<string, string>[],
  batchIndex: number,
  maxRetries: number = MAX_RETRIES
): Promise<BatchResult> {
  const prompt = buildPrompt(headers, batchRows, batchIndex);
  let lastError: Error | null = null;
  let attempt = 0;

  for (const config of MODEL_CHAIN) {
    const { provider, model: modelName } = config;

    // Skip provider gracefully if API key is not configured
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      console.log(`  ⚠ Skipping ${provider}/${modelName} because OPENAI_API_KEY is not set.`);
      continue;
    }
    if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
      console.log(`  ⚠ Skipping ${provider}/${modelName} because GEMINI_API_KEY is not set.`);
      continue;
    }

    for (let retry = 1; retry <= maxRetries; retry++) {
      attempt++;
      try {
        console.log(`  → Batch ${batchIndex + 1} | provider: ${provider} | model: ${modelName} | attempt ${retry}/${maxRetries}`);
        const rawText = await generateWithProvider(provider, modelName, prompt);
        const parsed = parseAIResponse(rawText, batchRows);
        console.log(`  ✓ Batch ${batchIndex + 1}: ${parsed.records.length} records, ${parsed.skippedRecords.length} skipped (${provider}/${modelName})`);
        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isRateLimitError(lastError)) {
          console.warn(`  ⚠ Batch ${batchIndex + 1} rate-limited on ${modelName}. Switching immediately to next fallback...`);
          // Fail fast on rate limit so we can try the next provider/model immediately
          break;
        } else {
          console.warn(`  ⚠ Batch ${batchIndex + 1} attempt ${retry} failed on ${modelName}:`, lastError.message.slice(0, 120));
          if (retry < maxRetries) {
            const backoff = BASE_RETRY_DELAY_MS * retry;
            console.log(`  ↻ Retrying in ${backoff}ms...`);
            await sleep(backoff);
          }
        }
      }
    }
  }

  // All models and retries exhausted. Use local CSV mapping as the final fallback.
  console.error(`  ✗ Batch ${batchIndex + 1} failed after ${attempt} total attempts across all models`);
  const fallback = extractBatchLocally(
    headers,
    batchRows,
    lastError?.message || 'No configured AI provider succeeded'
  );
  console.warn(
    `  Local fallback mapped ${fallback.records.length} records, ${fallback.skippedRecords.length} skipped`
  );
  return fallback;
}

/**
 * Main export: Extract CRM records from all rows using multi-provider AI fallback.
 */
export async function extractCRMRecords(
  headers: string[],
  rows: Record<string, string>[],
  onBatchComplete?: (batchIndex: number, total: number) => void | Promise<void>
): Promise<{ records: CRMRecord[]; skippedRecords: SkippedRecord[] }> {
  const allRecords: CRMRecord[] = [];
  const allSkipped: SkippedRecord[] = [];

  const batches: Record<string, string>[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`🤖 AI extraction: ${rows.length} rows → ${batches.length} batches of ${BATCH_SIZE}`);
  console.log(`📋 Fallback chain:`, MODEL_CHAIN.map(c => `${c.provider}/${c.model}`).join(' → '));

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n📦 Processing batch ${i + 1}/${batches.length} (${batch.length} rows)`);

    const result = await processBatchWithRetry(headers, batch, i);

    allRecords.push(...result.records);

    const adjustedSkipped = result.skippedRecords.map((s) => ({
      ...s,
      row: i * BATCH_SIZE + s.row,
    }));
    allSkipped.push(...adjustedSkipped);

    await onBatchComplete?.(i + 1, batches.length);

    if (i < batches.length - 1) {
      console.log(`  ⏳ Inter-batch delay ${INTER_BATCH_DELAY_MS}ms...`);
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }

  console.log(`\n✅ Extraction complete: ${allRecords.length} records, ${allSkipped.length} skipped`);

  return { records: allRecords, skippedRecords: allSkipped };
}
