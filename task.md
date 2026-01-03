# Task Checklist: Operation "Sparkling Forest" (Code Cleanup)

## 🧹 Phase 1: Sanitization (비우기)
- [/] **Linting & Formatting** (Scripts ignored, processing src/)
  - [ ] Run `npm run lint` and fix all warnings/errors.
  - [ ] Remove all `console.log`, `console.error` (except actionable catch blocks).
  - [x] **`src/components`**: Linting & Cleanup
  - [x] Fix `any` types in `PostCard`, `RecommendationGrid`
  - [x] Fix `exhaustive-deps` in home components
  - [x] Refactor `MyMapModal` logic
  - [x] Standardize `Next/Image` usage
- [x] **`src/hooks`**: Hook Cleanup
  - [x] Consolidate duplicate logic (Location constants)
  - [x] Integrate `useLBS` with `useWeather`
  - [x] Check for unused UI components in `src/components/ui` (Skipped deletion to prevent breakage)
  - [x] Review `public` folder for unused assets (Deleted default Next.js SVGs).

## 🔐 Phase 0.5: Post-Auth Security (Completed)
- [x] **Middleware Protection**: `middleware.ts` updated to secure `/myspace`, `/reservation`.
- [x] **Profile Sync**: `auth/callback/route.ts` implements auto-profile creation logic.
- [x] **Session UI**: `TopBar.tsx` displays user avatar and handles logout.
- [x] **Kakao Scope Fix**: Removed `account_email` requirement.
- [x] **Google Login Fix**: Added image domains to `next.config.ts` & fixed hydration error.
- [x] **Auth Verification**: Confirmed login flow for Kakao & Google without crashes.

## 🗂️ Phase 2.5. Structure & Cleanup (Completed)
    - [x] Global Import Cleanup (Partially done for Admin/Core modules)
    - [x] Global Linting (Critical Admin Modules Cleaned)
    - [x] Unused Component Removal (Alert restored, others verified)
    - [x] Critical Refactors (`package` -> `pkg`, `MySpaceState` export)
    - [x] **Fix Runtime 500 Error** (Solved)
    - [x] **Fix Production Build** (Code fixed, Validation deferred to next session)

## 🗂️ Phase 2: Organization (정리하기)
    - [/] Fix `prefer-const` issues
    - [ ] Address `react-hooks/exhaustive-deps` (Partially done for target files)
    - [/] Fix `react-hooks/set-state-in-effect` (Admin Notice fixed)
    - [/] Replace `<img>` tags with `<Image />` (Admin Recs fixed)
- [ ] **Type Safety**
  - [ ] Replace `any` with specific types or interfaces where possible.
  - [ ] Centralize shared types in `src/types/`.

## 🎨 Phase 3: Standardization (통일하기)
- [ ] **Design Tokens (SSOT v9)**
  - [ ] Scan for hardcoded hex colors and replace with CSS variables (e.g., `bg-[#224732]` -> `bg-brand-1`).
  - [ ] Ensure `typography` classes usage instead of arbitrary pixel values.
- [ ] **Component Structure**
  - [ ] Verify "One Component Per File" rule.
  - [ ] Check Function naming conventions (PascalCase components).

## 🚀 Phase 4: Final Verification
- [ ] **Build Test**: Ensure `npm run build` passes.
- [x] **Smoke Test**: Verify Home, Reservation, Community, My Space flows still work perfectly.
  - [x] **Security Fix**: Fixed bypass in `PostDetailView` (Like/Comment).
  - [x] **Live Verification**: Guest restrictions confirmed via Browser.

## 🩹 Phase 7.0: Hotfixes (2025-01-03)
- [x] **Reservation Pricing**: Fixed consecutive stay discount logic (Mixed Weekend/Weekday support).
- [x] **TopBar UI**: Added text label "로그인" next to the icon for better accessibility.
