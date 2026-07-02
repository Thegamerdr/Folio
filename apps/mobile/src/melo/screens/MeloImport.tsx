// Statement import v1 (MELO_BLUEPRINT.md §14 item 15) — the accuracy path without open banking.
// Paste the CSV your bank app exports; the engine reads it locally (nothing leaves the device),
// finds the closing balance, spots recurring bills, and seeds the last week of spending. Every
// found thing is a suggestion the user can untick — the import proposes, the person decides.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import {
  formatPounds,
  parseStatementCSV,
  type DetectedBill,
  type StatementParse,
} from '@folio/melo-engine';
import {
  Body,
  Display,
  GhostButton,
  Muted,
  PrimaryAction,
  Surface,
  useTheme,
} from '@/surfaces/pressureMap/kit';

import type { StatementApply } from '../state/meloStore';
import { billId } from '../state/presets';

type Props = {
  existingBillNames: readonly string[];
  onApply: (apply: StatementApply) => void;
  onClose: () => void;
};

// Files bigger than this are almost never a plain-text statement export.
const MAX_STATEMENT_BYTES = 1_000_000;

const WRONG_TYPE_MESSAGE = 'That file type can’t be read here — CSV or TXT works.';
const TOO_BIG_MESSAGE =
  'That file is bigger than this reader can take — a one or two month export is plenty.';
const READ_FAILED_MESSAGE =
  'The file couldn’t be opened. Pasting the statement works just as well.';

// A statement export is plain text — CSV, TSV, or TXT. Anything else (PDF, image, spreadsheet
// binary) can't be read by the paste-path parser, so it's turned away calmly instead of read.
function looksLikeTextStatement(name: string | undefined, mimeType: string | undefined): boolean {
  const n = (name ?? '').toLowerCase();
  const m = (mimeType ?? '').toLowerCase();
  return (
    n.endsWith('.csv') ||
    n.endsWith('.tsv') ||
    n.endsWith('.txt') ||
    m.includes('csv') ||
    m.includes('tab-separated') ||
    m.startsWith('text/')
  );
}

export function MeloImport({ existingBillNames, onApply, onClose }: Props) {
  const t = useTheme();
  const [pasted, setPasted] = useState('');
  const [parsed, setParsed] = useState<StatementParse | null>(null);
  const [useBalance, setUseBalance] = useState(true);
  const [pickedBills, setPickedBills] = useState<ReadonlySet<string>>(new Set());
  const [useSpend, setUseSpend] = useState(true);
  const [pickMessage, setPickMessage] = useState<string | null>(null);

  const known = new Set(existingBillNames.map((n) => n.toLowerCase()));

  // One reading path for both doors: pasted text and a picked file land here identically.
  const readText = (text: string) => {
    setPickMessage(null);
    const result = parseStatementCSV(text);
    setParsed(result);
    // Pre-tick only genuinely new bills — known ones stay off so re-imports feel like no-ops.
    setPickedBills(
      new Set(
        result.detectedBills.filter((b) => !known.has(b.name.toLowerCase())).map((b) => b.name),
      ),
    );
  };

  const readIt = () => readText(pasted);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset === undefined) return;
      if (!looksLikeTextStatement(asset.name, asset.mimeType)) {
        setPickMessage(WRONG_TYPE_MESSAGE);
        return;
      }
      if (typeof asset.size === 'number' && asset.size > MAX_STATEMENT_BYTES) {
        setPickMessage(TOO_BIG_MESSAGE);
        return;
      }
      const text = await FileSystem.readAsStringAsync(asset.uri);
      setPasted(text);
      readText(text);
    } catch {
      setPickMessage(READ_FAILED_MESSAGE);
    }
  };

  const toggleBill = (name: string) => {
    setPickedBills((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const apply = () => {
    if (!parsed) return;
    onApply({
      balancePence: useBalance ? parsed.closingBalancePence : null,
      newBills: parsed.detectedBills
        .filter((b) => pickedBills.has(b.name))
        .map((b) => ({
          id: billId(b.name),
          name: b.name,
          amountPence: b.amountPence,
          dueDay: b.dueDay,
          kind: 'bill' as const,
        })),
      spendEntries: useSpend
        ? parsed.recentSpend.map((e) => ({ amountPence: e.amountPence, atISO: e.atISO }))
        : [],
    });
    onClose();
  };

  const foundNothing = parsed !== null && parsed.rows.length === 0;

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Display>Read my statement.</Display>
        <Muted style={s.sub}>
          Paste the CSV from your bank app’s export. It’s read here on the phone — nothing is
          uploaded, anywhere.
        </Muted>

        {parsed === null || foundNothing ? (
          <>
            <TextInput
              value={pasted}
              onChangeText={setPasted}
              placeholder="Paste the statement here…"
              placeholderTextColor={t.muted}
              multiline
              style={[
                s.pasteBox,
                { color: t.ink, backgroundColor: t.inset, borderColor: t.hairline },
              ]}
            />
            {foundNothing
              ? parsed.warnings.map((w) => (
                  <Muted key={w} style={s.warning}>
                    {w}
                  </Muted>
                ))
              : null}
            {pickMessage !== null ? <Muted style={s.warning}>{pickMessage}</Muted> : null}
            <View style={s.cta}>
              <PrimaryAction label="Read it" onPress={readIt} disabled={pasted.trim() === ''} />
              <GhostButton label="pick the CSV file instead" onPress={pickFile} />
              <GhostButton label="back" onPress={onClose} />
            </View>
          </>
        ) : (
          <>
            <Muted style={s.sectionTag}>WHAT IT FOUND</Muted>
            <Surface style={s.list} tone="sunken">
              {parsed.closingBalancePence !== null ? (
                <PickRow
                  picked={useBalance}
                  onToggle={() => setUseBalance((v) => !v)}
                  title={`Balance ${formatPounds(parsed.closingBalancePence)}`}
                  detail="use as today’s balance"
                />
              ) : (
                <Muted style={s.warning}>No balance column — balance stays as it is.</Muted>
              )}
              {parsed.recentSpend.length > 0 ? (
                <PickRow
                  picked={useSpend}
                  onToggle={() => setUseSpend((v) => !v)}
                  title={`${parsed.recentSpend.length} spends from the last 7 days`}
                  detail="feeds the forecast your real pace"
                />
              ) : null}
            </Surface>

            {parsed.detectedBills.length > 0 ? (
              <>
                <Muted style={s.sectionTag}>RECURRING — LOOK LIKE BILLS</Muted>
                <Surface style={s.list} tone="sunken">
                  {parsed.detectedBills.map((b) => (
                    <BillPickRow
                      key={b.name}
                      bill={b}
                      alreadyKnown={known.has(b.name.toLowerCase())}
                      picked={pickedBills.has(b.name)}
                      onToggle={() => toggleBill(b.name)}
                    />
                  ))}
                </Surface>
              </>
            ) : (
              <Muted style={s.warning}>
                No recurring bills spotted — two months of statement finds them best.
              </Muted>
            )}

            {parsed.warnings.map((w) => (
              <Muted key={w} style={s.warning}>
                {w}
              </Muted>
            ))}

            <View style={s.cta}>
              <PrimaryAction label="Apply" onPress={apply} />
              <GhostButton
                label="paste a different one"
                onPress={() => {
                  setParsed(null);
                  setPasted('');
                }}
              />
              <GhostButton label="back" onPress={onClose} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PickRow({
  picked,
  onToggle,
  title,
  detail,
}: {
  picked: boolean;
  onToggle: () => void;
  title: string;
  detail: string;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onToggle} style={s.pickRow} accessibilityRole="checkbox">
      <View
        style={[
          s.tick,
          {
            borderColor: picked ? t.calm : t.hairline,
            backgroundColor: picked ? t.calmSoft : 'transparent',
          },
        ]}
      >
        {picked ? <Text style={[s.tickMark, { color: t.calmStrong }]}>✓</Text> : null}
      </View>
      <View style={s.pickBody}>
        <Text style={[s.pickTitle, { color: t.ink }]}>{title}</Text>
        <Text style={[s.pickDetail, { color: t.muted }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function BillPickRow({
  bill,
  alreadyKnown,
  picked,
  onToggle,
}: {
  bill: DetectedBill;
  alreadyKnown: boolean;
  picked: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onToggle} style={s.pickRow} accessibilityRole="checkbox">
      <View
        style={[
          s.tick,
          {
            borderColor: picked ? t.calm : t.hairline,
            backgroundColor: picked ? t.calmSoft : 'transparent',
          },
        ]}
      >
        {picked ? <Text style={[s.tickMark, { color: t.calmStrong }]}>✓</Text> : null}
      </View>
      <View style={s.pickBody}>
        <Text style={[s.pickTitle, { color: t.ink }]}>
          {bill.name} · {formatPounds(bill.amountPence)}
        </Text>
        <Text style={[s.pickDetail, { color: t.muted }]}>
          {bill.cadence} · day {bill.dueDay}
          {alreadyKnown ? ' · already on the shield' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 40 },
  sub: { marginTop: 6, lineHeight: 20 },
  pasteBox: {
    marginTop: 18,
    minHeight: 160,
    maxHeight: 260,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 12.5,
    textAlignVertical: 'top',
  },
  sectionTag: { marginTop: 22, marginBottom: 10, fontSize: 11.5, letterSpacing: 0.8 },
  list: { gap: 14 },
  pickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tickMark: { fontSize: 13, fontWeight: '700' },
  pickBody: { flex: 1, gap: 2 },
  pickTitle: { fontSize: 14.5, fontWeight: '500' },
  pickDetail: { fontSize: 12 },
  warning: { marginTop: 12, lineHeight: 19 },
  cta: { marginTop: 24, gap: 8 },
});
