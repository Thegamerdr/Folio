import Constants from 'expo-constants';

export const BUSINESS_BETA_ENV_KEY = 'EXPO_PUBLIC_MELO_BUSINESS_BETA';

/** Only the exact lowercase value `true` enables creation; whitespace around it is harmless. */
export function parseBusinessBetaFlag(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === 'true';
}

export function resolveBusinessBetaFlag(envValue: unknown, expoExtraValue: unknown): boolean {
  return parseBusinessBetaFlag(envValue === undefined ? expoExtraValue : envValue);
}

/**
 * Build-distributed exposure gate, not a remote security boundary. A reviewed rebuild/update is
 * required after RB-BUSINESS-TAX-BETA closes.
 */
export function isBusinessWorkspaceCreationEnabled(): boolean {
  const extra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[
    BUSINESS_BETA_ENV_KEY
  ];
  return resolveBusinessBetaFlag(process.env.EXPO_PUBLIC_MELO_BUSINESS_BETA, extra);
}
