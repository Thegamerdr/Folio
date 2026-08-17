import { describe, expect, it } from 'vitest';

import { intakeResultHelpPrompt } from './intakeResultHelp';

describe('shared intake result help', () => {
  it.each(['pdf', 'image', 'paste'] as const)(
    'keeps %s success in review-before-truth language',
    (source) => {
      expect(intakeResultHelpPrompt(source, 'found')).toContain(
        'Do not add anything until I confirm it.',
      );
    },
  );

  it('uses a recovery prompt for an unreadable source without claiming a read happened', () => {
    expect(intakeResultHelpPrompt('image', 'needs-help')).toBe(
      'Help me understand why Melo could not read this image and choose the safest next step.',
    );
  });
});
