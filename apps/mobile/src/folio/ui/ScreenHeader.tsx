// ScreenHeader — the shared header primitive every screen should use.
//
// Faithful RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/shell/ScreenHeader.tsx):
// a back glyph (left, >=44px tap target), an optional uppercase eyebrow + title (centre,
// truncating), and a trailing slot (right) — chip, button, icon. The back button hides when
// `onBack` is not supplied.
//
// RETROFIT (screen-headers lane, 2026-07): this is now the ADOPTED shared primitive for all 7
// screens that used to roll a local `Header` (PotsScreen, PlansScreen, CalendarScreen,
// InsightsScreen, ShortfallScreen, SubscriptionsScreen, TimelineScreen). Auditing all 7 local
// Headers found they are visually equivalent in SHAPE (back glyph · centred uppercase eyebrow ·
// balancing spacer, `justify-content: space-between` row) but NOT in exact geometry — the
// spacer/back-hit widths and eyebrow type sizes drifted screen to screen as each was ported
// independently:
//   • spacer/back-hit width: 16 (Shortfall) · 20 (Pots/Plans/Insights) · 44 (Calendar/Subs/Timeline)
//   • eyebrow fontSize/letterSpacing: 11/1.54 (Shortfall) · 12/1.68-1.7 (the other six)
//   • back glyph: several custom SVGs and plain text arrows
// Geometry remains configurable so the retrofit does not shift screen composition, but product
// chrome now resolves through the canonical 20px Lucide back icon at one stroke weight. The legacy
// `arrow` prop is temporarily accepted while call sites are removed; it no longer changes the icon.
// The row itself uses `justify-content: space-between` (not a flex-1 title
// cell) because that's what all 7 source screens actually use; `trailing` still exists for the
// original flex-1 contract but is unused by the 7 retrofits (none of them had a right-hand slot).
//
// Nothing new is defined here — no colour, font, spacing, or radius token; it composes only
// confirmed exports from '@/folio/theme' (gap, useTheme) plus a local inline back-arrow SVG that
// mirrors the one every existing screen already draws (20x20, stroke-based, no fill).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, useTheme } from '@/folio/theme';
import { ProductIcon } from './ProductIcon';

export type ScreenHeaderProps = {
  /** Back handler. Omit to hide the back button (web: `onBack` optional). */
  onBack?: () => void;
  /** Centre title — Fraunces-less plain title text, truncates. */
  title?: string;
  /** Small uppercase kicker above the title (used by screens like Shortfall). */
  eyebrow?: string;
  /** Right-aligned slot — chip, button, icon. Never collapses the title (shrink-0 on web). */
  trailing?: ReactNode;
  /**
   * Back-hit / spacer width in px. Every retrofit screen keeps its own confirmed value so the
   * eyebrow stays optically centred exactly as it did with the local Header:
   * 16 (Shortfall) · 20 (Pots/Plans/Insights) · 44 (Calendar/Subscriptions/Timeline).
   */
  spacerWidth?: number;
  /** Back tap-target width. Independent of spacerWidth on some screens (Pots/Plans/Insights/
   *  Shortfall use a 24px-wide hit box with a 20/16px spacer). Defaults to spacerWidth. */
  backHitWidth?: number;
  /** Back tap-target min-height. All 7 screens use 44 except Timeline (unset/auto). */
  backHitHeight?: number;
  /** Eyebrow fontSize. 12 everywhere except Shortfall's 11. */
  eyebrowSize?: number;
  /** Eyebrow letterSpacing (RN points, not em). Confirmed per screen: 1.7 (Pots/Plans) · 1.68
   *  (Calendar/Insights/Timeline) · 1.54 (Shortfall). */
  eyebrowTracking?: number;
  /** Eyebrow fontWeight. Pots/Plans set '600'; the other four leave it unset (default 400). */
  eyebrowWeight?: '400' | '600';
  /** @deprecated Product chrome always uses the canonical Lucide back icon. */
  arrow?: 'svg' | 'text';
  /** Back-hit alignItems. Calendar/Subscriptions use 'flex-start' (glyph hugs the left edge);
   *  everything else centres. */
  backHitAlign?: 'center' | 'flex-start';
};

export function ScreenHeader({
  onBack,
  title,
  eyebrow,
  trailing,
  spacerWidth = 20,
  backHitWidth,
  backHitHeight = 44,
  eyebrowSize = 12,
  eyebrowTracking = 1.7,
  eyebrowWeight,
  backHitAlign = 'center',
}: ScreenHeaderProps) {
  const t = useTheme();
  const resolvedBackHitWidth = backHitWidth ?? spacerWidth;

  // Retrofit shape: no trailing slot → three bare siblings in a space-between row (back-hit ·
  // eyebrow/title text · spacer), exactly what all 7 source screens render. No flex-1 wrapper
  // around the middle text — the row's own space-between + matched back-hit/spacer widths are
  // what centre it, same as the originals.
  const titleNode = (
    <>
      {eyebrow !== undefined ? (
        <Text
          style={[
            styles.eyebrow,
            {
              color: t.muted,
              fontSize: eyebrowSize,
              letterSpacing: eyebrowTracking,
              fontWeight: eyebrowWeight ?? '400',
            },
          ]}
          numberOfLines={1}
        >
          {eyebrow}
        </Text>
      ) : null}
      {title !== undefined ? (
        <Text style={[styles.title, { color: t.ink }]} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [
            styles.backHit,
            {
              minWidth: resolvedBackHitWidth,
              minHeight: backHitHeight,
              alignItems: backHitAlign,
            },
            pressed ? styles.pressed : undefined,
          ]}
        >
          <ProductIcon color={t.muted} name="back" />
        </Pressable>
      ) : (
        <View style={{ width: resolvedBackHitWidth, minHeight: backHitHeight }} />
      )}

      {trailing !== undefined ? <View style={styles.titleCell}>{titleNode}</View> : titleNode}

      {trailing !== undefined ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : (
        <View style={{ width: spacerWidth }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backHit: {
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  titleCell: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: gap.sm,
    justifyContent: 'flex-end',
  },
});
