import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { BookmarkFolder, DEFAULT_FOLDER_NAME } from '@/lib/supabase';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  folder: BookmarkFolder | null;
  onClose: () => void;
  onSelectCreate: () => void;
  onSelectRename: () => void;
  onSelectDelete: () => void;
};

export default function FolderOptionsSheet({
  visible,
  folder,
  onClose,
  onSelectCreate,
  onSelectRename,
  onSelectDelete,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isDefaultFolder = folder?.name === DEFAULT_FOLDER_NAME;
  const canRenameDelete = !folder || !isDefaultFolder;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onStartShouldSetResponder={() => true}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>{t('folder.manageTitle')}</Text>

          <TouchableOpacity
            style={[styles.optionRow, { borderBottomColor: colors.border }]}
            onPress={() => { onSelectCreate(); onClose(); }}>
            <FolderPlus size={22} color={colors.primary} />
            <Text style={[styles.optionText, { color: colors.text }]}>{t('folder.create')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, { borderBottomColor: colors.border }]}
            onPress={() => canRenameDelete && (onSelectRename(), onClose())}
            disabled={!canRenameDelete}>
            <Pencil size={22} color={canRenameDelete ? colors.primary : colors.textSecondary} />
            <Text style={[styles.optionText, { color: canRenameDelete ? colors.text : colors.textSecondary }]}>
              {t('folder.rename')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, { borderBottomColor: colors.border }]}
            onPress={() => canRenameDelete && (onSelectDelete(), onClose())}
            disabled={!canRenameDelete}>
            <Trash2 size={22} color={canRenameDelete ? colors.error : colors.textSecondary} />
            <Text style={[styles.optionText, { color: canRenameDelete ? colors.error : colors.textSecondary }]}>
              {t('folder.delete')}
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
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: { fontSize: 16, fontWeight: '500' },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600' },
});
