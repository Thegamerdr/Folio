// Clerk auth adapter — the thin platform layer that lets the app OPTIONALLY wire up sign-in.
//
// HARD CONSTRAINT (per the melo-mvp Clerk lane): sign-in is optional and NOTHING in this app is
// feature-gated on it. The app stays local-first and fully usable signed-out. This module's only
// job is: (1) tell the rest of the app whether Clerk is configured at all, and (2) hand back the
// standard @clerk/clerk-expo secure token cache so a session survives an app restart when it IS
// configured.
//
// Key resolution: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY env first, then Constants.expoConfig.extra —
// the same two-tier pattern meloAiClient uses for the gateway URL, because EXPO_PUBLIC_ babel
// inlining depends on the bundler's env while `extra` embedding survives gradle/EAS builds. No key
// means no Clerk — the app must render exactly as it did before this lane existed (AccountScreen).
//
// Token cache: @clerk/clerk-expo ships a ready-made secure cache (./token-cache) that already wraps
// expo-secure-store — the standard clerk-expo quickstart pattern. We re-export it rather than
// hand-rolling a second implementation of the same thing.

import Constants from 'expo-constants';
import { tokenCache as clerkSecureTokenCache } from '@clerk/clerk-expo/token-cache';

/** Publishable key (not a secret — safe on the client). Env override wins; the app.config.ts
 *  `extra` embed is the reliable default in built APKs. */
export function getClerkPublishableKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'
  ];
  return typeof fromExtra === 'string' && fromExtra.length > 0 ? fromExtra : undefined;
}

/** True only when a non-empty publishable key is present. Every call site that would otherwise
 *  assume Clerk is available (ClerkProvider wiring, the AccountScreen sign-in row) must gate on
 *  this — never on the key itself, so there is exactly one place that defines "configured". */
export function isClerkConfigured(): boolean {
  return getClerkPublishableKey() !== undefined;
}

/** The secure, persisted token cache for ClerkProvider's `tokenCache` prop. Undefined on web (the
 *  package itself resolves to undefined there); on native it is backed by expo-secure-store. Only
 *  ever pass this to ClerkProvider when `isClerkConfigured()` is true. */
export const clerkTokenCache = clerkSecureTokenCache;
