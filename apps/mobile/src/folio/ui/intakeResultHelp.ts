export type IntakeResultSource = 'pdf' | 'image' | 'paste';
export type IntakeResultOutcome = 'found' | 'needs-help';

export function intakeResultHelpPrompt(
  source: IntakeResultSource,
  outcome: IntakeResultOutcome,
): string {
  const sourceLabel = source === 'pdf' ? 'PDF' : source === 'image' ? 'image' : 'pasted text';
  return outcome === 'found'
    ? `Help me check the possible money items Melo found in this ${sourceLabel}. Do not add anything until I confirm it.`
    : `Help me understand why Melo could not read this ${sourceLabel} and choose the safest next step.`;
}
