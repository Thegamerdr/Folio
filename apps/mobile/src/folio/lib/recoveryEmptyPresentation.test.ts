import { describe, expect, it } from 'vitest';
import { recoveryEmptyPresentation } from './recoveryEmptyPresentation';
import type { CycleRecord } from '../store';
const review: CycleRecord = {
  closedAt: '2026-09-09',
  label: 'September',
  spare: 350,
  tightPoint: 100,
  setAside: 20,
  note: '',
};
describe('Recovery empty-state truth gates', () => {
  it('shows no fabricated amounts or history for a fresh or partial setup', () => {
    const empty = recoveryEmptyPresentation(false, false, 'Add your balance.', [review]);
    expect(empty.setup).toBe(true);
    expect(empty.history).toEqual([]);
    expect(empty.body).not.toMatch(/£|reached payday|full cycle/);
  });
  it('does not reassure on an overdue or unreviewed forecast', () => {
    const empty = recoveryEmptyPresentation(true, false, 'Check the unpaid rent.', []);
    expect(empty.body).toBe('Check the unpaid rent.');
    expect(empty.lead).not.toContain('Nothing');
  });
  it('distinguishes real recorded reviews from reconstructed imported history', () => {
    const empty = recoveryEmptyPresentation(true, true, '', [{ ...review, reconstructed: true }]);
    expect(empty.history).toEqual([]);
    expect(empty.body).toContain('no recorded cycle history');
    const recorded = recoveryEmptyPresentation(true, true, '', [review]);
    expect(recorded.history).toEqual([review]);
    expect(recorded.body).toContain('1 recorded review is');
    expect(recorded.body).not.toContain('reached payday');
  });
});
