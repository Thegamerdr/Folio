import type { WorkspaceSummary } from '@folio/business-workspace';
import {
  createWorkspace,
  createWorkspaceId,
  type Workspace,
  type WorkspaceId,
} from '@folio/domain';

/**
 * The production mobile store is still one top-level Personal data partition. This root makes that
 * ownership explicit before Business records are allowed to exist. A later schema may add a
 * Business partition only after every query/write/export/companion seam requires a workspace ID.
 */
export type PersistedWorkspace = Workspace &
  Readonly<{
    encryptedSubkeyId: string;
    archivedAt: string | null;
  }>;

export type WorkspaceRoot = Readonly<{
  workspaces: readonly PersistedWorkspace[];
  activeWorkspaceId: WorkspaceId;
  /** Workspace that owns every current top-level AppState data slot. */
  dataWorkspaceId: WorkspaceId;
}>;

export type WorkspacePartitionHeader = Readonly<{
  workspaces: readonly PersistedWorkspace[];
  activeWorkspaceId: WorkspaceId;
  dataWorkspaceId: WorkspaceId;
}>;

export const PERSONAL_WORKSPACE_ID = createWorkspaceId('workspace_personal_local');
export const PERSONAL_WORKSPACE_SUBKEY_ID = 'workspace-subkey-personal-v1';

export function createBusinessWorkspace(input: {
  id: string | WorkspaceId;
  name: string;
  encryptedSubkeyId: string;
}): PersistedWorkspace {
  if (!/^workspace-subkey-business-[a-z0-9_-]{4,80}-v[1-9][0-9]*$/u.test(input.encryptedSubkeyId)) {
    throw new Error('Business workspace encryption subkey ID is invalid.');
  }
  const workspace = createWorkspace({
    id: input.id,
    kind: 'business',
    name: input.name,
    baseCurrency: 'GBP',
    jurisdiction: 'GB',
    timeZone: 'Europe/London',
    version: { revision: 1, dataVersion: 'workspace:business:v1' },
  });
  if (workspace.id === PERSONAL_WORKSPACE_ID) {
    throw new Error('Business workspace cannot use the Personal workspace ID.');
  }
  return { ...workspace, encryptedSubkeyId: input.encryptedSubkeyId, archivedAt: null };
}

function createPersonalWorkspace(): PersistedWorkspace {
  return {
    ...createWorkspace({
      id: PERSONAL_WORKSPACE_ID,
      kind: 'personal',
      name: 'Personal',
      baseCurrency: 'GBP',
      jurisdiction: 'GB',
      timeZone: 'Europe/London',
      version: { revision: 1, dataVersion: 'workspace:personal:v1' },
    }),
    encryptedSubkeyId: PERSONAL_WORKSPACE_SUBKEY_ID,
    archivedAt: null,
  };
}

export function createPersonalWorkspaceRoot(): WorkspaceRoot {
  return {
    workspaces: [createPersonalWorkspace()],
    activeWorkspaceId: PERSONAL_WORKSPACE_ID,
    dataWorkspaceId: PERSONAL_WORKSPACE_ID,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCanonicalPersonalWorkspace(value: unknown): value is PersistedWorkspace {
  if (!isRecord(value)) return false;
  const version = value.version;
  return (
    value.id === PERSONAL_WORKSPACE_ID &&
    value.kind === 'personal' &&
    value.name === 'Personal' &&
    value.baseCurrency === 'GBP' &&
    value.jurisdiction === 'GB' &&
    value.timeZone === 'Europe/London' &&
    value.encryptedSubkeyId === PERSONAL_WORKSPACE_SUBKEY_ID &&
    value.archivedAt === null &&
    isRecord(version) &&
    Number.isSafeInteger(version.revision) &&
    Number(version.revision) >= 1 &&
    typeof version.dataVersion === 'string' &&
    version.dataVersion.length > 0
  );
}

/**
 * Load-time fail-closed normaliser for schema v9.
 *
 * Even if a malformed/crafted blob contains a Business workspace or selects one as active, this
 * schema keeps the production store on its single explicit Personal partition. Silently accepting
 * a Business ID before entity/query isolation exists would turn the current global arrays into a
 * cosmetic filter, which the approved Business boundary forbids.
 */
export function normalisePersonalWorkspaceRoot(input: {
  workspaces?: unknown;
  activeWorkspaceId?: unknown;
  dataWorkspaceId?: unknown;
}): WorkspaceRoot {
  const personal = Array.isArray(input.workspaces)
    ? input.workspaces.find(isCanonicalPersonalWorkspace)
    : undefined;

  return {
    workspaces: [personal ?? createPersonalWorkspace()],
    activeWorkspaceId: PERSONAL_WORKSPACE_ID,
    dataWorkspaceId: PERSONAL_WORKSPACE_ID,
  };
}

/**
 * Guard every production reader that is being migrated to workspace scope. Schema v9 has one
 * top-level data partition, so access is valid only when the requested workspace exists, is active
 * for this read, owns that partition and is not archived. There is deliberately no global-array
 * fallback and no filter-after-read behavior.
 */
export function requireWorkspaceData<TState extends WorkspacePartitionHeader>(
  state: TState,
  requestedWorkspaceId: string | WorkspaceId,
): TState {
  const requested = String(requestedWorkspaceId);
  const workspace = state.workspaces.find((item) => String(item.id) === requested);
  if (!workspace || workspace.archivedAt !== null) {
    throw new Error(`Workspace ${requested} is unavailable.`);
  }
  if (String(state.activeWorkspaceId) !== requested) {
    throw new Error(`Workspace ${requested} is not the active workspace.`);
  }
  if (String(state.dataWorkspaceId) !== requested) {
    throw new Error(
      `Workspace ${requested} does not own the current mobile data partition; access refused.`,
    );
  }
  return state;
}

/** Adapter into the existing pure Business switcher contract; production still supplies Personal only. */
export function toWorkspaceSummary(workspace: PersistedWorkspace): WorkspaceSummary {
  return {
    workspaceId: String(workspace.id),
    kind: workspace.kind,
    label: workspace.name,
    iconLabel: `${workspace.name} workspace`,
    legalName: null,
    tradingName: workspace.kind === 'business' ? workspace.name : null,
    encryptedSubkeyId: workspace.encryptedSubkeyId,
    created: true,
  };
}
