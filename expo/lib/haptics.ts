import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Light tap feedback — safe on all platforms (no-op on web). */
export function hapticLight(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium press feedback for primary actions. */
export function hapticMedium(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Selection tick for pagers, pickers, and segmented controls. */
export function hapticSelection(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

/** Success notification feedback after saves/completions. */
export function hapticSuccess(): void {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
