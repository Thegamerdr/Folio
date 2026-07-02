// Melo's free wardrobe (MELO_BLUEPRINT.md §14 item 6) — ten quiet, adult items
// rigged onto the mascot's own 120×120 viewBox. Each layer is designed to be
// composed inside MeloMascot's <Svg> AFTER the body/face layers, so hats cover
// the crest and glasses sit on the eye line, the way real clothing would.
//
// Rig reference (MeloMascot.tsx): body egg y20–106 (widest x28–92 at y66),
// crest bobbles cy 18.5–24, eyes at (46,56) and (74,56), mouth y70–75,
// belly ellipse cy81. Palette stays in the Warm Paper register — soft
// terracotta / moss / slate / cream / ink, nothing loud.

import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

const INK = '#4A443B';
const TERRACOTTA = '#B4694A';
const TERRACOTTA_DEEP = '#9E5A3E';
const MOSS = '#7F8F6F';
const MOSS_DEEP = '#6E7F5E';
const SLATE = '#5A646E';
const SLATE_DEEP = '#4C555E';
const SLATE_SOFT = '#6B7580';
const CREAM = '#EBDDC4';
const BROWN = '#6E5A44';

export type WardrobeId =
  | 'beanie'
  | 'round-glasses'
  | 'scarf'
  | 'flat-cap'
  | 'headphones'
  | 'neckerchief'
  | 'bobble-hat'
  | 'reading-glasses'
  | 'hood'
  | 'bow';

export interface WardrobeItem {
  readonly id: WardrobeId;
  readonly name: string;
}

export const WARDROBE: readonly WardrobeItem[] = [
  { id: 'beanie', name: 'the beanie' },
  { id: 'bobble-hat', name: 'the bobble hat' },
  { id: 'flat-cap', name: 'the flat cap' },
  { id: 'hood', name: 'the woolly hood' },
  { id: 'round-glasses', name: 'round glasses' },
  { id: 'reading-glasses', name: 'reading glasses' },
  { id: 'headphones', name: 'the headphones' },
  { id: 'scarf', name: 'the scarf' },
  { id: 'neckerchief', name: 'the neckerchief' },
  { id: 'bow', name: 'the bow' },
];

export function WardrobeLayer({ id }: { id: WardrobeId }): ReactElement | null {
  switch (id) {
    case 'beanie':
      // Soft terracotta knit dome over the crest, with a folded brim.
      return (
        <G>
          <Path d="M38 34 Q38 14.5 60 13 Q82 14.5 82 34 Q60 28.5 38 34 Z" fill={TERRACOTTA} />
          <Path
            d="M52 17 Q56 15 60 14.8 M60 14.8 Q66 15.2 70 17.6"
            stroke={TERRACOTTA_DEEP}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
            opacity={0.5}
          />
          <Path
            d="M37.5 30.5 Q60 25 82.5 30.5 L82.5 36.5 Q60 31 37.5 36.5 Z"
            fill={TERRACOTTA_DEEP}
          />
        </G>
      );
    case 'round-glasses':
      // Thin ink circles on the eye line, temples reaching the body edge.
      return (
        <G>
          <Circle cx={46} cy={56} r={7.6} stroke={INK} strokeWidth={2} fill="none" />
          <Circle cx={74} cy={56} r={7.6} stroke={INK} strokeWidth={2} fill="none" />
          <Path
            d="M53.6 55 Q60 51.8 66.4 55"
            stroke={INK}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M38.4 54.5 L30.5 52" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <Path d="M81.6 54.5 L89.5 52" stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </G>
      );
    case 'scarf':
      // Moss wrap under the mouth with one hanging tail and a short fringe.
      return (
        <G>
          <Path d="M31 75 Q60 81 89 75 L89 83 Q60 89 31 83 Z" fill={MOSS} />
          <Path d="M50.5 82.5 L49 96.5 Q53.5 98.5 58.5 96.5 L58 83.5 Z" fill={MOSS_DEEP} />
          <Path
            d="M50.5 96.8 L50 100 M54 97.6 L54 101 M57.5 96.8 L58 100"
            stroke={MOSS_DEEP}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M34 78.6 Q60 84 86 78.6"
            stroke={MOSS_DEEP}
            strokeWidth={1.4}
            fill="none"
            opacity={0.55}
          />
        </G>
      );
    case 'flat-cap':
      // Low slate cap with a small front brim over the forehead.
      return (
        <G>
          <Path d="M38 31.5 Q39 14.5 60 14 Q81 14.5 82 31.5 Q60 25.5 38 31.5 Z" fill={SLATE} />
          <Path d="M45 30 Q60 26 75 30 L75 33.5 Q60 29.5 45 33.5 Z" fill={SLATE_DEEP} />
          <Circle cx={60} cy={15.5} r={1.4} fill={SLATE_DEEP} />
        </G>
      );
    case 'headphones':
      // Quiet over-ear pair: ink band, cream cushions at the body's edge.
      return (
        <G>
          <Path
            d="M32 52 Q34 18 60 16 Q86 18 88 52"
            stroke={INK}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          <Rect x={26.5} y={45} width={9} height={16} rx={4.5} fill={INK} />
          <Rect x={84.5} y={45} width={9} height={16} rx={4.5} fill={INK} />
          <Rect x={28.5} y={47.5} width={5} height={11} rx={2.5} fill={CREAM} opacity={0.35} />
          <Rect x={86.5} y={47.5} width={5} height={11} rx={2.5} fill={CREAM} opacity={0.35} />
        </G>
      );
    case 'neckerchief':
      // Terracotta kerchief: a slim band and one soft point below the mouth.
      return (
        <G>
          <Path d="M38 75.5 Q60 81 82 75.5 L82 80.5 Q60 86 38 80.5 Z" fill={TERRACOTTA} />
          <Path d="M52.5 80.5 L60 94 L67.5 80.5 Q60 85.5 52.5 80.5 Z" fill={TERRACOTTA_DEEP} />
        </G>
      );
    case 'bobble-hat':
      // Taller slate knit with a cream bobble above the crown.
      return (
        <G>
          <Circle cx={60} cy={10.5} r={4.5} fill={CREAM} />
          <Path d="M39 34 Q40 13 60 12 Q80 13 81 34 Q60 28 39 34 Z" fill={SLATE_SOFT} />
          <Path
            d="M50 16.5 Q55 13.5 60 13.2 M60 13.2 Q66 13.8 70 16.9"
            stroke={SLATE_DEEP}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
            opacity={0.5}
          />
          <Path d="M38.5 30.5 Q60 25 81.5 30.5 L81.5 36 Q60 30.5 38.5 36 Z" fill={SLATE_DEEP} />
        </G>
      );
    case 'reading-glasses':
      // Half-moon frames perched low, the way readers actually sit.
      return (
        <G>
          <Path d="M38.5 59 A7.5 6.2 0 0 0 53.5 59" stroke={BROWN} strokeWidth={2} fill="none" />
          <Path d="M38.5 59 H53.5" stroke={BROWN} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M66.5 59 A7.5 6.2 0 0 0 81.5 59" stroke={BROWN} strokeWidth={2} fill="none" />
          <Path d="M66.5 59 H81.5" stroke={BROWN} strokeWidth={1.6} strokeLinecap="round" />
          <Path
            d="M53.5 59 Q60 61 66.5 59"
            stroke={BROWN}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M38.5 59 L30.8 56.5" stroke={BROWN} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M81.5 59 L89.2 56.5" stroke={BROWN} strokeWidth={1.8} strokeLinecap="round" />
        </G>
      );
    case 'hood':
      // Cream woolly hood framing the head, face left open.
      return (
        <G>
          <Path
            d="M33 62 Q28 19 60 13.5 Q92 19 87 62 Q86 64.5 83.8 63.2 Q88 23.5 60 18.8 Q32 23.5 36.2 63.2 Q34 64.5 33 62 Z"
            fill={CREAM}
          />
          <Path
            d="M36.2 63.2 Q32 23.5 60 18.8 Q88 23.5 83.8 63.2"
            stroke={BROWN}
            strokeWidth={1.2}
            fill="none"
            opacity={0.3}
          />
        </G>
      );
    case 'bow':
      // One small moss bow, worn low and unbothered.
      return (
        <G>
          <Path d="M59 79 L49.5 74.5 Q48 79 49.5 83.5 Z" fill={MOSS} />
          <Path d="M61 79 L70.5 74.5 Q72 79 70.5 83.5 Z" fill={MOSS} />
          <Ellipse cx={60} cy={79} rx={2.8} ry={2.5} fill={MOSS_DEEP} />
        </G>
      );
    default:
      return null;
  }
}
