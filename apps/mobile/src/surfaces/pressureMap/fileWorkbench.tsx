// Manual-from-file workbench + paste sheet.
//
// Any saved file that Folio could not read automatically still becomes a working surface here: the
// file is kept on the device for reference, the user types the important numbers from it, and each
// added item is linked back to the file ("Added from June statement.pdf"). A file NEVER changes the
// money picture by itself — only the items the user adds do. The user can open the saved file, add a
// note to it, or remove it (anything already added stays).

import { useMemo, useState } from 'react';
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
  poundsLabel,
  useTheme,
  type Palette,
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
  onAddNote,
  onViewFile,
  showMelo = true,
}: {
  files: readonly LocalDocumentStage[];
  onAddFromDocument: (input: DocumentItemInput) => void;
  onRemoveDocument: (documentId: string) => void;
  onAddNote?: ((documentId: string, note: string) => void) | undefined;
  onViewFile?: ((file: LocalDocumentStage) => void) | undefined;
  // One Melo per moment: a caller already showing its own Melo (e.g. the empty review state) passes
  // false so two Melos never share the screen.
  showMelo?: boolean | undefined;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [adding, setAdding] = useState<LocalDocumentStage | null>(null);
  const [noting, setNoting] = useState<LocalDocumentStage | null>(null);
  const saved = files.filter(unreadable);
  if (saved.length === 0) return null;

  return (
    <View style={styles.section}>
      <Eyebrow>Saved files</Eyebrow>
      {showMelo ? <MeloPresence state="melo_file_unreadable" style={styles.melo} /> : null}

      {saved.map((file) => {
        const linkedCount = file.linkedTransactionIds?.length ?? 0;
        const notes = file.notes ?? [];
        return (
          <View key={file.id} style={styles.fileCard}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.filename}
            </Text>
            <Muted style={styles.fileMeta}>{sourceTypeLabel(file)} · saved for reference</Muted>

            {/* The promise, in the accepted words. */}
            <Text style={styles.fileSaved}>File saved. It has not changed your money picture.</Text>

            {linkedCount > 0 ? (
              <Text style={styles.fileAdded}>
                {linkedCount === 1 ? '1 thing added' : `${linkedCount} things added`} from{' '}
                {file.filename}
              </Text>
            ) : null}

            {notes.length > 0 ? (
              <View style={styles.notes}>
                {notes.map((note, i) => (
                  <Text key={`${file.id}-note-${i}`} style={styles.noteText}>
                    “{note}”
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.fileActions}>
              <PrimaryAction
                accessibilityHint="Type an amount from this file to add it to your money."
                label="Add from this file"
                onPress={() => setAdding(file)}
                tone="ink"
              />
              <View style={styles.fileMinorRow}>
                {onViewFile ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Opens the saved file in a viewer on this device."
                    hitSlop={8}
                    onPress={() => onViewFile(file)}
                    style={styles.minorAction}
                  >
                    <Text style={styles.minorActionText}>View file</Text>
                  </Pressable>
                ) : null}
                {onAddNote ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Add a short note to remember what this file is."
                    hitSlop={8}
                    onPress={() => setNoting(file)}
                    style={styles.minorAction}
                  >
                    <Text style={styles.minorActionText}>Add note</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Removes this saved file. Anything you added stays."
                  hitSlop={8}
                  onPress={() => onRemoveDocument(file.id)}
                  style={styles.minorAction}
                >
                  <Text style={styles.minorActionRemove}>Remove file</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

      <AddFromFileSheet
        file={adding}
        onCancel={() => setAdding(null)}
        onSave={(input) => {
          onAddFromDocument(input);
          setAdding(null);
        }}
      />
      <AddNoteSheet
        file={noting}
        onCancel={() => setNoting(null)}
        onSave={(note) => {
          if (noting && onAddNote) onAddNote(noting.id, note);
          setNoting(null);
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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
            placeholderTextColor={t.muted}
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

function AddNoteSheet({
  file,
  onCancel,
  onSave,
}: {
  file: LocalDocumentStage | null;
  onCancel: () => void;
  onSave: (note: string) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [note, setNote] = useState('');
  return (
    <Modal animationType="slide" transparent visible={file !== null} onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Cancel" style={styles.scrim} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          Add a note
        </Text>
        {file ? <Muted style={styles.sheetFrom}>On: {file.filename}</Muted> : null}
        <Body style={styles.noteHint}>
          A note just helps you remember what this file is. It never changes your money.
        </Body>
        <TextInput
          accessibilityLabel="Note about this file"
          multiline
          onChangeText={setNote}
          placeholder="e.g. June statement, current account"
          placeholderTextColor={t.muted}
          style={styles.noteInput}
          textAlignVertical="top"
          value={note}
        />
        <View style={styles.footer}>
          <GhostButton flex label="Cancel" onPress={onCancel} />
          <View style={styles.flex}>
            <PrimaryAction
              label="Save note"
              onPress={() => {
                if (note.trim().length === 0) return;
                onSave(note);
                setNote('');
              }}
            />
          </View>
        </View>
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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
          amount. Rough is fine; you'll check each one next.
        </Body>
        <TextInput
          accessibilityLabel="Pasted bank text"
          multiline
          onChangeText={setText}
          placeholder={'25 Jun Tesco -42.00\n26 Jun Salary 1200.00\n27 Jun Rent -750.00'}
          placeholderTextColor={t.muted}
          style={styles.pasteInput}
          textAlignVertical="top"
          value={text}
        />
        <View style={styles.footer}>
          <GhostButton flex label="Cancel" onPress={onClose} />
          <View style={styles.flex}>
            <PrimaryAction
              label="Find payments"
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

function makeStyles(t: Palette) {
  return StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: gap.sm, marginTop: gap.lg },
  melo: { marginVertical: gap.xs },
  fileCard: {
    backgroundColor: t.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
    padding: gap.lg,
    gap: gap.xs,
  },
  fileName: { color: t.ink, fontSize: 17, fontWeight: '700' },
  fileMeta: { marginTop: -2 },
  fileSaved: { color: t.secondary, fontSize: 14, lineHeight: 20, marginTop: 2 },
  fileAdded: { color: t.calmStrong, fontSize: 13, fontWeight: '600', marginTop: 2 },
  notes: { gap: 2, marginTop: 2 },
  noteText: { color: t.muted, fontSize: 13, fontStyle: 'italic' },
  fileActions: { gap: gap.sm, marginTop: gap.sm },
  fileMinorRow: { flexDirection: 'row', justifyContent: 'center', gap: gap.xl },
  minorAction: { paddingVertical: 6 },
  minorActionText: { color: t.secondary, fontSize: 14, fontWeight: '600' },
  minorActionRemove: { color: t.repairInk, fontSize: 14, fontWeight: '600' },

  scrim: { flex: 1, backgroundColor: 'rgba(26, 24, 21, 0.42)' },
  sheet: {
    backgroundColor: t.surface,
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
    backgroundColor: t.hairline,
    marginBottom: gap.lg,
  },
  sheetTitle: { color: t.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  sheetFrom: { marginTop: 2 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.lg },
  label: { color: t.muted, fontSize: 13, fontWeight: '700', marginTop: gap.lg },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: t.hairlineStrong,
    paddingVertical: 8,
    fontSize: 18,
    color: t.ink,
  },
  amount: {
    color: t.ink,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: gap.sm,
  },
  footer: { flexDirection: 'row', gap: gap.sm, marginTop: gap.md },

  noteHint: { color: t.secondary, marginTop: gap.xs },
  noteInput: {
    marginTop: gap.md,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: t.hairline,
    backgroundColor: t.canvas,
    padding: gap.md,
    fontSize: 16,
    color: t.ink,
  },

  pasteHint: { color: t.secondary, marginTop: gap.xs },
  pasteInput: {
    marginTop: gap.md,
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: t.hairline,
    backgroundColor: t.canvas,
    padding: gap.md,
    fontSize: 16,
    color: t.ink,
    fontVariant: ['tabular-nums'],
  },
  });
}
