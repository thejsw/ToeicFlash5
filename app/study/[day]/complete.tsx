import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function DayCompleteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { day } = useLocalSearchParams<{ day: string }>();
  const { colors } = useTheme();

  const handleStartQuiz = () => {
    router.push(`/study/${day}/quiz`);
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('studyComplete.title', { day: day ?? '' })}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.message, { color: colors.text }]}>{t('studyComplete.prompt')}</Text>

        <TouchableOpacity
          style={[styles.quizButton, { backgroundColor: colors.primary }]}
          onPress={handleStartQuiz}>
          <Text style={styles.quizButtonText}>{t('studyComplete.startQuiz')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backToStudyButton, { borderColor: colors.border }]}
          onPress={handleGoBack}>
          <Text style={[styles.backToStudyButtonText, { color: colors.textSecondary }]}>
            {t('studyComplete.studyAgain')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 24,
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  quizButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  quizButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  backToStudyButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
  },
  backToStudyButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
