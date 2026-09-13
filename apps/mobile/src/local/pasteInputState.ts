export type TextSelection = Readonly<{ start: number; end: number }>;

export type PasteBackAction = 'dismiss-keyboard' | 'go-to-intake' | 'confirm-discard';

/** The paste editor's Back contract, shared by the hardware and visible Back actions. */
export function resolvePasteBackAction(input: {
  draftNonEmpty: boolean;
  keyboardVisible: boolean;
}): PasteBackAction {
  if (input.keyboardVisible) return 'dismiss-keyboard';
  return input.draftNonEmpty ? 'confirm-discard' : 'go-to-intake';
}

/** Insert clipboard text at the native selection without changing the surrounding draft. */
export function insertClipboardAtSelection(
  draft: string,
  clipboardText: string,
  selection: TextSelection,
): { text: string; selection: TextSelection } {
  const start = Math.min(Math.max(0, selection.start), draft.length);
  const end = Math.min(Math.max(start, selection.end), draft.length);
  const text = `${draft.slice(0, start)}${clipboardText}${draft.slice(end)}`;
  const caret = start + clipboardText.length;
  return { text, selection: { start: caret, end: caret } };
}
