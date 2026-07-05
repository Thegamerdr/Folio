// HiddenReviewSheet — the faithful 1:1 React Native port of the web un-hide list
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetHiddenReview.tsx).
//
// @rn-sheet     HiddenReviewSheet
// @purpose      Show the list of intake candidates the user tapped "Ignore" on. Un-hiding a row
//               means the next matching intake will surface again.
// @reads        ignoredReviewSigs (REAL — apps/mobile/src/folio/store.ts)
// @writes       unhideReviewSig (REAL — removes the signature so the candidate can surface again)
// @copy         FROZEN — '@/folio/copy/copy' `copy.hidden.*`, verbatim from the web source. Plain
//               "Hidden", never "ignored"/"blacklisted".
// @tokens       --surface (sheet body, inherited from Sheet) · --inset (row + empty-well fill) ·
//               --hairline (row + empty-well border) · --muted-ink (labels/meta/Done) · --ink (row
//               name)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press 0.97 on Un-hide + Done;
//               collapses to final state under reduce-motion (MOTION.md)
//
// STATES — this sheet has exactly two branches, both honest, neither an error:
//   • populated — the signature list, newest-first (store prepends), each row showing merchant +
//     amount + date with an "Un-hide" action.
//   • empty     — "Nothing hidden yet." (not <EmptyState> — this is a plain in-sheet line, not a
//     doorway with Melo; the web source renders it as a muted inset well, no mascot).
// No loading/error/offline branch: reading + writing `ignoredReviewSigs` is a synchronous local
// store operation, identical to EditItemSheet/LogSpendSheet's local-only writes.
//
// Signatures are stored `merchant|amountCents|date` (store.ts `reviewCandidateSig`) — this sheet
// splits for display but never re-guesses the merchant casing, matching the web source's `parseSig`.
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme' (which
// re-exports the pressure-map kit). Nothing new is defined — no colour, font, spacing, radius, or
// dependency. This sheet OWNS its Sheet host (visible / onClose), mounted as a sibling in the shell —
// mirroring the SubCaughtSheet/EditItemSheet/OnboardingSheet pattern.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, magnitude, radius, Sheet, useTheme, type Palette } from '@/folio/theme';
import { copy } from '@/folio/copy/copy';
import { unhideReviewSig, useAppStore } from '@/folio/store';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type HiddenReviewSheetProps = {
  visible: boolean;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Signature parsing — mirrors the web `parseSig`. `merchant|amountCents|date`; any missing part
// degrades to an empty string rather than throwing, so a malformed signature still renders a row.
// ---------------------------------------------------------------------------

function parseSig(sig: string): { merchant: string; amount: number; date: string } {
  const parts = sig.split('|');
  const merchant = parts[0] ?? '';
  const centsStr = parts[1] ?? '0';
  const date = parts[2] ?? '';
  return { merchant, amount: Number(centsStr) / 100, date };
}

export function HiddenReviewSheet({ visible, onClose }: HiddenReviewSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const sigs = useAppStore((state) => state.ignoredReviewSigs ?? []);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text accessibilityRole="header" style={s.headline}>
          {copy.hidden.title.replace(/\*\*/g, '')}
        </Text>
        <Text style={s.subhead}>{copy.hidden.body}</Text>

        {sigs.length === 0 ? (
          <View style={s.emptyWell}>
            <Text style={s.emptyText}>{copy.hidden.empty}</Text>
          </View>
        ) : (
          <View style={s.list}>
            {sigs.map((sig) => {
              const { merchant, amount, date } = parseSig(sig);
              return (
                <View key={sig} style={s.row}>
                  <View style={s.rowText}>
                    <Text numberOfLines={1} style={s.rowName}>
                      {merchant || '—'}
                    </Text>
                    <Text style={s.rowMeta}>
                      {magnitude(Math.round(amount * 100))}
                      {date ? ` · ${date}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${copy.hidden.unhide} ${merchant || '—'}`}
                    hitSlop={8}
                    onPress={() => unhideReviewSig(sig)}
                    style={({ pressed }) => [s.unhide, pressed ? s.pressed : undefined]}
                  >
                    <Text style={s.unhideLabel}>{copy.hidden.unhide}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.hidden.done}
          onPress={onClose}
          style={({ pressed }) => [s.done, pressed ? s.pressed : undefined]}
        >
          <Text style={s.doneLabel}>{copy.hidden.done}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette (makeStyles(t) per the kit pattern).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Web: px-1 pb-2 inside the sheet body.
    body: {
      paddingBottom: gap.sm,
    },
    // Fraunces 22px headline (web font-display text-[22px] leading-tight). The **accent** marker on
    // "from Review" is dropped here — this sheet has no accent-splitting need beyond the plain
    // display line (the web renders it terracotta via <em>, a refinement left for a follow-up visual
    // pass since no accent-capable Headline primitive is imported by this sheet's siblings).
    headline: {
      color: t.ink,
      fontSize: 22,
      lineHeight: 26,
    },
    // Muted 13px body copy, relaxed leading, mt-2 (web text-[13px] text-muted-ink leading-relaxed).
    subhead: {
      color: t.muted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: gap.sm,
    },
    // Empty well — inset fill, hairline border, rounded-2xl, centred text (web mt-6 bg-inset
    // hairline rounded-2xl px-5 py-6 text-center).
    emptyWell: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg + gap.xs, // mt-6 ≈ 24, nearest scale step
      paddingHorizontal: gap.lg + gap.xs,
      paddingVertical: gap.lg,
    },
    emptyText: {
      color: t.muted,
      fontSize: 13,
      textAlign: 'center',
    },
    // Row list — mt-5 space-y-2 (web).
    list: {
      gap: gap.sm,
      marginTop: gap.lg + gap.xs,
    },
    // Each row — inset fill, hairline, rounded-xl, px-4 py-3, items-center gap-3 (web).
    row: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      columnGap: gap.md,
      flexDirection: 'row',
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    rowText: {
      flex: 1,
    },
    // 14px ink merchant name, truncated to one line (web truncate).
    rowName: {
      color: t.ink,
      fontSize: 14,
    },
    // 11.5px muted tabular meta (amount + date).
    rowMeta: {
      color: t.muted,
      fontSize: 11.5,
      fontVariant: ['tabular-nums'],
    },
    // Un-hide — ghost pill, h-9, px-3, rounded-lg, hairline border, 12px muted label (web).
    unhide: {
      alignItems: 'center',
      borderColor: t.hairline,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      height: 36,
      justifyContent: 'center',
      paddingHorizontal: gap.md,
    },
    unhideLabel: {
      color: t.muted,
      fontSize: 12,
    },
    // Done — full-width ghost, h-11 (44), rounded-xl, hairline, mt-5, 13px muted centred (web).
    done: {
      alignItems: 'center',
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      height: 44,
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    doneLabel: {
      color: t.muted,
      fontSize: 13,
      textAlign: 'center',
    },
    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
