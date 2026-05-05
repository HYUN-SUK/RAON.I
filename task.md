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

### Next Session Tasks:
- [ ] **AI Persona Prompt Verification**: Validate that the hero narrative consistently includes the personalized guest details without exposing raw personal info, adjusting prompt constraints if necessary.
- [ ] **Route Selection Step**: Discuss and implement a step where the user is presented with ~3 route options (via KakaoNavi API) from origin to destination *before* the Smart Plan logic fully generates, allowing for more accurate midpoint data collection.
