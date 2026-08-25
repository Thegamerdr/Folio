import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';

export function BusinessScreenFrame({
  onBack,
  title,
  eyebrow,
  headline,
  heroAdornment,
  heroTopInset = gap.sm,
  intro,
  sourceEditorial = false,
  children,
}: {
  onBack: () => void;
  title?: string;
  eyebrow: string;
  headline: ReactNode;
  heroAdornment?: ReactNode;
  heroTopInset?: number;
  intro?: string;
  sourceEditorial?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[ui.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          ui.content,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={ui.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [ui.back, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[ui.backLabel, { color: t.muted }]}>←</Text>
          </Pressable>
          {title ? <Text style={[ui.headerTitle, { color: t.ink }]}>{title}</Text> : null}
        </View>
        <View style={[ui.hero, { marginTop: heroTopInset }]}>
          {heroAdornment ? <View style={ui.heroAdornment}>{heroAdornment}</View> : null}
          <Text style={[sourceEditorial ? ui.sourceEyebrow : ui.eyebrow, { color: t.muted }]}>
            {eyebrow}
          </Text>
          <Text
            accessibilityRole="header"
            style={[sourceEditorial ? ui.sourceHeadline : ui.headline, { color: t.ink }]}
          >
            {headline}
          </Text>
          {intro ? (
            <Text style={[sourceEditorial ? ui.sourceIntro : ui.intro, { color: t.muted }]}>
              {intro}
            </Text>
          ) : null}
        </View>
        <View style={sourceEditorial ? ui.sourceBody : ui.body}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function BusinessCard({
  children,
  tone = 'surface',
}: {
  children: ReactNode;
  tone?: 'surface' | 'inset';
}) {
  const t = useTheme();
  return (
    <View
      style={[
        ui.card,
        {
          backgroundColor: tone === 'surface' ? t.surface : t.inset,
          borderColor: tone === 'surface' ? t.hairline : 'transparent',
        },
      ]}
    >
      {children}
    </View>
  );
}

export function BusinessSectionTitle({ title, value }: { title: string; value?: string }) {
  const t = useTheme();
  return (
    <View style={ui.sectionHeader}>
      <Text style={[ui.sectionTitle, { color: t.muted }]}>{title}</Text>
      {value ? <Text style={[ui.sectionValue, { color: t.muted }]}>{value}</Text> : null}
    </View>
  );
}

export function BusinessPrimaryAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.primary,
        {
          backgroundColor: t.calmStrong,
          opacity: disabled ? 0.38 : pressed ? 0.68 : 1,
        },
      ]}
    >
      <Text style={[ui.primaryLabel, { color: t.inverse }]}>{label}</Text>
    </Pressable>
  );
}

export function BusinessSecondaryAction({
  label,
  onPress,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        ui.secondary,
        { backgroundColor: t.inset, opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <Text style={[ui.secondaryLabel, { color: destructive ? t.repair : t.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function BusinessRouteRow({
  label,
  hint,
  value,
  onPress,
}: {
  label: string;
  hint?: string;
  value?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        ui.routeRow,
        { borderBottomColor: t.hairline, opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <View style={ui.routeCopy}>
        <Text style={[ui.routeLabel, { color: t.ink }]}>{label}</Text>
        {hint ? <Text style={[ui.routeHint, { color: t.muted }]}>{hint}</Text> : null}
      </View>
      {value ? (
        <Text style={[ui.routeValue, { color: t.muted }]}>{value}</Text>
      ) : (
        <Text accessibilityElementsHidden style={[ui.routeArrow, { color: t.calmStrong }]}>
          →
        </Text>
      )}
    </Pressable>
  );
}

export function BusinessMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={ui.metric}>
      <Text style={[ui.metricValue, { color: accent ? t.calmStrong : t.ink }]}>{value}</Text>
      <Text style={[ui.metricLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

export function BusinessField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'email-address' | 'phone-pad';
  multiline?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={ui.field}>
      <Text style={[ui.fieldLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        selectionColor={t.calmStrong}
        style={[
          ui.input,
          multiline ? ui.inputMultiline : undefined,
          { backgroundColor: t.inset, color: t.ink },
        ]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

export function BusinessChoicePills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly Readonly<{ id: T; label: string }>[];
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={ui.choice}>
      <Text style={[ui.fieldLabel, { color: t.muted }]}>{label}</Text>
      <View style={ui.pills}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={({ pressed }) => [
                ui.pill,
                {
                  backgroundColor: selected ? t.calmStrong : t.inset,
                  opacity: pressed ? 0.64 : 1,
                },
              ]}
            >
              <Text style={[ui.pillLabel, { color: selected ? t.inverse : t.ink }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function BusinessFormSheet({
  visible,
  title,
  children,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        accessibilityLabel="Close form"
        accessibilityRole="button"
        onPress={onClose}
        style={ui.scrim}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={[ui.sheet, { backgroundColor: t.canvas, paddingBottom: insets.bottom + gap.lg }]}
        >
          <View style={[ui.handle, { backgroundColor: t.hairline }]} />
          <View style={ui.sheetHeader}>
            <Text accessibilityRole="header" style={[ui.sheetTitle, { color: t.ink }]}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [ui.close, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[ui.closeLabel, { color: t.muted }]}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={ui.sheetScroll}
          >
            {children}
          </ScrollView>
          <BusinessPrimaryAction
            disabled={primaryDisabled}
            label={primaryLabel}
            onPress={onPrimary}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function formatMinor(valueMinor: number, options?: { signed?: boolean; pence?: boolean }) {
  const absolute = Math.abs(valueMinor) / 100;
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: options?.pence ? 2 : Number.isInteger(absolute) ? 0 : 2,
    maximumFractionDigits: options?.pence ? 2 : 2,
  }).format(absolute);
  if (!options?.signed) return valueMinor < 0 ? `−${formatted}` : formatted;
  return `${valueMinor >= 0 ? '+' : '−'}${formatted}`;
}

export function parseMinor(value: string): number | null {
  const parsed = Number(value.replace(/[£,\s]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function formatBusinessDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : iso;
}

const ui = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  header: { height: 44, justifyContent: 'center', position: 'relative' },
  headerTitle: {
    alignSelf: 'center',
    fontSize: 17,
    fontWeight: '600',
    position: 'absolute',
  },
  back: {
    alignItems: 'flex-start',
    height: 44,
    justifyContent: 'center',
    marginLeft: -8,
    width: 44,
  },
  backLabel: { fontSize: 22 },
  hero: { position: 'relative' },
  heroAdornment: { position: 'absolute', right: 0, top: gap.sm, zIndex: 1 },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13 },
  sourceEyebrow: {
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    letterSpacing: -0.35,
    lineHeight: 36,
    marginTop: gap.xs,
  },
  sourceHeadline: {
    fontFamily: serif.display,
    fontSize: 28,
    letterSpacing: -0.56,
    lineHeight: 33,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 20, marginTop: gap.md, maxWidth: 520 },
  sourceIntro: { fontSize: 14, lineHeight: 20, marginTop: gap.md, maxWidth: 520 },
  body: { marginTop: gap.xl },
  sourceBody: { marginTop: gap.lg + gap.xs },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: gap.lg,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.05,
    textTransform: 'uppercase',
  },
  sectionValue: { fontSize: 11, fontVariant: ['tabular-nums'] },
  primary: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.lg,
    minHeight: 52,
    paddingHorizontal: gap.lg,
  },
  primaryLabel: { fontSize: 14.5, fontWeight: '700' },
  secondary: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.sm,
    minHeight: 48,
    paddingHorizontal: gap.lg,
  },
  secondaryLabel: { fontSize: 13.5, fontWeight: '600' },
  routeRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 62,
    paddingVertical: gap.md,
  },
  routeCopy: { flex: 1, paddingRight: gap.md },
  routeLabel: { fontSize: 14, fontWeight: '600' },
  routeHint: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  routeValue: { fontSize: 12, fontVariant: ['tabular-nums'] },
  routeArrow: { fontSize: 18 },
  metric: { flex: 1 },
  metricValue: {
    fontFamily: serif.medium,
    fontSize: 21,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  field: { marginBottom: gap.md },
  fieldLabel: { fontSize: 11.5, fontWeight: '600', marginBottom: gap.xs },
  input: {
    borderRadius: radius.md,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  inputMultiline: { minHeight: 88, paddingTop: gap.md },
  choice: { marginBottom: gap.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm },
  pill: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: gap.md,
  },
  pillLabel: { fontSize: 12, fontWeight: '600' },
  scrim: {
    backgroundColor: 'rgba(21, 19, 17, 0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    paddingHorizontal: gap.xl,
    paddingTop: gap.sm,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginBottom: gap.md,
    width: 38,
  },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: gap.sm },
  sheetTitle: { flex: 1, fontFamily: serif.medium, fontSize: 21 },
  close: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginRight: -10,
    width: 44,
  },
  closeLabel: { fontSize: 24 },
  sheetScroll: { flexGrow: 0, maxHeight: 500 },
});

export const businessUiStyles = ui;
