# Handoff Document - Session Wrap-up (Admin Notice, RLS, Code Cleanup)

## 1. Session Summary
- **Admin Console (Notice)**: Refactored 'Notice Create/Edit' pages. Extracted `AdminNoticeForm` for reusability. Verified creation and list view.
- **Security (RLS)**: Implemented Row Level Security (RLS) policies on Supabase `posts` table.
    - `SELECT`: Allowed for everyone (PUBLIC) or specific roles (PRIVATE/GROUP).
    - `INSERT`: Authenticated users only.
    - `UPDATE/DELETE`: Authors only (or Admins).
    - **Verification**: Confirmed that `UPDATE` operations without proper authentication are blocked by the DB.
- **Project-wide Cleanup**:
    - **Linting**: Fixed ~30 critical lint errors (Improper `useEffect` deps, `setState` in render, `any` types).
    - **Console Logs**: Removed all debugging `console.log` statements.
    - **Build Fix**: Resolved `npm run build` failure by setting `dynamic = 'force-dynamic'` in `RootLayout` and improving `Supabase` client robustness.

## 2. Technical Decisions
- **`AdminNoticeForm`**: Decided to share logic between Create/Edit to reduce duplication. Props: `initialData` (optional) and `onSubmit` handler.
- **RLS Policy**: Strict "Deny by Default". `visibility` column (PUBLIC, PRIVATE, GROUP) drives the `SELECT` policy.
- **Force Dynamic**: Due to the nature of the app (Community/Reservations requiring fresh data) and current lack of build-time mock data, we disabled Static Site Generation (SSG) for the root layout. This ensures build stability and data freshness.
- **Supabase Fallback**: `src/lib/supabase.ts` now uses fallback strings if ENV vars are missing, preventing build-time crashes (the build process tries to import the client).

## 3. Next Steps (Priorities)
1.  **Admin Authentication (CRITICAL)**:
    - Currently, we cannot fully verify "Admin Edit" or "Delete" because we lack a real Admin Login flow.
    - **Action**: Implement Admin Login (using Supabase Auth or mock for MVP) and ensure `auth.uid()` matches the RLS policies for Admin actions.
2.  **Group Feature (소모임)**:
    - Design is complete (`docs/design/group_logic_v1.md`).
    - **Action**: Implement `groups` table (or usage of `posts` with type `GROUP`), Group Join/Leave logic, and "My Groups" UI.
3.  **RLS Fine-tuning**:
    - Once Auth is ready, re-verify complex RLS cases (e.g., "Group Members only" visibility).

## 4. Known Issues / Notes
- **Build**: `npm run build` passes with Exit Code 0, but relies on `force-dynamic`. Do not revert this unless you have a strategy for Static Data Mocking.
- **Lint**: `no-explicit-any` was suppressed in a few complex Community components (`PostDetailView`) with `TODO` comments to refactor later.
