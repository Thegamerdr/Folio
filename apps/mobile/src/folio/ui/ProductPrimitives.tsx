import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import {
  elevation,
  gap,
  pressed,
  radius,
  serif,
  typeScale,
  useTheme,
} from '@/surfaces/pressureMap/kit';
import { Sheet } from '@/surfaces/pressureMap/Sheet';
import { ProductIcon, type ProductIconName } from './ProductIcon';

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.screen, { backgroundColor: t.canvas }, style]}>{children}</View>;
}

export function Section({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  title?: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: t.calmStrong }]}>{eyebrow}</Text> : null}
      {title ? <Text style={[styles.sectionTitle, { color: t.ink }]}>{title}</Text> : null}
      {description ? (
        <Text style={[styles.description, { color: t.muted }]}>{description}</Text>
      ) : null}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export function Card({
  children,
  inset = false,
  style,
}: {
  children: ReactNode;
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: inset ? t.inset : t.surface },
        inset ? undefined : elevation.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({
  description,
  icon,
  onPress,
  title,
  value,
}: {
  description?: string;
  icon?: ProductIconName;
  onPress?: () => void;
  title: string;
  value?: string;
}) {
  const t = useTheme();
  const content = (
    <>
      {icon ? <ProductIcon color={t.calmStrong} name={icon} size={20} /> : null}
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: t.ink }]}>{title}</Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: t.muted }]}>{description}</Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.rowValue, { color: t.secondary }]}>{value}</Text> : null}
      {onPress ? <ProductIcon color={t.muted} name="forward" size={16} /> : null}
    </>
  );

  if (!onPress) return <View style={[styles.row, { borderColor: t.hairline }]}>{content}</View>;
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.row,
        { borderColor: t.hairline },
        isPressed ? pressed : undefined,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Figure({
  label,
  supporting,
  value,
}: {
  label: string;
  supporting?: string;
  value: string;
}) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${supporting ? `. ${supporting}` : ''}`}
    >
      <Text style={[styles.figureLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.figureValue, { color: t.ink }]}>{value}</Text>
      {supporting ? (
        <Text style={[styles.supporting, { color: t.muted }]}>{supporting}</Text>
      ) : null}
    </View>
  );
}

export function Field({
  error,
  label,
  required = false,
  ...inputProps
}: TextInputProps & { error?: string; label: string; required?: boolean }) {
  const t = useTheme();
  const errorId = error ? `${label.replaceAll(' ', '-').toLowerCase()}-error` : undefined;
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: t.ink }]}>
        {label}
        {required ? ' · required' : ''}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled: inputProps.editable === false }}
        aria-describedby={errorId}
        placeholderTextColor={t.muted}
        {...inputProps}
        style={[
          styles.field,
          {
            backgroundColor: t.surface,
            borderColor: error ? t.repairInk : t.hairline,
            color: t.ink,
          },
          inputProps.style,
        ]}
      />
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          id={errorId}
          style={[styles.error, { color: t.repairInk }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Button({
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'destructive';
}) {
  const t = useTheme();
  const backgroundColor =
    variant === 'primary'
      ? t.ink
      : variant === 'destructive'
        ? t.repairInk
        : variant === 'secondary'
          ? t.surface
          : 'transparent';
  const color = variant === 'primary' || variant === 'destructive' ? t.canvas : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'secondary' ? t.hairlineStrong : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        isPressed ? pressed : undefined,
      ]}
    >
      <Text style={[styles.buttonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.calmSoft : t.surface,
          borderColor: selected ? t.calm : t.hairline,
        },
        isPressed ? pressed : undefined,
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? t.calmStrong : t.secondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: t.inset }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed: isPressed }) => [
              styles.segment,
              selected ? { backgroundColor: t.surface } : undefined,
              isPressed ? pressed : undefined,
            ]}
          >
            <Text style={[styles.segmentLabel, { color: selected ? t.ink : t.muted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChartFrame({
  children,
  description,
  summary,
  title,
}: {
  children: ReactNode;
  description?: string;
  summary: string;
  title: string;
}) {
  const t = useTheme();
  return (
    <Card>
      <Text style={[styles.chartTitle, { color: t.ink }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: t.muted }]}>{description}</Text>
      ) : null}
      <View
        accessibilityLabel={`${title}. ${summary}`}
        accessibilityRole="image"
        style={styles.chart}
      >
        {children}
      </View>
      <Text style={[styles.chartSummary, { color: t.muted }]}>{summary}</Text>
    </Card>
  );
}

export function CalendarCell({
  day,
  label,
  marked = false,
  onPress,
  selected = false,
  today = false,
}: {
  day: string;
  label: string;
  marked?: boolean;
  onPress: () => void;
  selected?: boolean;
  today?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel={`${label}${today ? ', today' : ''}${marked ? ', has activity' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.calendarCell,
        {
          backgroundColor: selected ? t.calmStrong : 'transparent',
          borderColor: today ? t.calmStrong : 'transparent',
        },
        isPressed ? pressed : undefined,
      ]}
    >
      <Text style={[styles.calendarDay, { color: selected ? t.canvas : t.ink }]}>{day}</Text>
      {marked ? (
        <View
          style={[styles.calendarMark, { backgroundColor: selected ? t.canvas : t.calmStrong }]}
        />
      ) : null}
    </Pressable>
  );
}

export function ListGroup({ children, label }: { children: ReactNode; label?: string }) {
  const t = useTheme();
  return (
    <View accessibilityLabel={label} style={[styles.listGroup, { backgroundColor: t.surface }]}>
      {children}
    </View>
  );
}

export function MeloPerch({
  children,
  label = 'Melo companion position',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <View accessibilityLabel={label} pointerEvents="box-none" style={styles.meloPerch}>
      {children}
    </View>
  );
}

export function ExplainSheet({
  children,
  onClose,
  title,
  visible,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  const t = useTheme();
  return (
    <Sheet onClose={onClose} visible={visible}>
      <View style={styles.explainSheet}>
        <View style={styles.explainHeader}>
          <Text accessibilityRole="header" style={[styles.explainTitle, { color: t.ink }]}>
            {title}
          </Text>
          <Pressable
            accessibilityLabel="Close explanation"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed: isPressed }) => (isPressed ? pressed : undefined)}
          >
            <ProductIcon color={t.muted} name="close" size={20} />
          </Pressable>
        </View>
        {children}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: gap.xl },
  section: { marginTop: gap.xxl },
  sectionContent: { gap: gap.md, marginTop: gap.md },
  eyebrow: {
    fontSize: typeScale.micro,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: { fontFamily: serif.display, fontSize: typeScale.title, lineHeight: 26 },
  description: { fontSize: typeScale.bodySmall, lineHeight: 20, marginTop: gap.xs },
  card: { borderRadius: radius.card, padding: gap.lg },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: gap.md,
    minHeight: 52,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: typeScale.body, fontWeight: '600' },
  rowDescription: { fontSize: typeScale.caption, lineHeight: 17, marginTop: gap.xs },
  rowValue: { fontSize: typeScale.bodySmall, fontVariant: ['tabular-nums'] },
  figureLabel: { fontSize: typeScale.caption, fontWeight: '600' },
  figureValue: {
    fontFamily: serif.display,
    fontSize: typeScale.figure,
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
  },
  supporting: { fontSize: typeScale.caption, lineHeight: 17, marginTop: gap.xs },
  fieldGroup: { gap: gap.xs },
  fieldLabel: { fontSize: typeScale.bodySmall, fontWeight: '600' },
  field: {
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: typeScale.body,
    minHeight: 48,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  error: { fontSize: typeScale.caption, lineHeight: 17 },
  button: {
    alignItems: 'center',
    borderRadius: radius.row,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: gap.xl,
    paddingVertical: gap.md,
  },
  buttonLabel: { fontSize: typeScale.body, fontWeight: '700' },
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.lg,
  },
  chipLabel: { fontSize: typeScale.bodySmall, fontWeight: '600' },
  segmented: { borderRadius: radius.row, flexDirection: 'row', padding: gap.xs },
  segment: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: gap.sm,
  },
  segmentLabel: { fontSize: typeScale.caption, fontWeight: '700' },
  chartTitle: { fontFamily: serif.display, fontSize: typeScale.title },
  chart: { marginTop: gap.lg, minHeight: 120 },
  chartSummary: { fontSize: typeScale.caption, lineHeight: 17, marginTop: gap.md },
  calendarCell: {
    alignItems: 'center',
    borderRadius: radius.row,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  calendarDay: { fontSize: typeScale.bodySmall, fontWeight: '600' },
  calendarMark: { borderRadius: radius.pill, height: 4, marginTop: 2, width: 4 },
  listGroup: { borderRadius: radius.card, overflow: 'hidden' },
  meloPerch: { alignItems: 'center', justifyContent: 'flex-end', minHeight: 72 },
  explainSheet: { gap: gap.lg, paddingBottom: gap.xl },
  explainHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  explainTitle: { flex: 1, fontFamily: serif.display, fontSize: typeScale.title, lineHeight: 26 },
});
