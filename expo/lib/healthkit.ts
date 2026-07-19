import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WorkoutActivityType,
  WorkoutTypeIdentifier,
  isHealthDataAvailable,
  requestAuthorization,
  queryWorkoutSamples,
  queryStatisticsForQuantity,
  type WorkoutProxyTyped,
} from '@kingstinct/react-native-healthkit';

const HEALTHKIT_PERMISSIONS_KEY = '@alchemize_healthkit_permissions';
const HEALTHKIT_LAST_SYNC_KEY = '@alchemize_healthkit_last_sync';

const ACTIVE_ENERGY_IDENTIFIER = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const EXERCISE_TIME_IDENTIFIER = 'HKQuantityTypeIdentifierAppleExerciseTime' as const;

export type HealthKitPermissionStatus = 'notDetermined' | 'authorized' | 'denied' | 'unavailable';

export interface HealthKitPermissions {
  activeEnergy: HealthKitPermissionStatus;
  workouts: HealthKitPermissionStatus;
  exerciseMinutes: HealthKitPermissionStatus;
  overallStatus: HealthKitPermissionStatus;
  lastUpdated: string | null;
}

export interface HealthKitWorkout {
  id: string;
  workoutType: string;
  startDate: string;
  endDate: string;
  duration: number;
  caloriesBurned: number | null;
  source: 'apple_health' | 'manual' | 'estimated';
  sourceName: string;
  isEstimated: boolean;
}

export interface HealthKitActivityData {
  date: string;
  activeEnergyBurned: number;
  exerciseMinutes: number;
  workouts: HealthKitWorkout[];
}

const DEFAULT_PERMISSIONS: HealthKitPermissions = {
  activeEnergy: 'notDetermined',
  workouts: 'notDetermined',
  exerciseMinutes: 'notDetermined',
  overallStatus: 'notDetermined',
  lastUpdated: null,
};

// Apple's readable enum keys ("running", "traditionalStrengthTraining", ...) already map
// closely to display names; only a handful need manual relabeling.
const WORKOUT_TYPE_LABEL_OVERRIDES: Partial<Record<keyof typeof WorkoutActivityType, string>> = {
  traditionalStrengthTraining: 'Strength Training',
  functionalStrengthTraining: 'Functional Training',
  highIntensityIntervalTraining: 'HIIT',
  crossTraining: 'Cross Training',
  danceInspiredTraining: 'Dance',
  mixedMetabolicCardioTraining: 'Mixed Cardio',
};

function formatWorkoutActivityType(type: WorkoutActivityType): string {
  const key = WorkoutActivityType[type] as keyof typeof WorkoutActivityType | undefined;
  if (!key) return 'Workout';
  if (WORKOUT_TYPE_LABEL_OVERRIDES[key]) return WORKOUT_TYPE_LABEL_OVERRIDES[key]!;
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function mapWorkout(workout: WorkoutProxyTyped): HealthKitWorkout {
  const durationMinutes = Math.round(workout.duration.quantity);
  const calories = workout.totalEnergyBurned ? Math.round(workout.totalEnergyBurned.quantity) : null;
  const sourceName = workout.sourceRevision?.source?.name ?? 'Apple Health';

  return {
    id: workout.uuid,
    workoutType: formatWorkoutActivityType(workout.workoutActivityType),
    startDate: workout.startDate.toISOString(),
    endDate: workout.endDate.toISOString(),
    duration: durationMinutes,
    caloriesBurned: calories,
    source: 'apple_health',
    sourceName,
    isEstimated: false,
  };
}

export function isHealthKitAvailable(): boolean {
  return Platform.OS === 'ios' && isHealthDataAvailable();
}

export function isHealthKitSupported(): { supported: boolean; reason: string } {
  if (Platform.OS === 'web') {
    return {
      supported: false,
      reason: 'HealthKit is not available on web. Use the mobile app to sync wearable data.',
    };
  }

  if (Platform.OS === 'android') {
    return {
      supported: false,
      reason: 'Apple Health is only available on iOS devices.',
    };
  }

  if (!isHealthDataAvailable()) {
    return {
      supported: false,
      reason: 'Health data is not available on this device.',
    };
  }

  return {
    supported: true,
    reason: 'HealthKit is available on this device.',
  };
}

export async function getStoredPermissions(): Promise<HealthKitPermissions> {
  try {
    const stored = await AsyncStorage.getItem(HEALTHKIT_PERMISSIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as HealthKitPermissions;
      console.log('[HealthKit] Loaded stored permissions:', parsed.overallStatus);
      return parsed;
    }
  } catch (error) {
    console.error('[HealthKit] Error loading permissions:', error);
  }
  return DEFAULT_PERMISSIONS;
}

export async function savePermissions(permissions: HealthKitPermissions): Promise<void> {
  try {
    await AsyncStorage.setItem(HEALTHKIT_PERMISSIONS_KEY, JSON.stringify(permissions));
    console.log('[HealthKit] Permissions saved:', permissions.overallStatus);
  } catch (error) {
    console.error('[HealthKit] Error saving permissions:', error);
  }
}

export async function requestHealthKitPermissions(): Promise<HealthKitPermissions> {
  console.log('[HealthKit] Requesting permissions...');

  const { supported, reason } = isHealthKitSupported();

  if (!supported) {
    console.log('[HealthKit] Not supported:', reason);
    const unavailablePermissions: HealthKitPermissions = {
      activeEnergy: 'unavailable',
      workouts: 'unavailable',
      exerciseMinutes: 'unavailable',
      overallStatus: 'unavailable',
      lastUpdated: new Date().toISOString(),
    };
    await savePermissions(unavailablePermissions);
    return unavailablePermissions;
  }

  // HealthKit deliberately never reports whether the user actually granted READ access
  // (only write/share access is queryable) — the presented sheet completing without error
  // is the only signal available, per Apple's privacy design.
  const requested = await requestAuthorization({
    toRead: [ACTIVE_ENERGY_IDENTIFIER, EXERCISE_TIME_IDENTIFIER, WorkoutTypeIdentifier],
  });

  const status: HealthKitPermissionStatus = requested ? 'authorized' : 'denied';
  const permissions: HealthKitPermissions = {
    activeEnergy: status,
    workouts: status,
    exerciseMinutes: status,
    overallStatus: status,
    lastUpdated: new Date().toISOString(),
  };

  await savePermissions(permissions);
  console.log('[HealthKit] Permission request completed:', status);

  return permissions;
}

export async function checkHealthKitPermissions(): Promise<HealthKitPermissions> {
  const stored = await getStoredPermissions();

  if (stored.overallStatus === 'notDetermined') {
    return stored;
  }

  const { supported } = isHealthKitSupported();
  if (!supported && stored.overallStatus === 'authorized') {
    return {
      ...stored,
      overallStatus: 'unavailable',
      activeEnergy: 'unavailable',
      workouts: 'unavailable',
      exerciseMinutes: 'unavailable',
    };
  }

  return stored;
}

export async function revokeHealthKitPermissions(): Promise<void> {
  console.log('[HealthKit] Clearing local HealthKit preference...');
  // HealthKit does not let apps programmatically revoke access — the user must do this in
  // iOS Settings > Health > Data Access & Devices. This only stops Alchemize from querying.
  await savePermissions(DEFAULT_PERMISSIONS);
  await AsyncStorage.removeItem(HEALTHKIT_LAST_SYNC_KEY);
}

export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(HEALTHKIT_LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export async function setLastSyncTime(time: string): Promise<void> {
  try {
    await AsyncStorage.setItem(HEALTHKIT_LAST_SYNC_KEY, time);
  } catch (error) {
    console.error('[HealthKit] Error saving last sync time:', error);
  }
}

export async function fetchHealthKitWorkouts(
  startDate: Date,
  endDate: Date
): Promise<HealthKitWorkout[]> {
  console.log('[HealthKit] Fetching workouts from', startDate.toISOString(), 'to', endDate.toISOString());

  const permissions = await checkHealthKitPermissions();
  if (permissions.workouts !== 'authorized') {
    console.log('[HealthKit] Workout permissions not granted');
    return [];
  }

  try {
    const workouts = await queryWorkoutSamples({
      filter: { date: { startDate, endDate } },
      limit: 0,
      ascending: false,
    });

    const mapped = workouts.map(mapWorkout);
    console.log('[HealthKit] Found', mapped.length, 'workouts');
    return mapped;
  } catch (error) {
    console.error('[HealthKit] Error fetching workouts:', error);
    return [];
  }
}

export async function fetchHealthKitActivity(date: Date): Promise<HealthKitActivityData | null> {
  console.log('[HealthKit] Fetching activity for', date.toISOString().split('T')[0]);

  const permissions = await checkHealthKitPermissions();
  if (permissions.overallStatus !== 'authorized') {
    console.log('[HealthKit] Permissions not granted for activity');
    return null;
  }

  const dateStr = date.toISOString().split('T')[0];
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  try {
    const [activeEnergyStats, exerciseStats, workouts] = await Promise.all([
      queryStatisticsForQuantity(ACTIVE_ENERGY_IDENTIFIER, ['cumulativeSum'], {
        filter: { date: { startDate: dayStart, endDate: dayEnd } },
      }),
      queryStatisticsForQuantity(EXERCISE_TIME_IDENTIFIER, ['cumulativeSum'], {
        filter: { date: { startDate: dayStart, endDate: dayEnd } },
      }),
      fetchHealthKitWorkouts(dayStart, dayEnd),
    ]);

    return {
      date: dateStr,
      activeEnergyBurned: Math.round(activeEnergyStats.sumQuantity?.quantity ?? 0),
      exerciseMinutes: Math.round(exerciseStats.sumQuantity?.quantity ?? 0),
      workouts,
    };
  } catch (error) {
    console.error('[HealthKit] Error fetching activity:', error);
    return null;
  }
}

export async function syncHealthKitData(): Promise<{
  success: boolean;
  workoutsImported: number;
  message: string;
}> {
  console.log('[HealthKit] Starting sync...');

  const permissions = await checkHealthKitPermissions();

  if (permissions.overallStatus !== 'authorized') {
    return {
      success: false,
      workoutsImported: 0,
      message: 'HealthKit permissions not granted. Please enable in settings.',
    };
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const workouts = await fetchHealthKitWorkouts(startDate, endDate);

  await setLastSyncTime(new Date().toISOString());

  console.log('[HealthKit] Sync complete. Imported', workouts.length, 'workouts');

  return {
    success: true,
    workoutsImported: workouts.length,
    message: `Synced ${workouts.length} workouts from Apple Health`,
  };
}

export function formatWorkoutType(type: string): string {
  const typeMap: Record<string, string> = {
    'HKWorkoutActivityTypeRunning': 'Running',
    'HKWorkoutActivityTypeWalking': 'Walking',
    'HKWorkoutActivityTypeCycling': 'Cycling',
    'HKWorkoutActivityTypeSwimming': 'Swimming',
    'HKWorkoutActivityTypeYoga': 'Yoga',
    'HKWorkoutActivityTypeStrengthTraining': 'Strength Training',
    'HKWorkoutActivityTypeHighIntensityIntervalTraining': 'HIIT',
    'HKWorkoutActivityTypeFunctionalStrengthTraining': 'Functional Training',
    'HKWorkoutActivityTypeCoreTraining': 'Core Training',
    'HKWorkoutActivityTypeElliptical': 'Elliptical',
    'HKWorkoutActivityTypeRowing': 'Rowing',
    'HKWorkoutActivityTypeDance': 'Dance',
    'HKWorkoutActivityTypePilates': 'Pilates',
  };

  return typeMap[type] || type;
}

export function getPermissionStatusLabel(status: HealthKitPermissionStatus): string {
  switch (status) {
    case 'authorized':
      return 'Enabled';
    case 'denied':
      return 'Denied';
    case 'unavailable':
      return 'Unavailable';
    case 'notDetermined':
    default:
      return 'Not Set';
  }
}

export function getPermissionStatusColor(status: HealthKitPermissionStatus): string {
  switch (status) {
    case 'authorized':
      return '#22c55e';
    case 'denied':
      return '#ef4444';
    case 'unavailable':
      return '#6b7280';
    case 'notDetermined':
    default:
      return '#f59e0b';
  }
}
