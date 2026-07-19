import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesStoreProduct, PurchasesStoreProductDiscount } from 'react-native-purchases';

export const ENTITLEMENT_ID = 'pro';

const DEV_FALLBACK_API_KEY = 'test_fWTiPXsQgZVLfKlkuqfYnBRtuLG';
const API_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
    : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;

function getApiKey(): string {
  if (API_KEY) return API_KEY;
  if (__DEV__) {
    console.warn('[Purchases] RevenueCat API key env var not set, using sandbox test key for development only');
    return DEV_FALLBACK_API_KEY;
  }
  throw new Error(
    'RevenueCat API key is not configured. Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS / EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID.'
  );
}

export function isPurchasesSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

async function getPurchases() {
  const mod = await import('react-native-purchases');
  return mod.default;
}

/** Initialize RevenueCat with the API key */
export async function initPurchases(appUserId?: string | null): Promise<boolean> {
  if (!isPurchasesSupported()) return false;
  try {
    const Purchases = await getPurchases();
    Purchases.configure({ apiKey: getApiKey(), appUserID: appUserId ?? undefined });
    // Enable debug logs in development
    if (__DEV__) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
    }
    return true;
  } catch (error: unknown) {
    console.error('[Purchases] init failed:', error);
    return false;
  }
}

/** Check if user has the Pro entitlement */
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

/** Get full customer info (including all entitlements, subscriptions, etc.) */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isPurchasesSupported()) return null;
  try {
    const Purchases = await getPurchases();
    return await Purchases.getCustomerInfo();
  } catch (error: unknown) {
    console.error('[Purchases] getCustomerInfo failed:', error);
    return null;
  }
}

export interface PaywallPackage {
  identifier: string;
  title: string;
  priceString: string;
  description: string;
  hasFreeTrial: boolean;
  freeTrialPeriod: string | null;
  rcPackage: unknown;
}

function mapPackage(pkg: any): PaywallPackage {
  const product = pkg.product;
  const intro = product.introPrice;
  return {
    identifier: pkg.identifier,
    title: product.title || pkg.identifier,
    priceString: product.priceString || '',
    description: product.description || '',
    hasFreeTrial: intro?.price === 0 && intro?.periodNumberOfUnits != null,
    freeTrialPeriod: intro?.price === 0 && intro?.periodNumberOfUnits
      ? `${intro.periodNumberOfUnits} ${intro.periodUnit?.toLowerCase() || 'days'}`
      : null,
    rcPackage: pkg,
  };
}

/** Get all available packages from the current offering */
export async function getAllPackages(): Promise<{
  monthly: PaywallPackage | null;
  yearly: PaywallPackage | null;
  lifetime: PaywallPackage | null;
  all: PaywallPackage[];
}> {
  if (!isPurchasesSupported()) {
    return { monthly: null, yearly: null, lifetime: null, all: [] };
  }
  try {
    const Purchases = await getPurchases();
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    if (!current) {
      console.warn('[Purchases] No current offering available');
      return { monthly: null, yearly: null, lifetime: null, all: [] };
    }

    const all: PaywallPackage[] = (current.availablePackages || []).map(mapPackage);

    const monthly = current.monthly ? mapPackage(current.monthly) : null;
    const yearly = current.annual ? mapPackage(current.annual) : null;
    const lifetime = current.lifetime ? mapPackage(current.lifetime) : null;

    return { monthly, yearly, lifetime, all };
  } catch (error: unknown) {
    console.error('[Purchases] getOfferings failed:', error);
    return { monthly: null, yearly: null, lifetime: null, all: [] };
  }
}

/** Purchase a specific package */
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

/** Purchase a specific product identifier directly */
export async function purchaseProduct(identifier: string): Promise<boolean> {
  try {
    const Purchases = await getPurchases();
    const { customerInfo } = await Purchases.purchaseProduct(identifier);
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error: unknown) {
    const cancelled =
      typeof error === 'object' && error !== null && (error as { userCancelled?: boolean }).userCancelled;
    if (!cancelled) console.error('[Purchases] purchaseProduct failed:', error);
    return false;
  }
}

/** Restore previous purchases */
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

/** Log out the current user (useful for account switching) */
export async function logOut(): Promise<void> {
  try {
    const Purchases = await getPurchases();
    await Purchases.logOut();
  } catch (error: unknown) {
    console.error('[Purchases] logOut failed:', error);
  }
}

/** Sync purchaser info with RevenueCat (useful after login) */
export async function syncPurchases(): Promise<void> {
  try {
    const Purchases = await getPurchases();
    await Purchases.syncPurchases();
  } catch (error: unknown) {
    console.error('[Purchases] syncPurchases failed:', error);
  }
}

/** Get available discounts / intro offers for a product */
export async function getPromotionalOffer(
  product: PurchasesStoreProduct,
  discount: PurchasesStoreProductDiscount,
): Promise<unknown | null> {
  try {
    const Purchases = await getPurchases();
    return await Purchases.getPromotionalOffer(product, discount);
  } catch (error: unknown) {
    console.error('[Purchases] getPromotionalOffer failed:', error);
    return null;
  }
}

/** Set a custom user attribute for RevenueCat */
export async function setAttributes(attributes: Record<string, string | number | boolean>): Promise<void> {
  try {
    const Purchases = await getPurchases();
    await Purchases.setAttributes(attributes as Record<string, string>);
  } catch (error: unknown) {
    console.error('[Purchases] setAttributes failed:', error);
  }
}

/** Set a custom user ID (alias for login) */
export async function logIn(appUserId: string): Promise<CustomerInfo | null> {
  try {
    const Purchases = await getPurchases();
    const { customerInfo } = await Purchases.logIn(appUserId);
    return customerInfo;
  } catch (error: unknown) {
    console.error('[Purchases] logIn failed:', error);
    return null;
  }
}
