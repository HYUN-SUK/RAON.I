# Task Checklist: Smart Plan UI & Logic Refinement

- [x] **Smart Plan UI Alignment**
    - [x] Adjust mobile timeline vertical line to `10px` offset.
    - [x] Update card margins and width (`w-[calc(100%-3rem)]`) to ensure they fit completely within the mobile viewport.
- [x] **Swap Popup Logic**
    - [x] Fix pagination logic to strictly display 3 items per page.
    - [x] Resolve Stage 5 duplication bug by deduplicating options based on ID and excluding active items.
- [x] **AI Hero Narrative Personalization**
    - [x] Extract `guestDetails` (adults, kids, pets) from the persona object.
    - [x] Enforce mandatory AI instructions to include specific guest composition and weather in the first paragraph.
- [x] **Auto-display Existing Plans**
    - [x] Restore logic to automatically show the generated plan when `smart_plan_data` is present upon entering the schedule page.
- [x] **Route Selection Integration**
    - [x] Implement `RouteSelector` with 3-priority fetch (`alternatives=true` strategy).
    - [x] Add "Simple Route" alert logic for 1-path scenarios.
    - [x] Optimize API calls to 1-request to save quota.
    - [x] Stabilize AI JSON parsing for production environments.

### Current Tasks (Navigation Integration):
- [x] **Navigation Utility Implementation**: Create `src/lib/nav-utils.ts` for deep link generation.
- [x] **Route Data Propagation**: Update `RouteSelector.tsx` to pass full route data to parent.
- [x] **Navigation UI Injection**: Add "Open Navigation" button in `SmartPlanProposal.tsx` Hero section.
- [x] **Action Sheet Implementation**: Add `RouteNavDrawer` for app selection.
- [ ] **Live Verification**: Test deep links and data flow.

### Next Session Tasks:
- [ ] **Hero Narrative Quality Enhancement**: Further refine the AI prompt to improve the "Hero" greeting quality and emotional resonance.
- [ ] **Smart Plan Midpoint Refinement**: Ensure the 50% duration midpoint calculation is consistently reflected in Stage 1-2 transition logic.
