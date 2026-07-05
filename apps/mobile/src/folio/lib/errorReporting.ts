// Crash reporting — Sentry, tuned for a local-first money app.
//
// PRIVACY CONSTRAINTS (deliberate, do not loosen casually):
// - No PII: sendDefaultPii stays false; no user identification is ever set.
// - No screenshots, no session replay — a crash screenshot of a money screen IS financial data.
// - No performance tracing (tracesSampleRate 0) — crash stacks only, minimum egress.
// - Financial values never attach: nothing in this module (or elsewhere) calls setContext/setExtra
//   with store data.
//
// DSN resolution mirrors the Clerk/gateway two-tier pattern: env override first, then the
// app.config `extra` embed (reliable inside gradle-built APKs). The DSN is a public,
// submit-only key — safe to embed, same tier as the gateway URL.
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

export function getSentryDsn(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[
    'EXPO_PUBLIC_SENTRY_DSN'
  ];
  return typeof fromExtra === 'string' && fromExtra.length > 0 ? fromExtra : undefined;
}

let initialized = false;

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
    enableAutoSessionTracking: true, // crash-free-rate only; carries no user data
  });
}

export function isErrorReportingActive(): boolean {
  return initialized;
}
