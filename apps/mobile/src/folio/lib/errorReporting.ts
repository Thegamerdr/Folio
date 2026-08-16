// Crash reporting — Sentry, tuned for a local-first money app.
//
// PRIVACY CONSTRAINTS (deliberate, do not loosen casually):
// - No PII: sendDefaultPii stays false; no user identification is ever set.
// - No screenshots, no session replay — a crash screenshot of a money screen IS financial data.
// - No performance tracing (tracesSampleRate 0) — crash stacks only, minimum egress.
// - No breadcrumbs, request/user/extra payloads or free-text exception messages. Stack locations,
//   exception type, app/device metadata and severity are enough to diagnose without sending values.
//
// DSN resolution mirrors the Clerk/gateway two-tier pattern: env override first, then the
// app.config `extra` embed (reliable inside gradle-built APKs). The DSN is a public,
// submit-only key — safe to embed, same tier as the gateway URL.
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/types';

export function getSentryDsn(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[
    'EXPO_PUBLIC_SENTRY_DSN'
  ];
  return typeof fromExtra === 'string' && fromExtra.length > 0 ? fromExtra : undefined;
}

let initialized = false;

/** Pure, exported for the privacy contract test. Never mutate the SDK-owned input object. */
export function sanitizeErrorEvent(event: ErrorEvent): ErrorEvent {
  const {
    user: _user,
    request: _request,
    extra: _extra,
    breadcrumbs: _breadcrumbs,
    ...safeEvent
  } = event;
  const sanitized: ErrorEvent = { ...safeEvent };
  if (sanitized.message !== undefined) sanitized.message = 'Application diagnostic';
  if (sanitized.exception?.values !== undefined) {
    sanitized.exception = {
      ...sanitized.exception,
      values: sanitized.exception.values.map((value) => ({
        ...value,
        ...(value.value !== undefined ? { value: value.type ?? 'Application error' } : {}),
      })),
    };
  }
  return sanitized;
}

/** Idempotent. No DSN → no-op (dev machines without the extra embed stay silent). */
export function initErrorReporting(): void {
  if (initialized) return;
  const dsn = getSentryDsn();
  if (dsn === undefined) return;
  initialized = true;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: (event) => sanitizeErrorEvent(event),
    enableAutoSessionTracking: true, // crash-free-rate only; carries no user data
  });
}

export function isErrorReportingActive(): boolean {
  return initialized;
}
