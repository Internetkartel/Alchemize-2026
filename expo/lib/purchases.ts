import { Platform } from 'react-native';

export const ENTITLEMENT_ID = 'pro';

const API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

export function isPurchasesSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getApiKey(): string {
  return Platform.OS === 'ios' ? API_KEY_IOS : API_KEY_ANDROID;
}

async function getPurchases() {
  const mod = await import('react-native-purchases');
  return mod.default;
}

export async function initPurchases(appUserId?: string | null): Promise<boolean> {
  if (!isPurchasesSupported()) return false;
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Purchases] No RevenueCat API key configured — skipping init');
    return false;
  }
  try {
    const Purchases = await getPurchases();
    Purchases.configure({ apiKey, appUserID: appUserId ?? undefined });
    return true;
  } catch (error: unknown) {
    console.error('[Purchases] init failed:', error);
    return false;
  }
}

export async function checkProEntitlement(): Promise<boolean> {
  if (!isPurchasesSupported()) return false;
  try {
    const Purchases = await getPurchases();
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error: unknown) {
    console.error('[Purchases] getCustomerInfo failed:', error);
    return false;
  }
}

export interface PaywallPackage {
  identifier: string;
  title: string;
  priceString: string;
  hasFreeTrial: boolean;
  rcPackage: unknown;
}

export async function getMonthlyPackage(): Promise<PaywallPackage | null> {
  if (!isPurchasesSupported()) return null;
  try {
    const Purchases = await getPurchases();
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.monthly ?? offerings.current?.availablePackages[0];
    if (!pkg) return null;
    return {
      identifier: pkg.identifier,
      title: pkg.product.title,
      priceString: pkg.product.priceString,
      hasFreeTrial: pkg.product.introPrice != null,
      rcPackage: pkg,
    };
  } catch (error: unknown) {
    console.error('[Purchases] getOfferings failed:', error);
    return null;
  }
}

export async function purchasePackage(pkg: PaywallPackage): Promise<boolean> {
  try {
    const Purchases = await getPurchases();
    const { customerInfo } = await Purchases.purchasePackage(
      pkg.rcPackage as Parameters<typeof Purchases.purchasePackage>[0],
    );
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error: unknown) {
    const cancelled =
      typeof error === 'object' && error !== null && (error as { userCancelled?: boolean }).userCancelled;
    if (!cancelled) console.error('[Purchases] purchase failed:', error);
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const Purchases = await getPurchases();
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error: unknown) {
    console.error('[Purchases] restore failed:', error);
    return false;
  }
}
