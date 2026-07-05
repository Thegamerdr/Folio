// ScreenHeader — the shared header primitive every screen should use.
//
// Faithful RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/shell/ScreenHeader.tsx):
// a back glyph (left, >=44px tap target), an optional uppercase eyebrow + title (centre,
// truncating), and a trailing slot (right) — chip, button, icon. The back button hides when
// `onBack` is not supplied.
//
// Batch-1 note (PORT_BIBLE §7 handoff checklist / GAP_MAP.md batch-1 flag): the web primitive
// exists, but every RN screen ported so far (PotsScreen, PlansScreen, CalendarScreen,
// InsightsScreen, ShortfallScreen, SubscriptionsScreen, TimelineScreen) rolled its own local
// `Header` function instead of a shared one — each one visually equivalent (back arrow SVG +
// uppercase tracked eyebrow + balancing spacer) but duplicated 7x with no single source of
// truth. This file is the missing shared primitive so future screens (and an eventual retrofit
// of the 7 existing ones) have one place to import from. Retrofitting the existing 7 screens is
// OUT OF SCOPE for this batch (they belong to batches 3/4/7) — flagged in wiringNeeds instead of
// touched here.
//
// Nothing new is defined here — no colour, font, spacing, or radius token; it composes only
// confirmed exports from '@/folio/theme' (gap, useTheme) plus a local inline back-arrow SVG that
// mirrors the one every existing screen already draws (20x20, stroke-based, no fill).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { gap, useTheme } from '@/folio/theme';

export type ScreenHeaderProps = {
  /** Back handler. Omit to hide the back button (web: `onBack` optional). */
  onBack?: () => void;
  /** Centre title — Fraunces-less plain title text, truncates. */
  title?: string;
  /** Small uppercase kicker above the title (used by screens like Shortfall). */
  eyebrow?: string;
  /** Right-aligned slot — chip, button, icon. Never collapses the title (shrink-0 on web). */
  trailing?: ReactNode;
};

export function ScreenHeader({ onBack, title, eyebrow, trailing }: ScreenHeaderProps) {
  const t = useTheme();

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [styles.backHit, pressed ? styles.pressed : undefined]}
        >
          <BackArrow color={t.muted} />
        </Pressable>
      ) : (
        <View style={styles.backHit} />
      )}

      <View style={styles.titleCell}>
        {eyebrow !== undefined ? (
          <Text style={[styles.eyebrow, { color: t.muted }]} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        {title !== undefined ? (
          <Text style={[styles.title, { color: t.ink }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

// Back arrow — the web '←' glyph, drawn inline. Matches the SVG every existing screen's local
// Header already draws (PlansScreen/PotsScreen/etc), so a future retrofit is visually a no-op.
function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M12 4 L6 10 L12 16"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M6 10 H16" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.sm,
  },
  backHit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    marginLeft: -gap.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  titleCell: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
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
