import { exportJWK, importJWK, importPKCS8, SignJWT, type JWK } from 'jose';

import type { EntitlementGrantClaims, GrantSigner, RuntimeEnv } from './types';

export function entitlementSigner(env: RuntimeEnv): GrantSigner {
  const publicJwk = parsePublicJwk(env.ENTITLEMENT_SIGNING_PUBLIC_JWK);
  const configured =
    nonBlank(env.ENTITLEMENT_SIGNING_PRIVATE_KEY) &&
    publicJwk !== null &&
    nonBlank(env.ENTITLEMENT_SIGNING_KEY_ID);
  return {
    configured,
    publicJwk,
    async sign(claims: EntitlementGrantClaims): Promise<string> {
      if (!configured || !nonBlank(env.ENTITLEMENT_SIGNING_PRIVATE_KEY)) {
        throw new Error('Entitlement signing is not configured.');
      }
      const privateKey = await importPKCS8(
        env.ENTITLEMENT_SIGNING_PRIVATE_KEY.replace(/\\n/g, '\n'),
        'EdDSA',
      );
      const now = Math.floor(Date.now() / 1000);
      let jwt = new SignJWT({ ...claims })
        .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: env.ENTITLEMENT_SIGNING_KEY_ID })
        .setIssuer(env.ENTITLEMENT_ISSUER)
        .setAudience(env.ENTITLEMENT_AUDIENCE)
        .setIssuedAt(now)
        .setJti(crypto.randomUUID());
      if (claims.graceUntil !== null) {
        jwt = jwt.setExpirationTime(Math.floor(Date.parse(claims.graceUntil) / 1000));
      }
      return jwt.sign(privateKey);
    },
  };
}

export async function publicJwkFromPrivate(privateKeyPem: string): Promise<JWK> {
  const privateKey = await importPKCS8(privateKeyPem.replace(/\\n/g, '\n'), 'EdDSA');
  const privateJwk = await exportJWK(privateKey);
  delete privateJwk.d;
  return privateJwk;
}

export async function validatePublicJwk(jwk: JWK): Promise<void> {
  await importJWK(jwk, 'EdDSA');
}

function parsePublicJwk(raw: string | undefined): Readonly<Record<string, unknown>> | null {
  if (!nonBlank(raw)) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const jwk = value as Record<string, unknown>;
    return jwk['kty'] === 'OKP' && jwk['crv'] === 'Ed25519' && typeof jwk['x'] === 'string'
      ? jwk
      : null;
  } catch {
    return null;
  }
}

function nonBlank(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
