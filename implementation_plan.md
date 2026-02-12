# Implementation Plan: Phase 12.3 Completion (Wishlist, Notifications, Meal Recs)

## Goal
Complete the remaining parts of Phase 12.3 "Camping Ajiit" to enhance user engagement.

## User Review Required
> [!IMPORTANT]
> **Push Notifications**: This plan assumes `supabase/functions/camping-notifications` will be triggered by a Cron Job.
> **Meal Recommendation**: Currently rule-based (L0).

## Proposed Changes

### 1. Wishlist (찜 목록)
#### [NEW] [Favorites Page](file:///c:/Users/USER/Desktop/RAON.I/src/app/(mobile)/myspace/favorites/page.tsx)
-   **Path**: `/myspace/favorites`
-   **Logic**:
    -   Fetch `campground_favorites` joined with `campgrounds` via `get_my_favorites`.
    -   Display using `RecommendationCard` or similar (AjiitCard).
    -   Empty state: "아직 찜한 캠핑장이 없어요."

### 2. Smart Preparation Notifications (준비 알림)
#### [NEW] [Edge Function](file:///c:/Users/USER/Desktop/RAON.I/supabase/functions/camping-notifications/index.ts)
-   **Trigger**: Scheduled (Cron) daily at 09:00 KST.
-   **Logic**:
    -   Query `user_schedules` where `check_in` is:
        -   **D-4**: "캠핑 4일 전! 체크리스트를 점검해보세요."
        -   **D-1**: "내일이 캠핑이네요! 빠진 짐은 없나요?"
        -   **D-Day**: "즐거운 캠핑 되세요! 안전 운전!"
    -   Send FCM via `notificationService`.

### 3. Meal Recommendation (메뉴 추천)
#### [NEW] [Logic Module](file:///c:/Users/USER/Desktop/RAON.I/src/lib/meal-recommendation.ts)
-   **Function**: `getMealRecommendation(weather, memberType, season)`
-   **Rule Engine**:
    -   **Rainy**: 파전, 어묵탕 via `weather.condition`
    -   **Cold (<10°C)**: 전골, 밀푀유나베
    -   **Family (Kids)**: 찜닭, 소세지
    -   **Couple**: 스테이크, 파스타
-   **Output**: Menu Name, Reason, Simple Ingredients.

#### [NEW] [Meal UI Widget](file:///c:/Users/USER/Desktop/RAON.I/src/components/myspace/MealRecommendationWidget.tsx)
-   Display in `MySpace` or `ScheduleDetail`.

## Verification Plan

### Manual Verification
1.  **Wishlist**:
    -   Go to a campground card -> Click Heart.
    -   Go to `/myspace/favorites` -> Verify item.
2.  **Notifications**:
    -   Create a schedule for D-4.
    -   Invoke Edge Function (curl).
    -   Verify Push Notification.
3.  **Meal Recs**:
    -   Check the output based on simulated weather.
