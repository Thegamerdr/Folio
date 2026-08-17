// PrivacyScreen — the faithful 1:1 React Native port of the web "Your data" surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPrivacy.tsx).
//
// @rn-screen    PrivacyScreen
// @rn-stack     More > Data & privacy
// @purpose      Plain statement of what Folio does (and doesn't do) with the user's data, plus export
//               and reset.
// @reads        — (no store reads for render)
// @writes       clearLocalMeloData() spans encrypted state, SQLCipher rows, reminders, widgets and
//               app-owned exports. NO post-clear Undo (D3). Demo reseeding stays development-only.
// @writes-export runExport() — "Export my data" runs the real export engine (full JSON + CSVs +
//               OS share sheet, ENGINES §6 D6). It opens the OS share sheet itself, not a Folio sheet.
// @writes-restore pickRestoreFile()/applyRestore() (plan 113) — "Restore from an export" loads a
//               folio-export.json back in through the store's own cold-boot hydration path, behind
//               a two-gate confirm that shows the file's contents first. Replaces current state.
// @copy         FROZEN — must match what the app actually does. No false claims. Checked by the RN
//               copy-lint tests (copyLint.test.ts): no banned words, no false privacy/security claims.
// @tokens       calm (accent) · positive (check) · repair (negative reset rows) · surface · hairline
//               · muted · canvas · ink — all from the kit via '@/folio/theme'
// @motion       press 0.97 on every tappable (kit `pressed`) · Melo breathe/blink at the footer
//               (calm). The page root stays static for reliable native navigation repainting.
// @notes        Claims here are checked by RN copy-lint tests. Edit copy with care.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store source):
//   • COPY IS FROZEN except the two honest-claims corrections below. Every other visible string is
//     the web literal, byte-for-byte. The deck (COPY_DECK.md) has NO keys for this screen, so the
//     strings are inline literals here (exactly as the web keeps them) — none of them are keyed in
//     '@/folio/copy/copy', so nothing is imported from the deck. The second and third honest claims
//     were rewritten (see below) because the original web wording overstated what the shipped app
//     does; every claim here must remain literally true of the shipped app, or the honest-claims
//     copy-lint fails.
//   • HONEST_CLAIMS[1] (was "Nothing shared without you tapping export"): the statement reader sends
//     the picked PDF/photo to Folio's reader service, and Melo chat sends the conversation (plus an
//     optional snapshot) to the gateway — both leave the device before any export tap. The rewritten
//     claim names those two real egress paths instead of promising nothing leaves.
//   • HONEST_CLAIMS[2] (was "Delete everything in one tap"): the reset below runs a
//     three-gate confirm chain (exportedAck → typedConfirm → finalConfirm) — never a single tap. The
//     rewritten claim describes the actual deliberate, multi-step gate instead of a one-tap wipe.
//   • The accent word "your call." is rendered UPRIGHT (not italic) in terracotta — the web uses
//     <em class="not-italic text-[accent]">. The headline is two Text runs so the accent run is a
//     nested, upright, calm-coloured span inside the Fraunces hero line (same pattern as StartScreen).
//   • The three honest claims each carry a positive-tinted check badge: a 15% alpha tint of the
//     `positive` token (web bg-[var(--positive)]/15), computed in RN — never a hard-coded hex — with
//     the kit's CheckGlyph in `positive` ink. Marked aria-hidden (importantForAccessibility="no") so
//     the claim text carries the meaning, matching the web's aria-hidden tick.
//   • The primary CTA is a Pressable carrying the terracotta fill + the warm raised glow (the kit's
//     `elevation.cta` — the in-system realisation of the web's literal terracotta drop shadow
//     rgba(224,99,58,0.55), which is NOT a token and must not be reintroduced). It opens the share
//     sheet via nav.openSheet('share'). Note this is a plain centred label (no arrow), faithful to the
//     web button, so it is NOT the kit's <PrimaryAction> (which pins a chevron).
//   • The action list is one `surface` card with the kit hairline border. It holds "See what's saved",
//     restore, and the single release-safe destructive action, each split by one inter-row hairline.
//   • "Clear local money & history" → clearLocalMeloData() removes every app-owned local surface,
//     then persists a genuinely empty encrypted state. It runs the tier-3 confirm chain
//     (exportedAck → typedConfirm → finalConfirm); only the final branch clears. There is no
//     customer-facing sample-data reset.
//     Per D3 there is NO post-wipe Undo (no fake undo after a confirmed wipe): the toast is a plain
//     confirmation, and the export acknowledged in gate 1 is the real recovery path. The honest claim
//     above ("a few deliberate confirmations, never one accidental tap") describes the user's OWN
//     data being wiped; the gate is deliberately multi-step, and what's LEFT after differs by which
//     reset was chosen. See @rn-engine.
//   • The page root stays static. Android can retain full-screen transformed layers after navigation;
//     motion remains local to press feedback and Melo instead of wrapping the entire surface.
//   • STATES: per the spec, Privacy is populated-only and offline ≡ populated (local-first, no network
//     dependency, no offline banner). All five branches are rendered for completeness: populated /
//     offline = the real surface; loading = Melo curious + a line (never a spinner, per the hard rule
//     + STATES.md); empty / error = the calm EmptyState doorway (n/a in practice — this screen never
//     fetches and has no async path — but rendered so every branch is exercised).
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px (the rows and
// CTA have generous padding; the back glyph carries hitSlop). Named export (the route file is separate).

import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { StatePanel } from '@/folio/ui/StatePanel';
import { CloudBackupSheet } from '@/folio/sheets/CloudBackupSheet';
import { isClerkConfigured } from '@/folio/lib/clerkAuth';
import { runExport } from '@/folio/lib/exportNative';
import { applyRestore, pickRestoreFile } from '@/folio/lib/restoreNative';
import { canStartFresh, type StartFreshState } from '@/folio/lib/undoPolicy';
import { clearLocalMeloData } from '@/folio/lib/localDataDeletion';
import {
  prepareSupportDiagnosticBundle,
  shareSupportDiagnosticBundle,
  type SupportDiagnosticBundle,
} from '@/folio/lib/supportDiagnosticNative';
import { getState, useAppStore } from '@/folio/store';
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
  'Bank and backup services run only when you choose them; Melo and statement reading stay local',
  'Local clearing and cloud account deletion stay separate',
] as const;

// The positive check badge is a 15% alpha tint of the `positive` token (web bg-[var(--positive)]/15).
// `positive` is a 6-digit hex; append the 0x26 (~15%) alpha byte so the tint follows the theme rather
// than being a separate hard-coded colour.
const POSITIVE_TINT_ALPHA = '26'; // 0x26 / 0xFF ≈ 0.15

export function PrivacyScreen({ nav, state = 'populated' }: PrivacyScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const activeWorkspaceId = useAppStore((current) => current.activeWorkspaceId);
  const activeWorkspace = useAppStore(
    (current) =>
      current.workspaces.find((workspace) => workspace.id === current.activeWorkspaceId)!,
  );
  const isBusiness = activeWorkspace.kind === 'business';
  const [appLockSettings, setAppLockSettings] = useState(getCachedAppLockSettings());
  const [appLockCapability, setAppLockCapability] = useState<AppLockCapability | null>(null);
  const [changingAppLock, setChangingAppLock] = useState(false);
  const [supportPreview, setSupportPreview] = useState<SupportDiagnosticBundle | null>(null);
  const [sharingSupportReport, setSharingSupportReport] = useState(false);
  const [cloudBackupVisible, setCloudBackupVisible] = useState(false);
  const clerkConfigured = isClerkConfigured();
  const serviceAccess = useAppStore((current) =>
    (current.serviceAccessLog ?? [])
      .filter((event) => String(event.workspaceId) === String(current.activeWorkspaceId))
      .slice(0, 8),
  );

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
          Alert.alert(
            'Add a device screen lock first',
            'Set a PIN, pattern, password or biometric in Android or iPhone settings, then come back to turn on Melo app lock.',
            [{ text: 'OK', style: 'cancel' }],
          );
        } else if (result.reason === 'unavailable') {
          // CLAIM: the shipped local vault uses SQLCipher with a device-protected key.
          Alert.alert(
            'App lock is unavailable',
            'This device could not securely save or open the app-lock setting. Your Melo vault remains encrypted on disk.',
            [{ text: 'OK', style: 'cancel' }],
          );
        } else if (result.reason === 'failed') {
          Alert.alert(
            'Device authentication did not finish',
            'Melo left the app-lock setting unchanged.',
            [{ text: 'OK', style: 'cancel' }],
          );
        }
      })
      .finally(() => setChangingAppLock(false));
  };

  // "Clear local money & history" spans all app-owned device surfaces, then persists a genuinely
  // empty encrypted state with no demo content and no forced re-onboarding.
  //
  // This is a Tier-3 "nuke" action per undoPolicy.ts (ENGINES.md §6), so it is never one-tap
  // reachable. It fires only once `canStartFresh` clears all three
  // gates — an explicit "I've exported my data" acknowledgement (exportedAck), a deliberate
  // typed-style confirm of the destructive intent (typedConfirm), and a final confirm (finalConfirm).
  // The engine (canStartFresh) and this UI agree; no bare one-tap reset bypasses the gate.
  //
  // Realised with the codebase's established RN confirmation convention — Alert.alert button chains
  // (SubscriptionsScreen / MeloChatSheet / TodayRecentTxns). RN's Alert.prompt is iOS-only and is used
  // nowhere here, so the typed confirmation is honoured as a deliberate, separately-worded destructive
  // step rather than a free-text box. Each step is independently cancellable, and the wipe only runs
  // inside the final branch after the gate returns true.
  //
  // Once the gate clears: run the wipe and jump to Start. There is NO post-wipe Undo — D3
  // forbids a fake undo after a confirmed wipe, and the final gate already says "there is no going
  // back" (the web's 6s sonner-with-Undo is deliberately dropped). Export is now REAL:
  // "Export my data" calls runExport() (the export engine), which builds the complete JSON + CSVs and
  // opens the OS share sheet on them — it no longer opens the cycle-share card (D6, never paywalled).
  // Remote account data stays separate so neither deletion direction silently destroys the other.
  const performReset = async () => {
    // The gate is cleared — build the StartFreshState the engine vets and confirm all three are set
    // before the destructive call. This keeps the engine as the single source of truth for the policy.
    const gate: StartFreshState = { typedConfirm: true, exportedAck: true, finalConfirm: true };
    if (!canStartFresh(gate)) return;

    try {
      const result = await clearLocalMeloData(activeWorkspaceId);
      nav.go('start');
      const residualCount = result.failedArtifacts.length + result.failedSurfaces.length;
      Alert.alert(
        result.complete ? 'Local data cleared' : 'Local data cleared with one warning',
        result.complete
          ? 'Money, setup details, imports, history and app-owned export files were cleared from this device. Your sign-in, cloud backup and bank connections are separate and unchanged.'
          : `Your live Melo data is empty, but Melo could not verify ${residualCount} local cleanup item${residualCount === 1 ? '' : 's'}. Retry this clear before transferring or disposing of the device.`,
        [{ text: 'OK', style: 'cancel' }],
        { cancelable: true },
      );
    } catch (reason: unknown) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Melo could not verify that local data was fully cleared.';
      Alert.alert('Local clear did not finish', message, [{ text: 'OK', style: 'cancel' }], {
        cancelable: true,
      });
    }
  };

  // The shared tier-3 confirm chain. Both destructive resets run the SAME three independently
  // cancellable gates (exportedAck → typedConfirm → finalConfirm); only the final branch wipes, and
  // only with the wipe + wording the caller passes. Reusing one chain keeps the gate identical across
  // both actions, so neither path can drift into being weaker than the other.
  const confirmReset = (finalActionLabel: string, perform: () => void) => {
    // Gate 1 — exportedAck: confirm the user has exported before anything is destroyed.
    Alert.alert(
      'Clear local money and history?',
      'This clears money, setup details, imports, history, widgets and app-owned export files from this device. It does not delete your sign-in, cloud backup or bank connections. Export first if you want to keep a copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "I've exported — continue",
          onPress: () => {
            // Gate 2 — typedConfirm: a deliberate, separately-worded confirmation of the destructive
            // intent (the cross-platform stand-in for the typed phrase the policy requires).
            // CLAIM: cloud backup envelopes are client-encrypted by the shipped cloud-vault engine.
            Alert.alert(
              'Are you sure?',
              'This local data cannot be recovered unless you already exported it or kept a separate encrypted cloud backup.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, clear local data',
                  onPress: () => {
                    // Gate 3 — finalConfirm: the last destructive confirm; only this branch wipes.
                    Alert.alert(
                      'Clear this device now?',
                      'Local money, setup details and history will be removed. Remote account data stays until you delete it separately.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: finalActionLabel, style: 'destructive', onPress: perform },
                      ],
                      { cancelable: true },
                    );
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
  };

  // Comprehensive local clear: auxiliary native/filesystem surfaces plus an empty encrypted store.
  const handleClearToEmpty = () =>
    confirmReset('Clear local data', () => {
      void performReset();
    });

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
        Alert.alert(
          'Couldn’t read that file',
          'That file doesn’t look like a Melo data export. Pick the personal or business export file that Melo created.',
          [{ text: 'OK', style: 'cancel' }],
          { cancelable: true },
        );
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
                      void applyRestore(raw, activeWorkspaceId)
                        .then(() => {
                          Alert.alert('Restored', 'Your data is back and saved on this device.', [
                            { text: 'OK', style: 'cancel' },
                          ]);
                        })
                        .catch((reason: unknown) => {
                          const message =
                            reason instanceof Error
                              ? reason.message
                              : 'Restore could not finish on this device.';
                          Alert.alert('Restore didn’t finish', message, [
                            { text: 'OK', style: 'cancel' },
                          ]);
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
      Alert.alert('Restore didn’t finish', message, [{ text: 'OK', style: 'cancel' }], {
        cancelable: true,
      });
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
      Alert.alert('Export didn’t finish', message, [{ text: 'OK', style: 'cancel' }], {
        cancelable: true,
      });
    });
  };

  const handlePrepareSupportReport = () => {
    const bundle = prepareSupportDiagnosticBundle(getState(), {
      appLockEnabled: appLockSettings.enabled,
      currentScreen: 'privacy',
    });
    if (!bundle.safeForExport) {
      Alert.alert(
        'Support report stopped',
        'Melo found content that did not pass the local privacy check. Nothing was written or shared.',
      );
      return;
    }
    setSupportPreview(bundle);
  };

  const handleShareSupportReport = () => {
    if (supportPreview === null || sharingSupportReport) return;
    setSharingSupportReport(true);
    void shareSupportDiagnosticBundle(supportPreview)
      .then(() => {
        setSupportPreview(null);
      })
      .catch((reason: unknown) => {
        Alert.alert(
          'Support report wasn’t shared',
          reason instanceof Error ? reason.message : 'The share sheet could not be opened.',
        );
      })
      .finally(() => setSharingSupportReport(false));
  };

  // empty / error — the calm EmptyState doorway (n/a in practice — no async path — rendered for
  // completeness). The single CTA routes back to the doorway so it never dead-ends.
  if (state === 'empty' || state === 'error') {
    return (
      <StatePanel
        body={
          state === 'error'
            ? 'Data controls could not be shown. Nothing has been cleared.'
            : 'Melo shows what is local, what is remote, and lets you clear each separately.'
        }
        fullScreen
        kind={state === 'error' ? 'error' : 'genuine-empty'}
        primaryAction={{ label: 'Export my data', onPress: handleExport }}
        title={state === 'error' ? copy.err.generic : 'Your data, your call.'}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm holding
  // moment while the surface settles.
  if (state === 'loading') {
    return (
      <StatePanel
        body="Reading local and optional-service records."
        fullScreen
        kind="loading"
        title="Gathering what’s saved"
      />
    );
  }

  if (supportPreview !== null) {
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
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.supportPreviewBody}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="Back to data and privacy"
              accessibilityRole="button"
              hitSlop={16}
              onPress={() => setSupportPreview(null)}
              style={({ pressed: isPressed }) => [styles.backHit, isPressed ? pressed : undefined]}
            >
              <Text style={[styles.backGlyph, { color: t.muted }]}>←</Text>
            </Pressable>
            <Text style={[styles.eyebrow, { color: t.muted }]}>Support report</Text>
            <View style={styles.topBarSpacer} aria-hidden />
          </View>

          <View style={styles.headlineBlock}>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
              Check exactly{' '}
              <Text style={[styles.headlineAccent, { color: t.calm }]}>what leaves.</Text>
            </Text>
            <Text style={[styles.body, { color: t.muted }]}>
              This is the complete report. It contains app and device versions, workspace type,
              counts and health states—not money values, names, account details, document text,
              conversations, tokens or recovery secrets.
            </Text>
          </View>

          <View
            accessibilityLabel="Exact support report contents"
            style={[
              styles.supportPreviewCard,
              { backgroundColor: t.surface, borderColor: t.hairline },
            ]}
          >
            <Text selectable style={[styles.supportPreviewText, { color: t.ink }]}>
              {supportPreview.jsonText}
            </Text>
          </View>

          <Text
            accessibilityLiveRegion="polite"
            style={[styles.supportPrivacyNote, { color: t.muted }]}
          >
            Nothing is uploaded automatically. The temporary file is removed after the share sheet
            closes.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: sharingSupportReport, disabled: sharingSupportReport }}
            disabled={sharingSupportReport}
            onPress={handleShareSupportReport}
            style={({ pressed: isPressed }) => [
              styles.primary,
              { backgroundColor: t.calmStrong },
              isPressed ? pressed : undefined,
              sharingSupportReport ? styles.disabledAction : undefined,
            ]}
          >
            <Text style={[styles.primaryLabel, { color: t.canvas }]}>
              {sharingSupportReport ? 'Opening share sheet…' : 'Share this exact report'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setSupportPreview(null)}
            style={({ pressed: isPressed }) => [
              styles.supportCancel,
              isPressed ? pressed : undefined,
            ]}
          >
            <Text style={[styles.supportCancelLabel, { color: t.muted }]}>Cancel</Text>
          </Pressable>
        </ScrollView>
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
          <Text style={[styles.primaryLabel, { color: t.canvas }]}>
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
              clerkConfigured
                ? 'Opens cloud backup and restore controls'
                : 'Explains why cloud backup is unavailable in this build'
            }
            accessibilityRole="button"
            onPress={() => {
              if (clerkConfigured) {
                setCloudBackupVisible(true);
                return;
              }
              Alert.alert(
                'Cloud backup is unavailable',
                'This build has no account provider configured. Local export and restore still work without an account.',
              );
            }}
            style={({ pressed: isPressed }) => [styles.actionRow, isPressed ? pressed : undefined]}
          >
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: t.ink }]}>Cloud backup & restore</Text>
              <Text style={[styles.actionSubtitle, { color: t.muted }]}>
                {clerkConfigured
                  ? 'optional · protected by a separate recovery code'
                  : 'not configured · local export remains available'}
              </Text>
            </View>
            <ChevronRight color={t.muted} />
          </Pressable>

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

          <Pressable
            accessibilityHint="Shows the exact redacted contents before anything is shared"
            accessibilityRole="button"
            onPress={handlePrepareSupportReport}
            style={({ pressed: isPressed }) => [styles.actionRow, isPressed ? pressed : undefined]}
          >
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: t.ink }]}>Create support report</Text>
              <Text style={[styles.actionSubtitle, { color: t.muted }]}>
                preview first · no money values or names
              </Text>
            </View>
            <ChevronRight color={t.muted} />
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

        <Text style={[styles.sectionLabel, { color: t.muted }]}>Optional-service access</Text>
        <View style={[styles.accessCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {serviceAccess.length === 0 ? (
            <Text style={[styles.accessEmpty, { color: t.muted }]}>
              No bank or backup request has been recorded for this workspace.
            </Text>
          ) : (
            serviceAccess.map((event, index) => (
              <View key={event.id}>
                {index > 0 ? (
                  <View style={[styles.rowDivider, { backgroundColor: t.hairline }]} />
                ) : null}
                <View
                  accessibilityLabel={`${serviceAccessLabel(event.service, event.operation)}. ${event.outcome}. ${formatServiceAccessTime(event.at)}`}
                  style={styles.accessRow}
                >
                  <View style={styles.actionText}>
                    <Text style={[styles.actionTitle, { color: t.ink }]}>
                      {serviceAccessLabel(event.service, event.operation)}
                    </Text>
                    <Text style={[styles.actionSubtitle, { color: t.muted }]}>
                      {formatServiceAccessTime(event.at)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.accessOutcome,
                      { color: event.outcome === 'completed' ? t.positive : t.repairInk },
                    ]}
                  >
                    {event.outcome}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
        <Text style={[styles.accessNote, { color: t.muted }]}>
          This history records only service, action, time and outcome. It never stores money,
          document text, conversations, credentials or response content.
        </Text>

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
      {clerkConfigured ? (
        <CloudBackupSheet
          visible={cloudBackupVisible}
          onClose={() => setCloudBackupVisible(false)}
        />
      ) : null}
    </View>
  );
}

function serviceAccessLabel(service: 'bank' | 'backup', operation: string): string {
  const operationLabel = operation.replaceAll('-', ' ');
  return `${service === 'bank' ? 'Bank connection' : 'Cloud backup'} · ${operationLabel}`;
}

function formatServiceAccessTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
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
  supportPreviewBody: {
    paddingBottom: gap.xxl,
  },
  supportPreviewCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg,
  },
  supportPreviewText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
  },
  supportPrivacyNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: gap.md,
  },
  supportCancel: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: gap.sm,
  },
  supportCancelLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  disabledAction: {
    opacity: 0.55,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: gap.xl,
    textTransform: 'uppercase',
  },
  accessCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.sm,
    overflow: 'hidden',
  },
  accessRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  accessEmpty: { fontSize: 12, lineHeight: 17, padding: gap.md },
  accessOutcome: { fontSize: 10.5, fontWeight: '700', textTransform: 'capitalize' },
  accessNote: { fontSize: 11, lineHeight: 16, marginTop: gap.sm },
});
