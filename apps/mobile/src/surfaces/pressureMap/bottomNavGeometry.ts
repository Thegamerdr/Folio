export type BottomNavVariant = 'personal' | 'business';

// The pinned acceptance viewport is the physical S9 with three-button navigation. Batch captures
// may run on a gesture-navigation AVD, but their fixed product crop still removes the S9's 48dp
// system band. Reserve that same band inside personal capture builds so the complete 68dp product
// tab strip remains above the crop, exactly as it does on the acceptance device.
export const S9_THREE_BUTTON_BOTTOM_INSET_DP = 48;

export function resolveBottomNavInset({
  reportedBottomInset,
  parityCapture,
  variant,
}: {
  reportedBottomInset: number;
  parityCapture: boolean;
  variant: BottomNavVariant;
}): number {
  const reported = Math.max(0, reportedBottomInset);
  if (!parityCapture || variant !== 'personal') return reported;
  return Math.max(reported, S9_THREE_BUTTON_BOTTOM_INSET_DP);
}
