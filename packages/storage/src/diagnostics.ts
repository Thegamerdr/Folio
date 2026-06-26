import { type JsonRecord, type JsonValue } from './json.js';

export type DiagnosticLeakKind =
  | 'secret'
  | 'financial_content'
  | 'account_reference'
  | 'document_text'
  | 'conversation_text'
  | 'private_identifier';

export type DiagnosticLeakFinding = Readonly<{
  path: string;
  kind: DiagnosticLeakKind;
  reason: string;
}>;

export type DiagnosticBundleInspection = Readonly<{
  safeForExport: boolean;
  findingCount: number;
  findings: readonly DiagnosticLeakFinding[];
}>;

export type SanitisedDiagnosticBundle = Readonly<{
  safeForExport: boolean;
  redacted: JsonRecord;
  findings: readonly DiagnosticLeakFinding[];
  redactedPaths: readonly string[];
}>;

type FieldRule = Readonly<{
  kind: DiagnosticLeakKind;
  pattern: RegExp;
  reason: string;
}>;

const FIELD_RULES: readonly FieldRule[] = [
  {
    kind: 'secret',
    pattern:
      /(^|[_-])(api[_-]?key|auth|authorization|cookie|password|passphrase|private[_-]?key|recovery[_-]?(code|secret)?|refresh[_-]?token|session|token|unwrapped[_-]?key)($|[_-])/i,
    reason: 'secret-bearing field name',
  },
  {
    kind: 'account_reference',
    pattern:
      /(^|[_-])(account[_-]?(number|reference|label)|bank[_-]?account|card[_-]?(number|pan)|iban|open[_-]?banking[_-]?token|provider[_-]?token|routing[_-]?number|sort[_-]?code)($|[_-])/i,
    reason: 'raw account or provider reference field',
  },
  {
    kind: 'document_text',
    pattern:
      /(^|[_-])(document[_-]?text|extracted[_-]?text|ocr[_-]?text|receipt[_-]?text|statement[_-]?text|payslip[_-]?text|raw[_-]?document)($|[_-])/i,
    reason: 'document text is not allowed in diagnostics',
  },
  {
    kind: 'conversation_text',
    pattern: /(^|[_-])(conversation|completion|message[_-]?text|prompt|transcript)($|[_-])/i,
    reason: 'conversation or model text is not allowed in diagnostics',
  },
  {
    kind: 'financial_content',
    pattern:
      /(^|[_-])(amount|balance|client[_-]?name|invoice[_-]?description|merchant|memo|note|payee|payer|plan[_-]?title|raw[_-]?import[_-]?rows|tax[_-]?value|transaction[_-]?(description|rows|text))($|[_-])/i,
    reason: 'raw financial content field',
  },
  {
    kind: 'private_identifier',
    pattern:
      /(^|[_-])(address|date[_-]?of[_-]?birth|email|full[_-]?name|phone|postcode|ssn|tax[_-]?identifier)($|[_-])/i,
    reason: 'direct personal identifier field',
  },
];

const VALUE_RULES: readonly FieldRule[] = [
  {
    kind: 'secret',
    pattern:
      /\b(Bearer\s+[A-Za-z0-9._~-]+|sk-[A-Za-z0-9]{16,}|[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/,
    reason: 'token-like value',
  },
  {
    kind: 'financial_content',
    pattern: /(\b(GBP|USD|EUR)\s?\d|[£$€]\s?\d)/i,
    reason: 'currency amount value',
  },
  {
    kind: 'account_reference',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/,
    reason: 'IBAN-like value',
  },
  {
    kind: 'account_reference',
    pattern: /\b\d{2}-\d{2}-\d{2}\b/,
    reason: 'sort-code-like value',
  },
  {
    kind: 'private_identifier',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    reason: 'email-like value',
  },
];

export function inspectDiagnosticBundle(input: JsonRecord): DiagnosticBundleInspection {
  const findings: DiagnosticLeakFinding[] = [];
  visitDiagnosticValue(input, '$', undefined, findings);

  return {
    safeForExport: findings.length === 0,
    findingCount: findings.length,
    findings,
  };
}

export function sanitiseDiagnosticBundle(input: JsonRecord): SanitisedDiagnosticBundle {
  const findings: DiagnosticLeakFinding[] = [];
  const redacted = redactDiagnosticValue(input, '$', undefined, findings) as JsonRecord;
  const redactedPaths = [...new Set(findings.map((finding) => finding.path))];

  return {
    safeForExport: findings.length === 0,
    redacted,
    findings,
    redactedPaths,
  };
}

export const sanitizeDiagnosticBundle = sanitiseDiagnosticBundle;

function visitDiagnosticValue(
  value: JsonValue,
  path: string,
  key: string | undefined,
  findings: DiagnosticLeakFinding[],
): void {
  const fieldRule = key === undefined ? undefined : classifyFieldName(key);
  if (fieldRule !== undefined) {
    findings.push({ path, kind: fieldRule.kind, reason: fieldRule.reason });
    return;
  }

  if (typeof value === 'string') {
    const valueRule = classifyStringValue(value);
    if (valueRule !== undefined) {
      findings.push({ path, kind: valueRule.kind, reason: valueRule.reason });
    }
    return;
  }

  if (value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      visitDiagnosticValue(item, `${path}[${index}]`, undefined, findings),
    );
    return;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    visitDiagnosticValue(childValue, `${path}.${childKey}`, childKey, findings);
  }
}

function redactDiagnosticValue(
  value: JsonValue,
  path: string,
  key: string | undefined,
  findings: DiagnosticLeakFinding[],
): JsonValue {
  const fieldRule = key === undefined ? undefined : classifyFieldName(key);
  if (fieldRule !== undefined) {
    findings.push({ path, kind: fieldRule.kind, reason: fieldRule.reason });
    return `[redacted:${fieldRule.kind}]`;
  }

  if (typeof value === 'string') {
    const valueRule = classifyStringValue(value);
    if (valueRule !== undefined) {
      findings.push({ path, kind: valueRule.kind, reason: valueRule.reason });
      return `[redacted:${valueRule.kind}]`;
    }
    return value;
  }

  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      redactDiagnosticValue(item, `${path}[${index}]`, undefined, findings),
    );
  }

  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactDiagnosticValue(childValue, `${path}.${childKey}`, childKey, findings),
    ]),
  );
}

function classifyFieldName(fieldName: string): FieldRule | undefined {
  return FIELD_RULES.find((rule) => rule.pattern.test(fieldName));
}

function classifyStringValue(value: string): FieldRule | undefined {
  return VALUE_RULES.find((rule) => rule.pattern.test(value));
}
