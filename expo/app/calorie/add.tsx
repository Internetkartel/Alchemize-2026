import { invalidateFoodLogs } from '../../services/queryInvalidationService';
import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, TextInput, Text, ScrollView, Alert, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '@/components/HapticTouchable';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ChevronDown,
  Check,
  Zap,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { foodLogsDb } from '@/lib/db/food';
import { appointmentsDb } from '@/lib/db/appointments';
import type { FoodLog, MealType, Appointment } from '@/types';

const MEAL_TYPES: { value: MealType; label: string; icon: string; color: string }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅', color: '#fbbf24' },
  { value: 'lunch', label: 'Lunch', icon: '☀️', color: '#22c55e' },
  { value: 'dinner', label: 'Dinner', icon: '🌙', color: '#6366f1' },
  { value: 'snack', label: 'Snack', icon: '🍎', color: '#ec4899' },
];

const QUICK_FOODS = [
  { name: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0, emoji: '🍌' },
  { name: 'Apple', calories: 95, protein: 0, carbs: 25, fat: 0, emoji: '🍎' },
  { name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 4, emoji: '🍗' },
  { name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fat: 2, emoji: '🍚' },
  { name: 'Greek Yogurt', calories: 100, protein: 17, carbs: 6, fat: 1, emoji: '🥛' },
  { name: 'Egg', calories: 78, protein: 6, carbs: 1, fat: 5, emoji: '🥚' },
  { name: 'Salmon', calories: 208, protein: 20, carbs: 0, fat: 13, emoji: '🐟' },
  { name: 'Avocado', calories: 160, protein: 2, carbs: 9, fat: 15, emoji: '🥑' },
  { name: 'Oatmeal', calories: 150, protein: 5, carbs: 27, fat: 3, emoji: '🥣' },
  { name: 'Sweet Potato', calories: 103, protein: 2, carbs: 24, fat: 0, emoji: '🍠' },
];

const FoodSearchResultSchema = z.object({
  name: z.string().describe('Clean, specific name of the food, using standard capitalization'),
  servingDescription: z.string().describe('One standard serving size with weight, e.g. "1 medium (118g)" or "1 cup cooked (185g)"'),
  calories: z.number().describe('Estimated calories for one standard serving, based on USDA FoodData Central reference values'),
  protein: z.number().describe('Estimated protein in grams for that serving'),
  carbs: z.number().describe('Estimated total carbohydrates in grams for that serving'),
  fat: z.number().describe('Estimated total fat in grams for that serving'),
  fiber: z.number().describe('Estimated dietary fiber in grams for that serving'),
});

type FoodSearchResult = z.infer<typeof FoodSearchResultSchema>;

function buildFoodSearchPrompt(query: string): string {
  return `You are a nutrition database assistant with deep knowledge of the USDA FoodData Central database.

The user wants to log this food: "${query}"

Return your best estimate of nutrition facts for ONE standard serving of this food. If the query names a dish or brand, pick the most common home or restaurant preparation. Use realistic values consistent with USDA reference data (e.g. chicken breast ~165 cal/100g cooked, white rice ~130 cal/100g cooked). If the query is too vague to identify a food at all, still return your best single-item guess rather than refusing.`;
}

export default function AddMealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string; id?: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const isEditMode = !!params.id;
  const initialMealType = (params.meal as MealType) || 'lunch';

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResult, setAiResult] = useState<FoodSearchResult | null>(null);

  const { data: existingLog } = useQuery({
    queryKey: ['foodLog', params.id],
    queryFn: () => foodLogsDb.getById(params.id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!existingLog) return;
    setName(existingLog.foodName);
    setCalories(existingLog.calories.toString());
    setProtein(existingLog.proteinGrams != null ? existingLog.proteinGrams.toString() : '');
    setCarbs(existingLog.carbGrams != null ? existingLog.carbGrams.toString() : '');
    setFat(existingLog.fatGrams != null ? existingLog.fatGrams.toString() : '');
    setFiber(existingLog.fiberGrams != null ? existingLog.fiberGrams.toString() : '');
    setServingSize(existingLog.servingDescription);
    setMealType(existingLog.mealType);
  }, [existingLog]);

  const aiSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      return generateObject({
        messages: [{ role: 'user', content: buildFoodSearchPrompt(query) }],
        schema: FoodSearchResultSchema,
      });
    },
    onSuccess: (result) => {
      setAiResult(result);
    },
    onError: (error: any) => {
      console.error('[AddFood] AI food search failed:', error);
      Alert.alert('Search failed', 'Could not look up that food. Please try again or enter it manually.');
    },
  });

  const createMutation = useMutation({
    mutationFn: async (foodLog: FoodLog) => {
      const calendarEventId = `cal-${Date.now()}`;
      const updatedFoodLog = { ...foodLog, calendarEventId };

      // Save the food log first — it's the record that actually matters. The calendar
      // reminder below is best-effort and must never leave an orphaned entry if it fails.
      await foodLogsDb.create(updatedFoodLog);

      const loggedDate = new Date(foodLog.loggedAt);
      const timeStr = loggedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const calendarEvent: Appointment = {
        id: calendarEventId,
        title: `${foodLog.foodName} (${foodLog.mealType})`,
        date: new Date(loggedDate.getFullYear(), loggedDate.getMonth(), loggedDate.getDate()).getTime(),
        time: timeStr,
        category: 'nutrition',
        notes: `${foodLog.calories} cal | P: ${foodLog.proteinGrams || 0}g C: ${foodLog.carbGrams || 0}g F: ${foodLog.fatGrams || 0}g`,
        reminder: false,
        createdAt: Date.now(),
        metadata: JSON.stringify({
          foodLogId: foodLog.id,
          calories: foodLog.calories,
          protein: foodLog.proteinGrams,
          carbs: foodLog.carbGrams,
          fat: foodLog.fatGrams,
          fiber: foodLog.fiberGrams,
          source: foodLog.sourceType,
          isLocked: foodLog.isLocked,
        }),
      };

      try {
        await appointmentsDb.create(calendarEvent);
      } catch (error) {
        console.error('[AddFood] Calendar reminder creation failed (food log still saved):', error);
      }
    },
    onSuccess: () => {
      invalidateFoodLogs(queryClient);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error: any) => {
      console.error('[AddFood] Save failed:', error);
      Alert.alert('Save failed', error?.message || 'Could not save food. Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (foodLog: FoodLog) => foodLogsDb.update(foodLog),
    onSuccess: () => {
      invalidateFoodLogs(queryClient);
      queryClient.invalidateQueries({ queryKey: ['foodLog', params.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error: any) => {
      console.error('[AddFood] Update failed:', error);
      Alert.alert('Save failed', error?.message || 'Could not update food. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => foodLogsDb.delete(id),
    onSuccess: () => {
      invalidateFoodLogs(queryClient);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error: any) => {
      console.error('[AddFood] Delete failed:', error);
      Alert.alert('Delete failed', error?.message || 'Could not delete this entry. Please try again.');
    },
  });

  const { mutate: createFood } = createMutation;
  const { mutate: updateFood } = updateMutation;

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a food name');
      return;
    }
    if (!calories.trim() || isNaN(parseFloat(calories))) {
      Alert.alert('Error', 'Please enter valid calories');
      return;
    }

    if (isEditMode && existingLog) {
      const updated: FoodLog = {
        ...existingLog,
        foodName: name.trim(),
        servingDescription: servingSize.trim() || '1 serving',
        calories: parseFloat(calories),
        proteinGrams: protein ? parseFloat(protein) : null,
        carbGrams: carbs ? parseFloat(carbs) : null,
        fatGrams: fat ? parseFloat(fat) : null,
        fiberGrams: fiber ? parseFloat(fiber) : null,
        mealType,
      };
      updateFood(updated);
      return;
    }

    const foodLog: FoodLog = {
      id: Date.now().toString(),
      foodName: name.trim(),
      servingDescription: servingSize.trim() || '1 serving',
      calories: parseFloat(calories),
      proteinGrams: protein ? parseFloat(protein) : null,
      carbGrams: carbs ? parseFloat(carbs) : null,
      fatGrams: fat ? parseFloat(fat) : null,
      sugarGrams: null,
      fiberGrams: fiber ? parseFloat(fiber) : null,
      mealType,
      sourceType: 'manual',
      loggedAt: Date.now(),
      isLocked: true,
      calendarEventId: null,
    };

    createFood(foodLog);
  }, [name, calories, protein, carbs, fat, fiber, servingSize, mealType, createFood, updateFood, isEditMode, existingLog]);

  const handleDelete = useCallback(() => {
    if (!params.id) return;
    Alert.alert('Delete Entry', 'Remove this food log entry? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(params.id!),
      },
    ]);
  }, [params.id, deleteMutation]);

  const handleQuickFood = useCallback((food: typeof QUICK_FOODS[0]) => {
    setName(food.name);
    setCalories(food.calories.toString());
    setProtein(food.protein.toString());
    setCarbs(food.carbs.toString());
    setFat(food.fat.toString());
    setServingSize('1 serving');
    setAiResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleUseAiResult = useCallback(() => {
    if (!aiResult) return;
    setName(aiResult.name);
    setCalories(Math.round(aiResult.calories).toString());
    setProtein(Math.round(aiResult.protein).toString());
    setCarbs(Math.round(aiResult.carbs).toString());
    setFat(Math.round(aiResult.fat).toString());
    setFiber(Math.round(aiResult.fiber).toString());
    setServingSize(aiResult.servingDescription);
    setAiResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [aiResult]);

  const handleAiSearch = useCallback(() => {
    const query = searchQuery.trim();
    if (!query || aiSearchMutation.isPending) return;
    setAiResult(null);
    aiSearchMutation.mutate(query);
  }, [searchQuery, aiSearchMutation]);

  const filteredFoods = QUICK_FOODS.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMeal = MEAL_TYPES.find(m => m.value === mealType);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: isEditMode ? 'Edit Food' : 'Log Food' }} />
      <LinearGradient
        colors={['#0a0a0f', '#0d0d15', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mealTypeSection}>
          <Text style={styles.sectionLabel}>Log to</Text>
          <TouchableOpacity
            style={[styles.mealTypeButton, { borderColor: `${selectedMeal?.color}40` }]}
            onPress={() => setShowMealPicker(!showMealPicker)}
          >
            <View style={[styles.mealIconBg, { backgroundColor: `${selectedMeal?.color}20` }]}>
              <Text style={styles.mealTypeEmoji}>{selectedMeal?.icon}</Text>
            </View>
            <Text style={styles.mealTypeText}>{selectedMeal?.label}</Text>
            <ChevronDown size={18} color="#666" />
          </TouchableOpacity>

          {showMealPicker && (
            <View style={styles.mealPickerDropdown}>
              {MEAL_TYPES.map((meal) => (
                <TouchableOpacity
                  key={meal.value}
                  style={[
                    styles.mealPickerItem,
                    mealType === meal.value && styles.mealPickerItemSelected,
                  ]}
                  onPress={() => {
                    setMealType(meal.value);
                    setShowMealPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={styles.mealPickerEmoji}>{meal.icon}</Text>
                  <Text style={styles.mealPickerText}>{meal.label}</Text>
                  {mealType === meal.value && <Check size={18} color="#22c55e" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.quickSection}>
          <Text style={styles.sectionLabel}>Search Foods</Text>
          <View style={styles.searchContainer}>
            <Search size={18} color="#666" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setAiResult(null);
              }}
              placeholder="Search foods or ask AI..."
              placeholderTextColor="#555"
              onSubmitEditing={handleAiSearch}
              returnKeyType="search"
            />
          </View>

          {filteredFoods.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickFoodsContainer}
            >
              {filteredFoods.map((food, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickFoodCard}
                  onPress={() => handleQuickFood(food)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickFoodEmoji}>{food.emoji}</Text>
                  <Text style={styles.quickFoodName}>{food.name}</Text>
                  <Text style={styles.quickFoodCal}>{food.calories} cal</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.aiSearchButton}
              onPress={handleAiSearch}
              disabled={aiSearchMutation.isPending}
              activeOpacity={0.85}
            >
              {aiSearchMutation.isPending ? (
                <ActivityIndicator color="#a78bfa" size="small" />
              ) : (
                <Sparkles size={16} color="#a78bfa" />
              )}
              <Text style={styles.aiSearchButtonText}>
                {aiSearchMutation.isPending ? 'Asking AI…' : `Search "${searchQuery.trim()}" with AI`}
              </Text>
            </TouchableOpacity>
          )}

          {aiResult && (
            <TouchableOpacity style={styles.aiResultCard} onPress={handleUseAiResult} activeOpacity={0.85}>
              <View style={styles.aiResultHeader}>
                <Sparkles size={16} color="#a78bfa" />
                <Text style={styles.aiResultTitle}>{aiResult.name}</Text>
              </View>
              <Text style={styles.aiResultServing}>{aiResult.servingDescription}</Text>
              <View style={styles.aiResultMacros}>
                <Text style={styles.aiResultMacro}>{Math.round(aiResult.calories)} cal</Text>
                <Text style={styles.aiResultMacro}>P {Math.round(aiResult.protein)}g</Text>
                <Text style={styles.aiResultMacro}>C {Math.round(aiResult.carbs)}g</Text>
                <Text style={styles.aiResultMacro}>F {Math.round(aiResult.fat)}g</Text>
              </View>
              <Text style={styles.aiResultHint}>Tap to fill in the form below</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.sectionLabel}>Food Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Food Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Grilled Chicken Salad"
              placeholderTextColor="#444"
            />
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.inputLabel}>Calories</Text>
              <TextInput
                style={styles.input}
                value={calories}
                onChangeText={setCalories}
                placeholder="0"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.inputLabel}>Serving Size</Text>
              <TextInput
                style={styles.input}
                value={servingSize}
                onChangeText={setServingSize}
                placeholder="e.g., 1 cup"
                placeholderTextColor="#444"
              />
            </View>
          </View>
        </View>

        <View style={styles.macrosSection}>
          <Text style={styles.sectionLabel}>Macros (optional)</Text>

          <View style={styles.macrosGrid}>
            <View style={styles.macroCard}>
              <View style={[styles.macroDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.macroLabel}>Protein</Text>
              <TextInput
                style={styles.macroInput}
                value={protein}
                onChangeText={setProtein}
                placeholder="0"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
              />
              <Text style={styles.macroUnit}>g</Text>
            </View>

            <View style={styles.macroCard}>
              <View style={[styles.macroDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.macroLabel}>Carbs</Text>
              <TextInput
                style={styles.macroInput}
                value={carbs}
                onChangeText={setCarbs}
                placeholder="0"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
              />
              <Text style={styles.macroUnit}>g</Text>
            </View>

            <View style={styles.macroCard}>
              <View style={[styles.macroDot, { backgroundColor: '#eab308' }]} />
              <Text style={styles.macroLabel}>Fat</Text>
              <TextInput
                style={styles.macroInput}
                value={fat}
                onChangeText={setFat}
                placeholder="0"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
              />
              <Text style={styles.macroUnit}>g</Text>
            </View>
          </View>
        </View>

        {(name || calories || protein || carbs || fat) && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Zap size={18} color="#22c55e" />
              <Text style={styles.previewTitle}>Nutrition Preview</Text>
            </View>
            <View style={styles.previewGrid}>
              <View style={styles.previewItem}>
                <Text style={styles.previewValue}>{calories || 0}</Text>
                <Text style={styles.previewLabel}>Calories</Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewItem}>
                <Text style={[styles.previewValue, { color: '#ef4444' }]}>{protein || 0}g</Text>
                <Text style={styles.previewLabel}>Protein</Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewItem}>
                <Text style={[styles.previewValue, { color: '#22c55e' }]}>{carbs || 0}g</Text>
                <Text style={styles.previewLabel}>Carbs</Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewItem}>
                <Text style={[styles.previewValue, { color: '#eab308' }]}>{fat || 0}g</Text>
                <Text style={styles.previewLabel}>Fat</Text>
              </View>
            </View>
          </View>
        )}

        {isEditMode && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={deleteMutation.isPending}>
            <Trash2 size={18} color="#ef4444" />
            <Text style={styles.deleteButtonText}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Entry'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={createMutation.isPending || updateMutation.isPending}
          activeOpacity={0.85}
        >
          <Text style={styles.saveButtonText}>
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : isEditMode ? 'Update Food' : 'Log Food'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  mealTypeSection: {
    marginBottom: 24,
  },
  mealTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mealIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealTypeEmoji: {
    fontSize: 20,
  },
  mealTypeText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#fff',
  },
  mealPickerDropdown: {
    marginTop: 8,
    backgroundColor: 'rgba(25, 25, 35, 0.98)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mealPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  mealPickerItemSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  mealPickerEmoji: {
    fontSize: 22,
  },
  mealPickerText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500' as const,
  },
  quickSection: {
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#fff',
  },
  quickFoodsContainer: {
    gap: 10,
    paddingRight: 20,
  },
  quickFoodCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    minWidth: 90,
  },
  quickFoodEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickFoodName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickFoodCal: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '500' as const,
  },
  aiSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  aiSearchButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#a78bfa',
  },
  aiResultCard: {
    marginTop: 12,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  aiResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiResultTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    flexShrink: 1,
  },
  aiResultServing: {
    fontSize: 13,
    color: '#999',
    marginBottom: 10,
  },
  aiResultMacros: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
  },
  aiResultMacro: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#a78bfa',
  },
  aiResultHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic' as const,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macrosSection: {
    marginBottom: 24,
  },
  macrosGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  macroCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  macroLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500' as const,
    marginBottom: 10,
  },
  macroInput: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
    minWidth: 50,
  },
  macroUnit: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  previewCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderRadius: 20,
    padding: 18,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#22c55e',
  },
  previewGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  previewLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
