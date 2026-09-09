/** Expo inlines this explicit build flag; local fixtures must never connect to real profiles. */
export function isCaptureBuild(): boolean {
  return process.env.EXPO_PUBLIC_MELO_PARITY_CAPTURE === 'true';
}
