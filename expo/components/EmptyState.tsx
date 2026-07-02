import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Plus } from 'lucide-react-native';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(riseAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 4,
      }),
    ]).start();
  }, [fadeAnim, riseAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: riseAnim }] }]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.actionButton} activeOpacity={0.7}>
          <Plus color="#fff" size={16} />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 16,
    opacity: 0.6,
  },
  title: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  actionText: {
    color: '#a78bfa',
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
