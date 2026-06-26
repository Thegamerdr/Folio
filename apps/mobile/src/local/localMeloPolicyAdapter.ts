import type { MeloLocalAiDraft } from '@folio/ai-contracts';
import { validateMeloRenderableOutput } from '@folio/melo-policy';

export type MeloPolicyGateResult = Readonly<{
  draft: MeloLocalAiDraft;
  renderable: boolean;
  blockedReasons: readonly string[];
}>;

export type CompactMeloNote = Readonly<{
  accessibilityLabel: string;
  control: string;
  matters: string;
  noticed: string;
  text: string;
}>;

export type CompactMeloNoteInput = Readonly<{
  control: string;
  fallback?: Readonly<{
    control?: string;
    matters?: string;
    noticed?: string;
  }>;
  matters: string;
  noticed: string;
}>;

export function gateMeloLocalAiDraft(draft: MeloLocalAiDraft): MeloPolicyGateResult {
  const validation = validateMeloRenderableOutput(renderableDraftText(draft));
  if (validation.renderable) {
    return { draft, renderable: true, blockedReasons: [] };
  }

  const blockedReasons = [
    ...validation.classification.matches.map((match) => match.category),
    ...validation.escalationTriggers,
  ];

  return {
    draft: {
      ...draft,
      answer: 'I can explain the local route, but this draft needs review before I show it.',
      financialConclusion: 'No record changed. Confirmed local figures remain the source of truth.',
      requiresUserReview: true,
      uncertainty: 'review-required',
      uncertaintyReason: 'Melo policy blocked unsafe or advice-like wording.',
      followUpChips: ['See sources', 'Review imports'],
      guardrails: [
        'Melo policy blocked this draft before display.',
        'Nothing changes until you choose a review action.',
      ],
      actions: [],
    },
    renderable: false,
    blockedReasons,
  };
}

export function gateMeloText(text: string, fallback: string): string {
  return validateMeloRenderableOutput(text).renderable ? text : fallback;
}

export function buildCompactMeloNote(input: CompactMeloNoteInput): CompactMeloNote {
  const candidate = normalizeCompactMeloNote({
    control: input.control,
    matters: input.matters,
    noticed: input.noticed,
  });
  const fallback = normalizeCompactMeloNote({
    control: input.fallback?.control ?? 'Review sources before anything changes.',
    matters: input.fallback?.matters ?? 'Review items stay separate from confirmed facts.',
    noticed: input.fallback?.noticed ?? 'Melo checked local records.',
  });
  const candidateText = formatCompactMeloText(candidate);
  const fallbackText = formatCompactMeloText(fallback);
  const safeText = gateMeloText(candidateText, fallbackText);
  const safeNote = safeText === candidateText ? candidate : fallback;

  return {
    ...safeNote,
    accessibilityLabel: safeText.replace(/\s+/gu, ' ').trim(),
    text: safeText,
  };
}

function renderableDraftText(draft: MeloLocalAiDraft): string {
  return [
    draft.answer,
    draft.financialConclusion,
    draft.uncertaintyReason,
    ...draft.followUpChips,
    ...draft.guardrails,
    ...draft.dataUsed,
    ...draft.actions.flatMap((action) => [action.label, action.detail]),
  ].join('\n');
}

function normalizeCompactMeloNote(note: {
  control: string;
  matters: string;
  noticed: string;
}): Pick<CompactMeloNote, 'control' | 'matters' | 'noticed'> {
  return {
    control: compactMeloLine(note.control, 'Review sources before anything changes.'),
    matters: compactMeloLine(note.matters, 'Review items stay separate from confirmed facts.'),
    noticed: compactMeloLine(note.noticed, 'Melo checked local records.'),
  };
}

function compactMeloLine(value: string, fallback: string): string {
  const normalized = value
    .replace(/^(?:Melo noticed|Why it matters|Your control)\s*:\s*/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();

  if (normalized.length === 0) return fallback;
  if (normalized.length <= 96) return normalized;

  const slice = normalized.slice(0, 93);
  const lastSpace = slice.lastIndexOf(' ');
  const trimAt = lastSpace > 48 ? lastSpace : 93;
  return `${slice.slice(0, trimAt).trim()}...`;
}

function formatCompactMeloText(note: Pick<CompactMeloNote, 'control' | 'matters' | 'noticed'>) {
  return [
    `Melo noticed: ${note.noticed}`,
    `Why it matters: ${note.matters}`,
    `Your control: ${note.control}`,
  ].join('\n');
}
