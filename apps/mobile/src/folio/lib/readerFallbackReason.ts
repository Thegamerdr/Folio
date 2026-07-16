// readerFallbackReason — a tiny module-level handoff from the reader (IntakeScreen) to the honest
// fallback screens (PdfFallbackScreen / ImageFallbackScreen).
//
// The Nav contract (`nav.go(screen: ScreenId)`) carries no payload, so a reader that DOES know why a
// local read failed (unsupported file, low-confidence OCR, encrypted export)
// had nowhere to hand that reason to the fallback screen; today it only reaches a toast, which the
// fallback screen never sees once it has dismissed. This mirrors the existing module-level handoff
// pattern already used by Toast.tsx's `showToast` (a plain function + module-level state, no
// provider/context plumbing) — sized for exactly one pending value, not a general nav-payload system.
//
// Consume-once by design: `consumeReaderFallbackReason()` clears the slot as it reads it, so a stale
// reason from an earlier read can never leak into an unrelated later visit to the fallback screen
// (e.g. the user backs out, tries a different file, and THIS time the reader doesn't know why it
// failed — the fallback must fall back to its generic copy, not repeat the previous file's reason).

let pendingReason: string | undefined;
let pendingEvidenceId: string | undefined;

/** Called by the reader right before routing to a fallback screen, when it has a specific reason. */
export function setReaderFallbackReason(reason: string | undefined): void {
  pendingReason = reason;
}

/** Called once by the fallback screen on mount. Reads AND clears the slot (consume-once). */
export function consumeReaderFallbackReason(): string | undefined {
  const reason = pendingReason;
  pendingReason = undefined;
  return reason;
}

/** Binds the next fallback surface to the exact encrypted original retained by the reader. */
export function setReaderFallbackEvidenceId(evidenceId: string | undefined): void {
  pendingEvidenceId = evidenceId;
}

/** Reads and clears the encrypted-original handoff so it cannot leak into a later import. */
export function consumeReaderFallbackEvidenceId(): string | undefined {
  const evidenceId = pendingEvidenceId;
  pendingEvidenceId = undefined;
  return evidenceId;
}
