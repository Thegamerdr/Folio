// More — the calm hub (Quiet Paper Luxury).
//
// Faithful port of the Lovable web ScreenMore (src/components/folio/screens/ScreenMore.tsx): a quiet
// hub on warm paper — a "Folio" wordmark row, a Melo intro ("The quiet hub" / "Everything else,
// calmly."), grouped quiet rows, and a closing Melo line. Drop-in replacement for the old mobileShell
// MoreScreen: same prop contract (plus onOpenWhatIf), same handlers — only presentation changed.
//
// Web parity: the previously-missing destinations now exist, so this hub surfaces them — a "Tend the
// picture" group (Subscriptions, Pots, Payday ritual) and Insights under "The picture", plus a quiet
// "Share a cycle" entry. The RN-only Developer group is kept. The detailed trust / security panel
// lives on the Data and privacy screen this hub links to; developer tools stay in a quiet group that
// only appears on builds where they are available.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Display, gap, PressureScreen, useTheme, type Palette } from './kit';
import { MeloFigure } from './melo/MeloFigure';
import { HubRow, Kicker, MeloLine, meloMoodFor, RowCard, SectionLabel } from './secondaryKit';
import type { LocalLedgerVaultSummary } from '../../local/localLedgerVault';
import type { LocalSecurityPosture } from '../../local/nativeLocalSecurity';
import type { PersistenceStatus } from '../mobileShell';

export function MoreScreen({
  developerModeAvailable,
  developerModeEnabled,
  onLockApp,
  onOpenCalendar,
  onOpenData,
  onOpenDogfood,
  onOpenInsights,
  onOpenPlans,
  onOpenPots,
  onOpenRecovery,
  onOpenRitual,
  onOpenSubscriptions,
  onOpenTimeline,
  onOpenWhatIf,
  onReplayFirstMinute,
  onRefreshSecurity,
  onResetSample,
  onShareCycle,
  onToggleDeveloperMode,
  securityPosture,
}: {
  developerModeAvailable: boolean;
  developerModeEnabled: boolean;
  onLockApp: () => void;
  onOpenCalendar: () => void;
  onOpenData: () => void;
  onOpenDogfood: () => void;
  onOpenInsights: () => void;
  // Accepted for prop-contract parity with the container; Review is reached from the bottom nav.
  onOpenImport: () => void;
  onOpenPlans: () => void;
  onOpenPots: () => void;
  onOpenRecovery: () => void;
  onOpenRitual: () => void;
  onOpenSubscriptions: () => void;
  onOpenTimeline: () => void;
  onOpenWhatIf: () => void;
  onReplayFirstMinute: () => void;
  onRefreshSecurity: () => void;
  onResetSample: () => void;
  onShareCycle: () => void;
  onToggleDeveloperMode: () => void;
  persistenceStatus: PersistenceStatus;
  privateExampleMode: boolean;
  securityPosture: LocalSecurityPosture | null;
  vaultSummary: LocalLedgerVaultSummary;
}) {
  const lockAvailable = securityPosture?.appLockMode === 'device_auth';
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  return (
    <PressureScreen>
      {/* The "Folio" wordmark row — italic serif left, a balancing spacer right (web ScreenMore). */}
      <View style={layout.wordmarkRow}>
        <Text style={[layout.wordmark, s.wordmark]}>Folio</Text>
        <View style={layout.wordmarkSpacer} />
      </View>

      {/* Intro row: Melo beside the kicker + headline — "The quiet hub" / "Everything else, calmly." */}
      <View style={layout.introRow}>
        <MeloFigure mood={meloMoodFor('soft')} size={30} />
        <View style={layout.introBody}>
          <Kicker>The quiet hub</Kicker>
          <Display style={layout.headline}>
            Everything else,{' '}
            <Text style={[layout.accentWord, s.accentWord]}>calmly</Text>.
          </Display>
        </View>
      </View>

      <View style={{ gap: gap.xl }}>
        <View>
          <SectionLabel>The picture</SectionLabel>
          <RowCard>
            <HubRow
              first
              label="Timeline"
              hint="what you added, what you left"
              accessibilityHint="Opens Timeline."
              onPress={onOpenTimeline}
            />
            <HubRow
              label="Calendar"
              hint="the dates that matter"
              accessibilityHint="Opens Calendar."
              onPress={onOpenCalendar}
            />
            <HubRow
              label="Plans"
              hint="what's coming before payday"
              accessibilityHint="Opens Plans."
              onPress={onOpenPlans}
            />
            <HubRow
              label="Insights"
              hint="the shape of your months"
              accessibilityHint="Opens Insights."
              onPress={onOpenInsights}
            />
          </RowCard>
        </View>

        <View>
          <SectionLabel>Tend the picture</SectionLabel>
          <RowCard>
            <HubRow
              first
              label="Subscriptions"
              hint="what still earns its place"
              accessibilityHint="Opens Subscriptions."
              onPress={onOpenSubscriptions}
            />
            <HubRow
              label="Pots"
              hint="set aside, small and calmly"
              accessibilityHint="Opens Pots."
              onPress={onOpenPots}
            />
            <HubRow
              label="Payday ritual"
              hint="close the cycle in four steps"
              accessibilityHint="Opens the payday ritual."
              onPress={onOpenRitual}
            />
            <HubRow
              label="See a cycle's trail"
              hint="what a cycle is built from"
              accessibilityHint="Shows the trail behind these numbers."
              onPress={onShareCycle}
            />
          </RowCard>
        </View>

        <View>
          <SectionLabel>Try a move</SectionLabel>
          <RowCard>
            <HubRow
              first
              label="What if I spend"
              hint="preview before you decide"
              accessibilityHint="Opens a spend preview."
              onPress={onOpenWhatIf}
            />
            <HubRow
              label="Recovery"
              hint="something has to move"
              accessibilityHint="Opens the repair flow."
              onPress={onOpenRecovery}
            />
          </RowCard>
        </View>

        <View>
          <SectionLabel>On this device</SectionLabel>
          <RowCard>
            <HubRow
              first
              label="Data and privacy"
              hint="what's saved, what to export"
              accessibilityHint="Opens Data and privacy."
              onPress={onOpenData}
            />
            <HubRow
              label="App lock"
              hint={lockAvailable ? 'lock with your device' : 'not set up · check again'}
              accessibilityHint={
                lockAvailable
                  ? 'Locks Folio and asks for device authentication to return.'
                  : 'Rechecks whether device authentication is available.'
              }
              onPress={lockAvailable ? onLockApp : onRefreshSecurity}
            />
            <HubRow
              label="See how Folio works"
              hint="a calm example, nothing saved"
              accessibilityHint="Opens the example briefing without touching your data."
              onPress={onResetSample}
            />
            <HubRow
              label="Start fresh"
              hint="clear everything on this device"
              tone="negative"
              accessibilityHint="Opens Data and privacy, where you can clear what is saved."
              onPress={onOpenData}
            />
          </RowCard>
        </View>

        {developerModeAvailable ? (
          <View>
            <SectionLabel>Developer</SectionLabel>
            <RowCard>
              <HubRow
                first
                label={developerModeEnabled ? 'Turn off developer mode' : 'Turn on developer mode'}
                hint="test tools, never shown in the released app"
                accessibilityHint="Shows or hides developer and test tools."
                onPress={onToggleDeveloperMode}
              />
              {developerModeEnabled ? (
                <>
                  <HubRow
                    label="Internal test mode"
                    hint="fake seeds, reset and test files"
                    accessibilityHint="Opens developer test controls."
                    onPress={onOpenDogfood}
                  />
                  <HubRow
                    label="Replay first minute"
                    hint="return to the introduction"
                    accessibilityHint="Replays the first-minute flow without changing what you saved."
                    onPress={onReplayFirstMinute}
                  />
                </>
              ) : null}
            </RowCard>
          </View>
        ) : null}
      </View>

      <MeloLine text="Your money stays on this device — what you type to Melo and any statement you add are read by your AI provider, and a copy you export leaves; nothing else does." />

      <Body style={[layout.footnote, s.footnote]}>
        Private and on this device. Cloud, AI and Open Banking are optional, never required here.
      </Body>
    </PressureScreen>
  );
}

// Layout-only styles (no colour) — static, shared across renders.
const layout = StyleSheet.create({
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: 'Fraunces_500Medium_Italic', fontSize: 14 },
  wordmarkSpacer: { width: 20 },
  introRow: { flexDirection: 'row', alignItems: 'flex-start', gap: gap.md },
  introBody: { flex: 1, gap: gap.xs },
  headline: { fontSize: 30, lineHeight: 32 },
  accentWord: { fontFamily: 'Fraunces_600SemiBold' },
  footnote: { fontSize: 13 },
});

// Colour-bearing styles, resolved against the active palette (the DARK-MODE PATTERN).
function makeStyles(t: Palette) {
  return StyleSheet.create({
    wordmark: { color: t.ink },
    accentWord: { color: t.calm },
    footnote: { color: t.muted },
  });
}
