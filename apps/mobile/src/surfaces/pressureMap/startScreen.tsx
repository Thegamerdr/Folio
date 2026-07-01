// Start — the product doorway.
//
// Faithful port of the accepted Lovable web source (ScreenStart.tsx): a "Folio / Privacy" header,
// a big serif question with ONE upright terracotta accent word ("last"), a calm sub-line, Melo's
// reassurance line, then air, the single dominant action ("See where you stand", 60px, trailing
// chevron), and a row of THREE quiet text links separated by 1px×12px vertical hairline dividers.
// No tile grid, no invented illustration — the web's Start is just type + Melo + the button + the
// three-link row, with air doing the hierarchy.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Body,
  gap,
  Headline,
  PressureScreen,
  PrimaryAction,
  serif,
  useTheme,
  type Palette,
} from './kit';
import { MeloLine } from './secondaryKit';

export function StartScreen({
  onOpenSampleBriefing,
  onStartImportDiscovery,
  onStartQuickEstimate,
  onOpenMelo,
  onOpenPrivacy,
}: {
  onOpenSampleBriefing: () => void;
  onStartBillFlow: () => void;
  onStartDebtFlow: () => void;
  onStartImportDiscovery: () => void;
  onStartQuickEstimate: () => void;
  onOpenMelo: () => void;
  onOpenPrivacy: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <PressureScreen style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>Folio</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Privacy. Your data stays on this device."
            hitSlop={10}
            onPress={onOpenPrivacy}
            style={({ pressed }) => [styles.privacyTap, pressed ? styles.pressed : undefined]}
          >
            <Text style={styles.privacy}>Privacy</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Headline
            lead="Will your money "
            accent="last"
            tail=" to payday?"
            style={styles.headline}
          />
          <Body style={styles.sub}>
            Start with a rough number. Nothing counts until you choose.
          </Body>
        </View>

        <View style={styles.meloWrap}>
          <MeloLine text="Start rough. You can correct anything later." />
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.bottom}>
        <PrimaryAction
          accessibilityHint="Starts a short, rough first picture of your money."
          label="See where you stand"
          onPress={onStartQuickEstimate}
        />
        <View style={styles.secondaryRow}>
          <SecondaryLink label="Add a statement" onPress={onStartImportDiscovery} />
          <View style={styles.linkDivider} />
          <SecondaryLink label="Try sample data" onPress={onOpenSampleBriefing} />
          <View style={styles.linkDivider} />
          <SecondaryLink label="Meet Melo" onPress={onOpenMelo} />
        </View>
        <View style={styles.foot} />
      </View>
    </PressureScreen>
  );
}

// A quiet secondary text link — subordinate to the hero CTA. One of three on a divider row.
function SecondaryLink({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkTap, pressed ? styles.pressed : undefined]}
    >
      <Text style={styles.linkLabel}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Lovable rhythm: the type + Melo cluster at the top, the action + link row pinned to the foot,
    // with air between (a flex spacer over a tall screen).
    screen: { justifyContent: 'space-between', minHeight: 560, paddingTop: gap.lg },
    top: { gap: 0 },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    // Web: font-display italic text-[15px].
    wordmark: { color: t.ink, fontFamily: serif.displayItalic, fontSize: 15 },
    // Web: text-[12px] muted, tracking-wide, uppercase.
    privacy: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    privacyTap: { paddingVertical: 4, paddingHorizontal: 2 },
    pressed: { opacity: 0.7 },

    // Web: mt-14 (56px) from the header to the hero.
    hero: { marginTop: 56 },
    // Web: font-display text-[42px] leading-[1.05] tracking-tight.
    headline: { fontSize: 42, lineHeight: 44, letterSpacing: -0.8 },
    // Web: mt-5 (20px), text-[15px] leading-relaxed muted, max-w-[300px].
    sub: { color: t.muted, fontSize: 15, lineHeight: 24, maxWidth: 300, marginTop: 20 },

    // Web: mt-10 (40px) to Melo's line.
    meloWrap: { marginTop: 40 },

    // Web: <div className="flex-1" /> — the air that pushes the action cluster to the foot.
    spacer: { flex: 1, minHeight: gap.xl },

    bottom: { gap: 0 },

    // Web: mt-5 (20px) below the CTA, row of three links, justify-between, text-[12.5px] muted.
    secondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    linkTap: { paddingVertical: 4 },
    linkLabel: { color: t.muted, fontSize: 12.5 },
    // Web: <span className="w-px h-3 bg-[var(--hairline)]" /> — 1px × 12px vertical hairline.
    linkDivider: { width: 1, height: 12, backgroundColor: t.hairline },

    // Web: <div className="h-6" /> — 24px breathing room at the foot.
    foot: { height: 24 },
  });
}
