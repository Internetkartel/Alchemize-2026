# Security Audit Triage Backlog

**Audit Date:** 2026-08-07  
**Current Head:** a0f412c5e3cfdd0e4891d08c90c5c8fb16a847ec  
**Classification:** Ready for Controlled Device QA (not production-certified)  
**Overall Readiness:** 6.4/10

---

## Fix Now (Immediate, Scoped, High Confidence)

These are confirmed defects with limited scope and clear remediation. No external-service verification required before code change.

### HIGH SEVERITY

#### 1. API routes not blocked during SurrealDB startup
**Status:** Defect confirmed  
**Scope:** ~15 lines, middleware layer  
**Risk if not fixed:** Requests fail with 500 errors instead of 503 while database initializes

**Current state:**
- Root `/` returns 503 when SurrealDB not ready ✓
- tRPC middleware registered before readiness check ✗
- `/api/trpc/*` routes bypass readiness guard ✗

**Fix approach:**
- Add global middleware that blocks all routes (except health/status) when `surrealReady === false`
- Return HTTP 503 Service Unavailable
- Wire readiness check into hono middleware chain before tRPC router

**Acceptance:**
- All tRPC endpoints return 503 until SurrealDB ready
- Health endpoint remains reachable to check status
- Startup sequence logged for verification

---

#### 2. Production backend startup does not fail if SurrealDB never connects
**Status:** Defect confirmed  
**Scope:** ~20 lines, main initialization  
**Risk if not fixed:** Silent production failure; app appears healthy but is non-functional

**Current state:**
- Backend starts even if SurrealDB init fails
- Error stored in `surrealInitError` but not enforced
- No production-mode startup guard

**Fix approach:**
Option A (preferred):
```
await initSurrealDB(); // throws if fails
serve(app, { port: 3000 });
```

Option B (if async init needed):
- Add environment check: `if (NODE_ENV === 'production' && surrealInitError) { process.exit(1) }`
- Timeout SurrealDB init to 10s; fail startup on timeout
- Log error and exit code clearly

**Acceptance:**
- Backend refuses to start if SurrealDB cannot connect in production
- Development mode may run degraded (optional, needs decision)
- Startup logs show initialization order clearly

---

#### 3. Image upload logs expose user identity and file paths
**Status:** Defect confirmed  
**Scope:** ~10 lines, logging redaction  
**Risk if not fixed:** User IDs and storage paths visible in logs; privacy/compliance issue

**Current state:**
```
console.log(`original filename: ${originalFileName}`)
console.log(`storage path: ${storageFilePath}`)
console.log(`user-scoped storage: users/${userId}/uploads/...`)
```

**Fix approach:**
- Remove or redact filename logging entirely
- If logging needed for debugging, use placeholder: `storagePath: [REDACTED]`
- Never log user ID or full path to logs
- Add environment check: skip logs in production unless `DEBUG_UPLOADS=true`

**Acceptance:**
- No user ID visible in default logs
- No storage paths visible in default logs
- Debug mode can be explicitly enabled in development only

---

#### 4. CI not pinned to repository's declared Bun version
**Status:** Defect confirmed  
**Scope:** 1-2 line change  
**Risk if not fixed:** Non-deterministic CI; different bun versions produce different outputs

**Current state:**
```yaml
bun-version: latest  # ← breaks reproducibility
```

**Fix approach:**
```yaml
bun-version: 1.3.14  # matches package.json "packageManager"
```

**Acceptance:**
- CI uses exact Bun version declared in package.json
- All runs use same toolchain
- Reproducibility documented in CI README

---

#### 5. Package scripts mix npm, npx, and Bun inconsistently
**Status:** Defect confirmed  
**Scope:** ~15 lines, package.json  
**Risk if not fixed:** CI failures on local machines; scripts may not work across platforms

**Current state:**
```json
"ci:local": "npm run validate:final && npx expo-doctor && npm run lint",
"ci:audit": "npm audit --audit-level=moderate"
```

**Fix approach:**
- Standardize on **Bun** as primary executor (declared in packageManager)
- Replace `npm run X` → `bun run X`
- Replace `npx X` → `bun X`
- Update CI to use `bun install` and `bun run`
- Document in README: "All scripts assume Bun 1.3.14+"

**Acceptance:**
- All scripts use consistent executor
- No npm/npx calls in scripts
- CI and local `bun run` produce same results

---

#### 6. Image upload still uses timestamp + user filename (information disclosure)
**Status:** Defect confirmed  
**Scope:** ~5 lines, upload handler  
**Risk if not fixed:** Filename patterns leak user behavior; not as severe as direct path exposure, but still unnecessary

**Current state:**
```
users/${userId}/uploads/${timestamp}-${safeName}
```

**Fix approach:**
```
users/${userId}/uploads/${uuid()}
```
with optional `.jpg` extension if needed for storage.

**Acceptance:**
- No original filename or timestamp in storage path
- File retrieval still works (metadata stored separately if needed)
- Storage listing reveals no information

---

#### 7. Image resize forced to 1600x1600 without aspect-ratio tests
**Status:** Defect confirmed  
**Scope:** ~20 lines, resize config + new test  
**Risk if not fixed:** Images distorted, cropped, or upscaled unexpectedly; poor UX for portrait/landscape uploads

**Current state:**
```js
resize: { width: 1600, height: 1600 }  // forces square
```

**Fix approach:**
1. Check Expo Image Manipulator behavior for aspect-ratio preservation
2. If it forces square, switch to aspect-ratio-preserving:
   ```js
   const maxDim = 1600;
   const scale = Math.min(maxDim / width, maxDim / height);
   resize: { width: width * scale, height: height * scale }
   ```
3. Add focused tests for:
   - Portrait (3:4)
   - Landscape (16:9)
   - Square (1:1)
   - Sub-1600px inputs (verify no upscaling)

**Acceptance:**
- Aspect ratio preserved for all orientations
- No upscaling of small images
- Tests verify all cases pass

---

#### 8. Unknown original file size bypasses max-size check
**Status:** Defect confirmed  
**Scope:** ~5 lines, validation  
**Risk if not fixed:** Malformed files or unexpectedly large files proceed to upload; storage/quota abuse

**Current state:**
```js
const originalSize = (await getInfoAsync(uri))?.size || 0;  // 0 is falsy but proceeds
if (originalSize > MAX_SIZE) throw; // passes if size is 0
```

**Fix approach:**
```js
const info = await getInfoAsync(uri);
if (!info?.size) throw new Error('Cannot determine file size');
if (info.size > MAX_SIZE) throw new Error('File too large');
```

**Acceptance:**
- Upload fails if file size cannot be determined
- No zero-size files slip through
- Error message clear to user

---

### MEDIUM SEVERITY

#### 9. CORS allowlist hardcoded (not environment-driven)
**Status:** Defect confirmed  
**Scope:** ~10 lines, move to env var  
**Risk if not fixed:** Staging/preview deployments cannot use different origins without code change

**Current state:**
```js
const allowedOrigins = ['https://alchemize.app', 'http://localhost:3000'];
```

**Fix approach:**
```js
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
```

**Production config requirement:**
```
ALLOWED_ORIGINS=https://alchemize.app,https://preview.alchemize.app
```

**Acceptance:**
- ALLOWED_ORIGINS read from environment
- Production startup fails if variable missing
- Can change origins per deployment

---

#### 10. iOS microphone usage description may be unnecessary
**Status:** Likely defect  
**Scope:** ~2 lines, remove or verify  
**Risk if not fixed:** App Store may flag unused permission as deceptive practice

**Current state:**
```json
"NSMicrophoneUsageDescription": "..."
```

**Fix approach:**
1. Grep codebase for any audio-recording usage
2. If none found: remove `NSMicrophoneUsageDescription` from app.json
3. If found: document why it's needed

**Acceptance:**
- iOS plist matches actual features
- No unused permissions declared
- Test on physical iPhone to confirm audio features (if any) still work

---

#### 11. Android exact-alarm permission needs policy justification
**Status:** Questionable defect  
**Scope:** Review + documentation  
**Risk if not fixed:** Play Store may reject or app may be flagged for excessive wake-ups

**Current state:**
```json
"SCHEDULE_EXACT_ALARM"
```

**Fix approach:**
1. Inspect notification/reminder code: does it use exact-alarm APIs?
2. If yes: document why exact timing is required (e.g., medication reminders)
3. If no: remove permission and use normal scheduled notifications
4. Submit app with policy statement if needed

**Acceptance:**
- Permission justified by actual use case
- Or permission removed and notification scheduling works
- Play Store review passes

---

#### 12. SQLCipher disabled on Android (platform-specific encryption model)
**Status:** Defect, needs decision  
**Scope:** Database init config + migration testing  
**Risk if not fixed:** Android users' financial/health data at different security level than iOS

**Current state:**
- iOS: SQLCipher enabled ✓
- Android: SQLCipher disabled ✗

**Fix approach (choose one):**

Option A: Enable SQLCipher on Android
- Test full database encryption/decryption on a physical Android device
- Verify app startup time acceptable
- Verify offline behavior works
- Plan migration for existing unencrypted databases

Option B: Document reliance on platform sandbox
- Add README section: "Data Security Model"
- Explain Android encryption relies on device encryption + app sandbox
- Justify decision for financial/health data (compliance review needed)

Option C: Encrypt sensitive fields separately
- Use NaCl or similar for field-level encryption independent of SQLCipher
- Slower but works on both platforms

**Acceptance (pick one path):**
- SQLCipher works on Android with migration tested, or
- Security model documented and compliance reviewed, or
- Field-level encryption implemented and tested

---

#### 13. No maintained automated regression test suite
**Status:** Defect confirmed  
**Scope:** Create package.json test script + baseline  
**Risk if not fixed:** Future changes break critical paths without detection

**Current state:**
- Delete-account test mentioned but not in package.json
- No `npm test` or `bun test` defined
- No test runner visible (Jest? Vitest? Bun's native?)

**Fix approach:**
1. Declare test framework preference (recommend Bun native or Vitest)
2. Add `"test": "bun test"` to package.json
3. Add focused regression tests for:
   - Delete account (cross-user isolation)
   - Authentication (protected procedures reject unauthenticated)
   - Image upload (file created, signed URL generated)
   - Notification scheduling (local state correct)
4. CI runs `bun test` on every PR

**Acceptance:**
- `bun test` runs cleanly
- At least 5 regression tests present
- CI enforces tests passing

---

#### 14. No CI explicit token permissions
**Status:** Defect confirmed  
**Scope:** ~3 lines, GitHub Actions  
**Risk if not fixed:** CI defaults to overly-broad token scope; larger attack surface

**Current state:**
```yaml
# No permissions specified
```

**Fix approach:**
```yaml
permissions:
  contents: read
  # other permissions as needed (checks, pull-requests, etc.)
```

**Acceptance:**
- CI defines minimal token permissions
- Token scoped to only what's needed
- Documented in workflow comments

---

#### 15. CI lacks timeouts and concurrency control
**Status:** Defect confirmed  
**Scope:** ~5 lines, workflow config  
**Risk if not fixed:** Long-running jobs block other PRs; runaway CI consumes credits

**Current state:**
- No job timeout
- No concurrency/cancel-in-progress

**Fix approach:**
```yaml
jobs:
  validate:
    timeout-minutes: 10  # or appropriate for your setup
    
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Acceptance:**
- Jobs timeout if stuck
- Only latest PR run executes; older runs cancelled
- CI time/cost reduced

---

#### 16. Repository still contains multiple Android roots without ownership rules
**Status:** Defect confirmed  
**Scope:** README clarity + cleanup (optional)  
**Risk if not fixed:** Confusion about which Android project is active; stale code becomes maintenance burden

**Current state:**
- `/expo` (active Expo project)
- `/android` or similar (possibly legacy)
- Ambiguity in README

**Fix approach:**
Add **Repository Structure** section to README:

```markdown
## Repository Structure

- **`/expo`** — Active Expo + React Native app. This is the authoritative app root.
- **`/android`** — Legacy Android project (not maintained; kept for reference only).
- **`/docs`** — Documentation and design files.

CI validates only `/expo`. Do not commit changes to `/android` without discussing in #dev-team.
```

**Acceptance:**
- README clearly identifies active app root
- Developers know not to edit legacy Android project
- No confusion on CI validation scope

---

#### 17. Backend has no production build/start contract
**Status:** Defect confirmed  
**Scope:** ~20 lines, build script + documentation  
**Risk if not fixed:** Backend deployment ambiguous; ops team uncertain how to run backend

**Current state:**
- Start: `tsx backend/server.ts` (ad hoc)
- No build step defined
- No production-vs-dev branching

**Fix approach:**
Add to `package.json`:
```json
"scripts": {
  "backend:build": "tsc --noEmit",  // or esbuild if preferred
  "backend:dev": "tsx backend/server.ts",
  "backend:start": "node backend/server.js"  // requires build first
}
```

Add to backend README:
```markdown
## Deployment

Production:
1. `bun run backend:build`
2. Set `NODE_ENV=production JWT_SECRET=... SURREALDB_URL=...`
3. `bun run backend:start`

Development:
1. `bun run backend:dev`
```

**Acceptance:**
- Clear build artifact production
- Clear environment variable contract for production
- Ops can deploy confidently

---

#### 18. App identifiers retain generator-oriented naming
**Status:** Defect (but verify before changing)  
**Scope:** app.json + native config  
**Risk if not fixed:** Store identity inconsistent; may affect deep linking, redirects, in-app purchases

**Current state:**
```json
"scheme": "rork-app",
"android": { "package": "app.rork.alchemize_app_skeleton" },
"ios": { "bundleIdentifier": "app.repo.alchemize-level-up" }
```

**Status:** Do not change without verifying:
- Live store app identities (App Store, Google Play)
- Any deep-link registrations (OAuth redirects, branch.io, etc.)
- RevenueCat bundle identity configuration
- Any existing installs relying on this package ID for updates

**Decision needed:**
- Keep legacy identifiers for compatibility with existing installs, or
- Decide on new identifiers and plan migration (requires staged rollout)

---

## Verify Before Changing

These findings require external-service or device verification before code change. Create test specs; do not modify code yet.

### Supabase Configuration & Behavior

#### V1. Supabase bucket must be private
**Audit finding:** Code uses signed URLs, but bucket may still be public  
**Test spec:**
1. In Supabase dashboard, verify `uploads` bucket is set to **Private** (not Public)
2. Attempt unsigned fetch to a signed URL after expiry → verify 403 Forbidden
3. Verify authenticated user can fetch before expiry → 200 OK
4. Log results and attach screenshot

**Decision gate:** Do not assume bucket privacy from code; verify via dashboard.

---

#### V2. Supabase Storage ownership policies
**Audit finding:** Code checks ownership, but RLS/policies not inspected  
**Test spec:**
1. In Supabase dashboard, check Storage policies for `uploads` bucket
2. Verify policy restricts `INSERT/UPDATE/DELETE` to `auth.uid() == owner_id`
3. Verify policy allows `SELECT` only on user's own objects (or no SELECT via policy, rely on signed URLs)
4. Create test with User A uploading → verify User B cannot fetch unsigned URL
5. Log policy text and test results

**Decision gate:** Verify storage policies match code assumptions.

---

#### V3. Supabase table RLS (Row Level Security)
**Audit finding:** Backend enforces ownership, but RLS not verified  
**Test spec:**
1. For each sensitive table (goals, appointments, health_data, etc.):
   - Check RLS is enabled
   - Check policy restricts `SELECT/UPDATE/DELETE` to `auth.uid() = user_id`
   - Check test cases: User A can see own row, User B cannot see User A's row
2. Log all policies and test results
3. Document any tables without RLS and why (if intentional)

**Decision gate:** Verify RLS on all multi-user tables.

---

### Account Deletion & Cloud Cleanup

#### V4. Complete cloud data deletion
**Audit finding:** Local SQLite deletion fixed, but cloud deletion not verified  
**Test spec:**
1. Create test account, upload image, create goals, sync to cloud
2. Trigger "Delete Account" from app
3. Verify:
   - Local SQLite records deleted (already tested)
   - Supabase Storage: image file gone
   - Supabase database: all user rows deleted
   - SurrealDB: user records deleted (if used)
   - RevenueCat: customer record handled (validate subscription cancellation if active)
4. Attempt login with deleted account → verify failure
5. Document results and any manual cleanup needed

**Decision gate:** Verify cloud services fully clean up on account deletion.

---

#### V5. Backup/snapshot data
**Audit finding:** No inspection of Supabase backups  
**Test spec:**
1. Check Supabase project settings: backup schedule and retention
2. Verify deleted-account data is not in latest backup (or backups expire after policy period)
3. Check if any export/backup procedures exist and whether they include deleted accounts
4. Document backup policy

**Decision gate:** Verify backup/restore procedures do not resurrect deleted accounts.

---

### Authentication & Authorization

#### V6. Object-level authorization across all endpoints
**Audit finding:** Protected procedures exist, but ownership checks not systematically verified  
**Test spec:**
1. Create test users A and B
2. For each sensitive mutation (update goal, delete appointment, etc.):
   - User A owns object → update succeeds
   - User B does not own object → update fails with 403 or UNAUTHORIZED
3. For each read endpoint:
   - User can read own data
   - User cannot read other user's data (query returns empty or 403)
4. Test cases:
   - Direct API calls (curl)
   - App client calls (authenticated)
   - Unauthenticated calls (should fail)
5. Log all test results

**Decision gate:** Verify every sensitive endpoint enforces object ownership.

---

#### V7. JWT production secret enforcement
**Audit finding:** Random secret used if `JWT_SECRET` absent  
**Test spec:**
1. Run backend without `JWT_SECRET` set
2. Verify startup **fails** with clear error message (production mode only)
3. Set `NODE_ENV=development` and verify app can start without secret (expected)
4. Document required env var in deployment guide

**Decision gate:** Verify production refuses to start without persistent JWT secret.

---

### External Services

#### V8. RevenueCat subscription flow
**Audit finding:** Init failure previously caused silent free access; fixed, but behavior not verified  
**Test spec:**
1. On physical iOS device:
   - Fresh install, no existing subscription
   - Tap subscription button → verify App Store prompt appears
   - Complete purchase → verify app grants Pro access
   - Kill app, relaunch → verify Pro status persists
2. Test restore:
   - Install on second device
   - Tap "Restore Purchases" → verify existing subscription recognized
3. Test failure:
   - Simulate offline during purchase → verify app does not grant access
   - Verify clear error message to user
4. Document results

**Decision gate:** Verify subscription flow works on physical device.

---

#### V9. HealthKit permission and data import
**Audit finding:** Permissions declared, but actual device behavior not tested  
**Test spec:**
1. On physical iOS device:
   - Fresh install, no prior HealthKit permission
   - Tap "Connect Health" → verify system permission prompt appears
   - Grant permission → verify app can read steps/heart rate
   - Revoke permission in Settings → verify app gracefully handles denial
2. Test data import:
   - Import 30 days of step data → verify displayed correctly
   - Verify no PII logged in app console
3. Test persistence:
   - Kill app and relaunch → verify imported data still visible
   - Uninstall and reinstall → verify HealthKit must be re-authorized (expected)
4. Document results

**Decision gate:** Verify HealthKit integration works on physical device.

---

#### V10. Offline sync and retry
**Audit finding:** Code exists but behavior not verified under realistic offline conditions  
**Test spec:**
1. On device or simulator:
   - Toggle airplane mode ON
   - Create new goal/appointment
   - Verify data saved locally (SQLite)
   - Toggle airplane mode OFF
   - Wait 30s → verify data syncs to cloud
2. Test partial failure:
   - Create goal, partial upload fails
   - Toggle offline → verify app does not lose data
   - Toggle online → verify retry succeeds
3. Test conflict:
   - Edit goal on device A offline
   - Edit same goal on device B online
   - Bring device A online → verify conflict handling (last-write-wins? UI prompt?)
4. Document retry behavior and any manual intervention needed

**Decision gate:** Verify offline sync works without data loss.

---

### Native Builds

#### V11. Full iOS archive build
**Audit finding:** Expo exports and CI bundles JavaScript; native compilation not verified  
**Test spec:**
1. On Mac with Xcode:
   - `bun run eas build --platform ios`
   - Verify build succeeds (takes ~30-45 min on EAS)
   - Verify HealthKit entitlements are present in .xcarchive
   - Verify provisioning profile matches Bundle ID
2. If using local Xcode:
   - `cd ios && pod install`
   - `xcodebuild archive -scheme Alchemize ...`
   - Verify archive succeeds
3. Test simulator:
   - Run on iOS 17+ simulator
   - Verify app launches, core flows work
4. Document build errors and workarounds

**Decision gate:** Verify iOS archive builds and app runs on simulator.

---

#### V12. Full Android APK/AAB build
**Audit finding:** Expo exports and CI bundles JavaScript; native compilation not verified  
**Test spec:**
1. On machine with Android SDK:
   - `bun run eas build --platform android`
   - Verify build succeeds (takes ~20-30 min on EAS)
   - Download resulting APK/AAB
2. Test on physical Android device (API 30+):
   - `adb install app.apk`
   - Verify app launches
   - Verify core flows work (goals, health data if available)
   - Verify notifications trigger correctly
   - Verify exact-alarm permission does not cause excessive wake-ups
3. Test on Play Store staging:
   - Upload APK to internal testing track
   - Verify Play Console accepts it
   - Test install from Play Store (staging)
4. Document build errors and workarounds

**Decision gate:** Verify Android APK builds and app runs on physical device.

---

### Privacy & Compliance

#### V13. Production privacy/terms URLs
**Audit finding:** URLs may be stale or missing  
**Test spec:**
1. Check app config for privacy/terms URLs:
   - Verify URLs in code/app.json point to real pages
   - Verify pages are accessible and in English (or localized per user language)
   - Verify pages are up-to-date and mention:
     - Data collection practices
     - HealthKit data usage (if applicable)
     - RevenueCat integration
     - Supabase storage
     - Data deletion policy
2. Legal review:
   - Have legal review for GDPR (EU users), CCPA (CA users), HIPAA (if health data)
   - Verify account deletion matches stated privacy practices
3. Document URLs and review date

**Decision gate:** Verify privacy/terms are accurate and accessible.

---

### Store Release

#### V14. App Store Connect identity and entitlements
**Audit finding:** Bundle ID set, but store configuration not verified  
**Test spec:**
1. In App Store Connect:
   - Verify app identifier matches `ios.bundleIdentifier` in code
   - Verify HealthKit entitlements are enabled (if needed)
   - Verify capabilities (push notifications, in-app purchase) are enabled
   - Verify provisioning profile is current
2. Verify certificate:
   - Code signing certificate is current (not expired)
   - Distribution certificate matches signing identity
3. Document app ID and capabilities

**Decision gate:** Verify App Store app identity matches code and all capabilities are enabled.

---

#### V15. Google Play Console identity and policies
**Audit finding:** Package ID set, but store configuration not verified  
**Test spec:**
1. In Google Play Console:
   - Verify app's package name matches `android.package` in code
   - Verify app is in closed testing or internal testing (not public)
   - Verify all required permissions are justified:
     - SCHEDULE_EXACT_ALARM (justify or remove)
     - Camera (justify)
     - Any others shown in manifest
   - Verify privacy policy linked and adequate
2. Verify signing:
   - Upload key certificate fingerprint recorded
   - Key store file backed up securely
3. Document package name and signing details

**Decision gate:** Verify Play Console app matches code and all permissions justified.

---

#### V16. In-app purchase production setup
**Audit finding:** RevenueCat configured, but store setup not verified  
**Test spec:**
1. In App Store Connect:
   - Verify subscription product ID matches code (app.rork.pro? check `sku`)
   - Verify subscription renewal terms are clear
   - Verify price point set for target regions
2. In Google Play Console:
   - Verify subscription product ID matches code
   - Verify price set for target regions
   - Verify auto-renewal disclosure present
3. In RevenueCat dashboard:
   - Verify API keys for both stores are valid (test mode and production)
   - Verify entitlements correctly map to store products
   - Verify webhook URLs configured (if needed for server-side verification)
4. Test flow:
   - Purchase on staging/internal test → verify RevenueCat sees it
   - Restore on second device → verify subscription recognized
5. Document product IDs and entitlement mapping

**Decision gate:** Verify in-app purchase setup consistent across all three systems.

---

## Defer as Hardening

These are valuable improvements but do not block controlled device QA or interim releases. Schedule for post-MVP hardening phase.

### CI & Build Hardening

- Add `contents: read` and other minimal GitHub Actions permissions explicitly
- Pin all GitHub Actions to commit SHAs (not `@main` or `@v1`)
- Add job-level timeouts (10-15 min depending on actual run times)
- Add concurrency/cancel-in-progress to prevent CI queue buildup
- Add native Gradle build step (iOS `xcodebuild`, Android `gradlew assembleDebug`)
- Add pre-flight Expo Doctor check as explicit CI step (currently implicit)
- Add dependency/secret scanning (Dependabot or similar)
- Separate pre-merge checks (fast linting/type-check) from full-build checks (slower native builds)

### Authorization & Security Hardening

- Systematic object-level authorization audit across all tRPC procedures (create tests)
- Bearer token parsing RFC 7235 compliance (case-insensitive scheme)
- Rate limiting on API endpoints (especially auth endpoints)
- CSRF protection if adding browser-based access
- Secure HTTP headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Rotation policy for JWT signing key
- Access logging for sensitive operations

### Data & Compliance

- Document data retention and deletion policies
- Implement data export (GDPR Article 15 right to access)
- Implement proper error handling for GDPR/CCPA requests
- Review and document cookie/tracking practices (if any)
- Compliance audit for HealthKit usage (Apple requires specific safeguards)
- HIPAA assessment if health data warrants it

### Architecture & Maintainability

- Extract data sync logic into separate module/service (currently mixed with UI)
- Document authority boundaries between SQLite, Supabase, SurrealDB, RevenueCat
- Remove or document legacy Android project
- Add architecture decision records (ADRs) for:
  - Why three data sources (SQLite/Supabase/SurrealDB)?
  - Why SurrealDB (vs Supabase alone)?
  - When does offline-first matter vs. cloud-first?
- Add deployment runbook for ops team

### Release & DevOps

- Create automated release checklist (pre-release script that verifies all gates)
- Plan staged rollout strategy (internal → closed beta → wider beta → public)
- Set up crash/error reporting dashboard (Sentry, Datadog, or similar)
- Document rollback procedures
- Plan and test A/B testing infrastructure (if needed for feature flags)
- Establish on-call runbook for production incidents

### Testing & Quality

- Expand test suite beyond delete-account test
- Add critical-path integration tests (signup → goal creation → subscription → health sync)
- Add performance benchmarks (app startup time, data sync time, search latency)
- Add visual regression tests for UI (using Detox or Appium for e2e)
- Add security-focused tests (unauthorized access attempts, XSS/injection on Web platform)

---

## Action Plan

### This Week (Fix Now — High Severity)

1. **SurrealDB readiness blocking** (1-2 hours)
   - Add global middleware blocking routes until ready
   - Test: CI passes, startup logs are clear

2. **Image upload security** (2 hours)
   - Redact logs, switch to UUID paths
   - Test: logs contain no user IDs or paths

3. **Backend startup contract** (1 hour)
   - Fail production if SurrealDB never connects
   - Test: `NODE_ENV=production` without SurrealDB → process exits

### Next Week (Fix Now — Medium Severity)

4. **CI and package script standardization** (3 hours)
   - Bun version pinning, script consistency, timeout/concurrency
   - Test: CI runs in <10 min consistently

5. **Image upload robustness** (2 hours)
   - Aspect-ratio testing, file-size validation
   - Test: upload works for portrait/landscape/square/small images

6. **Authorization audit tests** (3 hours)
   - Create focused tests for object-level ownership
   - Test: User B cannot modify User A's data

### Before Beta (Verify Before Changing)

- [ ] Supabase bucket privacy confirmed
- [ ] Supabase RLS policies verified
- [ ] Complete account deletion tested end-to-end
- [ ] iOS archive builds and simulator runs
- [ ] Android APK builds and physical device runs
- [ ] RevenueCat subscription flow works
- [ ] HealthKit integration tested on device
- [ ] Privacy/terms URLs verified
- [ ] App Store and Play Console setup confirmed

---

## Success Criteria

**Green light for beta:**
- All "Fix Now" items complete
- All "Verify Before Changing" tests pass (not skipped)
- CI runs consistently in under 10 minutes
- iOS and Android native builds succeed
- Object-level authorization proven
- No logs expose user identity

**Green light for production:**
- All of the above, plus
- Account deletion verified across all cloud services
- Offline sync and retry behavior documented and tested
- Store releases configured and tested
- Privacy/compliance review complete
- On-call runbook in place

---

**Next step:** Assign owners to each "Fix Now" item and create PRs against `claude/security-audit-triage-51cqrq`.
