# Handoff Document

## Session Summary
**Focus**: Holiday Integration and Substitute Holiday Handling
- Implemented real-time holiday fetching for 2025-2026 using `date.nager.at` and a backend implementation of manual substitute injection.
- Added a `holidays` Set to the global store (`useReservationStore`) and integrated it into the pricing logic.
- Updated the **Reservation** page (`DateRangePicker`) to display holidays (including substitute holidays) in **RED**.
- Verified that **March 3, 2025** (Substitute for Samiljeol) is correctly recognized as a holiday and priced at 70,000 KRW.

## Technical Decisions
- **Manual Substitute Holiday Injection**: The free API `date.nager.at` does not support Korean substitute holidays reliably. I manually injected known substitute holidays for 2025 and 2026 into `src/app/api/holidays/route.ts` to ensure accuracy.
- **Backend Proxy**: Created `src/app/api/holidays/route.ts` to fetch and merge data, preventing CORS issues and allowing for data augmentation (manual injection) before sending to the frontend.
- **Store**: Used a `Set<string>` in Zustand for O(1) holiday lookups in pricing calculations.

## Next Steps
- **Admin Console Features**:
    - **Site Management**: Implement UI to update site images, guide text, and Info.
    - **Hero Image Management**: Allow admins to change the home page hero background.
- **Cleanup**: Verify if `date.nager.at` improves support or consider switching to an API key-based solution (`holidays-kr`) if manual maintenance becomes burdensome in future years (2027+).

## Known Issues / Caveats
- **Manual Data**: The substitute holidays are hardcoded for 2025-2026. If the system is used beyond 2026, `src/app/api/holidays/route.ts` will need updates.
- **Linting**: No major lint errors remaining.
