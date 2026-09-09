import { describe, expect, it } from 'vitest';

import { isAmbiguousDebtClearanceRequest, parseLocalFinanceProposal } from './financeProposal';
import { buildLocalMeloTurn } from './localMeloTurn';

const snapshot = {
  currency: 'GBP' as const,
  availableNowMinor: 1_200,
  tightestDay: 'Friday 11 Sep',
  tightestBalanceMinor: 1_200,
  protectedItems: ['rent and food before payday'],
  pendingReviewCount: 0,
  nextPaydayLabel: '2026-09-25',
  hasMoneyPicture: true,
  debtCount: 1,
  totalDebtMinor: 80_000,
  monthlyDebtMinimumMinor: 2_000,
};

describe('local finance proposals', () => {
  it('proposes a named debt payment without writing it', () => {
    expect(parseLocalFinanceProposal('I paid £400 off Klarna')).toEqual({
      name: 'log_debt_payment',
      args: { amount: 400, debtName: 'Klarna' },
      summary: 'Record the completed £400.00 payment towards Klarna for review.',
      intent: 'review_debts',
    });
  });

  it('parses context corrections as typed review proposals', () => {
    expect(parseLocalFinanceProposal('Set my food allowance to £75 weekly')).toMatchObject({
      name: 'set_living_cost',
      args: { category: 'food', amount: 75, cadence: 'weekly' },
    });
    expect(parseLocalFinanceProposal('Change my safety buffer to £0')).toMatchObject({
      name: 'set_buffer_amount',
      args: { amount: 0 },
    });
    expect(parseLocalFinanceProposal('My actual pay was £1,427')).toMatchObject({
      name: 'correct_income',
      args: { amount: 1427 },
    });
    expect(parseLocalFinanceProposal('Update Klarna debt balance to £250')).toMatchObject({
      name: 'set_debt_balance',
      args: { debtName: 'Klarna', balance: 250 },
    });
    expect(parseLocalFinanceProposal('Change my rent to £950')).toMatchObject({
      name: 'set_commitment',
      args: { name: 'rent', amount: 950 },
    });
    expect(parseLocalFinanceProposal('Change my rent and bills to £1000')).toMatchObject({
      name: 'set_commitment',
      args: { name: 'rent and bills', amount: 1000 },
    });
    expect(
      buildLocalMeloTurn({ prompt: 'Change my rent and bills to 1000', snapshot, tone: 'calm' }),
    ).toMatchObject({
      suggestions: [{ name: 'set_commitment', args: { name: 'rent and bills', amount: 1000 } }],
    });
    expect(parseLocalFinanceProposal('My rent and bills are all one £950 payment')).toMatchObject({
      name: 'set_commitment',
      args: { name: 'rent and bills', amount: 950 },
    });
    expect(parseLocalFinanceProposal('I actually spend about £70 a week on food')).toMatchObject({
      name: 'set_living_cost',
      args: { category: 'food', amount: 70, cadence: 'weekly' },
    });
    expect(parseLocalFinanceProposal('Change my food budget to £80/week')).toMatchObject({
      name: 'set_living_cost',
      args: { category: 'food', amount: 80, cadence: 'weekly' },
    });
    expect(parseLocalFinanceProposal('I get paid on the 28th')).toMatchObject({
      name: 'set_income_schedule',
      args: { payDayOfMonth: 28 },
    });
    expect(
      buildLocalMeloTurn({ prompt: 'I get paid on the 28th', snapshot, tone: 'calm' }).context,
    ).toMatchObject({ lastIntent: 'check_payday', lastDetectedAmountMinor: null });
  });

  it('keeps questions and income variance away from a false ledger inflow', () => {
    expect(parseLocalFinanceProposal('Can I pay £400 towards Klarna?')).toBeNull();
    expect(parseLocalFinanceProposal('What happens if I pay £400?')).toBeNull();
    expect(parseLocalFinanceProposal('I want to pay £400')).toBeNull();
    expect(parseLocalFinanceProposal('I got paid £300 less than usual')).toMatchObject({
      name: 'correct_income',
      args: { adjustmentAmount: 300, direction: 'decrease' },
    });
  });

  it('asks for the clearance distinction before proposing a balance write', () => {
    expect(isAmbiguousDebtClearanceRequest('I just cleared Klarna')).toBe(true);
    const result = buildLocalMeloTurn({
      prompt: 'I just cleared Klarna',
      snapshot,
      tone: 'calm',
    });
    expect(result.suggestions).toEqual([]);
    expect(result.reply).toContain('already record the payment');
    expect(result.followUpChips).toEqual([
      'The Klarna payment is already recorded',
      'Only clear Klarna',
    ]);
  });

  it('keeps the six release phrases reviewable and asks when a target is missing', () => {
    expect(
      buildLocalMeloTurn({
        prompt: "I spent £200 I wasn't supposed to",
        snapshot,
        tone: 'calm',
      }),
    ).toMatchObject({
      suggestions: [{ name: 'log_spend', args: { amount: 200, merchant: 'unplanned spend' } }],
    });
    expect(
      buildLocalMeloTurn({ prompt: "I don't have a car", snapshot, tone: 'calm' }).reply,
    ).toContain('will not add a car');
    expect(
      buildLocalMeloTurn({
        prompt: "I've got £500 spare. What should I do?",
        snapshot,
        tone: 'calm',
      }).reply,
    ).toContain('will not overwrite your balance');
    expect(
      buildLocalMeloTurn({ prompt: 'My bill went up', snapshot, tone: 'calm' }).reply,
    ).toContain('Which bill changed');
    expect(
      buildLocalMeloTurn({ prompt: "I'm behind on this one", snapshot, tone: 'calm' }).reply,
    ).toContain('Which debt are you behind on');
    expect(parseLocalFinanceProposal("I'm behind on Klarna")).toMatchObject({
      name: 'set_debt_arrears',
      args: { debtName: 'Klarna', arrears: true },
    });
  });
});
