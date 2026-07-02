import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, ViewStyle, StyleProp, GestureResponderEvent } from 'react-native';
import { hapticLight } from '@/lib/haptics';

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  /** Scale when pressed. Defaults to 0.97 for a subtle, premium feel. */
  pressedScale?: number;
  /** Fire a light haptic on press. Defaults to true. */
  haptic?: boolean;
  disabled?: boolean;
  testID?: string;
}

/**
 * A Pressable with a soft spring scale-down on touch — the native iOS
 * "squish" feel — plus optional light haptic feedback.
 */
export default function PressableScale({
  children,
  onPress,
  style,
  pressedScale = 0.97,
  haptic = true,
  disabled = false,
  testID,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: pressedScale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scale, pressedScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }, [scale]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (haptic) hapticLight();
      onPress?.(event);
    },
    [haptic, onPress]
  );

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
