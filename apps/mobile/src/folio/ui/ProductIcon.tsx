import {
  ArrowLeft,
  ArrowRight,
  ArchiveRestore,
  CircleCheckBig,
  CircleGauge,
  CircleHelp,
  Clock3,
  Ellipsis,
  ListChecks,
  Route,
  TriangleAlert,
  WalletCards,
  WifiOff,
  LockKeyhole,
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
  | 'close'
  | 'info'
  | 'warning'
  | 'offline'
  | 'locked'
  | 'queued'
  | 'success'
  | 'restore';

const ICONS: Readonly<Record<ProductIconName, LucideIcon>> = {
  back: ArrowLeft,
  forward: ArrowRight,
  today: CircleGauge,
  plan: Route,
  money: WalletCards,
  review: ListChecks,
  more: Ellipsis,
  close: X,
  info: CircleHelp,
  warning: TriangleAlert,
  offline: WifiOff,
  locked: LockKeyhole,
  queued: Clock3,
  success: CircleCheckBig,
  restore: ArchiveRestore,
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
