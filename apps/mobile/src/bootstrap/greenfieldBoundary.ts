import { createWorkspaceId } from '@folio/domain';
import { folioTokens } from '@folio/ui';

export const mobileShellBoundary = {
  defaultWorkspaceId: createWorkspaceId('workspace_personal_demo'),
  minimumTouchTarget: folioTokens.size.touchTarget,
  accountRequiredForLocalUse: false,
  aiRequiredForLocalUse: false,
} as const;
