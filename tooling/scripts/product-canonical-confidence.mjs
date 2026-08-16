import { normalize } from 'node:path';

const trustedContractPath = normalize('packages/domain/src/trustedCore.ts').replaceAll('\\', '/');
const shippingFolioPrefix = `${normalize('apps/mobile/src/folio').replaceAll('\\', '/')}/`;

const obsoleteTrustedContractConfidence =
  /\bTrustedCoreConfidence\b|\btrustedCoreConfidenceLevels\b|\bTrustedSafeRangeConfidenceReason\b|\bconfidenceReasons\b|\bconfidenceAtTheTime\b|\bconfidenceWasJustified\b|\bcashflow_confidence\b|\bconfidence\s*:/i;

const unsupportedShippingConfidenceClaim =
  /\b(?:high|medium|low)\s+confidence\b|\blabel\s*=\s*["']Confidence["']|\{\s*[\w$.[\]?]+\.confidence\s*\}|\$\{\s*[^}\n]*\.confidence[^}\n]*\}/i;

/**
 * Reject aggregate confidence from the Trusted Core contract and shipping financial claims while
 * leaving parser/import candidate confidence alone. The latter is source-quality metadata used to
 * force review before truth, not a promise that a financial answer is trustworthy.
 */
export function isUnsupportedProductConfidenceLine(filePath, line) {
  const normalizedPath = normalize(filePath).replaceAll('\\', '/');
  if (normalizedPath.endsWith(trustedContractPath)) {
    return obsoleteTrustedContractConfidence.test(line);
  }
  if (normalizedPath.includes(shippingFolioPrefix)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('{/*')) {
      return false;
    }
    return unsupportedShippingConfidenceClaim.test(line);
  }
  return false;
}
