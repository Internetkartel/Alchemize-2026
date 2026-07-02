# Alchemize Pro Subscription — Setup Guide

The app is wired for a **7-day free trial → $15.55/month** subscription via RevenueCat.
Code is complete; the price and trial are configured in App Store Connect + RevenueCat
(not in code). Follow these one-time steps:

## 1. App Store Connect

1. Create the app record (bundle ID: `app.repo.alchemize-level-up`).
2. Go to **Monetization → Subscriptions** and create a Subscription Group (e.g. "Alchemize Pro").
3. Add an **Auto-Renewable Subscription**:
   - Product ID: `alchemize_pro_monthly`
   - Duration: **1 month**
   - Price: **$15.55 USD**
4. Add an **Introductory Offer** to that product:
   - Type: **Free trial**, Duration: **1 week (7 days)**
5. Fill in localization + review screenshot (required for review).

## 2. RevenueCat (app.revenuecat.com)

1. Create a project → add an **iOS app** with the same bundle ID.
2. Connect App Store Connect via the App Store Connect API key (RevenueCat guides you).
3. **Entitlements**: create entitlement with identifier `pro` (must match `ENTITLEMENT_ID` in `lib/purchases.ts`).
4. **Products**: import `alchemize_pro_monthly`, attach it to the `pro` entitlement.
5. **Offerings**: create/keep the `default` offering, add the monthly product as its **Monthly** package.
6. Copy the **public iOS API key** (starts with `appl_`).

## 3. Wire the API key

- Local dev: create `.env` with `EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxx`
- EAS builds: replace the placeholder in `eas.json` → `build.production.env`,
  or better: `eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx`

## Behavior in code

- `contexts/subscription-context.tsx` initializes RevenueCat at app start and exposes `useSubscription()`.
- `PaywallGate` in `app/_layout.tsx` redirects signed-in users without the `pro`
  entitlement to `app/paywall.tsx`.
- **Fail-open**: on web, or when no API key is configured (local dev), the paywall is skipped
  so the app stays usable. On real iOS builds with the key set, the paywall is enforced.
- Restore Purchases and legal links (required by App Review) are on the paywall.

## Test

Use a Sandbox tester account (App Store Connect → Users and Access → Sandbox) on a TestFlight
build. Sandbox trials renew every few minutes instead of monthly.
