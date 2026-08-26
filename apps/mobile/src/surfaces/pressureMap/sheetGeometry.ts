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
