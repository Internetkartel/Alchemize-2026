import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  initPurchases,
  checkProEntitlement,
  isPurchasesSupported,
  getMonthlyPackage,
  purchasePackage,
  restorePurchases,
  type PaywallPackage,
} from '@/lib/purchases';

interface SubscriptionContextValue {
  isLoading: boolean;
  isPro: boolean;
  monthlyPackage: PaywallPackage | null;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [monthlyPackage, setMonthlyPackage] = useState<PaywallPackage | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!isPurchasesSupported()) {
          // Web / unsupported platforms: don't block the app behind a paywall.
          if (mounted) setIsPro(true);
          return;
        }
        const initialized = await initPurchases();
        if (!initialized) {
          // Missing API key (e.g. local dev) — fail open so the app stays usable.
          if (mounted) setIsPro(true);
          return;
        }
        const [pro, pkg] = await Promise.all([checkProEntitlement(), getMonthlyPackage()]);
        if (mounted) {
          setIsPro(pro);
          setMonthlyPackage(pkg);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isPurchasesSupported()) return;
    setIsPro(await checkProEntitlement());
  }, []);

  const purchase = useCallback(async () => {
    if (!monthlyPackage) return false;
    const ok = await purchasePackage(monthlyPackage);
    if (ok) setIsPro(true);
    return ok;
  }, [monthlyPackage]);

  const restore = useCallback(async () => {
    const ok = await restorePurchases();
    if (ok) setIsPro(true);
    return ok;
  }, []);

  const value = useMemo(
    () => ({ isLoading, isPro, monthlyPackage, purchase, restore, refresh }),
    [isLoading, isPro, monthlyPackage, purchase, restore, refresh],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
