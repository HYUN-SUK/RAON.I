# Implementation Plan: Operation "Sparkling Forest" (Code Cleanup)

## 🎯 Goal
Clean up the entire codebase (`Code De-cluttering`) to improve maintainability, readability, and stability, while strictly **preserving all existing features, UI designs, and functionality**.

## 🛡️ Principles (The "Boy Scout" Rule)
1.  **Invisible Changes**: The user should see NO difference in the app's look or feel.
2.  **Zero Warnings**: Aim for zero ESLint warnings and zero console logs in production.
3.  **SSOT Alignment**: Ensure code structures align with the latest `RAONAI_SSOT_MASTER_v9.md`.

## 📋 Execution Strategy

### Step 1: Sanitization (The Purge)
_Remove noise and potential bugs._
*   **Linting**: Run strict linting and fix errors (e.g., `unused-vars`, `exhaustive-deps`).
*   **Console Logs**: Use regex search to find and remove `console.log`, `console.warn` (keep `console.error` in try-catch).
*   **Ghost Code**: Remove large blocks of commented-out code.
*   **Unused Files**: Identify files that are never imported (using tools or manual audit).

### Step 2: Organization (Structure)
_Put things where they belong._
*   **Imports**: Standardize imports to use absolute paths (`@/components/...`) instead of relative (`../../`).
*   **Types**: Move inline interfaces (e.g., `interface Props {...}`) to dedicated types files if reused, or keep them co-located but named consistently.
*   **File Names**: Ensure `PascalCase` for React components and `camelCase` for utilities/hooks.

### Step 3: Standardization (SSOT v9)
_Enforce the Design System at the code level._
*   **Colors**: Replace hardcoded hex values (e.g., `#1C4526`) with Tailwind variables (`bg-brand-1`).
*   **Spacing**: Ensure margins/paddings use Tailwind's 4px grid (e.g., `p-[13px]` -> `p-3` or `p-3.5`).
*   **Typography**: Verify strict font usage (no arbitrary font sizes).

## 🔍 Verification Plan
Since we are changing internal structures, verification is critical.
1.  **Static Analysis**: `npm run lint` must pass with 0 errors.
2.  **Build Check**: `npm run build` must succeed.
3.  **Visual Regression (Manual)**:
    *   Compare `Home`, `Mission`, `My Space` screens before/after.
    *   Check interactive flows (Tab switching, Modal opening).

## 📝 Next Steps
Upon approval, I will start with **Phase 1: Linting & Console Removal**.
