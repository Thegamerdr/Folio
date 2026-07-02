// The form registry — Melo is ONE entity with choosable bodies (the owner's original
// vision, restored by the drift audit). Five free forms: the original creature (built
// into MeloMascot as the default) plus the four rigs below, each carrying the full
// seven-emotion range, the belly-glow status display, and the same emotional grammar.

import { catRig } from './cat';
import { foxRig } from './fox';
import { geckoRig } from './gecko';
import { ghostRig } from './ghost';

export type { FormRigProps } from './fox';

export const FORM_RIGS = {
  fox: foxRig,
  gecko: geckoRig,
  cat: catRig,
  ghost: ghostRig,
} as const;

export type FormId = keyof typeof FORM_RIGS;

/** Picker order: the creature first (id null = the default body). */
export const FORMS: readonly { id: FormId | null; name: string }[] = [
  { id: null, name: 'the original' },
  { id: 'fox', name: foxRig.name },
  { id: 'gecko', name: geckoRig.name },
  { id: 'cat', name: catRig.name },
  { id: 'ghost', name: ghostRig.name },
];

export function asFormId(id: string | null | undefined): FormId | null {
  if (!id) return null;
  return id in FORM_RIGS ? (id as FormId) : null;
}
