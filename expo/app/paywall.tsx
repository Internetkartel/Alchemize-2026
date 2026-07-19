import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { TouchableOpacity } from '@/components/HapticTouchable';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Check, Crown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useSubscription } from '@/contexts/subscription-context';
import type { PaywallPackage } from '@/lib/purchases';

const FEATURES = [
  'Manifestation boards & slideshows',
  'Goals, habits & to-do tracking',
  'Calorie tracking with food scanning',
  'Financial tracker & secure notes',
  'Affirmations with play mode',
  'Fitness & workout library',
  'Unlimited entries & boards',
  'Priority support',
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    monthlyPackage,
    yearlyPackage,
    lifetimePackage,
    allPackages,
    purchase,
    restore,
  } = useSubscription();
  const [busy, setBusy] = useState<string | null>(null);

  const legalUrls = (Constants.expoConfig?.extra?.legalUrls ?? {}) as {
    privacy?: string;
    termsOfService?: string;
  };

  const handlePurchase = async (pkg: PaywallPackage) => {
    setBusy(pkg.identifier);
    try {
      const ok = await purchase(pkg);
      if (ok) {
        router.replace('/');
      } else {
        Alert.alert('Purchase not completed', 'Your purchase did not go through. Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    setBusy('restore');
    try {
      const ok = await restore();
      if (ok) {
        router.replace('/');
      } else {
        Alert.alert('No purchases found', 'We could not find an active subscription to restore.');
      }
    } finally {
      setBusy(null);
    }
  };

  const renderPackage = (pkg: PaywallPackage | null, label: string, badge?: string) => {
    if (!pkg) return null;
    const isBusy = busy === pkg.identifier;
    const hasTrial = pkg.hasFreeTrial && pkg.freeTrialPeriod;

    return (
      <TouchableOpacity
        key={pkg.identifier}
        style={styles.planCard}
        onPress={() => handlePurchase(pkg)}
        disabled={isBusy || busy !== null}
        activeOpacity={0.85}
      >
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.planLabel}>{label}</Text>
        <Text style={styles.planPrice}>{pkg.priceString}</Text>
        {hasTrial ? (
          <Text style={styles.trialText}>Free trial: {pkg.freeTrialPeriod}</Text>
        ) : null}
        <Text style={styles.planDescription}>{pkg.description}</Text>
        {isBusy ? (
          <ActivityIndicator color="#a78bfa" style={{ marginTop: 8 }} />
        ) : (
          <View style={styles.selectButton}>
            <Text style={styles.selectButtonText}>Select</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a0a3e', '#0c0520', '#0d1033']} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Crown color="#a78bfa" size={32} />
        </View>
        <Text style={styles.title}>Unlock Alchemize Pro</Text>
        <Text style={styles.subtitle}>
          Choose the plan that works for you. Cancel anytime.
        </Text>

        {/* Plans */}
        <View style={styles.plansRow}>
          {renderPackage(monthlyPackage, 'Monthly')}
          {renderPackage(yearlyPackage, 'Yearly', 'Best Value')}
        </View>
        {renderPackage(lifetimePackage, 'Lifetime', 'One-Time')}

        {/* Features */}
        <View style={styles.featureList}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Check color="#10b981" size={18} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} disabled={busy !== null} style={styles.restoreButton}>
          {busy === 'restore' ? (
            <ActivityIndicator color="#a78bfa" size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        {/* Legal */}
        <Text style={styles.legalText}>
          Subscriptions automatically renew unless cancelled at least 24 hours before the end of the
          current period. Manage or cancel in your account settings.
        </Text>

        <View style={styles.legalLinks}>
          {legalUrls.termsOfService ? (
            <TouchableOpacity onPress={() => Linking.openURL(legalUrls.termsOfService as string)}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </TouchableOpacity>
          ) : null}
          {legalUrls.privacy ? (
            <TouchableOpacity onPress={() => Linking.openURL(legalUrls.privacy as string)}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0520',
  },
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  plansRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  planLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 4,
  },
  trialText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  planDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 12,
  },
  selectButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  selectButtonText: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  featureList: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    marginBottom: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  restoreButton: {
    paddingVertical: 12,
    marginBottom: 20,
  },
  restoreText: {
    fontSize: 15,
    color: '#a78bfa',
    fontWeight: '600' as const,
  },
  legalText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    gap: 24,
  },
  legalLink: {
    fontSize: 13,
    color: 'rgba(167,139,250,0.8)',
    textDecorationLine: 'underline',
  },
});
