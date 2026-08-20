import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, Text, ScrollView, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Switch } from 'react-native';
import { TouchableOpacity } from '@/components/HapticTouchable';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Trash2, Watch } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { workoutSessionsDb, normalizedMetricsDb } from '@/lib/db/fitness';
import type { WorkoutSession } from '@/types';

export default function EditWorkoutSessionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ['workoutSession', id],
    queryFn: () => workoutSessionsDb.getById(id),
    enabled: !!id,
  });

  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [completed, setCompleted] = useState(true);

  useEffect(() => {
    if (session) {
      setDuration(String(session.durationMinutes ?? ''));
      setCalories(session.caloriesEstimate != null ? String(session.caloriesEstimate) : '');
      setCompleted(session.completed);
    }
  }, [session]);

  const isFromHealthKit = session?.id.startsWith('healthkit_') ?? false;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Session not found');
      const durationNum = parseInt(duration, 10);
      if (isNaN(durationNum) || durationNum <= 0) {
        throw new Error('Invalid duration');
      }
      const caloriesNum = calories.trim() ? parseInt(calories, 10) : null;

      const durationDelta = durationNum - session.durationMinutes;
      const caloriesDelta = (caloriesNum ?? 0) - (session.caloriesEstimate ?? 0);

      const updated: WorkoutSession = {
        ...session,
        durationMinutes: durationNum,
        caloriesEstimate: caloriesNum,
        completed,
      };
      await workoutSessionsDb.update(updated);

      const dateStr = new Date(session.startedAt).toISOString().split('T')[0];
      const existingMetric = await normalizedMetricsDb.getByDate(dateStr);
      if (existingMetric) {
        await normalizedMetricsDb.upsert({
          id: existingMetric.id,
          date: dateStr,
          activeMinutes: Math.max(0, (existingMetric.activeMinutes || 0) + durationDelta),
          caloriesActive: Math.max(0, (existingMetric.caloriesActive || 0) + caloriesDelta),
          steps: existingMetric.steps || 0,
          source: existingMetric.source,
          deviceType: existingMetric.deviceType,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workoutSessions'] });
      queryClient.invalidateQueries({ queryKey: ['todayMetric'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error) => {
      console.error('Session update error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save changes');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!session) return;
      await workoutSessionsDb.delete(session.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workoutSessions'] });
      queryClient.invalidateQueries({ queryKey: ['todayMetric'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to delete workout');
    },
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'This will permanently remove this workout entry. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.notFoundText}>Workout not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Workout</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView style={styles.scrollView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isFromHealthKit && (
            <View style={styles.sourceBanner}>
              <Watch size={16} color="#3b82f6" />
              <Text style={styles.sourceBannerText}>
                Synced from Apple Health. Editing here only updates your Alchemize record — it does not change data in the Health app.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Started</Text>
          <Text style={styles.readOnlyValue}>
            {new Date(session.startedAt).toLocaleString()}
          </Text>

          <Text style={styles.label}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={duration}
            onChangeText={setDuration}
            placeholder="30"
            placeholderTextColor="#666"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Calories Burned</Text>
          <TextInput
            style={styles.input}
            value={calories}
            onChangeText={setCalories}
            placeholder="e.g. 250"
            placeholderTextColor="#666"
            keyboardType="number-pad"
          />

          <View style={styles.switchRow}>
            <Text style={styles.label}>Completed</Text>
            <Switch
              value={completed}
              onValueChange={setCompleted}
              trackColor={{ false: '#2a2a2a', true: '#6366f1' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Text style={styles.saveButtonText}>
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={18} color="#ef4444" />
            <Text style={styles.deleteButtonText}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Workout'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: '#888',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  sourceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  sourceBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#93c5fd',
    lineHeight: 17,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  readOnlyValue: {
    fontSize: 15,
    color: '#888',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#232323',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
});
