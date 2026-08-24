import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectBusinessOneMove } from '@folio/business-workspace';

import { type MeloMood } from '@/folio/melo/Melo';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import { setMelo, useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';
import { useBusinessOperations } from './business/useBusinessOperations';
import { MeloCompanionHost } from '@/folio/ui/MeloCompanionHost';
import { MeloContextSheet } from '@/folio/sheets/MeloContextSheet';
import {
  deriveBusinessContextAction,
  deriveMeloPresence,
  type MeloPosition,
} from '@/folio/lib/melo/companion';

export function BusinessMeloScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [contextOpen, setContextOpen] = useState(false);
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const accounts = useAppStore((state) => state.accounts ?? []);
  const melo = useAppStore((state) => state.melo ?? { quietMode: false, wardrobe: [] });
  const preferredPosition = (melo.preferredPosition ?? 'auto') as MeloPosition;
  const business = useBusinessOperations();
  const move = useMemo(
    () =>
      selectBusinessOneMove(
        business,
        accounts.map((account) => ({
          ...account,
          balanceMinor: Math.round(account.balanceMinor * 100),
        })),
      ),
    [accounts, business],
  );
  const memory = business.memory.slice(0, 4);
  const mood: MeloMood =
    move.kind === 'runway' || move.kind === 'vat'
      ? 'concern'
      : move.kind === 'invoice' || move.kind === 'obligation'
        ? 'curious'
        : 'calm';
  const contextAction = useMemo(
    () =>
      deriveBusinessContextAction(
        move.action
          ? { id: `business-${move.action.target}`, label: move.action.label, prompt: move.body }
          : undefined,
      ),
    [move.action, move.body],
  );
  const presence = deriveMeloPresence({ quietMode: melo.quietMode, action: contextAction });

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordmark, { color: t.ink }]}>Melo</Text>
          <Text style={[styles.workspaceKind, { color: t.muted }]}>Business</Text>
        </View>

        <View style={styles.hero}>
          {melo.quietMode ? (
            <Text style={[styles.quietCompanion, { color: t.muted }]}>Melo is resting.</Text>
          ) : (
            <MeloCompanionHost
              mood={mood}
              size={74}
              position={preferredPosition}
              presence={presence}
              accessibilityLabel={`Melo, ${mood}, business context`}
              onPress={() => setContextOpen(true)}
            />
          )}
          <Text style={[styles.eyebrow, { color: t.muted }]}>{workspace.name}</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {move.headline}
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>{move.body}</Text>
        </View>

        {move.action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go(actionRoute(move.action!.target))}
            style={({ pressed }) => [
              styles.move,
              { backgroundColor: t.inset, opacity: pressed ? 0.62 : 1 },
            ]}
          >
            <Text style={[styles.moveLabel, { color: t.ink }]}>{move.action.label}</Text>
            <Text accessibilityElementsHidden style={[styles.arrow, { color: t.calmStrong }]}>
              →
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.watching}>
          <Text style={[styles.sectionTitle, { color: t.muted }]}>What Melo watches here</Text>
          {[
            'Cash across business accounts and 30-day burn.',
            'Invoices ageing past their due date.',
            'VAT pot against the current return.',
            'Recurring costs landing inside the runway.',
            'Tax and filing dates tied to the saved entity.',
          ].map((line) => (
            <Text key={line} style={[styles.watchLine, { color: t.muted }]}>
              · {line}
            </Text>
          ))}
        </View>

        {memory.length > 0 ? (
          <View style={styles.memory}>
            <Text style={[styles.sectionTitle, { color: t.muted }]}>What I remember</Text>
            <View style={[styles.memoryCard, { backgroundColor: t.surface }]}>
              {memory.map((entry, index) => (
                <View
                  key={entry.id}
                  style={[
                    styles.memoryRow,
                    index > 0
                      ? {
                          borderTopColor: t.hairline,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        }
                      : undefined,
                  ]}
                >
                  <Text style={[styles.memoryBody, { color: t.ink }]}>{entry.summary}</Text>
                  <Text style={[styles.memoryDate, { color: t.muted }]}>
                    {formatMemoryDate(entry.at)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityHint={`Opens the local companion for ${workspace.name}.`}
          accessibilityRole="button"
          onPress={() =>
            nav.openMelo({
              seed: `I'm looking only at ${workspace.name}. ${move.headline}`,
            })
          }
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: t.calm, opacity: pressed ? 0.68 : 1 },
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.inverse }]}>Ask Melo</Text>
        </Pressable>
      </ScrollView>
      <MeloContextSheet
        visible={contextOpen}
        onClose={() => setContextOpen(false)}
        mood={mood}
        presence={presence}
        action={contextAction}
        quietMode={melo.quietMode}
        position={preferredPosition}
        onAction={() => nav.go(actionRoute(move.action?.target ?? 'account'))}
        onQuietModeChange={() => setMelo({ quietMode: !melo.quietMode })}
        onPositionChange={(next) => setMelo({ preferredPosition: next })}
        onTalk={() =>
          nav.openMelo({
            seed: `I'm looking only at ${workspace.name}. ${move.headline}`,
          })
        }
      />
    </View>
  );
}

function actionRoute(
  target: NonNullable<ReturnType<typeof selectBusinessOneMove>['action']>['target'],
): ScreenId {
  if (target === 'account') return 'account';
  if (target === 'runway') return 'business-runway';
  if (target === 'vat') return 'business-vat';
  if (target === 'invoices') return 'business-invoices';
  return 'business-obligations';
}

function formatMemoryDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : value;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  wordmarkRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wordmark: { fontFamily: serif.displayItalic, fontSize: 14 },
  workspaceKind: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7 },
  hero: { alignItems: 'flex-start', marginTop: gap.xl },
  quietCompanion: { fontFamily: serif.displayItalic, fontSize: 15, marginBottom: gap.md },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13, marginTop: gap.md },
  headline: {
    fontFamily: serif.display,
    fontSize: 31,
    letterSpacing: -0.35,
    lineHeight: 37,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 21, marginTop: gap.md, maxWidth: 520 },
  move: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    marginTop: gap.lg,
    minHeight: 50,
    paddingHorizontal: gap.lg,
  },
  moveLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  arrow: { fontSize: 18, marginLeft: gap.md },
  watching: { marginTop: gap.xl },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: gap.sm,
    textTransform: 'uppercase',
  },
  watchLine: { fontSize: 12.5, lineHeight: 20 },
  memory: { marginTop: gap.xl },
  memoryCard: { borderRadius: radius.lg, overflow: 'hidden', paddingHorizontal: gap.lg },
  memoryRow: { paddingVertical: gap.md },
  memoryBody: { fontSize: 12.5, lineHeight: 18 },
  memoryDate: { fontSize: 10.5, marginTop: gap.xs },
  primary: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.xl,
    minHeight: 52,
    paddingHorizontal: gap.lg,
  },
  primaryLabel: { fontSize: 15, fontWeight: '700' },
});
