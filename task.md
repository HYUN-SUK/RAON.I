
## 🚀 High Priority (XP & Point System)
- [x] **Core System**
    - [x] Create `profiles` table SQL (XP, Token, Gold)
    - [x] Implement `pointService.ts` (Wallet, Grant, Use, History)
    - [x] Add `usePoint` hook for frontend
    - [x] **Wallet Page**: `/myspace/wallet` (My Exploration Index)
- [x] **Feature Integration**
    - [x] Connect Mission Complete -> Grant Reward
    - [x] UI: "My Records" PointStatusCard (Updated to XP/Token/Level balanced view)
    - [x] UI: "My Records" 5x View/Edit Options (Unlock via Token - Premium Forest Design)
- [x] **My Space Pivot**
    - [x] Card UI Refinement (Removed duplicated Wallet cards)
    - [x] Collapsible View/Edit Options

## 🚀 Next Priority (Token Economy & Mission)
- [ ] **Mission Integration**
    - [ ] Replace Mission Points with Raon Tokens in Mission Logic
    - [ ] Define Token Earning Methods (Writing, etc.)
- [ ] **Token Logic**
    - [ ] Implement robust Grant/Deduct Logic
    - [ ] Real-world Verification of Acquisition/Usage



## 🏁 Completed (My Space Pivot)
- [x] **Content Write Form**
  - [x] Add privacy guide text below content input: "기본 비공개로 설정되며 작성자만 볼 수 있습니다. 전체 공개 시 이야기 게시판에 게시됩니다."
- [x] Re-design 'My Records' page (`/myspace/records`)
    - [x] Full-screen width layout
    - [x] Paper texture / Archive feel
    - [x] Add clear description text: "내가 작성했던 모든 기록들이 모여있는 공간입니다."
    - [x] Add Search Bar
    - [x] Fix Infinite Loop in Records Page (UseMemo fix)
    - [x] Verify functionality (Infinite scroll, Search)
- [x] **Hero Section**
  - [x] Fix Mission Badge visibility (ensure it appears consistently). (Camera Icon).
  - [x] Retain and style "Mission Badge" for continuity.
- [x] **Refactor Hero Section**
    - [x] Remove Fire/Star/Decorate widgets.
    - [x] Implement "Archive View" (Photo Frame).
    - [x] Rename "Story" -> "기록 남기기".
    - [x] Rename "Photo" -> "내 기록 보기" (Linked to `/myspace/records`).primary CTAs in `ActionButtons.tsx`.
- [x] Final Verification
- [ ] **Verification**
  - [ ] Verify build/lint.
  - [ ] Check UI visual hierarchy (Hero -> Actions -> Timeline).
