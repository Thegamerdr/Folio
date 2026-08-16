import { createWorkspaceId } from '@folio/domain';
import { describe, expect, it } from 'vitest';

import { createEmptyLocalLedgerState } from './localLedger.js';
import {
  createLocalLedgerPortableVault,
  localLedgerWorkspaceId,
  requireLocalLedgerWorkspaceId,
  validateLocalLedgerVault,
} from './localLedgerVault.js';

describe('native local-ledger workspace boundary', () => {
  it('requires and preserves an explicit workspace owner in portable rows', () => {
    const businessId = createWorkspaceId('workspace_business_studio_test');
    expect(requireLocalLedgerWorkspaceId(localLedgerWorkspaceId)).toBe(localLedgerWorkspaceId);
    expect(requireLocalLedgerWorkspaceId(businessId)).toBe(businessId);

    const vault = createLocalLedgerPortableVault(
      createEmptyLocalLedgerState(),
      new Date('2026-07-15T20:00:00.000Z'),
      businessId,
    );
    expect(vault.tables.find((table) => table.name === 'workspaces')?.rows[0]).toMatchObject({
      id: businessId,
      name: 'Business',
    });
    expect(validateLocalLedgerVault(vault, businessId)).toEqual({ valid: true, issues: [] });
    expect(validateLocalLedgerVault(vault, localLedgerWorkspaceId)).toMatchObject({ valid: false });
  });
});
