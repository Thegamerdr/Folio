// Manual-from-file workbench + paste sheet.
//
// Any saved file that Folio could not read automatically still becomes a working surface here:
// the user types the important numbers from it, and each added item is linked back to the file.
// Nothing changes the money picture until the user adds it.

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { DocumentItemInput, LocalDocumentStage } from '../../local/localLedger';
import {
  Body,
  ChipToggle,
  Eyebrow,
  GhostButton,
  Hairline,
  MoneyPad,
  Muted,
  PrimaryAction,
  gap,
  paper,
  poundsLabel,
} from './kit';
import { MeloPresence } from './melo';

type Kind = DocumentItemInput['kind'];

const KINDS: readonly { key: Kind; label: string }[] = [
  { key: 'money', label: 'Money in' },
  { key: 'income', label: 'Income' },
  { key: 'bill', label: 'Bill' },
  { key: 'debt', label: 'Debt payment' },
];

function sourceTypeLabel(file: LocalDocumentStage): string {
  switch (file.sourceType) {
    case 'pdf':
      return 'PDF statement';
    case 'camera':
      return 'Photo';
    case 'image':
      return 'Image';
    case 'csv':
      return 'CSV file';
    case 'txt':
      return 'Text file';
    case 'paste':
      return 'Pasted text';
    default:
      return 'File';
  }
}

function unreadable(file: LocalDocumentStage): boolean {
  return file.extractionStatus !== 'text-extracted' && file.extractionStatus !== 'ocr-extracted';
}

export function FileWorkbench({
  files,
  onAddFromDocument,
  onRemoveDocument,
  showMelo = true,
}: {
  files: readonly LocalDocumentStage[];
  onAddFromDocument: (input: DocumentItemInput) => void;
  onRemoveDocument: (documentId: string) => void;
  // One Melo per moment: a caller already showing its own Melo (e.g. the empty
  // review state) passes false so two Melos never share the screen.
  showMelo?: boolean | undefined;
}) {
  const [adding, setAdding] = useState<LocalDocumentStage | null>(null);
  const saved = files.filter(unreadable);
  if (saved.length === 0) return null;

  return (
    <View style={styles.section}>
      <Eyebrow>Saved files</Eyebrow>
      <Muted style={styles.sectionNote}>
        These are saved for reference. They haven't changed your money picture — add the important
        numbers from each one.
      </Muted>
      {showMelo ? <MeloPresence state="melo_file_unreadable" style={styles.melo} /> : null}

      {saved.map((file) => (
        <View key={file.id} style={styles.fileCard}>
          <Text style={styles.fileName} numberOfLines={1}>
            {file.filename}
          </Text>
          <Muted style={styles.fileMeta}>{sourceTypeLabel(file)} · saved for reference</Muted>
          {file.linkedTransactionIds && file.linkedTransactionIds.length > 0 ? (
            <Text style={styles.fileAdded}>
              {file.linkedTransactionIds.length} added from this file
            </Text>
          ) : null}
          <View style={styles.fileActions}>
            <PrimaryAction
              accessibilityHint="Type an amount from this file to add it."
              label="Add from this file"
              onPress={() => setAdding(file)}
              tone="ink"
            />
            <GhostButton
              accessibilityHint="Remove this saved file. Anything you added stays."
              label="Remove file"
              onPress={() => onRemoveDocument(file.id)}
              tone="repair"
            />
          </View>
        </View>
      ))}

      <AddFromFileSheet
        file={adding}
        onCancel={() => setAdding(null)}
        onSave={(input) => {
          onAddFromDocument(input);
          setAdding(null);
        }}
      />
    </View>
  );
}

function AddFromFileSheet({
  file,
  onCancel,
  onSave,
}: {
  file: LocalDocumentStage | null;
  onCancel: () => void;
  onSave: (input: DocumentItemInput) => void;
}) {
  const [kind, setKind] = useState<Kind>('money');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');

  return (
    <Modal animationType="slide" transparent visible={file !== null} onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Cancel" style={styles.scrim} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            Add a number from this file
          </Text>
          {file ? <Muted style={styles.sheetFrom}>From: {file.filename}</Muted> : null}

          <View style={styles.kinds}>
            {KINDS.map((option) => (
              <ChipToggle
                key={option.key}
                label={option.label}
                onPress={() => setKind(option.key)}
                selected={kind === option.key}
              />
            ))}
          </View>

          <Text style={styles.label}>What is it? (optional)</Text>
          <TextInput
            accessibilityLabel="What this is"
            onChangeText={setTitle}
            placeholder={kind === 'bill' ? 'e.g. Rent' : 'e.g. Salary'}
            placeholderTextColor={paper.muted}
            style={styles.input}
            value={title}
          />

          <Text style={styles.amount}>{poundsLabel(amount)}</Text>
          <MoneyPad onChange={setAmount} value={amount} />

          <View style={styles.footer}>
            <GhostButton flex label="Cancel" onPress={onCancel} />
            <View style={styles.flex}>
              <PrimaryAction
                label="Add it"
                onPress={() => {
                  if (!file) return;
                  const pounds = amount.replace(/[^0-9]/g, '');
                  if (pounds.length === 0) return;
                  onSave({ documentId: file.id, kind, amountText: pounds, title: title.trim() });
                }}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function PasteSheet({
  visible,
  onClose,
  onStage,
}: {
  visible: boolean;
  onClose: () => void;
  onStage: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Cancel" style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          Paste from your bank
        </Text>
        <Body style={styles.pasteHint}>
          Copy the lines from your banking app and paste them here — date, what it was, and the
          amount. Rough is fine; you'll check each row next.
        </Body>
        <TextInput
          accessibilityLabel="Pasted bank text"
          multiline
          onChangeText={setText}
          placeholder={'25 Jun Tesco -42.00\n26 Jun Salary 1200.00\n27 Jun Rent -750.00'}
          placeholderTextColor={paper.muted}
          style={styles.pasteInput}
          textAlignVertical="top"
          value={text}
        />
        <View style={styles.footer}>
          <GhostButton flex label="Cancel" onPress={onClose} />
          <View style={styles.flex}>
            <PrimaryAction
              label="Find rows"
              onPress={() => {
                if (text.trim().length === 0) return;
                onStage(text);
                setText('');
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: gap.sm, marginTop: gap.lg },
  melo: { marginVertical: gap.xs },
  sectionNote: { marginBottom: gap.xs },
  fileCard: {
    backgroundColor: paper.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
    padding: gap.lg,
    gap: gap.xs,
  },
  fileName: { color: paper.ink, fontSize: 17, fontWeight: '700' },
  fileMeta: { marginTop: -2 },
  fileAdded: { color: paper.calmStrong, fontSize: 13, fontWeight: '600' },
  fileActions: { gap: gap.sm, marginTop: gap.sm },

  scrim: { flex: 1, backgroundColor: 'rgba(24, 35, 29, 0.42)' },
  sheet: {
    backgroundColor: paper.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: gap.xl,
    paddingTop: gap.md,
    paddingBottom: gap.xxxl,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: paper.hairline,
    marginBottom: gap.lg,
  },
  sheetTitle: { color: paper.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  sheetFrom: { marginTop: 2 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.lg },
  label: { color: paper.muted, fontSize: 13, fontWeight: '700', marginTop: gap.lg },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: paper.hairlineStrong,
    paddingVertical: 8,
    fontSize: 18,
    color: paper.ink,
  },
  amount: {
    color: paper.ink,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: gap.sm,
  },
  footer: { flexDirection: 'row', gap: gap.sm, marginTop: gap.md },

  pasteHint: { color: paper.secondary, marginTop: gap.xs },
  pasteInput: {
    marginTop: gap.md,
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: paper.hairline,
    backgroundColor: paper.canvas,
    padding: gap.md,
    fontSize: 16,
    color: paper.ink,
    fontVariant: ['tabular-nums'],
  },
});
