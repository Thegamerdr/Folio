import Constants from 'expo-constants';

/**
 * Open Banking is deliberately opt-in at build time. The current Melo release candidate does
 * not have regulated-provider approval, so merely embedding a URL must never expose a connect
 * button or send a request. A future approved build must set both the feature flag and URL.
 */
export function isOpenBankingEnabled(): boolean {
  const flag = publicValue('EXPO_PUBLIC_MELO_OPEN_BANKING_ENABLED');
  const endpoint = validEndpoint(publicValue('EXPO_PUBLIC_MELO_OPEN_BANKING_URL'));
  return flag === 'true' && endpoint !== null;
}

export function getOpenBankingUrl(): string | undefined {
  if (!isOpenBankingEnabled()) return undefined;
  const endpoint = validEndpoint(publicValue('EXPO_PUBLIC_MELO_OPEN_BANKING_URL'));
  return endpoint === null ? undefined : endpoint;
}

function validEndpoint(value: string | null): string | null {
  if (value === null) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.toString().replace(/\/+$/u, '');
  } catch {
    return null;
  }
}

function publicValue(key: string): string | null {
  const fromEnv = process.env[key];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[key];
  return typeof fromExtra === 'string' && fromExtra.trim().length > 0 ? fromExtra.trim() : null;
}
