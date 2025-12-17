# Community Group Logic Design v1

**Based on**: RAONAI SSOT v9 (Ch 7.7, Ch 15) & User Group Logic Guide  
**Date**: 2025-12-17  
**Status**: Draft

## 1. Overview
Community Groups ("소모임") are **private-by-default, approval-based** micro-communities within RAON.I.  
They provide a sense of "independent space" without requiring complex infrastructure changes (Single DB, Single Post Table).

## 2. Core Principles
1.  **Private by Default**: Content is invisible to non-members.
2.  **Approval Based**: Joining requires explicit approval (Request/Invite/Recommend).
3.  **Minimal Intervention**: Admin only intervenes in 'Review' state.
4.  **Zero Cost Arch**: Uses existing `community_posts` table with `group_id` filtering.

## 3. Roles & Permissions

| Role | Description | Read Post | Write Post | Comment | Invite/Recommend | Approve Member |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Owner (방장)** | Creator/Admin | ✅ | ✅ | ✅ | ✅ (Invite) | ✅ |
| **Member (구성원)** | Approved Member | ✅ | ✅ | ✅ | ✅ (Recommend) | ❌ |
| **Pending (신입)** | Awaiting Approval | ❌ | ❌ | ❌ | ❌ | ❌ |
| **External (외부)** | Non-member | ❌ | ❌ | ❌ | ❌ | ❌ |

*Note: External users can only see: Group Name, Description, Member Count, "Request Join" buttons.*

## 4. Membership Flows

### A. Request (신청)
`User` -> Click [Join] -> `Pending` Status -> `Owner` Approves -> `Member` Status.
*   *UX*: "가입 승인 대기 중입니다" (Pending Badge)

### B. Invite (초대)
`Owner` -> Select User -> Send Invite -> `User` Accepts -> `Member` Status (Immediate).
*   *Feature*: Admin/Owner dashboard feature.

### C. Recommendation (추천)
`Member` -> Recommends Friend -> `Pending` (Recommended) -> `Owner` Approves -> `Member` Status.
*   *Note*: Keeps Owner as the final gatekeeper.

## 5. Group Lifecycle (State)

| State | Description | Trigger | Permissions |
| :--- | :--- | :--- | :--- |
| **Active** | Normal Operation | Creation | Normal |
| **Review** | Under Admin Review | Report Threshold (e.g., 3+) | **ReadOnly** (for safe check) |
| **Paused** | Temporarily Stopped | Owner Decision | ReadOnly |
| **Closed** | Archived/Deleted | Owner Decision | Hidden/ReadOnly |

*   **Report Logic**: If `report_count >= 3`, auto-switch to `Review`. Notification to Admin.

## 6. Data Model (Schema Strategy)

The goal is to reuse existing Supabase tables with minimal extension.

### 6.1 `groups` Table (New)
```sql
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  owner_id uuid references users(id),
  status text default 'active', -- active, review, paused, closed
  is_private boolean default true,
  created_at timestamptz default now()
);
```

### 6.2 `group_members` Table (New)
```sql
create table group_members (
  group_id uuid references groups(id),
  user_id uuid references users(id),
  role text default 'member', -- owner, member
  status text default 'pending', -- pending, approved, invited
  joined_at timestamptz,
  primary key (group_id, user_id)
);
```

### 6.3 `community_posts` Table (Existing - Modify)
*   Add column: `group_id uuid references groups(id) (nullable)`
*   **Logic**:
    *   If `group_id` is NOT NULL -> It is a Group Post.
    *   RLS Policy: Visible ONLY if `auth.uid()` is in `group_members` (status='approved') for this `group_id`.

## 7. UX Guidelines
*   **Isolation**: When inside a group, the UI should feel like a separate app/space.
*   **No Cross-Posting**: A post belongs strictly to ONE group.
*   **Entry Points**:
    *   **Community Main**: "Active Groups" card (Horizontal Scroll).
    *   **My Space**: "My Groups" list.

## 8. Implementation Phases
1.  **Phase 1 (Core)**: Schema, RLS, Basic CRUD, Request/Approve Flow.
2.  **Phase 2 (Interaction)**: Posting within Groups, Feed view.
3.  **Phase 3 (Expansion)**: Invites, Recommendations, Notifications.
