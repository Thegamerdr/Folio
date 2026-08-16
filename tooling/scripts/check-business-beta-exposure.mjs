import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BUSINESS_BETA_ENV_KEY = 'EXPO_PUBLIC_MELO_BUSINESS_BETA';
export const BUSINESS_BETA_BLOCKER_ID = 'RB-BUSINESS-TAX-BETA';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..', '..');
const registerPath = path.join(root, 'tooling', 'config', 'release-blockers.json');

export function parseBusinessBetaFlag(value) {
  return typeof value === 'string' && value.trim() === 'true';
}

export function evaluateBusinessBetaExposure(enabled, register) {
  if (!enabled) {
    return { allowed: true, state: 'disabled', message: 'Business beta exposure is disabled.' };
  }
  if (!register || typeof register !== 'object' || !Array.isArray(register.blockers)) {
    return {
      allowed: false,
      state: 'malformed',
      message: `${BUSINESS_BETA_BLOCKER_ID}=malformed`,
    };
  }
  const matches = register.blockers.filter(
    (blocker) => blocker && typeof blocker === 'object' && blocker.id === BUSINESS_BETA_BLOCKER_ID,
  );
  if (matches.length !== 1) {
    return {
      allowed: false,
      state: matches.length === 0 ? 'missing' : 'duplicated',
      message: `${BUSINESS_BETA_BLOCKER_ID}=${matches.length === 0 ? 'missing' : 'duplicated'}`,
    };
  }
  const status = matches[0].status;
  if (typeof status !== 'string' || status.trim().length === 0) {
    return {
      allowed: false,
      state: 'malformed',
      message: `${BUSINESS_BETA_BLOCKER_ID}=malformed`,
    };
  }
  return status === 'closed'
    ? {
        allowed: true,
        state: 'closed',
        message: `${BUSINESS_BETA_BLOCKER_ID}=closed`,
      }
    : {
        allowed: false,
        state: status,
        message: `${BUSINESS_BETA_BLOCKER_ID}=${status}`,
      };
}

function main() {
  const enabled = parseBusinessBetaFlag(process.env[BUSINESS_BETA_ENV_KEY]);
  if (!enabled) {
    console.log('Business beta exposure: disabled.');
    return;
  }

  let register;
  try {
    register = JSON.parse(fs.readFileSync(registerPath, 'utf8'));
  } catch {
    console.error(`Business beta exposure rejected: ${BUSINESS_BETA_BLOCKER_ID}=malformed`);
    process.exitCode = 1;
    return;
  }

  const result = evaluateBusinessBetaExposure(true, register);
  const prefix = result.allowed
    ? 'Business beta exposure: enabled;'
    : 'Business beta exposure rejected:';
  const writer = result.allowed ? console.log : console.error;
  writer(`${prefix} ${result.message}`);
  if (!result.allowed) process.exitCode = 1;
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedUrl === import.meta.url) main();
