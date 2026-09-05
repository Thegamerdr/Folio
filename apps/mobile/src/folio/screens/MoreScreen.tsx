// MoreScreen — native presentation of the pinned Lovable More hub.
//
// Visual and copy authority:
//   private-money-pilot@ad90b4fee36c58be156e145e8663d8c6be1bf0eb
//   src/components/folio/screens/ScreenMore.tsx
//
// Native remains the authority for workspace switching, appearance persistence, notification
// permission/state, accessibility state, account data and privacy controls. A few Lovable child
// Search and notification controls stay local-first: navigation targets are real shell routes and
// notification state is only enabled after the OS permission is granted.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
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
  error: string | null;
  busy: boolean;
  toggleEnabled: (enabled: boolean) => void;
} {
  const [settings, setSettings] = useState(DEFAULT_REMINDERS_SETTINGS);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const refresh = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const [saved, currentPermission] = await Promise.all([
          loadRemindersSettings(),
          getPermissionState(),
        ]);
        if (!mountedRef.current) return;
        setSettings(saved);
        setPermission(currentPermission);
        setError(null);
      } catch {
        if (mountedRef.current) setError('Notification settings could not be checked. Try again.');
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    };
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, []);

  const toggleEnabled = (enabled: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const saved = await loadRemindersSettings();
        let nextPermission = enabled ? await getPermissionState() : permission;
        if (enabled && nextPermission !== 'granted') nextPermission = await requestPermission();
        const next = { ...saved, remindersEnabled: enabled && nextPermission === 'granted' };
        if (!(await saveRemindersSettings(next))) throw new Error('Preference was not saved.');
        forceRescheduleNow();
        if (!mountedRef.current) return;
        setSettings(next);
        setPermission(nextPermission);
        if (enabled && nextPermission !== 'granted') {
          setError(
            'Notifications are blocked. Allow them in device settings to turn reminders on.',
          );
        }
      } catch {
        if (mountedRef.current) setError('Notification change could not be saved. Try again.');
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    })();
  };

  return { settings, permission, error, busy, toggleEnabled };
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
  trailing?: ReactNode;
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
  // source order. Search is a real local route; notification state is surfaced from its persisted
  // preference plus the current OS permission.
  const sections: MoreSection[] = [
    {
      eyebrow: 'Find',
      title: 'Go straight there',
      accessibilityLabel: 'Find and jump',
      rows: [
        {
          label: 'Search Melo',
          meta: 'jump to pots, subscriptions, settings and actions',
          to: 'search',
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
          // Appearance is already a persisted native sheet.
          sheet: 'appearance',
        },
        {
          label: 'Notifications',
          meta:
            reminders.settings.remindersEnabled && reminders.permission === 'granted'
              ? 'On · permission granted'
              : reminders.permission === 'denied'
                ? 'Off · permission denied'
                : reminders.permission === 'granted'
                  ? 'Off · permission granted'
                  : 'Off · permission not granted',
          trailing: (
            <Switch
              accessibilityLabel="Notifications"
              disabled={reminders.busy}
              accessibilityState={{
                checked: reminders.settings.remindersEnabled && reminders.permission === 'granted',
                disabled: reminders.busy,
              }}
              onValueChange={reminders.toggleEnabled}
              trackColor={{ false: t.inset, true: t.calmSoft }}
              thumbColor={
                reminders.settings.remindersEnabled && reminders.permission === 'granted'
                  ? t.calm
                  : t.muted
              }
              value={reminders.settings.remindersEnabled && reminders.permission === 'granted'}
            />
          ),
        },
        {
          label: 'Accessibility',
          meta: 'text, contrast, motion and companion restraint',
          // Native accessibility follows the OS, so this remains a truthful device-state explanation.
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
          to: 'connections',
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
          // PrivacyScreen is the native authority for these controls.
          to: 'privacy',
        },
        {
          label: 'AI and automation',
          meta: 'what the model sees and when Melo asks first',
          // Preserve the existing truthful Review-before-truth explanation.
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
    <View style={[styles.root, { backgroundColor: t.canvas, paddingTop: insets.top }]}>
      <ScrollView
        accessibilityLabel="More"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            // Keep the inset on the fixed viewport wrapper so it cannot scroll away beneath the
            // Android status bar. The content's own breathing room remains scrollable.
            paddingTop: gap.sm,
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
            {section.eyebrow === 'Your Melo' && reminders.error ? (
              <Text style={[styles.note, styles.error, { color: t.repair }]}>
                {reminders.error}
              </Text>
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
      accessibilityRole={row.trailing ? undefined : 'button'}
      accessible={row.trailing ? false : undefined}
      onPress={row.trailing ? undefined : handlePress}
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
      {row.trailing ?? (
        <View style={styles.chevron}>
          <ChevronRight color={t.muted} />
        </View>
      )}
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
  error: { marginTop: gap.sm },
});
