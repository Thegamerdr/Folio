/** Keep paired labels/values in separate rows when scaled text needs the width. */
export function shouldStackTextRows(
  width: number,
  fontScale: number,
  horizontalPadding = 56,
): boolean {
  return Math.max(0, width - horizontalPadding) / Math.max(1, fontScale) < 280;
}
