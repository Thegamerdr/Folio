export type TextSelection = Readonly<{ start: number; end: number }>;

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
