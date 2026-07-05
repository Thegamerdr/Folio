/**
 * Shared helpers for stub-style strategies.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/strategies/_base.ts`,
 * verbatim. Not currently used by any of the ten shipped strategies in this
 * port (every mode has a full strategy — see `../index.ts`), but kept for
 * parity in case a future mode ships as an honest-stub-from-Survival before
 * its full engine lands, matching the design source's pattern.
 */
import { survivalStrategy } from './survival';
import type { ModeInputs, ModeState, MoneyMode, MeloVoiceTint } from '../types';

export type StubOverrides = {
  mode: MoneyMode;
  spareLabel: string;
  priority: string;
  formula: string;
  voice: MeloVoiceTint;
  /** Optional verdict rewriter — receives the Survival verdict + inputs so
   *  the mode can keep numeric honesty while changing the framing. */
  verdict?: (survivalVerdict: string, inputs: ModeInputs) => string;
};

export function stubFromSurvival(overrides: StubOverrides) {
  return {
    mode: overrides.mode,
    derive(inputs: ModeInputs): ModeState {
      const base = survivalStrategy.derive(inputs);
      return {
        ...base,
        mode: overrides.mode,
        spareLabel: overrides.spareLabel,
        safeZone: {
          ...base.safeZone,
          priority: overrides.priority,
          formula: overrides.formula,
        },
        verdict: overrides.verdict ? overrides.verdict(base.verdict, inputs) : base.verdict,
        voice: overrides.voice,
      };
    },
  };
}
