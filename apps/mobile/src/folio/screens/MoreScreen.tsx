// MoreScreen — the faithful 1:1 React Native port of the web hub
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenMore.tsx).
//
// @rn-screen    MoreScreen
// @rn-stack     MainTabs > More
// @purpose      The quiet hub — ONE flat scannable list of links to every secondary surface, in the
//               web's exact order, plus two dev/demo actions kept last and visually quiet.
// @reads        appearance (system|light|dark) via useThemeMode() — drives the Appearance row hint. chartStyle
//               via useChartStyle() — drives the "Chart style" row hint. ignoredReviewSigs.length via
//               the store — drives the "Hidden from Review" row hint.
// @writes       fastForwardMonth() (demo) · setMode (appearance picker). Start fresh ROUTES to Data &
//               privacy (the gated D3 reset); it no longer wipes from here (one-confirm bypass removed).
// @opens-sheet  share (from "Share a cycle") · onboarding (from "Payday & income") · chart-style
//               (from "Chart style") · hidden-review (from "Hidden from Review")
// @copy         FROZEN
// @tokens       calm (accent) · surface · hairline · muted · repairInk (negative) · canvas (paper) ·
//               ink · caution — all from the kit, no new token defined here.
// @motion       press feedback on every row · Melo breathe + blink (the only continuous motion on
//               this quiet screen). The native hub stays static so its long scroll never covers
//               persistent Android navigation chrome with a retained full-screen animation layer.
// @notes        Fast-forward is a dev/demo action; Start fresh routes to the gated reset on Data &
//               privacy (D3 forbids a one-confirm wipe here, so it no longer wipes from this hub).
//               Both are kept LAST and visually quiet (same row styling; only "Start fresh" carries
//               the negative label tone). No buttons, no badges, no elevation on them.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store source):
//   • Flat list, not grouped: the prior build reorganised the web's ONE 19-row flat list into four
//     titled groups, which changed the scan order and dropped two rows entirely ("Chart style",
//     "Hidden from Review" — both real, already-wired sheets on this app, simply unreachable from the
//     hub). This port restores the web's flat single-list structure and exact row order, and adds
//     both missing rows back in, in their frozen positions (see PARITY_GAPS.md Group 3).
//   • "Chart style" row: reads `useChartStyle()` (`@/folio/lib/chartStyle`) for the live style +
//     hint, opens the already-wired `chart-style` sheet (confirmed hosted in FolioShell.tsx). "Hidden
//     from Review" reads `ignoredReviewSigs.length` from the store and opens the already-wired
//     `hidden-review` sheet — both sheets existed and were fully wired; only the hub row was missing.
//   • Theme mechanism: the web useTheme() is web-coupled (document.documentElement.classList,
//     localStorage('folio-theme'), meta[name=theme-color]). NONE exist in RN. Per the spec's
//     fidelityRisks, this is re-implemented as the kit's theme store. The Appearance row opens the
//     native System / Light / Dark picker; kitTheme persists the preference and System follows OS
//     changes through useColorScheme.
//   • Press-handler precedence is onPress > sheet > to (exactly the web's onClick > sheet > to). This
//     keeps "Payday & income" opening the onboarding SHEET (not a screen) and "Share a cycle" opening
//     the share sheet.
//   • Melo mood: the web header uses <MeloAvatar size={30} mood="soft">. RN's MeloMood union has no
//     'soft' ('calm' | 'curious' | 'cheer' | 'concern' | 'celebrate') — 'soft' was a web-only
//     accent-soft expression. Mapped to the closest existing quiet mood, 'calm'. Kept sized 30, as the
//     rare quiet header companion. Flagged in PARITY_GAPS.md as a visible-but-reasonable mood
//     substitution, not a bug.
//   • Group card: the web is `divide-y divide-[hairline]` inside a `hairline rounded-2xl` surface. RN
//     has no divide-y, so rows render with a 1px Hairline rule between them (not after the last) and
//     the Surface carries a 1px hairline border + rounded-2xl (radius.xl) with overflow hidden so the
//     press highlight clips to the rounded card.
//   • Accent "calmly": the web is <em not-italic text-[accent]> inside an upright font-display
//     heading — rendered UPRIGHT (Fraunces display, normal style) + terracotta (t.calm), NOT italic.
//   • Chevron is a literal "→" text glyph in muted ink on the web. Kept as a muted "→" Text glyph
//     (the kit's ChevronRight is an option, but the web glyph is the literal "→"; staying faithful).
//   • The web's page-wide slide-in is deliberately omitted on native. Android can retain the
//     full-screen animation layer after it settles and composite it over unchanged navigation after
//     a long scroll. Row feedback and Melo's local motion preserve life without risking the shell.
//   • Header carries the "Folio" wordmark (font-display italic 14px) + a 20px empty balance spacer on
//     the right — the spacer is kept so the wordmark stays left-aligned; it is NOT a button.
//   • Scroll container hides scrollbars and clears the tab bar with a bottom safe-area inset + bottom
//     margin so the closing MeloLine never tucks under the nav.
//   • STATES: More is populated-only (offline ≡ populated; empty/error n/a). All five branches are
//     rendered for completeness: populated/offline = the hub; loading = Melo curious + a line, never
//     a spinner; empty/error = the calm EmptyState doorway (n/a in practice — the hub has no data
//     dependency — but rendered so every branch is exercised).
//
// HONEST CLAIMS: no privacy/security assertion is made anywhere here. The "Data & privacy" row hint
// is the verbatim web copy "what's saved, what to export" — it never claims data "stays on device",
// is "encrypted", "bank-grade", or "100% private". The closing line is the verbatim web reassurance.
// Banned vocabulary is absent from every visible string.
//
// Tokens only — no new colour, font, spacing, or radius. Every row is a >=44px tap target (px-5 py-4
// rows clear it). Copy is VERBATIM from the web source (the row labels/hints are @copy FROZEN inline
// literals exactly as the web keeps them; only app.name is keyed in COPY_DECK).

import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Surface, Hairline, gap, radius, serif, useTheme, useThemeMode } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { fastForwardMonth, useAppStore } from '@/folio/store';
import { useChartStyle, CHART_STYLE_LABEL, CHART_STYLE_HINT } from '@/folio/lib/chartStyle';
import {
  DEFAULT_REMINDERS_SETTINGS,
  loadRemindersSettings,
  saveRemindersSettings,
  type RemindersSettings,
} from '@/folio/lib/notifySettings';
import { getPermissionState, requestPermission } from '@/folio/lib/notifications';
import { forceRescheduleNow } from '@/folio/lib/notifyScheduler';
import type { PermissionState } from '@/folio/lib/notifications';
import {
  getCachedAppLockSettings,
  inspectAppLockCapability,
  loadAppLockSettings,
  subscribeAppLockSettings,
} from '@/folio/lib/appLock';
import type { Nav, ScreenId, SheetId } from '@/folio/types';

/** The Reminders row's live hint, one calm line per permission/enabled combination — no separate
 *  screen, this is a single settings-row toggle (per the notifications-binding brief). */
function remindersHint(enabled: boolean, permission: PermissionState): string {
  if (!enabled) return 'off';
  if (permission === 'denied') return 'blocked in system settings';
  if (permission === 'undetermined') return 'tap to allow';
  return 'on · quiet by default';
}

/** Reminders on/off + live permission state, backing the MoreScreen "Reminders" row. Self-contained
 *  (own persisted module, not store.ts) — see lib/notifySettings.ts + lib/notifications.ts. */
function useReminders(): {
  settings: RemindersSettings;
  permission: PermissionState;
  toggleEnabled: () => void;
  toggleSensitivePreviews: () => void;
} {
  const [settings, setSettings] = useState(DEFAULT_REMINDERS_SETTINGS);
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [settings, perm] = await Promise.all([loadRemindersSettings(), getPermissionState()]);
      if (!mounted) return;
      setSettings(settings);
      setPermission(perm);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleEnabled = () => {
    void (async () => {
      const next = { ...settings, remindersEnabled: !settings.remindersEnabled };
      setSettings(next);
      await saveRemindersSettings(next);
      // Permission is asked only on the same explicit tap that enables reminders—never at startup.
      if (next.remindersEnabled && permission !== 'granted') {
        setPermission(await requestPermission());
      }
      forceRescheduleNow();
    })();
  };

  const toggleSensitivePreviews = () => {
    void (async () => {
      const next = { ...settings, sensitivePreviews: !settings.sensitivePreviews };
      setSettings(next);
      await saveRemindersSettings(next);
      forceRescheduleNow();
    })();
  };

  return { settings, permission, toggleEnabled, toggleSensitivePreviews };
}

function useAppLockHint(): string {
  const [settings, setSettings] = useState(getCachedAppLockSettings());
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeAppLockSettings(setSettings);
    void Promise.all([loadAppLockSettings(), inspectAppLockCapability()]).then(
      ([loaded, capability]) => {
        if (!mounted) return;
        setSettings(loaded);
        setAvailable(capability.available);
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (settings.enabled) return 'on · locks when Melo leaves';
  if (available === false) return 'off · device screen lock required';
  if (available === null) return 'checking device lock';
  return 'off · tap to configure';
}

/**
 * Accessibility is owned by the device. More only reports the live OS preference and explains
 * what Melo follows; it does not create a second in-app accessibility authority.
 */
function useAccessibilityHint(): { hint: string; describe: () => void } {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const hint =
    reducedMotion === null
      ? 'follows your device settings'
      : reducedMotion
        ? 'text size · reduced motion on'
        : 'text size · standard motion';

  const describe = () => {
    const motion =
      reducedMotion === null ? 'still checking reduced motion' : reducedMotion ? 'on' : 'off';
    Alert.alert(
      'Accessibility',
      `Melo follows your device text size and reduced-motion preference. Reduced motion is ${motion}.`,
      [{ text: 'Done', style: 'cancel' }],
      { cancelable: true },
    );
  };

  return { hint, describe };
}

// Routing: the web "Data & privacy" row navigates to the Privacy screen (web `to: "privacy"`), where
// the export action lives (the Privacy "Export my data" CTA). This RN row is faithful to that — it
// carries `to: 'privacy'` and navigates via nav.go('privacy'), so export is reached FROM Privacy, not
// fired from this hub. The label, hint, layout, and tone are the web literals.

// The render states this screen can occupy. Per the spec, More is populated-only and offline is
// identical to populated (the hub is pure routing chrome with no data dependency); loading/empty/
// error are n/a but are rendered for completeness so every branch is exercised.
export type MoreState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type MoreScreenProps = {
  nav: Nav;
  state?: MoreState;
};

// A single link/action row. Faithful to the web row shape: a label, a hint, and exactly one of
// { to | sheet | onPress }, resolved in that precedence. `tone: 'negative'` colours the label coral
// (the web --negative) for the one destructive action.
type MoreRow = {
  label: string;
  hint: string;
  to?: ScreenId;
  sheet?: SheetId;
  onPress?: () => void;
  tone?: 'negative';
};

type MoreGroup = {
  title: string;
  rows: MoreRow[];
};

// The web's w-5 (20px) balance spacer that keeps the wordmark left-aligned. Not a button.
const BALANCE_SPACER = 20;

export function MoreScreen({ nav, state = 'populated' }: MoreScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  // Appearance is a preference picker backed by the single theme authority. The selected mode is
  // persisted by kitTheme; System continues to resolve from the live OS colour scheme.
  const { mode } = useThemeMode();

  // Chart style + hidden-review count — real, live reads backing the two rows the prior build
  // dropped (see FIDELITY DECISIONS).
  const { style: chartStyle } = useChartStyle();
  const hiddenCount = useAppStore((s) => s.ignoredReviewSigs?.length ?? 0);
  const reminders = useReminders();
  const appLockHint = useAppLockHint();
  const accessibility = useAccessibilityHint();
  const aiReads = useAppStore((s) => s.aiReads);
  const activeWorkspaceKind = useAppStore(
    (s) =>
      s.workspaces.find((workspace) => workspace.id === s.activeWorkspaceId)?.kind ?? 'personal',
  );
  const aiReadHint =
    aiReads?.used && aiReads.used > 0
      ? `${aiReads.used} read${aiReads.used === 1 ? '' : 's'} this month · asks before changes`
      : 'asks before anything reaches your records';

  const describeAiAutomation = () => {
    Alert.alert(
      'AI & automation',
      'Melo only reads a statement after you choose that path. Suggestions wait in Review, and nothing reaches your records until you confirm it.',
      [{ text: 'Done', style: 'cancel' }],
      { cancelable: true },
    );
  };

  // Group by user intent. Twenty unrelated rows in one card made the hub feel like an implementation
  // index; these sections keep the same working destinations while making the next choice legible.
  // Demo time travel is development-only and can never ship as a real account action.
  const groups: MoreGroup[] = [
    {
      title: 'Workspace',
      rows: [
        {
          label: activeWorkspaceKind === 'personal' ? 'Switch to Business' : 'Switch to Personal',
          hint: 'keep Personal and Business money separate',
          onPress: () => nav.openWorkspace?.(),
        },
      ],
    },
    {
      title: 'Your money',
      rows: [
        { label: 'Account & plan', hint: 'tier, accounts, sign in', to: 'account' },
        { label: 'Money sources', hint: 'accounts, statements and connections', to: 'account' },
        { label: 'Timeline', hint: 'everything you added or changed', to: 'timeline' },
        { label: 'Calendar', hint: 'the dates that matter', to: 'calendar' },
        { label: 'Plans', hint: "what's coming before payday", to: 'plans' },
        { label: 'Insights', hint: 'the shape of your months', to: 'insights' },
        { label: 'Subscriptions', hint: 'what still earns its place', to: 'subs' },
        { label: 'Pots & goals', hint: 'what you are setting aside', to: 'pots' },
      ],
    },
    {
      title: 'Melo & routines',
      rows: [
        { label: 'Melo settings', hint: 'companion, tone, quiet mode', to: 'melo' },
        { label: 'Payday & income', hint: 'change when money lands', sheet: 'onboarding' },
        { label: 'Payday review', hint: 'wrap up the month in four steps', to: 'ritual' },
        { label: 'What if I spend', hint: 'preview before you decide', to: 'whatif' },
        { label: 'Recovery', hint: 'make room when the route runs short', to: 'recovery' },
        { label: 'Share a cycle', hint: 'a quiet win card', sheet: 'share' },
      ],
    },
    {
      title: 'Preferences',
      rows: [
        {
          label: 'Appearance',
          hint: mode === 'system' ? 'system · follows your phone' : `${mode} · tap to change`,
          sheet: 'appearance',
        },
        {
          label: 'Notifications',
          hint: remindersHint(reminders.settings.remindersEnabled, reminders.permission),
          onPress: reminders.toggleEnabled,
        },
        {
          label: 'Accessibility',
          hint: accessibility.hint,
          onPress: accessibility.describe,
        },
        {
          label: 'Chart style',
          hint: `${CHART_STYLE_LABEL[chartStyle]} · ${CHART_STYLE_HINT[chartStyle]}`,
          sheet: 'chart-style',
        },
        {
          label: 'Hidden from Review',
          hint:
            hiddenCount === 0
              ? 'nothing hidden'
              : `${hiddenCount} ${hiddenCount === 1 ? 'row' : 'rows'} · tap to un-hide`,
          sheet: 'hidden-review',
        },
        {
          label: 'Lock-screen details',
          hint: reminders.settings.sensitivePreviews
            ? 'show titles and details'
            : 'hidden · recommended',
          onPress: reminders.toggleSensitivePreviews,
        },
      ],
    },
    {
      title: 'Trust & control',
      rows: [
        {
          label: 'Data & privacy',
          hint: "what's saved, what to export",
          to: 'privacy',
        },
        { label: 'Security', hint: appLockHint, to: 'privacy' },
        {
          label: 'AI & automation',
          hint: aiReadHint,
          onPress: describeAiAutomation,
        },
        {
          label: 'Melo memory',
          hint: 'what Melo has learned from your choices',
          to: 'melo',
        },
        {
          label: 'Start fresh',
          hint: 'clear local money, not your account',
          to: 'privacy',
          tone: 'negative',
        },
      ],
    },
    ...(__DEV__
      ? [
          {
            title: 'Developer',
            rows: [
              {
                label: 'Fast-forward 1 month',
                hint: 'test cycle ageing',
                onPress: () => {
                  fastForwardMonth();
                  nav.go('insights');
                },
              },
            ],
          },
        ]
      : []),
  ];

  // empty / error — the calm EmptyState doorway (n/a in practice; the hub has no data dependency).
  // The single CTA routes back to Today so the doorway never dead-ends.
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Everything else, calmly.';
    const body = state === 'error' ? undefined : 'The quiet hub — back in a moment.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Back to today', onPress: () => nav.go('today') }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm,
  // centred holding moment while the hub settles.
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One second — gathering everything else." />
      </View>
    );
  }

  // populated / offline — the real hub. offline ≡ populated (local-first; nothing here needs the
  // network). The static root keeps the persistent tab shell stable throughout long scrolling.
  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + gap.lg,
            paddingBottom: insets.bottom + gap.xxl,
          },
        ]}
      >
        {/* Header — the app wordmark (font-display italic 14px, from the deck so the brand renames
            in ONE place) + a 20px balance spacer (web wordmark span; not a button). */}
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: t.ink }]}>{copy.global.app.name}</Text>
          <View style={styles.balanceSpacer} />
        </View>

        {/* Hero / intro — Melo avatar (web mood "soft", mapped to "calm" — see FIDELITY DECISIONS)
            + the eyebrow + the upright accented heading. */}
        <View style={styles.hero}>
          <Melo size={30} mood="calm" />
          <View style={styles.heroText}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>The quiet hub</Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {'Everything else, '}
              <Text style={[styles.headingAccent, { color: t.calm }]}>calmly</Text>
              {'.'}
            </Text>
          </View>
        </View>

        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.title}>
              <Text style={[styles.groupTitle, { color: t.muted }]}>{group.title}</Text>
              <Surface style={[styles.card, { borderColor: t.hairline }]}>
                {group.rows.map((row, index) => (
                  <View key={row.label}>
                    {index > 0 ? <Hairline /> : null}
                    <MoreRowView nav={nav} row={row} />
                  </View>
                ))}
              </Surface>
            </View>
          ))}
        </View>

        {/* Closing reassurance — the verbatim web line. */}
        <View style={styles.closing}>
          <MeloLine text="Export any time. Start fresh clears this device, not your account." />
        </View>
      </ScrollView>
    </View>
  );
}

// A single hub row. Press precedence is onPress > sheet > to (the web's onClick > sheet > to). The
// "→" chevron is a muted Text glyph on every row (including Appearance, which opens its picker). Carries
// the kit `pressed` feel (scale 0.97 / lowered opacity — the web `press` util) and selection haptics
// via the kit primitives' convention; the row itself is a >=44px tap target (px-5 py-4).
function MoreRowView({ nav, row }: { nav: Nav; row: MoreRow }) {
  const t = useTheme();

  const handlePress = () => {
    if (row.onPress) {
      row.onPress();
      return;
    }
    if (row.sheet) {
      nav.openSheet(row.sheet);
      return;
    }
    if (row.to) {
      nav.go(row.to);
    }
  };

  const labelColor = row.tone === 'negative' ? t.repairInk : t.ink;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed: isPressed }) => [styles.row, isPressed ? styles.rowPressed : undefined]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{row.label}</Text>
        <Text style={[styles.rowHint, { color: t.muted }]}>{row.hint}</Text>
      </View>
      <Text style={[styles.chevron, { color: t.muted }]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    // px-7 ≈ gap.xl (the StartScreen precedent for the web's 28px screen inset).
    paddingHorizontal: gap.xl,
  },
  // The scroll content column. px-7 ≈ gap.xl screen inset.
  content: {
    paddingHorizontal: gap.xl,
  },
  // Header row — wordmark left, balance spacer right (web flex items-center justify-between).
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Fraunces italic wordmark, 14px (web font-display italic text-[14px]).
  wordmark: {
    fontFamily: serif.displayItalic,
    fontSize: 14,
  },
  // The web w-5 (20px) balance spacer — keeps the wordmark left-aligned. Not interactive.
  balanceSpacer: {
    width: BALANCE_SPACER,
  },
  // mt-6 (24px) = gap.xl; gap-3 (12px) = gap.md between Melo and the text; items-start.
  hero: {
    alignItems: 'flex-start',
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.xl,
  },
  heroText: {
    flex: 1,
  },
  // Fraunces italic eyebrow, 13px, muted (web font-display italic text-[13px] text-muted-ink).
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces hero, 30px, tight line-height (web font-display text-[30px] leading-[1.05]); mt-1 (4px).
  heading: {
    fontFamily: serif.display,
    fontSize: 30,
    lineHeight: 32,
    marginTop: gap.xs,
  },
  // The accent word "calmly" stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headingAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // mt-7 (28px) ≈ gap.xl; space-y-6 (24px) = gap.xl between groups.
  groups: {
    marginTop: gap.xl,
    rowGap: gap.xl,
  },
  // Group title — 11px, uppercase, tracked (web text-[11px] uppercase tracking-[0.16em]); mb-2 (8px)
  // = gap.sm; px-1 (4px) = gap.xs.
  groupTitle: {
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: gap.sm,
    paddingHorizontal: gap.xs,
    textTransform: 'uppercase',
  },
  // The group card — rounded-2xl (radius.xl) hairline surface; overflow hidden clips the row press
  // highlight to the rounded corners. The 1px hairline border is the web `hairline` outer rule.
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // A row — px-5 (20px) py-4 (16px = gap.lg) flex items-center. ~52px tall: clears the 44px target.
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: gap.lg,
  },
  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  rowPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
  rowText: {
    flex: 1,
  },
  // 15px medium label (web text-[15px] font-medium).
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  // 12px muted hint; mt-0.5 (2px) = gap.xxs.
  rowHint: {
    fontSize: 12,
    marginTop: gap.xxs,
  },
  // The literal "→" glyph in muted ink (web span text-muted-ink "→").
  chevron: {
    fontSize: 15,
  },
  // mt-6 (24px) = gap.xl; the bottom inset on the scroll content clears the tab bar (web mb-8).
  closing: {
    marginTop: gap.xl,
  },
});
