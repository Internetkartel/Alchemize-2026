import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Text } from 'react-native';

import { TouchableOpacity } from '@/components/HapticTouchable';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Settings, RefreshCw, MessageCircle, HelpCircle } from 'lucide-react-native';
import { useSubscription } from '@/contexts/subscription-context';
import { checkProEntitlement, restorePurchases, syncPurchases } from '@/lib/purchases';

export default function CustomerCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPro, customerInfo, refresh } = useSubscription();
  const [busy, setBusy] = useState<string | null>(null);

  const handleRestore = async () => {
    setBusy('restore');
    try {
      const ok = await restorePurchases();
      if (ok) {
        Alert.alert('Success', 'Your purchases have been restored.');
        await refresh();
      } else {
        Alert.alert('No purchases found', 'We could not find an active subscription to restore.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy('sync');
    try {
      await syncPurchases();
      await refresh();
      Alert.alert('Success', 'Purchase data synced successfully.');
    } catch {
      Alert.alert('Error', 'Failed to sync purchases. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleCheckEntitlement = async () => {
    setBusy('check');
    try {
      const hasPro = await checkProEntitlement();
      Alert.alert(
        'Subscription Status',
        hasPro
          ? 'You have an active Alchemize Pro subscription. ✅'
          : 'No active Alchemize Pro subscription found.',
      );
    } finally {
      setBusy(null);
    }
  };

  const formatDate = (timestamp: number | string | undefined) => {
    if (!timestamp) return 'N/A';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const activeEntitlements = customerInfo?.entitlements.active ?? {};

  const entitlementEntries = Object.entries(activeEntitlements);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Center</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={[styles.statusDot, isPro ? styles.statusActive : styles.statusInactive]} />
        <Text style={styles.statusTitle}>
          {isPro ? 'Alchemize Pro Active' : 'Free Plan'}
        </Text>
        <Text style={styles.statusSubtitle}>
          {isPro
            ? 'You have full access to all features.'
            : 'Upgrade to unlock all features.'}
        </Text>
      </View>

      {/* Entitlements */}
      {entitlementEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Entitlements</Text>
          {entitlementEntries.map(([key, value]) => (
            <View key={key} style={styles.entitlementRow}>
              <Text style={styles.entitlementName}>{key}</Text>
              <Text style={styles.entitlementExpiry}>
                Expires: {formatDate(value.expirationDate ?? undefined)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Actions</Text>

        <ActionButton
          icon={<RefreshCw color="#a78bfa" size={18} />}
          label="Restore Purchases"
          onPress={handleRestore}
          isLoading={busy === 'restore'}
        />

        <ActionButton
          icon={<Settings color="#a78bfa" size={18} />}
          label="Sync Purchase Data"
          onPress={handleSync}
          isLoading={busy === 'sync'}
        />

        <ActionButton
          icon={<HelpCircle color="#a78bfa" size={18} />}
          label="Check Subscription Status"
          onPress={handleCheckEntitlement}
          isLoading={busy === 'check'}
        />

        <ActionButton
          icon={<MessageCircle color="#a78bfa" size={18} />}
          label="Contact Support"
          onPress={() => Alert.alert('Contact Support', 'Email us at support@alchemize.app')}
        />
      </View>

      {!isPro && (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => router.push('/paywall')}
          activeOpacity={0.85}
        >
          <Text style={styles.upgradeText}>Upgrade to Pro</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isLoading?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} disabled={isLoading}>
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
      {isLoading ? (
        <ActivityIndicator color="#a78bfa" size="small" />
      ) : (
        <Text style={styles.actionArrow}>›</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0520',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  statusActive: {
    backgroundColor: '#10b981',
  },
  statusInactive: {
    backgroundColor: '#f59e0b',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 6,
  },
  statusSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  entitlementRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  entitlementName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 2,
  },
  entitlementExpiry: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  actionIcon: {
    marginRight: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    fontWeight: '500' as const,
  },
  actionArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '300' as const,
  },
  upgradeButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
