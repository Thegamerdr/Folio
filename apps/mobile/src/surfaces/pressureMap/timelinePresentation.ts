// Pure presentation helpers for the calm Timeline surface. No React Native imports, so they can be
// unit-tested directly.
//
// The canonical timeline adapter builds a rich, forensic `detail` for the old detailed surface — it
// appends evidence text (`<detail>. <evidence.summary>`) that embeds internal identifiers and
// vocabulary. The Quiet Paper Luxury timeline shows a calmer note and must NEVER surface raw engine
// identifiers or internal wording. It also shows what the USER did, not auto-generated bookkeeping.

import type { LocalTimelineEntryKind, LocalTimelineEvent } from '../../local/localTimelineAdapter';

// Auto-generated bookkeeping (opening / calculated balances, scenario previews) is not a user
// action. On a fresh ledger it is the only thing present, so surfacing it renders a synthetic
// "history" instead of a calm empty state. The calm timeline shows what the person actually did.
const SYSTEM_KINDS: ReadonlySet<LocalTimelineEntryKind> = new Set<LocalTimelineEntryKind>([
  'balance-event',
  'scenario-preview',
]);

export function isUserTimelineEvent(kind: LocalTimelineEntryKind): boolean {
  return !SYSTEM_KINDS.has(kind);
}

export function presentableTimelineEvents(
  events: readonly LocalTimelineEvent[],
): readonly LocalTimelineEvent[] {
  return events.filter((event) => isUserTimelineEvent(event.kind));
}

// Markers that begin the appended evidence text — cut the note here so only the human sentence is
// shown.
const EVIDENCE_MARKERS = [
  ' Source:',
  ' Last changed',
  ' Provenance',
  ' This balance record',
  ' This record',
  ' Needs a source',
  ' Calculated from',
];

// A calm note never carries internal engine vocabulary or a raw record identifier. This is the hard
// guard: if anything matching slips through, the note is dropped entirely rather than leaked.
const INTERNAL_VOCAB =
  /\b(provenance|baseline|indexed|canonical)\b|\bsource record\b|provenance[_\w-]+|_\d{4}_\d{2}_\d{2}_/i;

export function cleanTimelineNote(detail: string): string {
  let text = detail.trim();
  let cut = text.length;
  for (const marker of EVIDENCE_MARKERS) {
    const index = text.indexOf(marker);
    if (index >= 0 && index < cut) cut = index;
  }
  text = text
    .slice(0, cut)
    .trim()
    .replace(/[.\s]+$/, '')
    .trim();
  if (INTERNAL_VOCAB.test(text)) return '';
  return text;
}
