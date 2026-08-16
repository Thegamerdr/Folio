import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WorkspaceId } from '@folio/domain';

import { gap, radius, serif, Sheet, useTheme } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import {
  archivePersistedBusinessWorkspace,
  createAndActivatePersistedBusinessWorkspace,
  renamePersistedBusinessWorkspace,
  restorePersistedBusinessWorkspace,
  switchPersistedWorkspace,
} from '@/folio/lib/persist';
import { PERSONAL_WORKSPACE_ID, type PersistedWorkspace } from '@/folio/lib/workspaceRoot';

export type WorkspaceSheetProps = Readonly<{
  visible: boolean;
  onClose: () => void;
  onActivated: (workspaceId: WorkspaceId) => void;
}>;

type EditorMode =
  | Readonly<{ kind: 'list' | 'create' }>
  | Readonly<{
      kind: 'rename';
      workspaceId: WorkspaceId;
    }>;

export function WorkspaceSheet({ visible, onClose, onActivated }: WorkspaceSheetProps) {
  const t = useTheme();
  const workspaces = useAppStore((state) => state.workspaces);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const [mode, setMode] = useState<EditorMode>({ kind: 'list' });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const business = workspaces.find((workspace) => workspace.kind === 'business');

  useEffect(() => {
    if (!visible) return;
    setMode({ kind: 'list' });
    setName('');
    setBusy(null);
    setError(null);
  }, [visible]);

  const editorWorkspace = useMemo(
    () =>
      mode.kind === 'rename'
        ? workspaces.find((workspace) => workspace.id === mode.workspaceId)
        : undefined,
    [mode, workspaces],
  );

  const activate = async (workspace: PersistedWorkspace) => {
    if (busy !== null || workspace.archivedAt !== null) return;
    if (workspace.id === activeWorkspaceId) {
      onClose();
      return;
    }
    setBusy(`switch:${String(workspace.id)}`);
    setError(null);
    try {
      await switchPersistedWorkspace(workspace.id);
      onActivated(workspace.id);
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      setBusy(null);
    }
  };

  const saveEditor = async () => {
    if (busy !== null) return;
    setBusy(mode.kind);
    setError(null);
    try {
      if (mode.kind === 'create') {
        const created = await createAndActivatePersistedBusinessWorkspace(name);
        onActivated(created.id);
        return;
      }
      if (mode.kind === 'rename') {
        await renamePersistedBusinessWorkspace(mode.workspaceId, name);
        setMode({ kind: 'list' });
        setName('');
      }
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (workspace: PersistedWorkspace) => {
    if (busy !== null) return;
    setBusy(`restore:${String(workspace.id)}`);
    setError(null);
    try {
      await restorePersistedBusinessWorkspace(workspace.id);
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      setBusy(null);
    }
  };

  const confirmArchive = (workspace: PersistedWorkspace) => {
    Alert.alert(
      `Archive ${workspace.name}?`,
      'This hides the Business workspace and stops its reminders. Its local records stay on this device, and you can restore it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive workspace',
          style: 'destructive',
          onPress: () => {
            setBusy(`archive:${String(workspace.id)}`);
            setError(null);
            void archivePersistedBusinessWorkspace(workspace.id)
              .then(() => onActivated(PERSONAL_WORKSPACE_ID))
              .catch((reason: unknown) => setError(messageFor(reason)))
              .finally(() => setBusy(null));
          },
        },
      ],
    );
  };

  const beginRename = (workspace: PersistedWorkspace) => {
    setMode({ kind: 'rename', workspaceId: workspace.id });
    setName(workspace.name);
    setError(null);
  };

  const isEditing = mode.kind !== 'list';
  const editorTitle =
    mode.kind === 'rename' ? 'Rename the business side.' : 'Name the business side.';
  const editorAction = mode.kind === 'rename' ? 'Save name' : 'Create empty workspace';

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Workspace</Text>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          {isEditing ? editorTitle : 'Personal and business stay apart.'}
        </Text>
        <Text style={[styles.intro, { color: t.muted }]}>
          {isEditing
            ? 'Use the name you recognise. You can change it later.'
            : 'Switching changes the accounts, activity, exports and Melo context shown in the app.'}
        </Text>

        {isEditing ? (
          <View style={styles.editor}>
            <TextInput
              accessibilityLabel="Business workspace name"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={120}
              onChangeText={setName}
              placeholder="Business name"
              placeholderTextColor={t.muted}
              returnKeyType="done"
              style={[
                styles.input,
                { backgroundColor: t.inset, borderColor: t.hairlineStrong, color: t.ink },
              ]}
              value={name}
              onSubmitEditing={() => void saveEditor()}
            />
            {error !== null ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: t.repairInk }]}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy !== null }}
              disabled={busy !== null}
              onPress={() => void saveEditor()}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: t.calmStrong, opacity: pressed || busy !== null ? 0.68 : 1 },
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.accentInk }]}>
                {busy !== null ? 'Saving…' : editorAction}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMode({ kind: 'list' });
                setName('');
                setError(null);
              }}
              style={styles.quietAction}
            >
              <Text style={[styles.quietLabel, { color: t.muted }]}>Back to workspaces</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspaceId;
              const archived = workspace.archivedAt !== null;
              const working = busy?.endsWith(String(workspace.id)) ?? false;
              return (
                <View
                  key={String(workspace.id)}
                  style={[styles.workspace, { backgroundColor: t.inset }]}
                >
                  <Pressable
                    accessibilityHint={
                      archived
                        ? 'Restore this workspace before opening it.'
                        : `Shows ${workspace.name} throughout Melo.`
                    }
                    accessibilityLabel={`${workspace.name}, ${workspace.kind} workspace`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: archived || busy !== null, selected: active }}
                    disabled={archived || busy !== null}
                    onPress={() => void activate(workspace)}
                    style={({ pressed }) => [
                      styles.workspaceMain,
                      { opacity: pressed || working ? 0.62 : archived ? 0.72 : 1 },
                    ]}
                  >
                    <View style={styles.workspaceCopy}>
                      <Text numberOfLines={1} style={[styles.workspaceName, { color: t.ink }]}>
                        {workspace.name}
                      </Text>
                      <Text style={[styles.workspaceMeta, { color: t.muted }]}>
                        {archived
                          ? 'Archived · records retained'
                          : active
                            ? `${workspace.kind === 'personal' ? 'Personal' : 'Business'} · open now`
                            : workspace.kind === 'personal'
                              ? 'Personal money'
                              : 'Business money'}
                      </Text>
                    </View>
                    <Text style={[styles.openLabel, { color: t.calmStrong }]}>
                      {working ? 'Opening…' : active ? 'Open' : archived ? '' : 'Open →'}
                    </Text>
                  </Pressable>

                  {workspace.kind === 'business' ? (
                    <View style={[styles.workspaceActions, { borderTopColor: t.hairline }]}>
                      {archived ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ disabled: busy !== null }}
                          disabled={busy !== null}
                          onPress={() => void restore(workspace)}
                          style={styles.inlineAction}
                        >
                          <Text style={[styles.inlineLabel, { color: t.calmStrong }]}>
                            {working ? 'Restoring…' : 'Restore workspace'}
                          </Text>
                        </Pressable>
                      ) : (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: busy !== null }}
                            disabled={busy !== null}
                            onPress={() => beginRename(workspace)}
                            style={styles.inlineAction}
                          >
                            <Text style={[styles.inlineLabel, { color: t.secondary }]}>Rename</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: busy !== null }}
                            disabled={busy !== null}
                            onPress={() => confirmArchive(workspace)}
                            style={styles.inlineAction}
                          >
                            <Text style={[styles.inlineLabel, { color: t.repairInk }]}>
                              Archive
                            </Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}

            {business === undefined ? (
              <Pressable
                accessibilityHint="Creates a separate empty workspace."
                accessibilityRole="button"
                onPress={() => {
                  setMode({ kind: 'create' });
                  setName('');
                  setError(null);
                }}
                style={({ pressed }) => [
                  styles.addBusiness,
                  { borderColor: t.hairlineStrong, opacity: pressed ? 0.62 : 1 },
                ]}
              >
                <Text style={[styles.addTitle, { color: t.ink }]}>Add a business workspace</Text>
                <Text style={[styles.addBody, { color: t.muted }]}>
                  For freelance or sole-trader money. It starts empty.
                </Text>
              </Pressable>
            ) : null}

            {error !== null ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: t.repairInk }]}>
                {error}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </Sheet>
  );
}

function messageFor(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Melo could not finish that workspace change.';
}

const styles = StyleSheet.create({
  body: { paddingBottom: gap.xl },
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },
  headline: {
    fontFamily: serif.display,
    fontSize: 29,
    letterSpacing: -0.3,
    lineHeight: 35,
    marginTop: gap.xs,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.sm,
    maxWidth: 520,
  },
  list: { gap: gap.md, marginTop: gap.xl },
  workspace: { borderRadius: radius.lg, overflow: 'hidden' },
  workspaceMain: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  workspaceCopy: { flex: 1, minWidth: 0 },
  workspaceName: { fontFamily: serif.medium, fontSize: 18, lineHeight: 23 },
  workspaceMeta: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  openLabel: { fontSize: 12.5, fontWeight: '600', marginLeft: gap.md },
  workspaceActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 44,
  },
  inlineAction: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.md,
  },
  inlineLabel: { fontSize: 12.5, fontWeight: '600' },
  addBusiness: {
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 68,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  addTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  addBody: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  editor: { marginTop: gap.xl },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  primary: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.lg,
    minHeight: 50,
    paddingHorizontal: gap.lg,
  },
  primaryLabel: { fontSize: 14, fontWeight: '700' },
  quietAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.lg,
  },
  quietLabel: { fontSize: 13, fontWeight: '500' },
  error: { fontSize: 12.5, lineHeight: 18, marginTop: gap.md },
});
