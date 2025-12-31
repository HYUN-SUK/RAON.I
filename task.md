# Task Checklist: Operation "Sparkling Forest" (Code Cleanup)

## 🧹 Phase 1: Sanitization (비우기)
- [ ] **Linting & Formatting**
  - [ ] Run `npm run lint` and fix all warnings/errors.
  - [ ] Remove all `console.log`, `console.error` (except actionable catch blocks).
  - [ ] Remove commented-out code (Ghost code).
- [ ] **Dead Code Elimination**
  - [ ] Identify and delete unused components/pages.
  - [ ] Check for unused UI components in `src/components/ui`.
  - [ ] Review `public` folder for unused assets.

## 🗂️ Phase 2: Organization (정리하기)
- [ ] **Import Cleanups**
  - [ ] Optimize imports (remove unused named imports).
  - [ ] Fix absolute path aliases (`@/`) consistency.
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
- [ ] **Smoke Test**: Verify Home, Reservation, Community, My Space flows still work perfectly.
