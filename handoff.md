# Handoff Document
**Date:** 2026-01-01
**Session Goal:** Improve Login/Logout UX and Guest Access Control.

## Current State Summary
- **Social Login Fixes**: Resolved issues with Google (hydration mismatch, image domains) and Kakao (account_email scope, http/https images) logins.
- **Login/Logout UX**:
  - Implemented **User Data Reset on Logout**: `useMySpaceStore` now has a `reset()` action called on logout to clear XP, Level, and Tokens.
  - created `useAuthModalStore` and `LoginRequestDialog` (globally mounted in `layout.tsx`) to show a "Login Required" popup instead of redirecting immediately.
  - **Guest Access Control**: 
    - `BottomNav`: Clicking Reservation, Community, MySpace, Market triggers the popup. Home and Admin are accessible.
    - `BeginnerHome`: "Reservation Date View", "Mission Join", and "Recommendations" trigger the popup.
    - **Exception**: The 6 core chips (Wayfinding, Contact, etc.) are **accessible to guests** as requested.

## Technical Decisions
- **Global Auth Modal**: Moved away from immediate redirects to a modal approach to improve conversion (less friction).
- **`useRequireAuth` Hook**: Created a reusable hook to wrap any action with an auth check. This simplifies protecting new features in the future.
- **Next.js Image Config**: Expanded `remotePatterns` to include `lh3.googleusercontent.com`, `k.kakaocdn.net` and `*.pstatic.net` to prevent crashes when rendering avatars.

## Next Steps (Priorities)
1. **Mission System Refinement**: Now that login flow is solid, focus on the Mission UI details and logic implementation.
2. **Community Polish**: Ensure the community board interaction (comments, likes) works smoothly with the new login modal flow.
3. **Naver Login**: Currently deferred. Requires Supabase + Naver Developer setup if decided to implement.

## Caveats / Known Issues
- **Naver Login**: Not implemented yet (Button exists but might need hiding or wiring up if prioritized).
- **Local Dev**: Remember to restart the Next.js server if you change `next.config.ts` again.

## Changed Files
- `src/components/auth/SocialLoginButtons.tsx`
- `src/app/layout.tsx`
- `next.config.ts`
- `src/store/useMySpaceStore.ts`
- `src/components/TopBar.tsx`
- `src/store/useAuthModalStore.ts` (New)
- `src/components/auth/LoginRequestDialog.tsx` (New)
- `src/hooks/useRequireAuth.ts` (New)
- `src/components/BottomNav.tsx`
- `src/components/home/BeginnerHome.tsx`
- `src/components/home/MissionHomeWidget.tsx`
