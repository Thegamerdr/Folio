// Melo's fox form — same soul, different body (Lovable form-roster fox, rank 2).
// Ported from the prototype's FormFox (melo-forms/forms.tsx): pointed ears with a
// lighter inner, a plush brush tail with a pale tip, and a slightly narrower muzzle.
// The seven emotion families keep the creature's exact grammar; the ears take over
// the crest's dip so concern/stress/sadness read the same way at a glance.
// Composed inside the host's <Svg> (120x120) AFTER <Defs> — no Svg/Defs here.

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

/** Ears carry the crest's emotional dip — same values as the creature's crestDip. */
function earDipFor(emotion: MascotFamily): number {
  if (emotion === 'concern') return 2.5;
  if (emotion === 'stress') return 3;
  if (emotion === 'sadness') return 3.5;
  return 0;
}

function FoxBody({ emotion, c, glow, glowId }: FormRigProps) {
  const earDip = earDipFor(emotion);
  return (
    <G>
      {/* plush brush tail, behind the body; pale tip like the prototype's cream flick */}
      <Path
        d="M82 94 Q108 88 104 64"
        stroke={c.shade}
        strokeWidth={11}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M102 69 q3 -4.5 2 -6.5"
        stroke={c.belly}
        strokeWidth={5.5}
        fill="none"
        strokeLinecap="round"
      />

      {/* pointed ears — bases tucked under the head; inner ear in the crest colour */}
      <G translateY={earDip}>
        <Path d="M39 31 L45 9 L56 25 Z" fill={c.shade} />
        <Path d="M81 31 L75 9 L64 25 Z" fill={c.shade} />
        <Path d="M42.5 27 L45.5 14.5 L51 23.5 Z" fill={c.crest} opacity={0.9} />
        <Path d="M77.5 27 L74.5 14.5 L69 23.5 Z" fill={c.crest} opacity={0.9} />
      </G>

      {/* body — the family egg, drawn a touch narrower than the creature */}
      <Path
        d="M60 22 C44 22 31 39 31 66 C31 93 44 105 60 105 C76 105 89 93 89 66 C89 39 76 22 60 22 Z"
        fill={c.body}
      />

      {/* narrower muzzle: a soft patch and a small nose above the mouth */}
      <Ellipse cx={60} cy={66.5} rx={10} ry={7} fill={c.belly} opacity={0.5} />
      <Ellipse cx={60} cy={63.5} rx={2.6} ry={2} fill={INK} />

      {/* belly + glow — the status display; never removed */}
      <Ellipse cx={60} cy={81} rx={19} ry={15} fill={c.belly} opacity={0.95} />
      <Ellipse cx={60} cy={81} rx={15} ry={11.5} fill={`url(#${glowId})`} opacity={glow} />

      <FoxFace emotion={emotion} c={c} />
    </G>
  );
}

function FoxFace({ emotion, c }: { emotion: MascotFamily; c: FormRigProps['c'] }) {
  switch (emotion) {
    case 'calm':
      return (
        <G>
          <Ellipse cx={46} cy={56} rx={4} ry={4.6} fill={INK} />
          <Ellipse cx={74} cy={56} rx={4} ry={4.6} fill={INK} />
          <Rect x={40.5} y={48.6} width={11} height={5} rx={2.5} fill={c.body} />
          <Rect x={68.5} y={48.6} width={11} height={5} rx={2.5} fill={c.body} />
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
          {/* bright, not a perpetual grin — arcs and a short-lived smile */}
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
          <Ellipse cx={39} cy={65} rx={4} ry={2.4} fill={c.crest} opacity={0.3} />
          <Ellipse cx={81} cy={65} rx={4} ry={2.4} fill={c.crest} opacity={0.3} />
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
          {/* the storm vigil: composed, holding a small umbrella — ears sheltered under it */}
          <Path d="M72 22 A21 21 0 0 1 114 22 L114 23 Q93 14 72 23 Z" fill={UMBRELLA} />
          <Path
            d="M93 22 V50 q0 6 6 6"
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
          <Rect x={40.5} y={50} width={11} height={4.6} rx={2.3} fill={c.body} />
          <Rect x={68.5} y={50} width={11} height={4.6} rx={2.3} fill={c.body} />
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
          <Circle cx={47.6} cy={53.4} r={1.3} fill={c.glow} opacity={0.9} />
          <Circle cx={75.6} cy={53.4} r={1.3} fill={c.glow} opacity={0.9} />
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

export const foxRig: {
  readonly id: 'fox';
  readonly name: string;
  readonly Render: (props: FormRigProps) => ReactElement;
} = {
  id: 'fox',
  name: 'the fox',
  Render: (props: FormRigProps): ReactElement => <FoxBody {...props} />,
};
