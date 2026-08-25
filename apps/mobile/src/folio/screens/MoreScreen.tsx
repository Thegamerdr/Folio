// MoreScreen — native presentation of the pinned Lovable More hub.
//
// Visual and copy authority:
//   private-money-pilot@ad90b4fee36c58be156e145e8663d8c6be1bf0eb
//   src/components/folio/screens/ScreenMore.tsx
//
// Native remains the authority for workspace switching, appearance persistence, notification
// permission/state, accessibility state, account data and privacy controls. A few Lovable child
// routes are not yet present in the native ScreenId registry; their temporary bindings below keep
// those native authorities reachable without pretending the missing destinations exist.

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRight, gap, radius, serif, useTheme, weightFamily } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { showStatusDialog } from '@/folio/ui/statusDialogs';
import {
  DEFAULT_REMINDERS_SETTINGS,
  loadRemindersSettings,
  saveRemindersSettings,
  type RemindersSettings,
} from '@/folio/lib/notifySettings';
import { getPermissionState, requestPermission } from '@/folio/lib/notifications';
import { forceRescheduleNow } from '@/folio/lib/notifyScheduler';
import type { PermissionState } from '@/folio/lib/notifications';
import type { Nav, ScreenId, SheetId } from '@/folio/types';

function useReminders(): {
  settings: RemindersSettings;
  permission: PermissionState;
  toggleEnabled: () => void;
} {
  const [settings, setSettings] = useState(DEFAULT_REMINDERS_SETTINGS);
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [saved, currentPermission] = await Promise.all([
        loadRemindersSettings(),
        getPermissionState(),
      ]);
      if (!mounted) return;
      setSettings(saved);
      setPermission(currentPermission);
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
      if (next.remindersEnabled && permission !== 'granted') {
        setPermission(await requestPermission());
      }
      forceRescheduleNow();
    })();
  };

  return { settings, permission, toggleEnabled };
}

function useAccessibilityDescription(): () => void {
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

  return () => {
    const motion = reducedMotion === null ? 'still being checked' : reducedMotion ? 'on' : 'off';
    showStatusDialog('dialog.more-accessibility-info', {
      message: `Melo follows your device text size and reduced-motion preference. Reduced motion is ${motion}.`,
    });
  };
}

export type MoreState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type MoreScreenProps = {
  nav: Nav;
  state?: MoreState;
};

type MoreRow = {
  label: string;
  meta: string;
  to?: ScreenId;
  sheet?: SheetId;
  onPress?: () => void;
};

type MoreSection = {
  eyebrow: string;
  title: string;
  accessibilityLabel: string;
  rows: MoreRow[];
  note?: string;
};

export function MoreScreen({ nav, state = 'populated' }: MoreScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reminders = useReminders();
  const describeAccessibility = useAccessibilityDescription();

  const describeAiAutomation = () => {
    showStatusDialog('dialog.more-ai-transparency-info');
  };

  // ScreenMore.tsx is the exact composition authority. These are its five sections and ten rows in
  // source order. Temporary native bindings are intentionally local and are called out inline:
  // global-search, notifications, accessibility, connections, trust and ai-transparency need
  // shared ScreenId + shell owners before their navigation can become byte-for-byte equivalent.
  const sections: MoreSection[] = [
    {
      eyebrow: 'Find',
      title: 'Go straight there',
      accessibilityLabel: 'Find and jump',
      rows: [
        {
          label: 'Search Melo',
          meta: 'jump to pots, subscriptions, settings and actions',
          // Native has no global-search ScreenId yet. The existing Melo doorway is the only honest
          // search/help authority available from this screen until the shared registry is extended.
          onPress: () => nav.openMelo(),
        },
      ],
    },
    {
      eyebrow: 'Workspace',
      title: 'Switch workspace',
      accessibilityLabel: 'Workspace',
      rows: [
        {
          label: 'Switch to Business',
          meta: 'keep Personal and Business money separate',
          onPress: () => nav.openWorkspace?.(),
        },
      ],
    },
    {
      eyebrow: 'Your Melo',
      title: 'Looks, alerts and behaviour',
      accessibilityLabel: 'Your Melo',
      rows: [
        {
          label: 'Appearance',
          meta: 'light, dark or follow your device',
          // Appearance is already a persisted native sheet. Keep that authority until the shared
          // `appearance` screen route exists.
          sheet: 'appearance',
        },
        {
          label: 'Notifications',
          meta: 'what Melo may say, and when',
          // The native notification module owns permission and scheduling. Its dedicated source
          // route is not registered in native yet, so this remains the existing explicit toggle.
          onPress: reminders.toggleEnabled,
        },
        {
          label: 'Accessibility',
          meta: 'text, contrast, motion and companion restraint',
          // Native accessibility follows the OS. The dedicated source route is a shared-registry
          // dependency; this preserves the existing truthful device-state explanation meanwhile.
          onPress: describeAccessibility,
        },
        {
          label: 'Melo',
          meta: 'memory, wardrobe, quiet and conversation',
          to: 'melo',
        },
      ],
    },
    {
      eyebrow: 'Account & money',
      title: 'Identity and sources',
      accessibilityLabel: 'Account and money',
      rows: [
        {
          label: 'Account and plan',
          meta: 'identity, access and paid plan',
          to: 'account',
        },
        {
          label: 'Money sources',
          meta: 'manual, file and available connections',
          // The native account surface currently owns money-source controls. A separate
          // `connections` ScreenId is a shared-shell dependency.
          to: 'account',
        },
      ],
    },
    {
      eyebrow: 'Privacy & control',
      title: 'Data and decisions',
      accessibilityLabel: 'Privacy and control',
      rows: [
        {
          label: 'Data and privacy',
          meta: 'what Melo reads, backup, export, deletion and app lock',
          // PrivacyScreen is the current native authority for these controls; the pinned source's
          // intermediate `trust` hub is not registered in the native shell yet.
          to: 'privacy',
        },
        {
          label: 'AI and automation',
          meta: 'what the model sees and when Melo asks first',
          // Preserve the existing truthful Review-before-truth explanation until the shared
          // `ai-transparency` route is available.
          onPress: describeAiAutomation,
        },
      ],
      note: 'Nothing is connected, shared or deleted without an explicit step from you.',
    },
  ];

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

  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One second — gathering everything else." />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        accessibilityLabel="More"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            // The shell begins behind Android's status bar. Source product content starts 8px
            // below the status area, so the physical inset and mt-2 are both owned here.
            paddingTop: insets.top + gap.sm,
            paddingBottom: gap.xl,
          },
        ]}
      >
        <View style={styles.hero}>
          {/* ScreenMore reserves a 64px semantic companion perch here. The visible companion is a
              shell-level overlay in Lovable; native does not yet have that shared resolver. Keep
              the exact anchor geometry without drawing a screen-owned substitute. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.perch}
          />
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>The quiet hub</Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {'Everything else, '}
              <Text style={[styles.headingAccent, { color: t.calm }]}>calmly</Text>
              {'.'}
            </Text>
          </View>
        </View>

        {sections.map((section) => (
          <View key={section.eyebrow} style={styles.section}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>{section.eyebrow}</Text>
            <Text style={[styles.sectionTitle, { color: t.ink }]} numberOfLines={1}>
              {section.title}
            </Text>
            <View
              accessibilityLabel={section.accessibilityLabel}
              style={[styles.list, { backgroundColor: t.surface, borderColor: t.hairline }]}
            >
              {section.rows.map((row, index) => (
                <View key={row.label}>
                  {index > 0 ? (
                    <View style={[styles.divider, { backgroundColor: t.hairline }]} />
                  ) : null}
                  <MoreRowView nav={nav} row={row} />
                </View>
              ))}
            </View>
            {section.note ? (
              <Text style={[styles.note, { color: t.muted }]}>{section.note}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

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
    if (row.to) nav.go(row.to);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : undefined]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color: t.ink }]} numberOfLines={2}>
          {row.label}
        </Text>
        <Text style={[styles.rowMeta, { color: t.muted }]} numberOfLines={2}>
          {row.meta}
        </Text>
      </View>
      <View style={styles.chevron}>
        <ChevronRight color={t.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, paddingHorizontal: gap.xl },
  content: {
    paddingHorizontal: gap.xl,
  },
  // Source: mt-2 flex items-start gap-4; the 64px perch and text column form the whole hero.
  hero: {
    alignItems: 'flex-start',
    columnGap: gap.lg,
    flexDirection: 'row',
  },
  perch: {
    flexShrink: 0,
    height: 64,
    width: 64,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: gap.xs,
  },
  // Source Eyebrow: 11 / 1.5, uppercase, 0.14em tracking.
  eyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16.5,
    textTransform: 'uppercase',
  },
  // Source TYPE.display: 28 / 1.15, Fraunces 400. Web applies the family tracking (-0.02em).
  heading: {
    fontFamily: serif.display,
    fontSize: 28,
    letterSpacing: -0.56,
    lineHeight: 32.2,
    marginTop: gap.xs,
  },
  headingAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // Default Section rank is secondary: exactly 32px above every section.
  section: {
    marginTop: gap.xxl,
  },
  // Source TYPE.bodyLarge: Inter Tight 500, 16 / 1.5, mt-1.
  sectionTitle: {
    fontFamily: weightFamily(500),
    fontSize: 16,
    lineHeight: 24,
    marginTop: gap.xs,
  },
  // Source ListGroup: raised surface, 18px radius, 1px hairline, mt-3, px-4.
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: gap.md,
    overflow: 'hidden',
    paddingHorizontal: gap.lg,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  // Source Row: min-h-11, gap-3, py-3. Horizontal inset belongs to ListGroup, not each row.
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    minHeight: 44,
    paddingVertical: gap.md,
  },
  rowPressed: {
    transform: [{ scale: 0.97 }],
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  // Source secondary Row: TYPE.body (14 / 1.55), regular weight.
  rowLabel: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 21.7,
  },
  // Source TYPE.small: 12.5 / 1.5, mt-0.5.
  rowMeta: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 18.75,
    marginTop: 2,
  },
  chevron: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  note: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 18.75,
    marginTop: gap.md,
  },
});
