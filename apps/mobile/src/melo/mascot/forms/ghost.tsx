// Melo's ghost form — a soft floating wisp. Same soul, different body.
// Silhouette ported from the Lovable form-roster prototype (FormGhost, melo-forms/forms.tsx):
// an egg-ish dome that dissolves into a wavy hem instead of feet, no tail, hovering just
// off the ground (a faint shadow below sells the float). Family DNA kept: three-nub crest,
// medium eyes, calm posture, and the glowing belly as the status display (MELO_BLUEPRINT.md §3.1).
// Composed inside the host's <Svg> after <Defs>; the host owns the RadialGradient (glowId).

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

// Egg-ish dome (x 31..89) that ends in four soft hem waves around y 91 — no feet, no tail.
const WISP_BODY =
  'M60 18 C44 18 31 33 31 56 C31 70 31 82 31 91 ' +
  'q7.25 7.5 14.5 0 q7.25 7.5 14.5 0 q7.25 7.5 14.5 0 q7.25 7.5 14.5 0 ' +
  'C89 82 89 70 89 56 C89 33 76 18 60 18 Z';

// Underside of each hem wave, inset — the shade gives the hem its lift.
const HEM_SHADE =
  'M33.5 91.5 q5 6 9.5 0 M48 91.5 q5 6 9.5 0 M62.5 91.5 q5 6 9.5 0 M77 91.5 q5 6 9.5 0';

function GhostRender({ emotion, c, glow, glowId }: FormRigProps): ReactElement {
  const crestDip =
    emotion === 'concern' ? 2.5 : emotion === 'stress' ? 3 : emotion === 'sadness' ? 3.5 : 0;

  return (
    <G>
      {/* float shadow — the gap below the hem is what says "hovering" */}
      <Ellipse cx={60} cy={108} rx={21} ry={3.4} fill={INK} opacity={0.08} />
      {/* body */}
      <Path d={WISP_BODY} fill={c.body} />
      {/* hem shading */}
      <Path
        d={HEM_SHADE}
        stroke={c.shade}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        opacity={0.45}
      />
      {/* crest */}
      <G translateY={crestDip}>
        <Circle cx={47} cy={22} r={4.6} fill={c.crest} />
        <Circle cx={60} cy={17} r={5.6} fill={c.crest} />
        <Circle cx={73} cy={22} r={4.6} fill={c.crest} />
      </G>
      {/* belly + glow — the status display survives every form */}
      <Ellipse cx={60} cy={80} rx={17} ry={11} fill={c.belly} opacity={0.95} />
      <Ellipse cx={60} cy={80} rx={14} ry={9} fill={`url(#${glowId})`} opacity={glow} />

      <Face emotion={emotion} bodyFill={c.body} sparkle={c.glow} />
    </G>
  );
}

function Face({
  emotion,
  bodyFill,
  sparkle,
}: {
  emotion: MascotFamily;
  bodyFill: string;
  sparkle: string;
}) {
  switch (emotion) {
    case 'calm':
      return (
        <G>
          <Ellipse cx={46} cy={54} rx={4} ry={4.6} fill={INK} />
          <Ellipse cx={74} cy={54} rx={4} ry={4.6} fill={INK} />
          <Rect x={40.5} y={46.6} width={11} height={5} rx={2.5} fill={bodyFill} />
          <Rect x={68.5} y={46.6} width={11} height={5} rx={2.5} fill={bodyFill} />
          <Path
            d="M55 70 q5 3.5 10 0"
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
            d="M40 55 q6 -7 12 0"
            stroke={INK}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M68 55 q6 -7 12 0"
            stroke={INK}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M53 68 q7 8 14 0"
            stroke={INK}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    case 'concern':
      return (
        <G>
          <Path d="M39 44.5 l13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M81 44.5 l-13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={54} rx={4.2} ry={5} fill={INK} />
          <Ellipse cx={74} cy={54} rx={4.2} ry={5} fill={INK} />
          <Path d="M55 71 h10" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'stress':
      return (
        <G>
          {/* the storm vigil: composed, holding a small umbrella (§3.2) */}
          <Path d="M66 24 A21 21 0 0 1 108 24 L108 25 Q87 16 66 25 Z" fill={UMBRELLA} />
          <Path
            d="M87 24 V48 q0 6 6 6"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M40 44 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M68 44 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={54} rx={3.8} ry={4.2} fill={INK} />
          <Ellipse cx={74} cy={54} rx={3.8} ry={4.2} fill={INK} />
          <Path d="M56 71 h8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'sadness':
      return (
        <G>
          {/* one honest beat — never aimed at the user (§3.1) */}
          <Path d="M39 41.5 l13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M81 41.5 l-13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={55} rx={4} ry={4.2} fill={INK} />
          <Ellipse cx={74} cy={55} rx={4} ry={4.2} fill={INK} />
          <Rect x={40.5} y={48} width={11} height={4.6} rx={2.3} fill={bodyFill} />
          <Rect x={68.5} y={48} width={11} height={4.6} rx={2.3} fill={bodyFill} />
          <Path
            d="M55 73 q5 -3 10 0"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    case 'hope':
      return (
        <G rotation={-3} origin="60, 58">
          <Ellipse cx={46} cy={53} rx={4} ry={4.6} fill={INK} />
          <Ellipse cx={74} cy={53} rx={4} ry={4.6} fill={INK} />
          <Circle cx={47.6} cy={51.4} r={1.3} fill={sparkle} opacity={0.9} />
          <Circle cx={75.6} cy={51.4} r={1.3} fill={sparkle} opacity={0.9} />
          <Path
            d="M55 70 q6 2.5 11 -1"
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
            d="M38 45 Q60 38 82 45"
            stroke={INK}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />
          <Path d="M40 54 h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M68 54 h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M56 70 h8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
  }
}

export const ghostRig: {
  readonly id: 'ghost';
  readonly name: string;
  readonly Render: (props: FormRigProps) => ReactElement;
} = {
  id: 'ghost',
  name: 'the wisp',
  Render: GhostRender,
};
