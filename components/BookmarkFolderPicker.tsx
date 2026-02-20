import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  listFolders,
  ensureDefaultFolder,
  createFolder,
  BookmarkFolder,
} from '@/lib/supabase';
import { Check, FolderPlus } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

type Props = {
  visible: boolean;
  userId: string | null;
  /** 선택한 폴더 ID 배열로 호출 (여러 폴더 선택 가능) */
  onSelectFolders: (folderIds: string[]) => void;
  onClose: () => void;
};

export default function BookmarkFolderPicker({
  visible,
  userId,
  onSelectFolders,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setCreating(false);
      setNewFolderName('');
      setShowCreateInput(false);
      setSelectedFolderIds(new Set());
      const uid = userId ?? null;
      let list = await listFolders(uid);
      if (list.length === 0) {
        await ensureDefaultFolder(uid);
        list = await listFolders(uid);
      }
      if (mounted) setFolders(list);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [visible, userId]);

  const handleConfirmSave = () => {
    if (selectedFolderIds.size > 0) {
      onSelectFolders(Array.from(selectedFolderIds));
      onClose();
    }
  };

  const toggleFolder = (folderId: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const uid = userId ?? null;
    setCreating(true);
    try {
      const folder = await createFolder(uid, name);
      setFolders((prev) => [...prev, folder]);
      setNewFolderName('');
      setShowCreateInput(false);
      setSelectedFolderIds((prev) => new Set([...prev, folder.id]));
    } finally {
      setCreating(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}>
          <View
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]}>북마크 폴더 선택</Text>
              <TouchableOpacity
                style={styles.newFolderIconBtn}
                onPress={() => setShowCreateInput(true)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <FolderPlus size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
            ) : (
              <FlatList
                data={folders}
                keyExtractor={(item) => item.id}
                style={styles.list}
                renderItem={({ item }) => {
                  const isSelected = selectedFolderIds.has(item.id);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.row,
                        { borderBottomColor: colors.border },
                        isSelected && { borderWidth: 2, borderColor: colors.primary, borderRadius: 8, marginBottom: 2 },
                      ]}
                      onPress={() => toggleFolder(item.id)}>
                      <Text style={[styles.rowText, { color: colors.text }]}>{item.name}</Text>
                      {isSelected && (
                        <Check size={22} color={colors.primary} style={styles.rowCheck} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {!loading && (
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: selectedFolderIds.size > 0 ? colors.primary : colors.border },
                ]}
                onPress={handleConfirmSave}
                disabled={selectedFolderIds.size === 0}>
                <Text style={[styles.saveBtnText, { color: selectedFolderIds.size > 0 ? '#fff' : colors.textSecondary }]}>
                  {selectedFolderIds.size > 0
                    ? `선택한 폴더 ${selectedFolderIds.size}개에 저장`
                    : '폴더를 선택하세요'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={[styles.newSection, { borderTopColor: colors.border }]}>
              {showCreateInput ? (
                <View style={styles.createRow}>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    placeholder="폴더 이름"
                    placeholderTextColor={colors.textSecondary}
                    value={newFolderName}
                    onChangeText={setNewFolderName}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.createBtn, { backgroundColor: colors.primary }]}
                    onPress={handleCreateFolder}
                    disabled={creating || !newFolderName.trim()}>
                    <Text style={styles.createBtnText}>{creating ? '...' : '만들기'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.text }]}>취소</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrap: { maxHeight: '70%' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  newFolderIconBtn: { padding: 4 },
  loader: { paddingVertical: 24 },
  list: { maxHeight: 220 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  rowText: { fontSize: 16, flex: 1 },
  rowCheck: { marginLeft: 8 },
  saveBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '600' },
  newSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
  },
  createRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  createBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600' },
});
