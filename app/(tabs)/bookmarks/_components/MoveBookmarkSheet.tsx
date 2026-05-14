import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { BookmarkFolder } from '@/lib/supabase';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  folders: BookmarkFolder[];
  currentFolderId: string;
  onSelect: (targetFolderId: string) => void;
  onClose: () => void;
};

export default function MoveBookmarkSheet({ visible, folders, currentFolderId, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const targets = folders.filter((f) => f.id !== currentFolderId);

  useEffect(() => {
    if (visible) setSelectedFolderId(null);
  }, [visible]);

  const handleConfirmMove = () => {
    if (selectedFolderId) {
      onSelect(selectedFolderId);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onStartShouldSetResponder={() => true}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>{t('folder.moveTitle')}</Text>
          <FlatList
            data={targets}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => {
              const isSelected = selectedFolderId === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.row,
                    { borderBottomColor: colors.border },
                    isSelected && { borderWidth: 2, borderColor: colors.primary, borderRadius: 8, marginBottom: 2 },
                  ]}
                  onPress={() => setSelectedFolderId(item.id)}>
                  <Text style={[styles.rowText, { color: colors.text }]}>{item.name}</Text>
                  {isSelected && <Check size={22} color={colors.primary} style={styles.rowCheck} />}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity
            style={[
              styles.moveBtn,
              { backgroundColor: selectedFolderId ? colors.primary : colors.border },
            ]}
            onPress={handleConfirmMove}
            disabled={!selectedFolderId}>
            <Text style={[styles.moveBtnText, { color: selectedFolderId ? '#fff' : colors.textSecondary }]}>
              {t('folder.moveConfirm')}
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
  moveBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  moveBtnText: { fontSize: 16, fontWeight: '600' },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600' },
});
