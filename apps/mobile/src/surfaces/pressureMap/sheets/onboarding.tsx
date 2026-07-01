// First-run Onboarding sheet — the RN port of the web folio SheetOnboarding.
//
// Faithful to src/components/folio/sheets/SheetOnboarding.tsx (the source of truth):
// four calm steps — name → payday day → rough monthly income → pots — that seed the
// basics on first run. The web design is reproduced here with no reinterpretation:
// the same progress pills, the same italic-serif eyebrow + one-accent-word headline,
// the same inset input, the same two sliders, the same 2-col pot grid, and the same
// "Begin quietly" / "Skip for now" actions and VERBATIM copy.
//
// Presentation only. It never touches the engine. On finish it calls the two prop
// callbacks the container passes — onSeedProfile (name + payday + monthly income in
// MINOR units) and onCreatePots (the selected pot templates as CreatePotInput[], also
// in MINOR units). The web stores whole pounds; this screen converts pounds → pence at
// the boundary so the canonical handlers receive minor units, matching the rest of the
// app. Money is displayed through the canonical formatMinorAmount so there's no drift.
//
// It composes the shared Sheet primitive (./Sheet) for the bottom-sheet chrome and the
// pressure-map kit (./kit) for type, tokens, and the primary/quiet actions.

import { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { formatMinorAmount, type CreatePotInput } from '../../../local/localLedger';
import {
  GhostButton,
  PrimaryAction,
  elevation,
  gap,
  radius,
  serif,
  useTheme,
  type Palette,
} from '../kit';
import { Sheet } from '../Sheet';

// ---------------------------------------------------------------------------
// Pot templates offered at onboarding. VERBATIM from the web source — same names,
// same whole-pound goal + per-week, same single accented "Holiday" tile. Held in
// pounds here (matching the web) and converted to minor units only when handed to
// the engine on finish, so this list stays a 1:1 mirror of the web template.
// ---------------------------------------------------------------------------

type PotTemplate = Readonly<{
  id: string;
  name: string;
  goal: number; // whole pounds, as in the web source
  perWeek: number; // whole pounds, as in the web source
  accent: boolean;
}>;

const POT_TEMPLATES: readonly PotTemplate[] = [
  { id: 'holiday', name: 'Holiday · September', goal: 1200, perWeek: 35, accent: true },
  { id: 'buffer', name: 'Buffer', goal: 500, perWeek: 20, accent: false },
  { id: 'christmas', name: 'Christmas', goal: 300, perWeek: 15, accent: false },
  { id: 'pet', name: 'Vet fund', goal: 400, perWeek: 10, accent: false },
  { id: 'home', name: 'Home things', goal: 600, perWeek: 15, accent: false },
];

// Slider bounds mirror the web's <input type="range"> attributes exactly.
const PAYDAY_MIN = 1;
const PAYDAY_MAX = 31;
const INCOME_MIN = 500;
const INCOME_MAX = 8000;
const INCOME_STEP = 20;

// Sensible first-run defaults (the web seeds these from store onboarding defaults).
const DEFAULT_PAYDAY = 25;
const DEFAULT_INCOME = 2400;

const STEP_COUNT = 4;
const PENCE_PER_POUND = 100;

// ---------------------------------------------------------------------------
// Props contract — everything the container must pass. The screen is presentation
// only: it renders from these and reports back through the on* callbacks. No engine,
// no store, no navigation owned here.
// ---------------------------------------------------------------------------

export type OnboardingProfile = Readonly<{
  name: string;
  paydayDay: number;
  monthlyIncomeMinor: number;
}>;

type OnboardingSheetProps = Readonly<{
  // Sheet chrome — passed straight through to the shared Sheet primitive.
  visible: boolean;
  onClose: () => void;
  reduceMotion?: boolean | undefined;
  // Optional initial values so the sheet can prefill from whatever the container
  // already knows (e.g. a partially-completed first run). All optional; the web
  // starts blank-name with seeded payday/income.
  initialName?: string | undefined;
  initialPaydayDay?: number | undefined;
  initialMonthlyIncomeMinor?: number | undefined;
  // On finish: seed the profile, then create the selected pots. Both in MINOR units.
  onSeedProfile: (profile: OnboardingProfile) => void;
  onCreatePots: (pots: readonly CreatePotInput[]) => void;
}>;

export function OnboardingSheet({
  visible,
  onClose,
  reduceMotion,
  initialName,
  initialPaydayDay,
  initialMonthlyIncomeMinor,
  onSeedProfile,
  onCreatePots,
}: OnboardingSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName ?? '');
  const [payday, setPayday] = useState(
    clampInt(initialPaydayDay ?? DEFAULT_PAYDAY, PAYDAY_MIN, PAYDAY_MAX),
  );
  const [income, setIncome] = useState(
    initialMonthlyIncomeMinor !== undefined
      ? Math.round(initialMonthlyIncomeMinor / PENCE_PER_POUND)
      : DEFAULT_INCOME,
  );
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const togglePot = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isLast = step === STEP_COUNT - 1;

  // Finish: seed the profile (minor units), then create each selected pot template as a
  // CreatePotInput (also minor units). The web kept any existing pot's saved balance, but
  // these are fresh templates with no saved balance, so we hand the engine the goal +
  // per-week and let it start each pot at zero.
  const done = () => {
    onSeedProfile({
      name: name.trim(),
      paydayDay: payday,
      monthlyIncomeMinor: income * PENCE_PER_POUND,
    });
    const selected = POT_TEMPLATES.filter((t) => picked.has(t.id)).map<CreatePotInput>((t) => ({
      name: t.name,
      goalMinor: t.goal * PENCE_PER_POUND,
      perWeekMinor: t.perWeek * PENCE_PER_POUND,
      accent: t.accent,
    }));
    if (selected.length > 0) {
      onCreatePots(selected);
    }
    onClose();
  };

  const advance = () => {
    if (isLast) {
      done();
      return;
    }
    setStep((x) => x + 1);
  };

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <View style={s.body}>
        <ProgressTrack step={step} />

        {step === 0 ? <NameStep value={name} onChange={setName} /> : null}
        {step === 1 ? <PaydayStep value={payday} onChange={setPayday} /> : null}
        {step === 2 ? <IncomeStep value={income} onChange={setIncome} /> : null}
        {step === 3 ? <PotsStep picked={picked} onToggle={togglePot} /> : null}

        <View style={s.actions}>
          <PrimaryAction label={isLast ? 'Begin quietly' : 'Next'} onPress={advance} />
          <GhostButton
            label="Skip for now"
            onPress={done}
            accessibilityHint="Skips setup and starts with what you have."
          />
        </View>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Step header — the italic-serif eyebrow + the one-accent-word headline. The web uses
// `font-display italic` for the eyebrow and a `not-italic text-accent` upright serif
// span for the accent word inside the headline; both are reproduced here.
// ---------------------------------------------------------------------------

function StepHeader({ eyebrow, lead, accent }: { eyebrow: string; lead: string; accent: string }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={s.header}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={s.headline}>
        {lead}
        <Text style={s.headlineAccent}>{accent}</Text>
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — name
// ---------------------------------------------------------------------------

function NameStep({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View>
      <StepHeader eyebrow="Hello" lead="What should Melo " accent="call you?" />
      <TextInput
        accessibilityLabel="Your name"
        autoFocus
        onChangeText={onChange}
        placeholder="A name, a nickname"
        placeholderTextColor={t.muted}
        style={s.input}
        value={value}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — payday day of month
// ---------------------------------------------------------------------------

function PaydayStep({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View>
      <StepHeader eyebrow="Rhythm" lead="When does payday " accent="land?" />
      <View style={s.sliderBlock}>
        <View style={s.numberRow}>
          <Text style={s.bigNumber}>{value}</Text>
          <Text style={s.numberSuffix}>of the month</Text>
        </View>
        <Slider
          min={PAYDAY_MIN}
          max={PAYDAY_MAX}
          step={1}
          value={value}
          onChange={onChange}
          accessibilityLabel="Payday day of the month"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — rough monthly income
// ---------------------------------------------------------------------------

function IncomeStep({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View>
      <StepHeader eyebrow="Rough only" lead="What lands, " accent="roughly?" />
      <View style={s.sliderBlock}>
        <View style={s.numberRow}>
          <Text style={s.bigNumber}>{formatMinorAmount(value * PENCE_PER_POUND)}</Text>
          <Text style={s.numberSuffix}>/ month</Text>
        </View>
        <Slider
          min={INCOME_MIN}
          max={INCOME_MAX}
          step={INCOME_STEP}
          value={value}
          onChange={onChange}
          accessibilityLabel="Rough monthly income"
        />
        <Text style={s.helper}>Doesn&apos;t need to be exact. Folio adjusts as you go.</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — pot multi-select
// ---------------------------------------------------------------------------

function PotsStep({
  picked,
  onToggle,
}: {
  picked: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View>
      <StepHeader eyebrow="Pots" lead="What are you " accent="saving for?" />
      <Text style={s.potsHelper}>
        Pick any. Skip with none if you&apos;d rather start blank — you can add later.
      </Text>
      <View style={s.potGrid}>
        {POT_TEMPLATES.map((t) => (
          <PotTile
            key={t.id}
            template={t}
            selected={picked.has(t.id)}
            onPress={() => onToggle(t.id)}
          />
        ))}
      </View>
    </View>
  );
}

function PotTile({
  template,
  selected,
  onPress,
}: {
  template: PotTemplate;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  // £1200 · £35/wk — the web shows whole pounds joined with a middot.
  const meta = `${formatMinorAmount(template.goal * PENCE_PER_POUND)} · ${formatMinorAmount(
    template.perWeek * PENCE_PER_POUND,
  )}/wk`;
  return (
    <Text
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.potTile, selected ? s.potTileSelected : undefined]}
      suppressHighlighting
    >
      <Text style={s.potTileInner}>
        <Text style={s.potName}>{template.name}</Text>
        {'\n'}
        <Text style={s.potMeta}>{meta}</Text>
      </Text>
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Progress track — four pills. The active one is a wide terracotta bar; completed
// steps are a narrower dimmed-ink bar; upcoming steps are a narrow hairline bar.
// Mirrors the web's w-7 accent / w-5 ink-60 / w-5 hairline treatment.
// ---------------------------------------------------------------------------

function ProgressTrack({ step }: { step: number }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`} style={s.progress}>
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const state = i === step ? 'active' : i < step ? 'done' : 'todo';
        return (
          <View
            key={i}
            style={[
              s.progressPill,
              state === 'active' ? s.progressActive : undefined,
              state === 'done' ? s.progressDone : undefined,
            ]}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Slider — a dependency-free RN port of the web's <input type="range">. A sunken
// track with an accent fill and a terracotta thumb, driven by a PanResponder. The web
// snaps to its step; this snaps to the same step. No new native module is pulled in.
// ---------------------------------------------------------------------------

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 24;

function Slider({
  min,
  max,
  step,
  value,
  onChange,
  accessibilityLabel,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [trackWidth, setTrackWidth] = useState(0);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  // Map a finger x (relative to the track) to a stepped value within [min, max].
  const valueFromX = (x: number): number => {
    if (trackWidth <= 0) {
      return value;
    }
    const ratio = clamp(x / trackWidth, 0, 1);
    const raw = min + ratio * (max - min);
    const snapped = Math.round((raw - min) / step) * step + min;
    return clampInt(snapped, min, max);
  };

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
    onPanResponderMove: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
  });

  const ratio = max > min ? clamp((value - min) / (max - min), 0, 1) : 0;
  const fillWidth = trackWidth * ratio;
  // Keep the thumb fully on the track at both ends.
  const thumbLeft = clamp(fillWidth - THUMB_SIZE / 2, 0, Math.max(0, trackWidth - THUMB_SIZE));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
      onLayout={onTrackLayout}
      style={s.sliderHit}
      {...responder.panHandlers}
    >
      <View style={s.sliderTrack}>
        <View style={[s.sliderFill, { width: fillWidth }]} />
      </View>
      <View pointerEvents="none" style={[s.sliderThumb, { left: thumbLeft }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.round(clamp(n, lo, hi));
}

// ---------------------------------------------------------------------------
// Styles — colours map 1:1 to the web CSS variables: --inset #FCFBF7 (paper.inset),
// --ink #1A1815 (paper.ink), --muted-ink #6B6760 (paper.muted), --hairline #ECE9E0
// (paper.hairline), --accent #E0633A (paper.calm), --accent-soft #F5E4DB
// (paper.calmSoft). Serif display + italic come from the kit's serif faces.
// Resolved against the active palette `t` (light or dark) via makeStyles(t).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: {
      gap: gap.xl,
    },

    // Progress
    progress: {
      flexDirection: 'row',
      gap: 6,
    },
    progressPill: {
      height: 4,
      width: 20, // w-5
      borderRadius: radius.pill,
      backgroundColor: t.hairline,
    },
    progressActive: {
      width: 28, // w-7
      backgroundColor: t.calm,
    },
    progressDone: {
      // A completed-but-quiet step: a dimmed ink that reads on both grounds (the web's ink/60 is a
      // light-only literal; muted is the palette key that stays legible on the dark canvas too).
      backgroundColor: t.muted,
    },

    // Header
    header: {
      gap: 4,
      marginBottom: gap.lg,
    },
    eyebrow: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 12.5,
      letterSpacing: 0.2,
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      lineHeight: 31,
      letterSpacing: -0.3,
    },
    headlineAccent: {
      // Same upright serif as the headline, recoloured terracotta — never italic.
      color: t.calm,
      fontFamily: serif.display,
    },

    // Step 1 — name input
    input: {
      height: 48,
      backgroundColor: t.inset,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      borderRadius: radius.md,
      paddingHorizontal: gap.lg,
      fontSize: 15,
      color: t.ink,
    },

    // Steps 2 + 3 — sliders
    sliderBlock: {
      gap: gap.md,
    },
    numberRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: gap.sm,
    },
    bigNumber: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 40,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    numberSuffix: {
      color: t.muted,
      fontSize: 13,
    },
    helper: {
      color: t.muted,
      fontSize: 11.5,
      lineHeight: 17,
      marginTop: gap.xs,
    },

    sliderHit: {
      height: THUMB_SIZE,
      justifyContent: 'center',
    },
    sliderTrack: {
      height: TRACK_HEIGHT,
      borderRadius: radius.pill,
      backgroundColor: t.sunken,
      overflow: 'hidden',
    },
    sliderFill: {
      height: TRACK_HEIGHT,
      borderRadius: radius.pill,
      backgroundColor: t.calm,
    },
    sliderThumb: {
      position: 'absolute',
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: t.calm,
      borderWidth: 3,
      borderColor: t.surface,
      ...elevation.card,
    },

    // Step 4 — pots
    potsHelper: {
      color: t.muted,
      fontSize: 12.5,
      lineHeight: 18,
      marginBottom: gap.md,
    },
    potGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.sm,
    },
    potTile: {
      // Two per row: each tile takes just under half, the gap fills the rest.
      width: '48%',
      minHeight: 64,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: t.inset,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    potTileSelected: {
      backgroundColor: t.calmSoft,
      borderWidth: 1,
      borderColor: t.calm,
    },
    potTileInner: {
      // The Text-as-button carries both lines so the whole tile is one tap target.
    },
    potName: {
      color: t.ink,
      fontSize: 13,
      fontWeight: '500',
    },
    potMeta: {
      color: t.muted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },

    // Actions
    actions: {
      gap: gap.sm,
      marginTop: gap.xs,
    },
  });
}
