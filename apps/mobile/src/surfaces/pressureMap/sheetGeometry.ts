export type SheetBottomOffsetInput = Readonly<{
  platform: 'android' | 'ios' | 'other';
  usesAndroidPortal: boolean;
  bottomInset: number;
}>;

/**
 * Android portal sheets paint in the app window, whose edge-to-edge bounds include the system
 * navigation area. The pinned product viewport excludes that external area, so anchor the panel
 * above it. Modal/iOS sheets keep their platform-owned window geometry.
 */
export function resolveSheetBottomOffset({
  platform,
  usesAndroidPortal,
  bottomInset,
}: SheetBottomOffsetInput): number {
  return platform === 'android' && usesAndroidPortal ? Math.max(0, bottomInset) : 0;
}

export type SheetWindowFrame = Readonly<{ x: number; y: number; width: number; height: number }>;
export type SheetKeyboardFrame = Readonly<{
  screenX: number;
  screenY: number;
  width: number;
  height: number;
}>;

/** Android 11+ reports IME height without navigation bars, even when adjustResize leaves screenY
 * at the unchanged edge-to-edge window bottom. Derive the real IME top from both measurements. */
export function resolveSheetKeyboardFrame(
  keyboard: SheetKeyboardFrame | undefined,
  androidApi: number | null,
  screenHeight: number,
  bottomInset: number,
): SheetKeyboardFrame | null {
  if (!keyboard || keyboard.height <= 0) return null;
  if (androidApi === null || androidApi < 30) return keyboard;
  const keyboardBottom = screenHeight - Math.max(0, bottomInset);
  const screenY = Math.max(0, Math.min(keyboard.screenY, keyboardBottom - keyboard.height));
  return { ...keyboard, screenY, height: keyboardBottom - screenY };
}

/** A portal can already exclude part/all of a system inset; reserve only actual overlap. */
export function resolveSheetNavigationOffset(
  frame: SheetWindowFrame,
  screenHeight: number,
  bottomInset: number,
): number {
  return Math.max(0, frame.y + frame.height - (screenHeight - Math.max(0, bottomInset)));
}

/** Intersect the actual sheet window with the keyboard; never subtract an IME twice after resize. */
export function resolveSheetViewport({
  frame,
  keyboard,
  topInset,
  bottomOffset,
  maxHeightFraction = 0.92,
}: Readonly<{
  frame: SheetWindowFrame;
  keyboard?: SheetKeyboardFrame | null;
  topInset: number;
  bottomOffset: number;
  maxHeightFraction?: number;
}>) {
  const top = Math.max(0, topInset - frame.y);
  const windowBottom = frame.y + frame.height;
  const restingBottom = windowBottom - Math.max(0, bottomOffset);
  const intersectsHorizontally =
    keyboard != null &&
    keyboard.screenX < frame.x + frame.width &&
    keyboard.screenX + keyboard.width > frame.x;
  // A floating/split keyboard that does not touch this window's bottom is not a bottom inset.
  const keyboardOccludesBottom =
    keyboard != null &&
    keyboard.height > 0 &&
    intersectsHorizontally &&
    keyboard.screenY < restingBottom &&
    keyboard.screenY + keyboard.height >= restingBottom - 1;
  const visibleBottom = keyboardOccludesBottom
    ? Math.min(restingBottom, keyboard.screenY)
    : restingBottom;
  const bottom = Math.min(frame.height, Math.max(0, windowBottom - visibleBottom));
  const availableHeight = Math.max(0, frame.height - top - bottom);
  return {
    top,
    bottom,
    availableHeight,
    maxHeight: Math.min(Math.round(frame.height * maxHeightFraction), availableHeight),
    keyboardOccludesBottom,
  };
}

/** Keep the whole focused field in the body viewport, which excludes both chrome and sticky footer. */
export function resolveSheetFocusedScroll({
  scrollY,
  inputTop,
  inputHeight,
  bodyTop,
  bodyHeight,
  padding = 8,
}: Readonly<{
  scrollY: number;
  inputTop: number;
  inputHeight: number;
  bodyTop: number;
  bodyHeight: number;
  padding?: number;
}>): number {
  if (bodyHeight <= 0 || inputHeight <= 0) return scrollY;
  const visibleTop = bodyTop + padding;
  const visibleBottom = bodyTop + bodyHeight - padding;
  if (inputTop < visibleTop || inputHeight > visibleBottom - visibleTop)
    return Math.max(0, scrollY + inputTop - visibleTop);
  if (inputTop + inputHeight > visibleBottom)
    return Math.max(0, scrollY + inputTop + inputHeight - visibleBottom);
  return scrollY;
}
