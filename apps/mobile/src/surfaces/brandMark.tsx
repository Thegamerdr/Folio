import { View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { folioTokens } from '@folio/ui';

export const FOLIO_BRAND_MARK_ACCESSIBILITY_LABEL =
  'Folio temporary brand mark: folded local record with a money line';

type FolioBrandMarkProps = Readonly<{
  accessibilityLabel?: string;
  backgroundColor?: string;
  color?: string;
  routeColor?: string;
  size?: number;
  style?: ViewStyle;
}>;

export function FolioBrandMark({
  accessibilityLabel = FOLIO_BRAND_MARK_ACCESSIBILITY_LABEL,
  backgroundColor = folioTokens.color.role.surface.base,
  color = folioTokens.color.role.surface.inverse,
  routeColor = folioTokens.color.role.accent.primary,
  size = 36,
  style,
}: FolioBrandMarkProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={[
        {
          alignItems: 'center',
          backgroundColor,
          borderColor: color,
          borderRadius: Math.max(8, Math.round(size * 0.22)),
          borderWidth: Math.max(1, Math.round(size * 0.035)),
          height: size,
          justifyContent: 'center',
          width: size,
        },
        style,
      ]}
    >
      <Svg
        accessibilityElementsHidden
        height={Math.round(size * 0.68)}
        importantForAccessibility="no-hide-descendants"
        viewBox="0 0 48 48"
        width={Math.round(size * 0.68)}
      >
        <Path
          d="M14 6h18l8 8v28H14z"
          fill="none"
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={3.4}
        />
        <Path
          d="M32 6v10h8"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3.4}
        />
        <Path
          d="M19 29c3.8-3.6 7.6-3.6 11.4 0 2 1.8 4.3 2.8 6.6 2.9"
          fill="none"
          stroke={routeColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3.8}
        />
        <Path
          d="M19 36h18"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeOpacity={0.38}
          strokeWidth={3.4}
        />
      </Svg>
    </View>
  );
}
