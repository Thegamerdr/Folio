import { describe, expect, it } from 'vitest';
import { getFraming } from './framing';
import { MODE_SHIP_STATUS, type MoneyMode } from './types';

const modes = Object.keys(MODE_SHIP_STATUS) as MoneyMode[];

describe('cycle review framing before any financial action', () => {
  it.each(modes)('%s does not claim a safe month or completed financial progress', (mode) => {
    const line = getFraming(mode, 'cycleClose').sublabel;
    // This banner appears before any action and has no financial-state argument. Claims about
    // actual payment, covered essentials, preserved buffer or elapsed history cannot be supported.
    expect(line).not.toMatch(
      /you made it|month held|buffer intact|chips the balance|month of runway|met their share|cycle closer|money you kept|held the essentials|whole cycle to learn/i,
    );
  });

  it('tells Debt review users that payments are a separate action', () => {
    expect(getFraming('debt', 'cycleClose').sublabel).toContain('Record payments separately.');
  });
});
