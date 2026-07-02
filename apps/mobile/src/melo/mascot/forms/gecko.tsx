// Melo 'gecko' form — react-native-svg rig for the forms registry.
// Silhouette ported from the Lovable forms-roster prototype (melo-forms/forms.tsx, FormGecko):
// flatter, wider body; rounded head; big friendly eyes; curled tail; small toe-pads.
// Same soul as the creature rig (MeloMascot.tsx): seven emotion families with the same
// grammar, belly glow as a status display, adult by restraint — the body changes, Melo doesn't.

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
  /** 0..1 — belly-glow brightness (bright = safe, dim = storm). */
  readonly glow: number;
  /** Id of the RadialGradient the host defines in its <Defs>. */
  readonly glowId: string;
}

// The gecko's head is wider and sits lower than the creature's, so the whole
// face drops: eyes at y52 (creature 56), wider apart, mouth around y66.
const EYE_L = 44;
const EYE_R = 76;

function GeckoFace({ emotion, c }: { emotion: MascotFamily; c: FormRigProps['c'] }): ReactElement {
  switch (emotion) {
    case 'calm':
      return (
        <G>
          <Ellipse cx={EYE_L} cy={52} rx={4.4} ry={5} fill={INK} />
          <Ellipse cx={EYE_R} cy={52} rx={4.4} ry={5} fill={INK} />
          <Rect x={38} y={44.4} width={12} height={5} rx={2.5} fill={c.body} />
          <Rect x={70} y={44.4} width={12} height={5} rx={2.5} fill={c.body} />
          <Path
            d="M54 66 q6 3.5 12 0"
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
            d="M37 53 q7 -7 14 0"
            stroke={INK}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M69 53 q7 -7 14 0"
            stroke={INK}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M52 64 q8 8 16 0"
            stroke={INK}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse cx={34} cy={61} rx={4} ry={2.4} fill={c.crest} opacity={0.3} />
          <Ellipse cx={86} cy={61} rx={4} ry={2.4} fill={c.crest} opacity={0.3} />
        </G>
      );
    case 'concern':
      return (
        <G>
          <Path d="M37 42.5 l13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M83 42.5 l-13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={EYE_L} cy={52} rx={4.6} ry={5.4} fill={INK} />
          <Ellipse cx={EYE_R} cy={52} rx={4.6} ry={5.4} fill={INK} />
          <Path d="M54 67 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'stress':
      return (
        <G>
          {/* the storm vigil: composed, holding a small umbrella (§3.2) */}
          <Path d="M64 22 A20 20 0 0 1 104 22 L104 23 Q84 14 64 23 Z" fill={UMBRELLA} />
          <Path
            d="M84 22 V46 q0 5 5 5"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M38 42 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M70 42 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={EYE_L} cy={52} rx={4} ry={4.4} fill={INK} />
          <Ellipse cx={EYE_R} cy={52} rx={4} ry={4.4} fill={INK} />
          <Path d="M55 67 h10" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'sadness':
      return (
        <G>
          {/* one honest beat — never aimed at the user (§3.1) */}
          <Path d="M37 39.5 l13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M83 39.5 l-13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={EYE_L} cy={53} rx={4.4} ry={4.6} fill={INK} />
          <Ellipse cx={EYE_R} cy={53} rx={4.4} ry={4.6} fill={INK} />
          <Rect x={38} y={46.2} width={12} height={4.6} rx={2.3} fill={c.body} />
          <Rect x={70} y={46.2} width={12} height={4.6} rx={2.3} fill={c.body} />
          <Path
            d="M54 69 q6 -3 12 0"
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
          <Ellipse cx={EYE_L} cy={51} rx={4.4} ry={5} fill={INK} />
          <Ellipse cx={EYE_R} cy={51} rx={4.4} ry={5} fill={INK} />
          <Circle cx={45.7} cy={49.3} r={1.4} fill={c.belly} opacity={0.9} />
          <Circle cx={77.7} cy={49.3} r={1.4} fill={c.belly} opacity={0.9} />
          <Path
            d="M54 66 q7 2.5 12 -1"
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
            d="M35 44 Q60 37 85 44"
            stroke={INK}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />
          <Path d="M38 52 h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M70 52 h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M55 66 h10" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
  }
}

function RenderGecko({ emotion, c, glow, glowId }: FormRigProps): ReactElement {
  // Same emotional grammar as the creature's crestDip — here the brow ridge sinks.
  const ridgeDip =
    emotion === 'concern' ? 2.5 : emotion === 'stress' ? 3 : emotion === 'sadness' ? 3.5 : 0;
  return (
    <G>
      {/* curled tail */}
      <Path
        d="M92 86 Q114 84 112 64 Q110 50 97 54"
        stroke={c.shade}
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
      />
      {/* body — flatter and wider than the creature, rounded head */}
      <Path
        d="M60 30 C34 30 21 54 24 78 C27 97 43 106 60 106 C77 106 93 97 96 78 C99 54 86 30 60 30 Z"
        fill={c.body}
      />
      {/* brow ridge — the gecko's crest, dips with the heavier moods */}
      <G translateY={ridgeDip}>
        <Ellipse cx={48} cy={29.5} rx={4.2} ry={3} fill={c.crest} />
        <Ellipse cx={72} cy={29.5} rx={4.2} ry={3} fill={c.crest} />
      </G>
      {/* small toe-pads peeking out at the base */}
      <Circle cx={33} cy={103} r={4.5} fill={c.crest} />
      <Circle cx={87} cy={103} r={4.5} fill={c.crest} />
      {/* belly + glow — the status display survives every form */}
      <Ellipse cx={60} cy={81} rx={22} ry={13} fill={c.belly} opacity={0.95} />
      <Ellipse cx={60} cy={81} rx={17.5} ry={10.5} fill={`url(#${glowId})`} opacity={glow} />
      <GeckoFace emotion={emotion} c={c} />
    </G>
  );
}

export const geckoRig: {
  readonly id: 'gecko';
  readonly name: string;
  readonly Render: (props: FormRigProps) => ReactElement;
} = {
  id: 'gecko',
  name: 'the gecko',
  Render: RenderGecko,
};
