// Melo's cat form — same soul, different body (Lovable form-roster port, rank 3 "Cat").
// Silhouette from the prototype's FormCat (melo-forms/forms.tsx): triangular ears,
// curled tail, small nose, whiskers — rebuilt in the creature rig's 120x120 frame so
// the seven emotion families keep the exact same grammar (MELO_BLUEPRINT.md §3.1):
// adult by restraint, medium eyes, calm posture, joy without a perpetual grin,
// sadness as one honest beat never aimed at the user, stress keeping the umbrella vigil.
// The glowing belly is a status display and survives every emotion.
// Composed inside the host's <Svg> AFTER <Defs> — the host owns the glow gradient.

import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { MascotFamily } from '@folio/melo-engine';

const INK = '#3A342C';
const UMBRELLA = '#5A646E';

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

/** Ears dip with the mood, the cat's equivalent of the creature's crest dip. */
function earDipFor(emotion: MascotFamily): number {
  switch (emotion) {
    case 'concern':
      return 2.5;
    case 'stress':
      return 3;
    case 'sadness':
      return 3.5;
    default:
      return 0;
  }
}

function CatRender({ emotion, c, glow, glowId }: FormRigProps): ReactElement {
  const earDip = earDipFor(emotion);

  return (
    <G>
      {/* curled tail — resting against the hip, never lashing */}
      <Path
        d="M88 99 Q111 97 108 75 Q105 64 95.5 67.5"
        stroke={c.shade}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />

      {/* triangular ears — drawn under the body so their bases tuck into the head */}
      <G translateY={earDip}>
        <Path d="M38 30 L45 8 L58 25 Z" fill={c.shade} />
        <Path d="M82 30 L75 8 L62 25 Z" fill={c.shade} />
        <Path d="M42 26 L46 14 L52 23 Z" fill={c.crest} opacity={0.7} />
        <Path d="M78 26 L74 14 L68 23 Z" fill={c.crest} opacity={0.7} />
      </G>

      {/* body — the family egg, unchanged mass */}
      <Path
        d="M60 22 C43 22 29 39 29 66 C29 93 43 106 60 106 C77 106 91 93 91 66 C91 39 77 22 60 22 Z"
        fill={c.body}
      />

      {/* belly + glow — the status display; bright when safe, dim in a storm */}
      <Ellipse cx={60} cy={80} rx={19} ry={15} fill={c.belly} opacity={0.95} />
      <Ellipse cx={60} cy={80} rx={15.5} ry={11.5} fill={`url(#${glowId})`} opacity={glow} />

      {/* small nose + whiskers — constant, part of the body, not the mood */}
      <Path d="M57.7 65.5 L62.3 65.5 L60 68.8 Z" fill={c.crest} />
      <G stroke={INK} strokeWidth={1} strokeLinecap="round" opacity={0.4}>
        <Path d="M33 64 L45 65.4" />
        <Path d="M33 69 L45 67.6" />
        <Path d="M87 64 L75 65.4" />
        <Path d="M87 69 L75 67.6" />
      </G>

      <Face emotion={emotion} c={c} />
    </G>
  );
}

function Face({ emotion, c }: { emotion: MascotFamily; c: FormRigProps['c'] }) {
  switch (emotion) {
    case 'calm':
      return (
        <G>
          <Ellipse cx={46} cy={56} rx={4} ry={4.6} fill={INK} />
          <Ellipse cx={74} cy={56} rx={4} ry={4.6} fill={INK} />
          <Rect x={40.5} y={48.6} width={11} height={5} rx={2.5} fill={c.body} />
          <Rect x={68.5} y={48.6} width={11} height={5} rx={2.5} fill={c.body} />
          <Path
            d="M55 72.5 q5 3 10 0"
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
            d="M53 71.5 q7 7 14 0"
            stroke={INK}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse cx={39} cy={64} rx={4} ry={2.4} fill={c.crest} opacity={0.28} />
          <Ellipse cx={81} cy={64} rx={4} ry={2.4} fill={c.crest} opacity={0.28} />
        </G>
      );
    case 'concern':
      return (
        <G>
          <Path d="M39 46.5 l13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M81 46.5 l-13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={56} rx={4.2} ry={5} fill={INK} />
          <Ellipse cx={74} cy={56} rx={4.2} ry={5} fill={INK} />
          <Path d="M55 73.5 h10" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'stress':
      return (
        <G>
          {/* the storm vigil: composed, holding a small umbrella (§3.2) */}
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
          <Path d="M56 73.5 h8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'sadness':
      return (
        <G>
          {/* one honest beat — never aimed at the user (§3.1) */}
          <Path d="M39 43.5 l13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M81 43.5 l-13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={57} rx={4} ry={4.2} fill={INK} />
          <Ellipse cx={74} cy={57} rx={4} ry={4.2} fill={INK} />
          <Rect x={40.5} y={50} width={11} height={4.6} rx={2.3} fill={c.body} />
          <Rect x={68.5} y={50} width={11} height={4.6} rx={2.3} fill={c.body} />
          <Path
            d="M55 76 q5 -3 10 0"
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
          <Circle cx={47.6} cy={53.4} r={1.3} fill={c.belly} opacity={0.9} />
          <Circle cx={75.6} cy={53.4} r={1.3} fill={c.belly} opacity={0.9} />
          <Path
            d="M55 72.5 q6 2.5 11 -1"
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
          <Path d="M56 72.5 h8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
  }
}

export const catRig: {
  readonly id: 'cat';
  readonly name: string;
  readonly Render: (props: FormRigProps) => ReactElement;
} = {
  id: 'cat',
  name: 'the cat',
  Render: CatRender,
};
