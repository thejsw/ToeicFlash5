import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { BookmarkFolder, DEFAULT_FOLDER_NAME } from '@/lib/supabase';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  folders: BookmarkFolder[];
  mode: 'rename' | 'delete';
  onClose: () => void;
  onConfirm: (folder: BookmarkFolder) => void;
};

export default function FolderSelectSheet({
  visible,
  folders,
  mode,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setSelectedFolderId(null);
  }, [visible]);

  const list = mode === 'delete'
    ? folders.filter((f) => f.name !== DEFAULT_FOLDER_NAME)
    : folders;

  const selectedFolder = selectedFolderId ? list.find((f) => f.id === selectedFolderId) : null;
  const canConfirmRename = selectedFolder && selectedFolder.name !== DEFAULT_FOLDER_NAME;
  const canConfirmDelete = !!selectedFolder;

  const handleConfirm = () => {
    if (mode === 'rename' && canConfirmRename && selectedFolder) {
      onConfirm(selectedFolder);
      onClose();
    }
    if (mode === 'delete' && canConfirmDelete && selectedFolder) {
      onConfirm(selectedFolder);
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onStartShouldSetResponder={() => true}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>
            {mode === 'rename' ? t('folder.selectRenameTitle') : t('folder.selectDeleteTitle')}
          </Text>
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => {
              const isSelected = selectedFolderId === item.id;
              const isDefault = item.name === DEFAULT_FOLDER_NAME;
              const disabled = mode === 'rename' && isDefault;
              return (
                <TouchableOpacity
                  style={[
                    styles.row,
                    { borderBottomColor: colors.border },
                    isSelected && !disabled && { borderWidth: 2, borderColor: colors.primary, borderRadius: 8, marginBottom: 2 },
                    disabled && { opacity: 0.5 },
                  ]}
                  onPress={() => !disabled && setSelectedFolderId(item.id)}
                  disabled={disabled}>
                  <Text style={[styles.rowText, { color: colors.text }]}>{item.name}</Text>
                  {isSelected && !disabled && (
                    <Check size={22} color={colors.primary} style={styles.rowCheck} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              {
                backgroundColor:
                  (mode === 'rename' && canConfirmRename) || (mode === 'delete' && canConfirmDelete)
                    ? colors.primary
                    : colors.border,
              },
            ]}
            onPress={handleConfirm}
            disabled={mode === 'rename' ? !canConfirmRename : !canConfirmDelete}>
            <Text
              style={[
                styles.confirmBtnText,
                {
                  color:
                    (mode === 'rename' && canConfirmRename) || (mode === 'delete' && canConfirmDelete)
                      ? '#fff'
                      : colors.textSecondary,
                },
              ]}>
              {mode === 'rename' ? t('folder.renameConfirm') : t('folder.deleteConfirm')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.text }]}>{t('folder.cancel')}</Text>
          </TouchableOpacity>
        </View>
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
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  list: { maxHeight: 280 },
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
  confirmBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 16, fontWeight: '600' },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600' },
});
