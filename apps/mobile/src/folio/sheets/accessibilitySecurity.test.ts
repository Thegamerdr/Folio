import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url).href), 'utf8');
}

describe('native accessibility and diagnostic redaction contracts', () => {
  it('does not put a cloud recovery secret in the screen-reader label', () => {
    const backupSheet = source('./CloudBackupSheet.tsx');
    expect(backupSheet).toContain(
      'accessibilityLabel="Recovery code. Keep this code private. Long-press to select and copy."',
    );
    expect(backupSheet).not.toContain('accessibilityLabel={`Recovery code ${newRecoveryCode}`}');
  });

  it('does not print exception objects or component stacks at native crash boundaries', () => {
    const root = source('../../../app/_layout.tsx');
    const shell = source('../shell/FolioShell.tsx');
    expect(root).toContain("console.error('Root error boundary captured an application failure.')");
    expect(shell).toContain(
      "console.error('Screen error boundary captured an application failure.')",
    );
    expect(root).not.toContain("console.error('Root crashed:', error, info)");
    expect(shell).not.toContain(
      "console.error('Screen crashed:', this.props.screenLabel, error, info)",
    );
  });
});
