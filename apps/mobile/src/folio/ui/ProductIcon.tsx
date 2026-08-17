import {
  ArrowLeft,
  ArrowRight,
  CircleGauge,
  Ellipsis,
  ListChecks,
  Route,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react-native';

export type ProductIconName =
  | 'back'
  | 'forward'
  | 'today'
  | 'plan'
  | 'money'
  | 'review'
  | 'more'
  | 'close';

const ICONS: Readonly<Record<ProductIconName, LucideIcon>> = {
  back: ArrowLeft,
  forward: ArrowRight,
  today: CircleGauge,
  plan: Route,
  money: WalletCards,
  review: ListChecks,
  more: Ellipsis,
  close: X,
};

/**
 * The one icon boundary for product chrome. It keeps navigation and actions on the approved
 * Lucide language, one optical stroke and the 16/20px size contract instead of platform-dependent
 * text glyphs. Accessible names belong to the enclosing control, so the SVG stays decorative.
 */
export function ProductIcon({
  name,
  color,
  size = 20,
}: Readonly<{
  name: ProductIconName;
  color: string;
  size?: 16 | 20;
}>) {
  const Icon = ICONS[name];
  return (
    <Icon
      accessibilityElementsHidden
      accessible={false}
      absoluteStrokeWidth
      color={color}
      size={size}
      strokeWidth={1.8}
    />
  );
}
