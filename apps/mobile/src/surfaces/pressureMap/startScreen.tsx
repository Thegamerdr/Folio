// Pressure Moment — the product doorway.
//
// Not a dashboard, not a menu. It opens on the user's real question and offers one
// dominant way in. Everything else is a quiet path.

import { StyleSheet, View } from 'react-native';

import { FolioBrandMark } from '../brandMark';
import {
  Body,
  Display,
  Eyebrow,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  gap,
  paper,
} from './kit';
import { MeloPresence } from './melo';

export function StartScreen({
  onOpenSampleBriefing,
  onStartImportDiscovery,
  onStartQuickEstimate,
}: {
  onOpenSampleBriefing: () => void;
  onStartBillFlow: () => void;
  onStartDebtFlow: () => void;
  onStartImportDiscovery: () => void;
  onStartQuickEstimate: () => void;
}) {
  return (
    <PressureScreen style={styles.screen}>
      <View style={styles.brandRow}>
        <FolioBrandMark size={30} />
        <Body style={styles.whisper}>Private · on this device</Body>
      </View>

      <View style={styles.hero}>
        <Eyebrow>Folio</Eyebrow>
        <Display style={styles.question}>Will your money last to payday?</Display>
        <Body style={styles.sub}>
          A calm, private read on where you stand. No accounts, no sign-up — it never leaves your
          phone.
        </Body>
      </View>

      <View style={styles.actions}>
        <MeloPresence state="melo_start" style={styles.melo} />
        <PrimaryAction
          accessibilityHint="Starts a short, rough first picture of your money."
          caption="A minute, rough is fine"
          label="See where you stand"
          onPress={onStartQuickEstimate}
        />
        <View style={styles.quietGroup}>
          <QuietLink
            accessibilityHint="Bring in a bank statement to review."
            label="I already have a bank statement"
            onPress={onStartImportDiscovery}
          />
          <QuietLink
            accessibilityHint="See how Folio works with an example picture."
            label="Show me an example first"
            onPress={onOpenSampleBriefing}
          />
        </View>
      </View>
    </PressureScreen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingTop: gap.sm },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  whisper: { color: paper.muted, fontSize: 13, fontWeight: '600' },

  hero: { gap: gap.md, paddingTop: gap.xxl },
  question: { fontSize: 38, lineHeight: 43 },
  sub: { color: paper.secondary, fontSize: 17, lineHeight: 25, maxWidth: 340 },

  actions: { gap: gap.sm },
  melo: { marginBottom: gap.xs },
  quietGroup: { marginTop: gap.xs },
});
