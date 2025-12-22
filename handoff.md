# Handoff Document: Mission Photo Comment & Automation

## 📅 Session Summary
**Completed Mission System MVP** by implementing User Photo Comments and automating the "Weekly Mission" post creation.
The entire flow from "Checking Mission" -> "Auto Post Creation" -> "User Photo Upload" is now seamless.

## ✅ Accomplished Features
1.  **Mission Photo Comments**:
    *   **Frontend**: Added `ImageIcon` to `CommentSection`, implemented local preview and `clear` function.
    *   **Logic**: Created `imageUtils.ts` for strictly client-side compression (WebP, max 1920px, <500KB) to save storage/bandwidth.
    *   **Backend**: Updated `communityService` and `useCommunityStore` to handle `imageUrl`.
2.  **Automated Weekly Post**:
    *   **Logic**: Implemented "Lazy Creation" logic in `missionService`. (If post is missing when fetching mission, create it via RPC).
    *   **Database**: Added `community_post_id` to `missions` and created `ensure_mission_post` RPC function.
    *   **Permission**: Fixed RPC execution permissions for browser clients.
3.  **UI/UX Polish**:
    *   Added `MissionHomeWidget` to **Beginner Home** for better visibility.
    *   Verified "Mission Check -> Post Creation" flow via Browser Subagent.

## 📂 Key Files Created/Modified
- `src/components/community/CommentSection.tsx`: Added photo upload UI.
- `src/utils/imageUtils.ts`: Image compression utility.
- `src/services/missionService.ts`: Added auto-post logic.
- `supabase/migrations/20251222_mission_automation_FINAL.sql`: Core automation logic (RPC).
- `src/components/home/BeginnerHome.tsx`: Added Mission Widget.

## ⚠️ Known Caveats / Next Steps
1.  **Admin Console**: Mission management (Update/Delete) is currently DB-only. Need Admin UI in Phase 7.
2.  **Notification**: User doesn't get a notification when their mission post is created (it's silent).
3.  **Next Session**: Recommended to focus on **Admin Console** or **My Space Content (Album)**.

## 📖 How to Verify
1.  **Fresh Start**: Reload the app.
2.  **Auto Post**: Check `Community > Story`. A post "[금주의 미션]..." should exist.
3.  **Photo Comment**: Open that post -> Upload a photo comment -> Verify it appears instantly properly compressed.
