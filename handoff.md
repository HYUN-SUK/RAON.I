# Handoff: Mission Ranking & Admin Deletion

**Date**: 2025-12-31
**Role**: Lead Developer
**Session Goal**: Implement Mission Trending System and Admin Moderation Tools.

## 📌 Summary
This session successfully implemented the **Mission Ranking System** ("Trending" sort based on participation/likes) and **Admin Deletion Capabilities** (removing specific comments and withdrawing users from missions). These features enhance user discovery and provide necessary moderation tools for operations.

## ✅ Completed Features
### 1. Mission Ranking System
*   **Backend**: Added `get_trending_missions` RPC.
    *   Score formula: `(participants * 1.0) + (likes * 0.5)`.
*   **Frontend**: 
    *   Updated `useMissionStore` to support `sortBy` ('newest' | 'trending').
    *   Added Sort Toggle UI to `/mission` page.
    *   Added "🔥 N명 참여" badge for trending missions.

### 2. Admin Moderation (Deletion)
*   **Global Deletion (Community)**:
    *   **Posts**: Admins can delete ANY post via the "More" menu in Post Detail.
    *   **Comments**: Admins can delete ANY comment via the "Trash" icon in Comment List.
    *   **RPC**: Added `admin_delete_post` and genericized `admin_delete_comment`.
*   **Mission Participation**:
    *   Updated `/admin/mission/[id]` to list all participants.
    *   Implemented `admin_withdraw_mission_participation` RPC to force-withdraw users (cascading delete of points, likes, comments).

### 3. Policy & Data Integrity
*   **XP/Token Clawback**:
    *   Implemented `on_point_history_delete` trigger to reverse XP/Token grants when history is deleted.
    *   Updated `grant_user_reward` RPC to track `xp_amount`.
*   **Like Synchronization**:
    *   Implemented bi-directional triggers (`sync_mission_like_to_comment`, `sync_comment_like_to_mission`) to sync likes between Mission Proofs and Comments.
*   **UI Updates**:
    *   Added Admin Delete icon to `PostCard`.
    *   Added Non-cash currency disclaimer to Wallet Page.

## 🛠 Technical Notes
*   **RPCs**: New RPCs added to `20251231_mission_ranking_and_admin.sql` and `20251231_xp_clawback_and_sync.sql`.
*   **Services**: `missionService`, `creatorService`, `adminMissionService`, `communityService` enhanced.
*   **Types**: Updated `Mission` type to optional `participant_count` and `total_likes`.

## ⚠️ Known Issues / Caveats
*   **Admin Auth**: Implementation assumes the user has access to Admin Pages. RLS policies for `admin_*` RPCs are set to `authenticated`, relying on the app's Admin Guard for access control.
*   **Performance**: `get_trending_missions` performs a sort on the DB side. For very large datasets, indexing strategies on `user_missions` might be reviewed later.

## ⏭ Next Steps
*   **Verification**: Manually verify the Trending Sort order and Admin Deletion flow.
*   **Search System**: Implement global search (mentioned in roadmap but not started).
*   **My Space**: Continue polishing the "Digital Archive" pivot (Phase 2).
