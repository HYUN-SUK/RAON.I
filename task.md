# Task Checklist: Smart Plan Stabilization & Personalization

- [x] **AI Persona Pipeline Stabilization**
    - [x] Implement authenticated data retrieval in `persona.ts` to bypass RLS.
    - [x] Prioritize `User Camping Profile` over historical reservations for accurate persona extraction.
    - [x] Fix merge conflicts in `persona.ts` and `smartPlan.ts` to unify logic.
- [x] **DB Migration**
    - [x] Apply `20260506_add_seniors_to_profile.sql` to Supabase.
- [x] **Caching Script Optimization**
    - [x] Move `totalFactMap` inside the cluster loop in `scripts/caching-smart-plan.mjs` to ensure isolation.
- [x] **Retrieval Logic Enhancement**
    - [x] Implement spatial matching (location-based) for `reservation_id` in `src/lib/smartPlan.ts`.
- [x] **Weather API Integration Fix**
    - [x] Resolve date-format mismatch (`YYYYMMDD` string matching with `.replace(/-/g, '')`).
    - [x] Implement full-duration weather data collection for comprehensive AI briefings.
- [x] **AI Hero Narrative Enhancement**
    - [x] Refine AI prompt to enforce mandatory inclusion of specific guest composition (seniors, kids, pets).
    - [x] Ensure day-by-day weather summaries are naturally integrated into the narrative.
- [x] **Build & Git Integrity**
    - [x] Resolve Git Rebase conflicts and synchronize with remote `main`.
    - [x] Verify production build status (`npm run build` success).
- [x] **Verification**
    - [x] Verify separate data retrieval for multiple bookings on the same day.
    - [x] Confirm caching script performance and data integrity.

### Status:
All identified blockers regarding data leakage and multi-reservation matching have been resolved.

### Next Session Tasks:
- [ ] **Festival Scoring Refinement**: Re-verify the differentiate scoring logic between `SPOT` and `FESTIVAL` and remove outdated `readcount` criteria.
