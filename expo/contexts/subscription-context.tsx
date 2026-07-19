import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  initPurchases,
  checkProEntitlement,
  isPurchasesSupported,
  getAllPackages,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  logIn,
  logOut,
  syncPurchases,
  type PaywallPackage,
} from '@/lib/purchases';
import type { CustomerInfo } from 'react-native-purchases';
import { useAuth } from '@/contexts/auth-context';

interface SubscriptionContextValue {
  isLoading: boolean;
  isPro: boolean;
  monthlyPackage: PaywallPackage | null;
  yearlyPackage: PaywallPackage | null;
  lifetimePackage: PaywallPackage | null;
  allPackages: PaywallPackage[];
  customerInfo: CustomerInfo | null;
  purchase: (pkg: PaywallPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
  logIn: (userId: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [isLoading, setIsLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [monthlyPackage, setMonthlyPackage] = useState<PaywallPackage | null>(null);
  const [yearlyPackage, setYearlyPackage] = useState<PaywallPackage | null>(null);
  const [lifetimePackage, setLifetimePackage] = useState<PaywallPackage | null>(null);
  const [allPackages, setAllPackages] = useState<PaywallPackage[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const loadSubscriptionData = useCallback(async () => {
    if (!isPurchasesSupported()) {
      setIsPro(true);
      return;
    }
    try {
      const [pro, packages, info] = await Promise.all([
        checkProEntitlement(),
        getAllPackages(),
        getCustomerInfo(),
      ]);
      setIsPro(pro);
      setMonthlyPackage(packages.monthly);
      setYearlyPackage(packages.yearly);
      setLifetimePackage(packages.lifetime);
      setAllPackages(packages.all);
      setCustomerInfo(info);
    } catch (error) {
      console.error('[Subscription] Failed to load subscription data:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!isPurchasesSupported()) {
          if (mounted) setIsPro(true);
          return;
        }
        const initialized = await initPurchases(currentUserId);
        if (!initialized) {
          if (mounted) setIsPro(true);
          return;
        }
        await loadSubscriptionData();
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentUserId, loadSubscriptionData]);

  const refresh = useCallback(async () => {
    await loadSubscriptionData();
  }, [loadSubscriptionData]);

  const purchase = useCallback(async (pkg: PaywallPackage): Promise<boolean> => {
    const ok = await purchasePackage(pkg);
    if (ok) {
      setIsPro(true);
      await refresh();
    }
    return ok;
  }, [refresh]);

  const restore = useCallback(async (): Promise<boolean> => {
    const ok = await restorePurchases();
    if (ok) {
      setIsPro(true);
      await refresh();
    }
    return ok;
  }, [refresh]);

  const handleLogIn = useCallback(async (userId: string) => {
    await logIn(userId);
    await syncPurchases();
    await refresh();
  }, [refresh]);

  const handleLogOut = useCallback(async () => {
    await logOut();
    setIsPro(false);
    setCustomerInfo(null);
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      isPro,
      monthlyPackage,
      yearlyPackage,
      lifetimePackage,
      allPackages,
      customerInfo,
      purchase,
      restore,
      refresh,
      logIn: handleLogIn,
      logOut: handleLogOut,
    }),
    [
      isLoading,
      isPro,
      monthlyPackage,
      yearlyPackage,
      lifetimePackage,
      allPackages,
      customerInfo,
      purchase,
      restore,
      refresh,
      handleLogIn,
      handleLogOut,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
