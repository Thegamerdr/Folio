// Melo's fenice form — the LOCKED brand mascot (founder spec, 2026-07-05).
// A compact phoenix/money-companion: soft egg-ish body, a three-tongue ember crest,
// a small chest ember-heart brand mark, a unified swept tail (2-3 feather tips),
// and a folded wing hint at the side. The belly glow stays exactly as the creature's —
// it is the Clarity Ember status display and is never removed or reinterpreted.
// NOT an aggressive eagle, NOT a fantasy RPG bird, NOT childish. Same seven-emotion
// grammar as every other form: stress keeps the small umbrella vigil, sadness is one
// honest beat, joy never becomes a perpetual grin.
// Composed inside the host's <Svg> (120x120) AFTER <Defs> — no Svg/Defs here.

import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { MascotFamily } from '@folio/melo-engine';

const INK = '#3A342C';
const UMBRELLA = '#5A646E';
const GOLD = '#D9A441';

export interface FormRigProps {
  readonly emotion: MascotFamily;
  readonly c: {
    readonly body: string;
    readonly shade: string;
    readonly crest: string;
    readonly belly: string;
    readonly glow: string;
  };
  readonly glow: number;
  readonly glowId: string;
}

/** Crest carries the emotional dip — same values as the creature's crestDip. */
function crestDipFor(emotion: MascotFamily): number {
  if (emotion === 'concern') return 2.5;
  if (emotion === 'stress') return 3;
  if (emotion === 'sadness') return 3.5;
  return 0;
}

function FeniceBody({ emotion, c, glow, glowId }: FormRigProps) {
  const crestDip = crestDipFor(emotion);
  return (
    <G>
      {/* unified tail silhouette — one elegant swept tail, 2-3 feather tips, behind the body */}
      <Path
        d="M84 92 Q104 96 112 84 Q100 88 92 80 Q102 78 108 66 Q94 72 86 64 Q88 78 84 92 Z"
        fill={c.shade}
      />

      {/* folded wing hint — small soft shape at the side, tucked against the body */}
      <Path d="M86 58 Q98 62 96 78 Q86 74 82 62 Z" fill={c.shade} opacity={0.85} />

      {/* body — the family egg, phoenix-soft */}
      <Path
        d="M60 20 C42 20 28 38 28 66 C28 94 42 106 60 106 C78 106 92 94 92 66 C92 38 78 20 60 20 Z"
        fill={c.body}
      />

      {/* ember crest — three soft flame tongues replacing the nubs */}
      <G translateY={crestDip}>
        <Path d="M46 26 Q43 18 47 10 Q51 18 49 26 Q47.5 27.5 46 26 Z" fill={c.crest} />
        <Path d="M60 22 Q56 12 60 2 Q64 12 60 22 Q60 23 60 22 Z" fill={c.crest} />
        <Path d="M74 26 Q71 18 75 10 Q79 18 77 26 Q75.5 27.5 74 26 Z" fill={c.crest} />
      </G>

      {/* chest ember-heart mark — subtle brand mark, gold, above the belly glow */}
      <Path
        d="M60 63 Q56.5 58.5 52 60.4 Q47.8 62.2 49.6 67.2 Q51.4 72 60 78 Q68.6 72 70.4 67.2 Q72.2 62.2 68 60.4 Q63.5 58.5 60 63 Z"
        fill={GOLD}
        opacity={0.85}
      />

      {/* belly + glow — the status display; never removed */}
      <Ellipse cx={60} cy={81} rx={20} ry={15.5} fill={c.belly} opacity={0.95} />
      <Ellipse cx={60} cy={81} rx={16} ry={12} fill={`url(#${glowId})`} opacity={glow} />

      <FeniceFace emotion={emotion} bodyFill={c.body} />
    </G>
  );
}

function FeniceFace({ emotion, bodyFill }: { emotion: MascotFamily; bodyFill: string }) {
  switch (emotion) {
    case 'calm':
      return (
        <G>
          <Ellipse cx={46} cy={56} rx={4} ry={4.6} fill={INK} />
          <Ellipse cx={74} cy={56} rx={4} ry={4.6} fill={INK} />
          <Rect x={40.5} y={48.6} width={11} height={5} rx={2.5} fill={bodyFill} />
          <Rect x={68.5} y={48.6} width={11} height={5} rx={2.5} fill={bodyFill} />
          <Path
            d="M55 72 q5 3.5 10 0"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    case 'joy':
      return (
        <G>
          <Path
            d="M40 57 q6 -7 12 0"
            stroke={INK}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M68 57 q6 -7 12 0"
            stroke={INK}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M53 70 q7 8 14 0"
            stroke={INK}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse cx={39} cy={65} rx={4} ry={2.4} fill="#C4623A" opacity={0.22} />
          <Ellipse cx={81} cy={65} rx={4} ry={2.4} fill="#C4623A" opacity={0.22} />
        </G>
      );
    case 'concern':
      return (
        <G>
          <Path d="M39 46.5 l13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M81 46.5 l-13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={56} rx={4.2} ry={5} fill={INK} />
          <Ellipse cx={74} cy={56} rx={4.2} ry={5} fill={INK} />
          <Path d="M55 73 h10" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'stress':
      return (
        <G>
          {/* the storm vigil: composed, holding a small umbrella (kept exactly, all forms) */}
          <Path d="M66 24 A21 21 0 0 1 108 24 L108 25 Q87 16 66 25 Z" fill={UMBRELLA} />
          <Path
            d="M87 24 V50 q0 6 6 6"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M40 46 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M68 46 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={56} rx={3.8} ry={4.2} fill={INK} />
          <Ellipse cx={74} cy={56} rx={3.8} ry={4.2} fill={INK} />
          <Path d="M56 73 h8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'sadness':
      return (
        <G>
          {/* one honest beat — never aimed at the user */}
          <Path d="M39 43.5 l13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M81 43.5 l-13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={57} rx={4} ry={4.2} fill={INK} />
          <Ellipse cx={74} cy={57} rx={4} ry={4.2} fill={INK} />
          <Rect x={40.5} y={50} width={11} height={4.6} rx={2.3} fill={bodyFill} />
          <Rect x={68.5} y={50} width={11} height={4.6} rx={2.3} fill={bodyFill} />
          <Path
            d="M55 75 q5 -3 10 0"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    case 'hope':
      return (
        <G rotation={-3} origin="60, 60">
          <Ellipse cx={46} cy={55} rx={4} ry={4.6} fill={INK} />
          <Ellipse cx={74} cy={55} rx={4} ry={4.6} fill={INK} />
          <Circle cx={47.6} cy={53.4} r={1.3} fill="#FFF6EA" opacity={0.9} />
          <Circle cx={75.6} cy={53.4} r={1.3} fill="#FFF6EA" opacity={0.9} />
          <Path
            d="M55 72 q6 2.5 11 -1"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    case 'squint':
      return (
        <G>
          <Path
            d="M38 47 Q60 40 82 47"
            stroke={INK}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />
          <Path d="M40 56 h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M68 56 h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M56 72 h8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
  }
}

export const feniceRig: {
  readonly id: 'fenice';
  readonly name: string;
  readonly Render: (props: FormRigProps) => ReactElement;
} = {
  id: 'fenice',
  name: 'the fenice',
  Render: (props: FormRigProps): ReactElement => <FeniceBody {...props} />,
};

// --- Sanctioned fenice accessory set (replaces the old wardrobe for this form) ---
// Positioned on the fenice rig only: scarf at the neck line, ring as a thin gold
// halo arc near the crest, wrap as a soft band on the body, charm as a tiny pendant
// below the chest mark, band as a subtle feather accent by the folded wing.

export type FeniceAccessoryId =
  | 'ember-scarf'
  | 'clarity-ring'
  | 'recovery-wrap'
  | 'weather-charm'
  | 'feather-band';

export const FENICE_ACCESSORIES: readonly { id: FeniceAccessoryId; name: string }[] = [
  { id: 'ember-scarf', name: 'the ember scarf' },
  { id: 'clarity-ring', name: 'the clarity ring' },
  { id: 'recovery-wrap', name: 'the recovery wrap' },
  { id: 'weather-charm', name: 'the weather charm' },
  { id: 'feather-band', name: 'the feather band' },
];

export function FeniceAccessory({ id }: { id: FeniceAccessoryId }): ReactElement | null {
  switch (id) {
    case 'ember-scarf':
      // A slim warm wrap at the neck, one soft hanging tail — echoes the wardrobe scarf.
      return (
        <G>
          <Path d="M31 75 Q60 81 89 75 L89 83 Q60 89 31 83 Z" fill="#C4623A" />
          <Path d="M50.5 82.5 L49 96.5 Q53.5 98.5 58.5 96.5 L58 83.5 Z" fill="#9E5C3B" />
        </G>
      );
    case 'clarity-ring':
      // A thin gold halo arc riding just above the crest — a quiet status ring, not a crown.
      return (
        <Path
          d="M42 14 A20 20 0 0 1 78 14"
          stroke={GOLD}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          opacity={0.85}
        />
      );
    case 'recovery-wrap':
      // A soft cream band around the lower body — gentle, bandage-like, never clinical.
      return (
        <G>
          <Path d="M33 88 Q60 94 87 88 L87 94 Q60 100 33 94 Z" fill="#F7F2EA" opacity={0.92} />
          <Path
            d="M35 90.5 Q60 96 85 90.5"
            stroke="#D9A441"
            strokeWidth={1.2}
            fill="none"
            opacity={0.4}
          />
        </G>
      );
    case 'weather-charm':
      // A tiny pendant hanging just below the chest ember-heart mark.
      return (
        <G>
          <Path d="M60 79 L60 86" stroke={GOLD} strokeWidth={1.4} strokeLinecap="round" />
          <Circle cx={60} cy={89} r={3.2} fill={GOLD} opacity={0.9} />
          <Circle cx={60} cy={89} r={1.3} fill="#F7F2EA" opacity={0.8} />
        </G>
      );
    case 'feather-band':
      // A subtle accent stroke along the folded wing hint — one warm highlight feather.
      return (
        <Path
          d="M88 60 Q97 64 95 76"
          stroke={GOLD}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          opacity={0.6}
        />
      );
    default:
      return null;
  }
}
