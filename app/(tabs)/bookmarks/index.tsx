import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  ensureDefaultFolder,
  migrateNullFolderBookmarks,
  isAuthError,
  DEFAULT_FOLDER_NAME,
  BookmarkFolder,
} from '@/lib/supabase';
import { Moon, Sun, MoreVertical } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import FolderOptionsSheet from './_components/FolderOptionsSheet';
import FolderSelectSheet from './_components/FolderSelectSheet';
import { useTranslation } from 'react-i18next';

export default function BookmarksIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, handleSessionError } = useAuth();
  const userId = user?.id ?? null;
  const { colors, theme, toggleTheme } = useTheme();
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsSheetVisible, setOptionsSheetVisible] = useState(false);
  const [folderSelectVisible, setFolderSelectVisible] = useState(false);
  const [folderSelectMode, setFolderSelectMode] = useState<'rename' | 'delete' | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleteConfirmFolder, setDeleteConfirmFolder] = useState<BookmarkFolder | null>(null);

  const loadFolders = useCallback(async (uid: string | null) => {
    await migrateNullFolderBookmarks(uid);
    let list = await listFolders(uid);
    if (list.length === 0) {
      await ensureDefaultFolder(uid);
      list = await listFolders(uid);
    }
    setFolders(list);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        await loadFolders(userId);
        if (!mounted) return;
        setLoading(false);
      } catch (e) {
        console.error('Failed to load bookmark folders:', e);
        if (isAuthError(e)) {
          await handleSessionError();
        }
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, loadFolders, handleSessionError]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const folder = await createFolder(userId ?? null, newFolderName.trim());
      setFolders((prev) => [...prev, folder]);
      setCreateModalVisible(false);
      setNewFolderName('');
    } catch (e) {
      Alert.alert(t('alert.error'), t('folder.createError'));
    }
  };

  const handleUpdateFolder = async () => {
    if (!editFolderId || !editName.trim()) return;
    try {
      await updateFolder(userId ?? null, editFolderId, editName.trim());
      setFolders((prev) =>
        prev.map((f) => (f.id === editFolderId ? { ...f, name: editName.trim() } : f))
      );
      setEditModalVisible(false);
      setEditFolderId(null);
      setEditName('');
    } catch (e) {
      Alert.alert(t('alert.error'), t('folder.renameError'));
    }
  };

  const openOptionsSheet = () => {
    setOptionsSheetVisible(true);
  };

  const handleConfirmDelete = async () => {
    const folder = deleteConfirmFolder;
    setDeleteConfirmFolder(null);
    if (!folder || folder.name === DEFAULT_FOLDER_NAME) return;
    try {
      await deleteFolder(userId ?? null, folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    } catch (e) {
      Alert.alert(t('alert.error'), t('folder.deleteError'));
    }
  };

  const openRenameSelect = () => {
    setFolderSelectMode('rename');
    setFolderSelectVisible(true);
  };

  const openDeleteSelect = () => {
    setFolderSelectMode('delete');
    setFolderSelectVisible(true);
  };

  const handleFolderSelectConfirm = (folder: BookmarkFolder) => {
    if (folderSelectMode === 'rename') {
      setEditFolderId(folder.id);
      setEditName(folder.name);
      setEditModalVisible(true);
    } else if (folderSelectMode === 'delete') {
      setDeleteConfirmFolder(folder);
    }
    setFolderSelectVisible(false);
    setFolderSelectMode(null);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('folder.headerTitle')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeButton}>
            {theme === 'light' ? (
              <Moon size={20} color={colors.text} />
            ) : (
              <Sun size={20} color={colors.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={openOptionsSheet} style={styles.menuButton}>
            <MoreVertical size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={folders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.folderRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/(tabs)/bookmarks/${item.id}` as never)}
            activeOpacity={0.7}>
            <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FolderOptionsSheet
        visible={optionsSheetVisible}
        folder={null}
        onClose={() => setOptionsSheetVisible(false)}
        onSelectCreate={() => setCreateModalVisible(true)}
        onSelectRename={openRenameSelect}
        onSelectDelete={openDeleteSelect}
      />

      {folderSelectMode && (
        <FolderSelectSheet
          visible={folderSelectVisible}
          folders={folders}
          mode={folderSelectMode}
          onClose={() => { setFolderSelectVisible(false); setFolderSelectMode(null); }}
          onConfirm={handleFolderSelectConfirm}
        />
      )}

      <Modal visible={!!deleteConfirmFolder} transparent animationType="fade">
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>{t('folder.deleteModalTitle')}</Text>
            <Text style={[styles.deleteModalMessage, { color: colors.textSecondary }]}>
              {deleteConfirmFolder
                ? t('folder.deleteModalMessage', { name: deleteConfirmFolder.name })
                : ''}
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, { backgroundColor: colors.border }]}
                onPress={() => setDeleteConfirmFolder(null)}>
                <Text style={[styles.deleteModalBtnText, { color: colors.text }]}>{t('folder.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, { backgroundColor: colors.error }]}
                onPress={handleConfirmDelete}>
                <Text style={[styles.deleteModalBtnText, { color: '#fff' }]}>{t('folder.deleteSubmit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={createModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('folder.newFolder')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder={t('folder.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => {
                  setCreateModalVisible(false);
                  setNewFolderName('');
                }}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t('folder.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateFolder}
                disabled={!newFolderName.trim()}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('folder.createSubmit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={editModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('folder.renameModalTitle')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder={t('folder.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={editName}
              onChangeText={setEditName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => {
                  setEditModalVisible(false);
                  setEditFolderId(null);
                  setEditName('');
                }}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t('folder.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleUpdateFolder}
                disabled={!editName.trim()}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('folder.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeButton: { padding: 8 },
  menuButton: { padding: 8 },
  listContent: { padding: 16 },
  folderRow: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  folderName: { fontSize: 16, fontWeight: '500' },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  deleteModalBox: { borderRadius: 16, padding: 24 },
  deleteModalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  deleteModalMessage: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  deleteModalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  deleteModalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  deleteModalBtnText: { fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalBtnText: { fontSize: 16, fontWeight: '600' },
});
