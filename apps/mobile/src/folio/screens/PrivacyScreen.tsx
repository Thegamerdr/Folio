// Privacy controls keep local clearing separate from remote account services.
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '@/surfaces/pressureMap/Sheet';

import {
  CheckGlyph,
  ChevronRight,
  elevation,
  gap,
  pressed,
  radius,
  serif,
  useTheme,
} from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { showStatusDialog } from '@/folio/ui/statusDialogs';
import { runExport } from '@/folio/lib/exportNative';
import { applyRestore, pickRestoreFile } from '@/folio/lib/restoreNative';
import { canStartFresh, type StartFreshState } from '@/folio/lib/undoPolicy';
import { clearLocalMeloData } from '@/folio/lib/localDataDeletion';
import { privacyHistoryPresentation } from '@/folio/lib/privacyHistoryPresentation';
import { useUndo } from '@/folio/ui/useUndo';
import { useAppStore } from '@/folio/store';
import {
  changeAppLockEnabled,
  getCachedAppLockSettings,
  inspectAppLockCapability,
  loadAppLockSettings,
  subscribeAppLockSettings,
  type AppLockCapability,
} from '@/folio/lib/appLock';
import type { Nav } from '@/folio/types';

// The render states this screen can occupy. Per the spec, Privacy is populated-only and offline is
// identical to populated (local-first, no network dependency); loading/empty/error are n/a for a
// purely presentational + two-store-actions screen, but are rendered for completeness.
export type PrivacyState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PrivacyScreenProps = {
  nav: Nav;
  state?: PrivacyState;
};

// Three concise, literal claims about the shipped app. Optional remote services and local/account
// deletion are named as separate boundaries instead of implying everything stays on-device.
const HONEST_CLAIMS = [
  'No ads or behavioural tracking',
  'Bank, backup, Melo and statement services run only when you choose them',
  'Local clearing and cloud account deletion stay separate',
] as const;

// The positive check badge is a 15% alpha tint of the `positive` token (web bg-[var(--positive)]/15).
// `positive` is a 6-digit hex; append the 0x26 (~15%) alpha byte so the tint follows the theme rather
// than being a separate hard-coded colour.
const POSITIVE_TINT_ALPHA = '26'; // 0x26 / 0xFF ≈ 0.15

export function PrivacyScreen({ nav, state = 'populated' }: PrivacyScreenProps) {
  const { dismissUndo } = useUndo();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const activeWorkspaceId = useAppStore((current) => current.activeWorkspaceId);
  const activeWorkspace = useAppStore(
    (current) =>
      current.workspaces.find((workspace) => workspace.id === current.activeWorkspaceId)!,
  );
  const isBusiness = activeWorkspace.kind === 'business';
  const savedRecordCount = useAppStore((current) => current.transactions.length);
  const savedSourceCount = useAppStore((current) => current.evidenceDocuments?.length ?? 0);
  const savedAccountCount = useAppStore((current) => current.accounts?.length ?? 0);
  const savedCycles = useAppStore((current) => current.cycles);
  const savedHistory = privacyHistoryPresentation(savedCycles);
  const [appLockSettings, setAppLockSettings] = useState(getCachedAppLockSettings());
  const [appLockCapability, setAppLockCapability] = useState<AppLockCapability | null>(null);
  const [changingAppLock, setChangingAppLock] = useState(false);
  const [resetStep, setResetStep] = useState<'review' | 'confirm' | null>(null);
  const [resetGate, setResetGate] = useState<StartFreshState>({
    scopeReviewed: false,
    exportChoice: null,
    finalConfirm: false,
  });
  const [clearing, setClearing] = useState(false);
  const savedBillCount = useAppStore((current) => current.subs.length);
  const savedDebtCount = useAppStore((current) => current.debts?.length ?? 0);
  const workspaceNames = useAppStore((current) =>
    current.workspaces.map((workspace) => workspace.name).join(', '),
  );
  const closeReset = () => {
    if (!clearing) setResetStep(null);
  };

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeAppLockSettings(setAppLockSettings);
    void Promise.all([loadAppLockSettings(), inspectAppLockCapability()]).then(
      ([settings, capability]) => {
        if (!mounted) return;
        setAppLockSettings(settings);
        setAppLockCapability(capability);
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleAppLock = () => {
    if (changingAppLock) return;
    setChangingAppLock(true);
    void changeAppLockEnabled(!appLockSettings.enabled)
      .then((result) => {
        if (result.reason === 'device-lock-not-set') {
          showStatusDialog('dialog.privacy-app-lock-no-device-lock');
        } else if (result.reason === 'unavailable') {
          showStatusDialog('dialog.privacy-app-lock-unavailable');
        } else if (result.reason === 'failed') {
          showStatusDialog('dialog.privacy-app-lock-auth-failed');
        }
      })
      .finally(() => setChangingAppLock(false));
  };

  // Scope review and a real export choice precede the explicit final destructive action.
  // Export is optional; requesting a share sheet does not assert that a copy was saved.
  const performReset = async () => {
    if (clearing || resetStep !== 'confirm') return;
    const gate: StartFreshState = { ...resetGate, finalConfirm: true };
    if (!canStartFresh(gate)) return;
    // A pre-clear reversal must never remain available after the clean profile is persisted.
    dismissUndo();
    setClearing(true);
    try {
      const result = await clearLocalMeloData(activeWorkspaceId);
      setResetStep(null);
      nav.go('start');
      Alert.alert(
        result.complete ? 'Local data cleared' : 'Local data cleared with one warning',
        result.complete
          ? 'Money, setup details, imports, history and app-owned export files were cleared from this device. Your sign-in, cloud backup and bank connections are separate and unchanged.'
          : `Your live Melo data is empty, but ${result.failedArtifacts.length} older app file${result.failedArtifacts.length === 1 ? '' : 's'} could not be removed. Do not treat this device as fully wiped yet.`,
        [{ text: 'OK', style: 'cancel' }],
        { cancelable: true },
      );
    } catch (reason: unknown) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Melo could not verify that local data was fully cleared.';
      showStatusDialog('dialog.privacy-clear-failed', { message });
    } finally {
      setClearing(false);
    }
  };

  const handleClearToEmpty = () => {
    setResetGate({ scopeReviewed: false, exportChoice: null, finalConfirm: false });
    setResetStep('review');
  };
  const continueClear = (exportChoice: 'requested' | 'declined') => {
    setResetGate({ scopeReviewed: true, exportChoice, finalConfirm: false });
    setResetStep('confirm');
  };
  const exportBeforeClear = async () => {
    try {
      await runExport(activeWorkspaceId);
      continueClear('requested');
    } catch (reason: unknown) {
      showStatusDialog('dialog.privacy-export-failed', {
        message:
          reason instanceof Error ? reason.message : 'Export could not finish on this device.',
      });
    }
  };

  // Restore from an export (plan 113) — the recovery path the wipe chain's first gate points at.
  // pickRestoreFile opens the system picker and validates the file BEFORE anything is touched;
  // the two-gate confirm shows what the file holds (counts + name) and says plainly that loading
  // it replaces current state; only the final branch applies. applyRestore routes through the
  // store's own cold-boot hydration (migrate/guards/re-anchor) — a restore and a first run are
  // the same code path. Degraded (= the pipeline threw and state fell back to defaults) is
  // reported honestly; per-field corruption defaults silently, same as any boot.
  const handleRestore = () => {
    void (async () => {
      const picked = await pickRestoreFile(activeWorkspaceId);
      if (picked.status === 'cancelled') return;
      if (picked.status === 'invalid') {
        showStatusDialog('dialog.privacy-restore-invalid-file');
        return;
      }
      const { summary, raw, fileName } = picked;
      const who = summary.name !== null ? ` for ${summary.name}` : '';
      const counted = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
      // Gate 1 — what the file holds + what loading it does, before anything changes.
      Alert.alert(
        'Restore from this export?',
        `${fileName} holds ${counted(summary.transactions, 'transaction')}, ${counted(summary.subs, 'subscription')} and ${counted(summary.pots, 'pot')}${who}. Loading it replaces everything currently in the app — export your current data first if you want to keep it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              // Gate 2 — the final replace confirm; only this branch applies the file.
              Alert.alert(
                'Replace everything now?',
                'What’s in the app now is overwritten by the file.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Restore',
                    style: 'destructive',
                    onPress: () => {
                      void applyRestore(raw, activeWorkspaceId).then(({ degraded }) => {
                        Alert.alert(
                          degraded ? 'Restored with gaps' : 'Restored',
                          degraded
                            ? 'The file couldn’t be fully read — what loaded is in place, the rest was reset.'
                            : 'Your data is back.',
                          [{ text: 'OK', style: 'cancel' }],
                          { cancelable: true },
                        );
                      });
                    },
                  },
                ],
                { cancelable: true },
              );
            },
          },
        ],
        { cancelable: true },
      );
    })().catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Restore could not finish on this device.';
      showStatusDialog('dialog.privacy-restore-failed', { message });
    });
  };

  // Export my data — runs the REAL export engine (ENGINES §6 D6 "export everything", free + never
  // paywalled). runExport builds the complete JSON + per-surface CSVs from live state, writes them to
  // the app's document directory, and opens the OS share sheet on the canonical JSON. It opens the OS
  // sheet itself (not a Folio sheet), so the CTA calls it directly instead of nav.openSheet('share')
  // — the old wiring opened the cycle-share card, which is NOT a data export. On a device without
  // storage/sharing the call rejects; we surface that honestly rather than imply the export happened.
  const handleExport = () => {
    void runExport(activeWorkspaceId).catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Export could not finish on this device.';
      showStatusDialog('dialog.privacy-export-failed', { message });
    });
  };

  // empty / error — the calm EmptyState doorway (n/a in practice — no async path — rendered for
  // completeness). The single CTA routes back to the doorway so it never dead-ends.
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Your data, your call.';
    const body =
      state === 'error'
        ? undefined
        : 'Melo shows what is local, what is remote, and lets you clear each separately.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Export my data', onPress: handleExport }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm holding
  // moment while the surface settles.
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One second — gathering what's saved." />
      </View>
    );
  }

  // populated / offline — the real surface. offline ≡ populated (local-first; nothing here needs the
  // network, so there is no offline banner).
  const positiveTint = `${t.positive}${POSITIVE_TINT_ALPHA}`;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: t.canvas,
          paddingTop: insets.top + gap.md,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* The whole surface scrolls — on a short viewport (or with large OS text) the action card's
          last row ("Clear local money & history") and the Melo footer sit below the fold; without a scroll
          container they were unreachable. flexGrow:1 keeps the footer pinned to the bottom when there
          IS room (the spacer below expands), and lets the column scroll when there isn't. */}
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar — back glyph · centred eyebrow · an equal-width invisible spacer so the eyebrow stays
          optically centred (the web balances the back arrow with a w-5 spacer, not textAlign:center). */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [styles.backHit, isPressed ? pressed : undefined]}
          >
            <Text style={[styles.backGlyph, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>
            {isBusiness ? 'Business workspace data' : 'Your data'}
          </Text>
          <View style={styles.topBarSpacer} aria-hidden />
        </View>

        {/* Headline block — "Your data, " + the upright terracotta accent "your call." + the body line. */}
        <View style={styles.headlineBlock}>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {isBusiness ? 'Business data, ' : 'Your data, '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>your call.</Text>
          </Text>
          <Text style={[styles.body, { color: t.muted }]}>
            {isBusiness
              ? `Exports and restores are bound to ${activeWorkspace.name}. Device-wide clearing is labelled separately.`
              : 'Melo shows what is local, what is remote, and lets you clear each separately.'}
          </Text>
        </View>

        {/* Three honest claims — each a positive-tinted check badge + the claim text. */}
        <View style={styles.claims}>
          {HONEST_CLAIMS.map((claim) => (
            <View key={claim} style={styles.claimRow}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.checkBadge, { backgroundColor: positiveTint }]}
              >
                <CheckGlyph color={t.positive} size={12} />
              </View>
              <Text style={[styles.claimText, { color: t.ink }]}>{claim}</Text>
            </View>
          ))}
        </View>

        {/* A live, deliberately small footprint keeps the trust promise concrete. These counts read
            the active workspace directly; they are not an estimate and do not leave this screen. */}
        <View style={[styles.footprint, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.footprintTitle, { color: t.muted }]}>Saved here now</Text>
          <Text style={[styles.footprintHint, { color: t.muted }]}>this workspace only</Text>
          <View style={styles.footprintGrid}>
            <FootprintValue
              label="money records"
              value={savedRecordCount}
              color={t.ink}
              muted={t.muted}
            />
            <FootprintValue
              label="original files"
              value={savedSourceCount}
              color={t.ink}
              muted={t.muted}
            />
            <FootprintValue
              label="accounts"
              value={savedAccountCount}
              color={t.ink}
              muted={t.muted}
            />
            <FootprintValue
              label="recorded reviews"
              value={savedHistory.recordedReviews}
              color={t.ink}
              muted={t.muted}
            />
            {savedHistory.historySummaries > 0 ? (
              <FootprintValue
                label="history summaries"
                value={savedHistory.historySummaries}
                color={t.ink}
                muted={t.muted}
              />
            ) : null}
          </View>
        </View>

        {/* Primary CTA — terracotta fill + the warm raised glow; opens the share (export) sheet. Plain
          centred label, no arrow, faithful to the web button. */}
        <Pressable
          accessibilityHint={
            isBusiness
              ? 'Builds the Business data and spreadsheet files, then shares the accountant records sheet'
              : 'Builds a full copy of your data and opens the share sheet'
          }
          accessibilityRole="button"
          onPress={handleExport}
          style={({ pressed: isPressed }) => [
            styles.primary,
            { backgroundColor: t.calmStrong },
            isPressed ? pressed : undefined,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.inverse }]}>
            {isBusiness ? 'Export Business records' : 'Export my data'}
          </Text>
        </Pressable>

        {/* Action list card — one surface with the kit hairline border. Three rows split by ONE inter-row
          hairline each (web divide-y): "See what's saved", then the two distinct destructive resets.
          Both resets are gated; their subtitles tell the truth about what each one leaves behind. */}
        <View style={[styles.actionCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('timeline')}
            style={({ pressed: isPressed }) => [styles.actionRow, isPressed ? pressed : undefined]}
          >
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: t.ink }]}>See what&apos;s saved</Text>
              <Text style={[styles.actionSubtitle, { color: t.muted }]}>
                everything you&apos;ve added
              </Text>
            </View>
            <ChevronRight color={t.muted} />
          </Pressable>

          {/* Inter-row divider (web divide-y) — between "See what's saved" and "Restore". */}
          <View style={[styles.rowDivider, { backgroundColor: t.hairline }]} />

          <Pressable
            accessibilityHint={
              appLockSettings.enabled
                ? 'Authenticates before turning off app lock'
                : 'Authenticates before turning on app lock'
            }
            accessibilityRole="switch"
            accessibilityState={{
              checked: appLockSettings.enabled,
              busy: changingAppLock,
              disabled: changingAppLock,
            }}
            disabled={changingAppLock}
            onPress={handleAppLock}
            style={({ pressed: isPressed }) => [styles.actionRow, isPressed ? pressed : undefined]}
          >
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: t.ink }]}>App lock</Text>
              <Text style={[styles.actionSubtitle, { color: t.muted }]}>
                {changingAppLock
                  ? 'checking your device lock…'
                  : appLockSettings.enabled
                    ? 'on · locks whenever Melo leaves the screen'
                    : appLockCapability?.available === false
                      ? 'off · add a device screen lock first'
                      : 'off · uses your device screen lock'}
              </Text>
            </View>
            <Text
              style={[
                styles.appLockState,
                { color: appLockSettings.enabled ? t.positive : t.muted },
              ]}
            >
              {appLockSettings.enabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: t.hairline }]} />

          {/* Restore from an export — loads a folio-export.json back in (plan 113). Ink title (its
            intent is recovery), truthful subtitle; the two-gate confirm carries the replace weight. */}
          <Pressable
            accessibilityHint="Asks you to pick an export file and confirm before replacing your data"
            accessibilityRole="button"
            onPress={handleRestore}
            style={({ pressed: isPressed }) => [styles.actionRow, isPressed ? pressed : undefined]}
          >
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: t.ink }]}>Restore from an export</Text>
              <Text style={[styles.actionSubtitle, { color: t.muted }]}>
                loads a Melo JSON export, replaces this workspace
              </Text>
            </View>
            <ChevronRight color={t.muted} />
          </Pressable>

          {/* Inter-row divider — between restore and the local clear. */}
          <View style={[styles.rowDivider, { backgroundColor: t.hairline }]} />

          {/* Local clear spans every app-owned device surface and leaves remote account data alone. */}
          <Pressable
            accessibilityHint="Asks you to confirm before clearing local money and history"
            accessibilityRole="button"
            onPress={handleClearToEmpty}
            style={({ pressed: isPressed }) => [styles.actionRow, isPressed ? pressed : undefined]}
          >
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: t.repair }]}>
                {isBusiness ? 'Clear all local workspaces' : 'Clear local money & history'}
              </Text>
              <Text style={[styles.actionSubtitle, { color: t.muted }]}>
                {isBusiness
                  ? 'clears Personal and Business on this device; remote services stay'
                  : 'keeps sign-in, cloud backup and bank connections'}
              </Text>
            </View>
            <ChevronRight color={t.muted} />
          </Pressable>
        </View>

        {/* Spacer pushes the Melo footer line to the bottom, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {/* Melo footer line — the only Melo on screen: the folded-document character (size 28, calm) beside
          one Fraunces-italic thought. The web mood "soft" is non-canonical (MELO_MOODS maps Privacy to
          'calm'), so the canonical 'calm' is used. MeloLine supplies the straight quotes; pass raw text. */}
        <View style={styles.footer}>
          <MeloLine
            mood="calm"
            size={28}
            text={
              isBusiness
                ? 'This export is built from the active Business partition only.'
                : 'Your numbers are yours to keep or export.'
            }
          />
        </View>
      </ScrollView>
      <Sheet
        visible={resetStep !== null}
        onClose={closeReset}
        scrollKey={resetStep ?? 'closed'}
        footer={
          <View style={styles.resetActions}>
            {resetStep === 'review' ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void exportBeforeClear()}
                  style={[styles.resetButton, { backgroundColor: t.calmStrong }]}
                >
                  <Text style={[styles.primaryLabel, { color: t.inverse }]}>Export first</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => continueClear('declined')}
                  style={styles.resetButton}
                >
                  <Text style={[styles.primaryLabel, { color: t.ink }]}>
                    Continue without export
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: clearing, busy: clearing }}
                disabled={clearing}
                onPress={() => void performReset()}
                style={[
                  styles.resetButton,
                  { backgroundColor: t.repair, opacity: clearing ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.primaryLabel, { color: t.inverse }]}>
                  {clearing ? 'Clearing local data…' : 'Clear local data'}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={clearing}
              onPress={closeReset}
              style={styles.resetButton}
            >
              <Text style={[styles.primaryLabel, { color: t.ink }]}>Cancel</Text>
            </Pressable>
          </View>
        }
      >
        <Text accessibilityRole="header" style={[styles.resetTitle, { color: t.ink }]}>
          {resetStep === 'review' ? 'Review what will clear' : 'Clear this device now?'}
        </Text>
        {resetStep === 'review' ? (
          <>
            <Text style={[styles.body, { color: t.ink }]}>
              All local workspaces: {workspaceNames}.
            </Text>
            <Text style={[styles.body, { color: t.ink }]}>
              In {activeWorkspace.name}: {savedRecordCount} transactions, {savedBillCount} bills,{' '}
              {savedDebtCount} debts, {savedSourceCount} original files and {savedHistory.summary}.
            </Text>
            <Text style={[styles.body, { color: t.muted }]}>
              Money, setup details, imports, history, widgets and app-owned export files will be
              cleared. Sign-in, cloud backup and bank connections stay separate and unchanged.
            </Text>
            <Text style={[styles.body, { color: t.muted }]}>
              Export first if you want a copy. Save it outside Melo before continuing; exports
              stored only inside Melo will also clear. Export covers the active workspace.
            </Text>
          </>
        ) : (
          <Text style={[styles.body, { color: t.muted }]}>
            This removes the local data you reviewed. There is no Undo after clearing. Only a copy
            you kept outside Melo or a separate cloud backup can restore it.
          </Text>
        )}
      </Sheet>
    </View>
  );
}

function FootprintValue({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: number;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.footprintValue}>
      <Text style={[styles.footprintValueNumber, { color }]}>{value}</Text>
      <Text style={[styles.footprintValueLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  resetActions: { gap: gap.xs },
  resetButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  resetTitle: { fontFamily: serif.display, fontSize: 28, lineHeight: 32 },
  // px-7 ≈ screen inset (gap.xl = 24); pt-4 ≈ safe-area top + gap.md (12).
  screen: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // The scroll container fills the screen; its content grows to at least a full viewport so the
  // flex:1 spacer can still pin the footer when there's room, then scrolls past it when there isn't.
  scrollFlex: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Top bar — back · eyebrow · spacer.
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backHit: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // ← back glyph, 20px, muted (web text-[20px] text-muted-ink).
  backGlyph: {
    fontSize: 20,
  },
  // Eyebrow — 12px, uppercase, tracked, muted (web tracking-[0.14em] uppercase).
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // The invisible 20px spacer (web w-5) that balances the back arrow so the eyebrow stays centred.
  topBarSpacer: {
    width: 20,
  },
  // mt-10 (40px) = gap.xl (24) + gap.lg (16).
  headlineBlock: {
    marginTop: gap.xl + gap.lg,
  },
  // Fraunces headline, 36px, tight line-height (web font-display text-[36px] leading-[1.05]).
  headline: {
    fontFamily: serif.display,
    fontSize: 36,
    lineHeight: 38,
  },
  // The accent word "your call." stays UPRIGHT (web em.not-italic) — same display face, terracotta.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // mt-4 (16px); 14px relaxed, muted, max-width ~300 (web text-[14px] leading-relaxed max-w-[300px]).
  body: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: gap.lg,
    maxWidth: 300,
  },
  // mt-6 (24px) = gap.xl; gap-2 (8px) = gap.sm between claim rows (web mt-6 space-y-2).
  claims: {
    gap: gap.sm,
    marginTop: gap.xl,
  },
  // Each claim row — badge + text, gap-3 (12px), 13.5px text (web flex items-center gap-3 text-[13.5px]).
  claimRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.md,
  },
  // The check badge — 20px round well holding the 12px tick (web w-5 h-5 rounded-full).
  checkBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  claimText: {
    // flex:1 so a long claim wraps inside the row instead of running off the right edge
    // (seen live on the second claim during the 2026-07-11 dark-mode sweep).
    flex: 1,
    fontSize: 13.5,
  },
  footprint: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  footprintTitle: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  footprintHint: {
    fontSize: 12,
    marginTop: gap.xs,
  },
  footprintGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: gap.md,
    marginTop: gap.md,
  },
  footprintValue: {
    minWidth: '50%',
  },
  footprintValueNumber: {
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  footprintValueLabel: {
    fontSize: 12,
    marginTop: gap.xxs,
  },
  // mt-8 (32px) = gap.xxl; full-width terracotta CTA, rounded-2xl (radius.xl = 24), with the warm glow.
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    marginTop: gap.xxl,
    paddingVertical: 18,
    ...elevation.cta,
  },
  // 15px medium label (web text-[15px] font-medium text-white → inverse).
  primaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  // mt-3 (12px) = gap.md; surface card with a 1px hairline border, rounded-2xl (radius.xl = 24).
  actionCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    overflow: 'hidden',
  },
  // px-5 py-4 row (web px-5 py-4 flex items-center). py-4 (16px) clears the >=44px tap target.
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: gap.lg + gap.xs, // px-5 ≈ 20
    paddingVertical: gap.lg,
  },
  actionText: {
    flex: 1,
  },
  // 15px medium row title (web text-[15px] font-medium).
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  // 12px muted subtitle, mt-0.5 (web text-[12px] text-muted-ink mt-0.5).
  actionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  appLockState: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  // The single inter-row hairline.
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  spacer: {
    flex: 1,
  },
  // mt-6 mb-6 footer (web mt-6 mb-6 flex items-center gap-3). MeloLine owns its own row layout + gap.
  footer: {
    marginBottom: gap.xl,
    marginTop: gap.xl,
  },
});
