import Svg, { G, Path, Rect } from 'react-native-svg';

/** Registered attachment layers for the immutable square Fenice master.
 * Coordinates share the body's 100×100 canvas and its animation transform.
 * The chest heart, eyes, beak and ember crest remain uncovered.
 */
export function MeloWardrobe({
  items,
  size,
  layer,
}: {
  items: readonly string[];
  size: number;
  layer: 'back' | 'front';
}) {
  return (
    <Svg
      pointerEvents="none"
      accessible={false}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      {layer === 'back' && items.includes('headphones') ? (
        <G fill="none" stroke="#713D32" strokeWidth={2.5}>
          <Path d="M57 29 C53 21 57 16 64 16 C72 16 78 21 77 30" />
          <Path d="M77 28 L77 33" strokeWidth={4} strokeLinecap="round" />
        </G>
      ) : null}
      {layer === 'front' && items.includes('scarf') ? (
        <G stroke="#8B4434" strokeWidth={0.65} strokeLinejoin="round">
          <Path d="M58 41 L63 44 L60 58 L55 56 Z" fill="#D9A441" />
          <Path d="M57 43 L60 46 L54 53 L51 50 Z" fill="#F1CB80" />
          <Path d="M58 39 C62 43 68 45 73 43 L74 47 C68 49 60 45 57 43 Z" fill="#EDBF65" />
          <Path d="M57 40 Q61 39 62 43 Q61 47 58 45 Q56 43 57 40 Z" fill="#D9A441" />
          <Path d="M55.5 54 L60 56 M54 50 L56 52" stroke="#FFF1CE" />
        </G>
      ) : null}
      {layer === 'front' && items.includes('crown') ? (
        <G stroke="#AA703A" strokeWidth={0.6} strokeLinejoin="round">
          <Path d="M55 6 L54 1 L58 3 L61 0.6 L64 3 L68 1 L67 6 Z" fill="#F6D891" />
          <Path d="M55 5 L67 5 L67 7 L55 7 Z" fill="#D9A441" />
        </G>
      ) : null}
      {layer === 'front' && items.includes('headphones') ? (
        <G stroke="#713D32" strokeWidth={0.6}>
          <Rect x={55.5} y={26.5} width={4} height={7} rx={1.7} fill="#F1CB80" />
          <Path d="M57.5 28 L57.5 32" stroke="#D9A441" strokeWidth={1.4} />
        </G>
      ) : null}
    </Svg>
  );
}
