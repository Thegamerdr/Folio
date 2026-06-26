// North-star UI system for the core Folio slice (Start → guided → Review → Today/route → detail → Data).
// Calm financial notebook, not a dashboard. Rhythm comes from whitespace + hairlines, not stacked cards.
// Rules baked in: one purpose / one primary action / one payoff per screen; large type only for hero
// moments; money is tabular and precise; cards group only meaningful things. Tokens only — paper/ink/
// green/amber/coral, near-flat. No system language reaches these components (callers pass human strings).

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

const c = folioTokens.color.role;
const sp = folioTokens.spacing.scale;
const RADIUS = folioTokens.size.radius;
const HIT = folioTokens.hitTarget.minimumDp;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'quiet';

export function NsButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
  accessibilityHint,
  fill,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone | undefined;
  disabled?: boolean | undefined;
  accessibilityHint?: string | undefined;
  fill?: boolean | undefined;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ns.btnBase,
        tone === 'primary' ? ns.btnPrimary : undefined,
        tone === 'secondary' ? ns.btnSecondary : undefined,
        tone === 'ghost' || tone === 'quiet' ? ns.btnGhost : undefined,
        fill ? ns.btnFill : undefined,
        disabled ? ns.btnDisabled : undefined,
        pressed && !disabled ? ns.pressed : undefined,
      ]}
    >
      <Text
        style={[
          ns.btnLabel,
          tone === 'primary' ? ns.btnLabelPrimary : undefined,
          tone === 'secondary' ? ns.btnLabelSecondary : undefined,
          tone === 'quiet' ? ns.btnLabelQuiet : undefined,
          disabled ? ns.btnLabelDisabled : undefined,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// One clear action zone. One primary, an optional secondary beside it.
export function BottomActionBar({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryHint,
  secondaryLabel,
  onSecondary,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean | undefined;
  primaryHint?: string | undefined;
  secondaryLabel?: string | undefined;
  onSecondary?: (() => void) | undefined;
}) {
  return (
    <View style={ns.actionBar}>
      {secondaryLabel && onSecondary ? (
        <View style={ns.actionBarSecondary}>
          <NsButton label={secondaryLabel} onPress={onSecondary} tone="secondary" />
        </View>
      ) : null}
      <View style={ns.actionBarPrimary}>
        <NsButton
          accessibilityHint={primaryHint}
          disabled={primaryDisabled}
          fill
          label={primaryLabel}
          onPress={onPrimary}
          tone="primary"
        />
      </View>
    </View>
  );
}

// Small uppercase context label. Used sparingly, never as a heading.
export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={ns.eyebrow}>{children}</Text>;
}

// The single calm heading for a screen. Moderate size — not a poster.
export function ScreenHeading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={ns.heading}>
      {children}
    </Text>
  );
}

export function SupportText({ children }: { children: ReactNode }) {
  return <Text style={ns.supportText}>{children}</Text>;
}

// A quiet reveal for details that should not crowd the first decision.
export function Reveal({
  title,
  detail,
  expanded,
  onToggle,
  accessibilityHint,
}: {
  title: string;
  detail?: string | undefined;
  expanded: boolean;
  onToggle: () => void;
  accessibilityHint?: string | undefined;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={({ pressed }) => [ns.reveal, pressed ? ns.pressed : undefined]}
    >
      <View style={ns.flex}>
        <Text style={ns.revealTitle}>{title}</Text>
        {detail ? <Text style={ns.revealDetail}>{detail}</Text> : null}
      </View>
      <Text style={ns.revealChevron}>{expanded ? '–' : '+'}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// FolioScreen — the screen scaffold. Whitespace rhythm, not a card stack.
// ---------------------------------------------------------------------------

export function FolioScreen({ children }: { children: ReactNode }) {
  return <View style={ns.screen}>{children}</View>;
}

// ---------------------------------------------------------------------------
// MoneyHero — one human sentence + one big tabular number. The Today moment.
// ---------------------------------------------------------------------------

export function MoneyHero({
  eyebrow,
  headline,
  value,
  caption,
  tone = 'calm',
}: {
  eyebrow?: string | undefined;
  headline: string;
  value?: string | undefined;
  caption?: string | undefined;
  tone?: 'calm' | 'attention' | 'neutral' | undefined;
}) {
  return (
    <View style={ns.hero}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Text accessibilityRole="header" style={ns.heroHeadline}>
        {headline}
      </Text>
      {value ? (
        <Text
          style={[
            ns.heroValue,
            tone === 'attention' ? ns.heroValueAttention : undefined,
            tone === 'neutral' ? ns.heroValueNeutral : undefined,
          ]}
        >
          {value}
        </Text>
      ) : null}
      {caption ? <Text style={ns.heroCaption}>{caption}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PrimaryDecisionCard — the one dominant doorway on Start. Confident, ink-filled.
// ---------------------------------------------------------------------------

export function PrimaryDecisionCard({
  title,
  detail,
  onPress,
  accessibilityHint,
}: {
  title: string;
  detail: string;
  onPress: () => void;
  accessibilityHint?: string | undefined;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [ns.primaryCard, pressed ? ns.pressedLift : undefined]}
    >
      <View style={ns.flex}>
        <Text style={ns.primaryCardTitle}>{title}</Text>
        <Text style={ns.primaryCardDetail}>{detail}</Text>
      </View>
      <Text style={ns.primaryCardChevron}>{'›'}</Text>
    </Pressable>
  );
}

// A quiet secondary path — a plain row link, never an equal card.
export function QuietPathRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={detail}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [ns.quietRow, pressed ? ns.pressed : undefined]}
    >
      <View style={ns.flex}>
        <Text style={ns.quietRowLabel}>{label}</Text>
        {detail ? <Text style={ns.quietRowDetail}>{detail}</Text> : null}
      </View>
      <Text style={ns.quietChevron}>{'›'}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Guided stepper — one step per screen, calm, with a thin progress rail.
// ---------------------------------------------------------------------------

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <View accessibilityLabel={`Step ${step} of ${total}`} accessible style={ns.progressRail}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[ns.progressSeg, index < step ? ns.progressSegOn : undefined]} />
      ))}
    </View>
  );
}

export function GuidedMoneyStep({
  step,
  total,
  question,
  hint,
  children,
}: {
  step: number;
  total: number;
  question: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View style={ns.stepBlock}>
      <StepProgress step={step} total={total} />
      <Text accessibilityRole="header" style={ns.stepQuestion}>
        {question}
      </Text>
      {hint ? <Text style={ns.stepHint}>{hint}</Text> : null}
      <View style={ns.stepInput}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ReviewDecisionCard — one row is one decision. The critical interaction.
// ---------------------------------------------------------------------------

export function ReviewDecisionCard({
  question,
  amountLabel,
  dateLabel,
  sourceLine,
  consequence,
  state,
  flagLine,
  addLabel = 'Add to my money',
  onAdd,
  onEdit,
  onIgnore,
  onMore,
  addDisabled,
}: {
  question: string;
  amountLabel: string;
  dateLabel: string;
  sourceLine: string;
  consequence: string;
  state: 'waiting' | 'ready';
  flagLine?: string | undefined;
  addLabel?: string | undefined;
  onAdd: () => void;
  onEdit: () => void;
  onIgnore: () => void;
  onMore: () => void;
  addDisabled?: boolean | undefined;
}) {
  return (
    <View
      accessibilityLabel={`${question} ${amountLabel}, ${dateLabel}. ${sourceLine}. ${consequence}`}
      accessible
      style={ns.decisionCard}
    >
      <Text style={ns.decisionQuestion}>{question}</Text>
      <View style={ns.decisionAmountRow}>
        <Text style={ns.decisionAmount}>{amountLabel}</Text>
        <Text style={ns.decisionDate}>{dateLabel}</Text>
      </View>
      <Text style={ns.decisionSource}>{sourceLine}</Text>
      <Text style={ns.decisionConsequence}>{consequence}</Text>
      {flagLine ? <Text style={ns.decisionFlag}>{flagLine}</Text> : null}
      <View style={ns.decisionPrimary}>
        <NsButton
          accessibilityHint={`Adds this to your money. ${consequence}`}
          disabled={addDisabled}
          fill
          label={addLabel}
          onPress={onAdd}
          tone="primary"
        />
      </View>
      <View style={ns.decisionSecondary}>
        <NsButton label="Edit" onPress={onEdit} tone="secondary" />
        <NsButton label="Ignore" onPress={onIgnore} tone="secondary" />
        <NsButton label="More" onPress={onMore} tone="quiet" />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// RoutePointDetail — human answers about one point on the route.
// ---------------------------------------------------------------------------

export function RoutePointDetail({
  title,
  answers,
}: {
  title: string;
  answers: ReadonlyArray<{ label: string; value: string }>;
}) {
  return (
    <View style={ns.pointDetail}>
      <Text style={ns.pointTitle}>{title}</Text>
      {answers.map((answer) => (
        <View key={answer.label} style={ns.pointRow}>
          <Text style={ns.pointLabel}>{answer.label}</Text>
          <Text style={ns.pointValue}>{answer.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TrustPanel — Data/privacy as trust, not a database inventory.
// ---------------------------------------------------------------------------

export function TrustPanel({
  lines,
  onExport,
  onStartFresh,
  exportBusy,
  startFreshArmed,
}: {
  lines: readonly string[];
  onExport: () => void;
  onStartFresh: () => void;
  exportBusy?: boolean | undefined;
  startFreshArmed?: boolean | undefined;
}) {
  return (
    <View style={ns.trustPanel}>
      <View style={ns.trustLines}>
        {lines.map((line) => (
          <Text key={line} style={ns.trustLine}>
            {line}
          </Text>
        ))}
      </View>
      <View style={ns.trustActions}>
        <NsButton
          accessibilityHint="Prepares a copy of your data to take with you."
          disabled={exportBusy}
          fill
          label={exportBusy ? 'Preparing your copy…' : 'Export my data'}
          onPress={onExport}
          tone="secondary"
        />
        <NsButton
          accessibilityHint={
            startFreshArmed
              ? 'Tap again to clear everything on this device.'
              : 'Clears everything on this device. Asks once more first.'
          }
          fill
          label={startFreshArmed ? 'Tap again to start fresh' : 'Start fresh'}
          onPress={onStartFresh}
          tone="quiet"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — near-flat: hairline borders + tinted fills, generous whitespace.
// ---------------------------------------------------------------------------

const ns = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.9 },
  pressedLift: { opacity: 0.94, transform: [{ scale: 0.992 }] },

  screen: { gap: sp.xl, paddingBottom: sp.sm },

  // buttons
  btnBase: {
    alignItems: 'center',
    borderRadius: RADIUS,
    justifyContent: 'center',
    minHeight: HIT,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
  },
  btnFill: { alignSelf: 'stretch' },
  btnPrimary: { backgroundColor: c.surface.inverse },
  btnSecondary: { backgroundColor: c.surface.base, borderColor: c.border.strong, borderWidth: 1 },
  btnGhost: { backgroundColor: 'transparent', minHeight: 44 },
  btnDisabled: { backgroundColor: c.surface.disabled, borderColor: c.border.subtle },
  btnLabel: { color: c.text.primary, fontSize: 16, fontWeight: '700' },
  btnLabelPrimary: { color: c.text.inverse },
  btnLabelSecondary: { color: c.text.primary },
  btnLabelQuiet: { color: c.accent.primary, fontWeight: '700' },
  btnLabelDisabled: { color: c.text.muted },

  actionBar: {
    alignItems: 'center',
    borderTopColor: c.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: sp.sm,
    paddingTop: sp.lg,
  },
  actionBarSecondary: { flexShrink: 1 },
  actionBarPrimary: { flex: 1 },

  // text
  eyebrow: {
    color: c.text.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    color: c.text.primary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 31,
  },
  supportText: { color: c.text.secondary, fontSize: 16, lineHeight: 23 },

  reveal: {
    alignItems: 'center',
    borderTopColor: c.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: sp.md,
    paddingVertical: sp.md,
  },
  revealTitle: { color: c.text.primary, fontSize: 16, fontWeight: '700' },
  revealDetail: { color: c.text.secondary, fontSize: 14, lineHeight: 19, marginTop: 2 },
  revealChevron: { color: c.accent.primary, fontSize: 22, fontWeight: '700' },

  // hero
  hero: { gap: sp.xs },
  heroHeadline: {
    color: c.text.primary,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 33,
  },
  heroValue: {
    color: c.text.primary,
    fontSize: 60,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -1.8,
    lineHeight: 64,
    marginTop: sp.xs,
  },
  heroValueAttention: { color: c.text.warning },
  heroValueNeutral: { color: c.text.muted },
  heroCaption: { color: c.text.secondary, fontSize: 15, lineHeight: 21 },

  // primary decision card (Start)
  primaryCard: {
    alignItems: 'center',
    backgroundColor: c.surface.inverse,
    borderRadius: RADIUS + 6,
    elevation: 7,
    flexDirection: 'row',
    gap: sp.md,
    paddingHorizontal: sp.xl,
    paddingVertical: sp.xl,
    // Restrained tactile depth on the one dominant doorway only — not on money/route/review.
    shadowColor: '#0E1714',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  primaryCardTitle: { color: c.text.inverse, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  primaryCardDetail: { color: '#D6E5DC', fontSize: 15, lineHeight: 21, marginTop: sp.xs },
  primaryCardChevron: { color: '#D6E5DC', fontSize: 26, fontWeight: '700' },

  quietRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: sp.md,
    paddingVertical: sp.md,
  },
  quietRowLabel: { color: c.text.primary, fontSize: 17, fontWeight: '700' },
  quietRowDetail: { color: c.text.secondary, fontSize: 14, lineHeight: 19, marginTop: 1 },
  quietChevron: { color: c.text.muted, fontSize: 20, fontWeight: '700' },

  // stepper
  progressRail: { flexDirection: 'row', gap: sp.xs },
  progressSeg: { backgroundColor: c.border.subtle, borderRadius: 2, flex: 1, height: 4 },
  progressSegOn: { backgroundColor: c.accent.primary },
  stepBlock: { gap: sp.md },
  stepQuestion: {
    color: c.text.primary,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 31,
  },
  stepHint: { color: c.text.secondary, fontSize: 16, lineHeight: 23 },
  stepInput: { gap: sp.sm },

  // review decision card
  decisionCard: {
    backgroundColor: c.surface.base,
    borderColor: c.border.subtle,
    borderRadius: RADIUS + 4,
    borderWidth: 1,
    gap: sp.sm,
    padding: sp.xl,
  },
  decisionQuestion: {
    color: c.text.primary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  decisionAmountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: sp.sm,
    marginTop: sp.xxs,
  },
  decisionAmount: {
    color: c.text.primary,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  decisionDate: { color: c.text.muted, fontSize: 15, fontWeight: '600' },
  decisionSource: { color: c.text.muted, fontSize: 14 },
  decisionConsequence: { color: c.text.secondary, fontSize: 15, lineHeight: 21, marginTop: sp.xs },
  decisionFlag: { color: c.text.warning, fontSize: 14, lineHeight: 19 },
  decisionPrimary: { marginTop: sp.sm },
  decisionSecondary: { alignItems: 'center', flexDirection: 'row', gap: sp.sm, marginTop: sp.xs },

  // route point detail
  pointDetail: {
    backgroundColor: c.background.sunken,
    borderRadius: RADIUS,
    gap: sp.sm,
    padding: sp.lg,
  },
  pointTitle: { color: c.text.primary, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  pointRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: sp.md,
  },
  pointLabel: { color: c.text.secondary, fontSize: 15 },
  pointValue: {
    color: c.text.primary,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    textAlign: 'right',
  },

  // trust panel
  trustPanel: { gap: sp.xl },
  trustLines: { gap: sp.sm },
  trustLine: { color: c.text.primary, fontSize: 18, fontWeight: '600', lineHeight: 26 },
  trustActions: { gap: sp.sm },
});
