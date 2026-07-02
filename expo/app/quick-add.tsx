import { invalidateGoals, invalidateTasks } from '../services/queryInvalidationService';
import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { TouchableOpacity } from '@/components/HapticTouchable';
import { useRouter } from 'expo-router';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksDb, goalsDb, mealsDb, transactionsDb } from '@/lib/db';
import { gratitudeSupabase } from '@/services/gratitude.service';
import type { Task, Goal, Meal, Transaction, GratitudeEntry } from '@/types';

const QUICK_ADD_OPTIONS = ['Task', 'Goal', 'Meal', 'Transaction', 'Gratitude'] as const;

export default function QuickAddScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<typeof QUICK_ADD_OPTIONS[number]>('Task');
  const [input, setInput] = useState('');

  const createTaskMutation = useMutation({
    mutationFn: (task: Task) => tasksDb.create(task),
    onSuccess: () => {
      invalidateTasks(queryClient);
      router.back();
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: (goal: Goal) => goalsDb.create(goal),
    onSuccess: () => {
      invalidateGoals(queryClient);
      router.back();
    },
  });

  const createMealMutation = useMutation({
    mutationFn: (meal: Meal) => mealsDb.create(meal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      router.back();
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (transaction: Transaction) => transactionsDb.create(transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      router.back();
    },
  });

  const createGratitudeMutation = useMutation({
    mutationFn: async (entry: GratitudeEntry) => {
      const result = await gratitudeSupabase.create(entry);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gratitude-entries'] });
      router.back();
    },
    onError: (error: any) => {
      console.error('[QuickAdd] Gratitude save failed:', error);
      Alert.alert('Save failed', error?.message || 'Could not save gratitude entry. Please check your connection.');
    },
  });

  const isSaving =
    createTaskMutation.isPending ||
    createGoalMutation.isPending ||
    createMealMutation.isPending ||
    createTransactionMutation.isPending ||
    createGratitudeMutation.isPending;

  const handleQuickAdd = () => {
    if (!input.trim()) {
      Alert.alert('Error', 'Please enter something');
      return;
    }
    hapticSuccess();

    switch (selectedType) {
      case 'Task':
        createTaskMutation.mutate({
          id: Date.now().toString(),
          title: input.trim(),
          notes: '',
          dueDate: null,
          dueTime: null,
          isDone: false,
          order: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedDate: null,
          reminderEnabled: false,
          reminderTime: null,
          notificationId: null,
          priority: null,
        });
        break;
      case 'Goal':
        createGoalMutation.mutate({
          id: Date.now().toString(),
          title: input.trim(),
          description: '',
          targetDate: null,
          status: 'not_started',
          progress: 0,
          lastCompletedDate: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        break;
      case 'Meal':
        createMealMutation.mutate({
          id: Date.now().toString(),
          date: Date.now(),
          name: input.trim(),
          calories: 0,
          protein: null,
          carbs: null,
          fat: null,
          notes: '',
        });
        break;
      case 'Transaction':
        createTransactionMutation.mutate({
          id: Date.now().toString(),
          date: Date.now(),
          amount: 0,
          category: input.trim(),
          note: '',
          dayOfWeek: null,
          time: null,
          reminderEnabled: false,
          reminderTime: null,
          isRecurring: false,
        });
        break;
      case 'Gratitude':
        createGratitudeMutation.mutate({
          id: Date.now().toString(),
          entryDate: new Date().setHours(0, 0, 0, 0),
          gratitude1: input.trim(),
          gratitude2: null,
          gratitude3: null,
          createdAt: Date.now(),
        });
        break;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Quick Add</Text>

        <View style={styles.typeContainer}>
          {QUICK_ADD_OPTIONS.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, selectedType === type && styles.typeChipActive]}
              onPress={() => {
                hapticSelection();
                setSelectedType(type);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeText, selectedType === type && styles.typeTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={[styles.input, styles.textArea]}
          value={input}
          onChangeText={setInput}
          placeholder={`Enter ${selectedType.toLowerCase()}...`}
          placeholderTextColor="#666"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.addButton, isSaving && styles.addButtonDisabled]}
          onPress={handleQuickAdd}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addButtonText}>Add {selectedType}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0520',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 24,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    minHeight: 44,
    justifyContent: 'center',
  },
  typeChipActive: {
    backgroundColor: 'rgba(139,92,246,0.9)',
    borderColor: '#a78bfa',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  typeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500' as const,
  },
  typeTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
  },
  addButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
