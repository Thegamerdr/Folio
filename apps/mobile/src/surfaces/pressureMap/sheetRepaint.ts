// Tiny external signal shared by navigation, the native Sheet primitive, and persistent app chrome.
// Android Fabric can leave unchanged siblings unpainted after either a screen replacement or a
// transparent Modal unmount even though React's logical tree is intact. An epoch lets the background
// and bottom navigation remount only their paint layers without resetting the screen or its data.

let epoch = 0;
const listeners = new Set<() => void>();

export function getSurfaceRepaintEpoch(): number {
  return epoch;
}

export function subscribeSurfaceRepaint(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceSurfaceRepaint(): void {
  epoch += 1;
  for (const listener of listeners) listener();
}
