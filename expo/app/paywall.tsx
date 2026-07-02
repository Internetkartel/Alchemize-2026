import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { TouchableOpacity } from '@/components/HapticTouchable';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useSubscription } from '@/contexts/subscription-context';

const FEATURES = [
  'Manifestation boards & slideshows',
  'Goals, habits & to-do tracking',
  'Calorie tracking with food scanning',
  'Financial tracker & secure notes',
  'Affirmations with play mode',
  'Fitness & workout library',
];

const FALLBACK_PRICE = '$15.55/month';

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { monthlyPackage, purchase, restore } = useSubscription();
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  const priceLabel = monthlyPackage?.priceString
    ? `${monthlyPackage.priceString}/month`
    : FALLBACK_PRICE;

  const legalUrls = (Constants.expoConfig?.extra?.legalUrls ?? {}) as {
    privacy?: string;
    termsOfService?: string;
  };

  const handlePurchase = async () => {
    setBusy('purchase');
    try {
      const ok = await purchase();
      if (ok) {
        router.replace('/');
      } else if (monthlyPackage) {
        Alert.alert('Purchase not completed', 'Your purchase did not go through. Please try again.');
      } else {
        Alert.alert('Unavailable', 'Subscriptions are not available right now. Please try again later.');
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

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a0a3e', '#0c0520', '#0d1033']} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Sparkles color="#a78bfa" size={40} />
        </View>
        <Text style={styles.title}>Unlock Alchemize Pro</Text>
        <Text style={styles.subtitle}>
          Start your 7-day free trial, then {priceLabel}. Cancel anytime.
        </Text>

        <View style={styles.featureList}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Check color="#10b981" size={18} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handlePurchase}
          disabled={busy !== null}
          activeOpacity={0.85}
          testID="paywall-purchase-button"
        >
          {busy === 'purchase' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.ctaText}>Start 7-Day Free Trial</Text>
              <Text style={styles.ctaSubtext}>then {priceLabel}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRestore} disabled={busy !== null} style={styles.restoreButton}>
          {busy === 'restore' ? (
            <ActivityIndicator color="#a78bfa" size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legalText}>
          Payment is charged to your Apple ID at the end of the free trial. The subscription renews
          automatically at {priceLabel} unless cancelled at least 24 hours before the end of the
          current period. Manage or cancel in your App Store account settings.
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
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  featureList: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    marginBottom: 32,
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
  ctaButton: {
    alignSelf: 'stretch',
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
  ctaSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
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
    color: 'rgba(255,255,255,0.4)',
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
