// Merchant→category memory — DATA_INTELLIGENCE.md phase ③.
//
// Nothing today remembers a user's category correction (`ReviewScreen.tsx`'s
// category chips / `categoryFor()`), so every statement re-import re-asks the
// model the same category question for the same merchant, forever, at the
// same low confidence. This module is the pure, store-agnostic half of the
// fix: given the store's `merchantCategories` map (see `store.ts`), recall a
// remembered category for a merchant, and apply that memory onto a batch of
// intake candidates (`CandidateMoneyItem[]`, `lib/importSheet.ts` /
// `statementReaderParse.ts`).
//
// HONESTY discipline (matches caughtSubs.ts / caughtIncome.ts): applying
// memory never touches amount/date/kind — category only — and it flags every
// candidate it touched (`rememberedCategory: true`) so the UI can show
// provenance honestly ("remembered from a past correction") rather than
// silently passing off a memory hit as a fresh, confident model guess.
//
// Split discipline: this file is pure and Node-testable (no react-native, no
// DOM, no store mutation) — collected by the apps/**\/*.test.ts vitest runner
// via merchantMemory.test.ts. The store owns the map itself (`store.ts`
// `merchantCategories`, `rememberMerchantCategory` / `forgetMerchantCategory`).

import type { CandidateMoneyItem } from './importSheet';
import { normaliseMerchant } from './subSignals';

/** One remembered correction. `hits` counts how many times the user has
 *  confirmed this category for this merchant (informational only — does not
 *  gate recall); `correctedAt` is the ISO timestamp of the most recent
 *  correction, used only to pick the least-recently-corrected entry to evict
 *  once the map is at capacity.
 *
 *  Flip-threshold fields (anti-thrash / anti one-tap-poisoning, `store.ts`'s
 *  `rememberMerchantCategory`): a correction that DISAGREES with the
 *  committed `category` does not overwrite it immediately. Instead it is
 *  tracked here as `pendingCategory` + `pendingCount`, and only promoted to
 *  the committed `category` once the SAME disagreeing category has been
 *  chosen twice in a row. Any correction that doesn't match the pending
 *  category (including a correction back to the current committed one)
 *  resets the pending fields. Both are absent while there is no pending
 *  disagreement — never persisted as `undefined`. */
export type MerchantCategoryMemory = {
  category: string;
  correctedAt: string;
  hits: number;
  pendingCategory?: string;
  pendingCount?: number;
};

/** Keyed by normalised merchant (`normaliseMerchant`, `lib/subSignals.ts`). */
export type MerchantCategoryMap = Record<string, MerchantCategoryMemory>;

/** Cap on distinct remembered merchants — see `store.ts`'s
 *  `rememberMerchantCategory` for the eviction policy this backs. */
export const MERCHANT_CATEGORY_CAP = 500;

/** A candidate carrying an applied memory hit — same shape as
 *  `CandidateMoneyItem` plus the honesty flag. `category` is overwritten with
 *  the remembered value; every other field is untouched. */
export type CandidateWithMemory = CandidateMoneyItem & {
  /** Present and `true` only when this candidate's category came from a
   *  remembered correction, not the model's guess — lets the UI show
   *  provenance ("remembered") rather than passing memory off as a fresh
   *  high-confidence model read. */
  rememberedCategory?: true;
};

/** Look up the remembered category for a merchant, or `null` when nothing has
 *  been corrected for it yet (or the map itself is absent — a fresh install /
 *  pre-migration blob). Comparison is normalised (case/whitespace/punctuation
 *  insensitive), matching every other merchant-keyed slot in the app. */
export function recallCategory(
  merchantCategories: MerchantCategoryMap | undefined,
  merchant: string,
): string | null {
  if (!merchantCategories) return null;
  const key = normaliseMerchant(merchant);
  const entry = merchantCategories[key];
  return entry ? entry.category : null;
}

/** Apply remembered categories onto a batch of intake candidates. For each
 *  candidate whose merchant has a remembered correction, the model's guessed
 *  `category` is overridden with the remembered one and `rememberedCategory:
 *  true` is set; candidates with no memory hit pass through unchanged
 *  (structurally identical object, no flag added). Never touches `amount`,
 *  `date`, `kind`, or any other field — category only, per the module's
 *  honesty discipline. Pure: returns a new array, never mutates the input. */
export function applyMemoryToCandidates(
  candidates: readonly CandidateMoneyItem[],
  merchantCategories: MerchantCategoryMap | undefined,
): CandidateWithMemory[] {
  if (!merchantCategories) return candidates.slice();
  return candidates.map((candidate) => {
    const remembered = recallCategory(merchantCategories, candidate.merchant);
    if (remembered === null) return candidate;
    return { ...candidate, category: remembered, rememberedCategory: true };
  });
}
