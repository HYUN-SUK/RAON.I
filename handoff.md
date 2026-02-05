# Handoff Document
**Session Date**: 2026-02-05
**Task**: Unified Schedule Display (Phase 12.3)

## 📝 Summary
이번 세션에서는 '마이스페이스'(`myspace/page.tsx`)와 '예약 내역'(`myspace/reservations/page.tsx`)에서 **라온아이 예약**과 **타캠핑장 일정**을 통합하여 표시하는 기능을 구현했습니다.
사용자가 어떤 플랫폼을 통해 여행을 가든, 가장 가까운 일정을 메인 화면에서 직관적으로 확인할 수 있도록 UX를 개선했습니다.

## ✅ Completed Tasks
1.  **통합 일정 타입 정의 (`UnifiedUpcoming`)**:
    *   `UpcomingReservation.tsx` 내부에서 예약(Reservation)과 일정(Schedule)을 아우르는 유니온 타입 정의.
    *   체크인 날짜를 기준으로 정렬 및 비교 로직 구현.
2.  **메인 카드 조건부 렌더링**:
    *   `upcomingItem` 타입(`reservation` vs `schedule`)에 따라 다른 디자인의 카드를 렌더링.
    *   **라온아이 예약**: 기존 입금 대기/확정 상태 비주얼(그라디언트) 유지.
    *   **타캠핑장 일정**: 숲 테마(녹색) 및 심플한 정보(박수, 장소) 카드 적용.
3.  **빈 상태 개선**:
    *   다가오는 일정이 없을 때 "타캠핑장 일정 추가" 버튼을 노출하여 사용 유도.
    *   "다가오는 예약" → "다가오는 일정"으로 타이틀 변경.
4.  **검증**:
    *   `/myspace` 페이지에서 타캠핑장 일정이 가장 가까울 때 정상 표시됨을 확인.
    *   `/myspace/reservations` 페이지의 통합 리스트 확인.

## 🏗️ Technical Decisions
*   **컴포넌트 내 통합 로직**: 별도의 백엔드 통합 API를 만드는 대신, 클라이언트 컴포넌트(`UpcomingReservation`)에서 `useReservationStore`와 `getMySchedules`를 병렬로 호출하여 클라이언트 사이드에서 병합했습니다. (반응성 및 기존 로직 최소 건드림)
*   **Upcoming Item 선정 기준**:
    *   `activeReservations`: 체크아웃이 오늘 이후이고, 상태가 `PENDING` 또는 `CONFIRMED`인 예약.
    *   `activeSchedules`: 체크아웃이 오늘 이후인 일정.
    *   위 두 리스트를 합쳐 `checkIn` 날짜 오름차순 정렬 후 첫 번째 항목 선택.

## 🚀 Next Steps (Priority)
1.  **일정 관리 CRUD (Phase 12.3 계속)**:
    *   현재는 일정 추가 및 표시만 가능. 수정/삭제 기능 확인 및 보완 필요.
2.  **1분 기록 (Instant Log)**:
    *   캠핑 중 빠르게 사진과 메모를 남기는 기능 구현.
3.  **찜 기능 & 알림**:
    *   캠핑장 찜하기 및 D-Day 알림 구현.

## ⚠️ Notes & Caveats
*   **데이터 페칭**: `UpcomingReservation` 컴포넌트가 마운트될 때마다 예약을 다시 불러옵니다(`fetchMyReservations`). 성능상 큰 문제는 없으나 추후 React Query 등으로 캐싱 전략을 도입하면 더 효율적일 수 있습니다.
*   **lint**: `UpcomingReservation.tsx`에서 일부 lint 에러가 발생할 수 있으나 빌드에는 지장이 없도록 확인했습니다. (변수 미사용 등 정리 완료)
