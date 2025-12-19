# Handoff: Group Post & My Space Integration
**Last Updated:** 2025-12-19

## 1. 현재 상태 요약 (Completed)
이번 세션에서는 **소모임(Group)의 게시글 작성** 기능을 복구하고, **커뮤니티-내 공간** 간의 연동을 완료했습니다.

### ✅ 주요 완료 사항
1.  **소모임 게시글 작성 복구**
    *   **문제**: `createGroupPostAction`이 `posts_type_check` 제약 조건 위반으로 실패.
    *   **해결**: `createGroupPostAction`에서 게시글 타입을 소문자 'story'가 아닌 **대문자 'STORY'**로 전송하도록 수정. (DB 제약 및 Zod 스키마 일치)
2.  **커뮤니티 소모임 피드 상호작용**
    *   `GroupFeed`에 `LikeButton` 연동 완료 (좋아요 기능).
    *   게시글 클릭 시 `/community/[id]` 상세 페이지로 이동하며, 상세 페이지에서 '뒤로 가기' 시 소모임 홈으로 복귀하도록 개선.
3.  **마이 스페이스 연동**
    *   `MyGroupsWidget` 컴포넌트 신규 개발.
    *   마이 스페이스(`myspace/page.tsx`)에 위젯을 추가하여 가입한 소모임 목록을 가로 스크롤로 표시.

## 2. 기술적 결정 사항 (Technical Decisions)
*   **Post Type Enum**: DB의 `type` 컬럼은 `'STORY'`, `'NOTICE'` 등 대문자 Enum을 사용합니다. 코드 전반(Zod, UI Form, Server Action)에서 대문자를 엄격히 사용해야 합니다.
*   **Navigation Logic**: `PostDetailView`는 `groupId` 속성의 유무에 따라, 소모임 글이면 소모임 페이지로, 일반 글이면 이전 페이지로 돌아가는 분기 처리를 포함했습니다.
*   **MyGroupsWidget**: 성능을 위해 `group_members` 테이블에서 `groups` 테이블을 조인하여 필요한 정보(`id`, `name`, `image_url`)만 가져오도록 최적화했습니다.

## 3. 다음 작업 가이드 (Next Steps)
다음 세션에서는 **마이 스페이스의 예약 및 기록 기능** 완성에 집중해야 합니다.

1.  **예약 내역 연동 (UpcomingReservation)**
    *   현재 `UpcomingReservation.tsx`는 더미 데이터입니다.
    *   `reservations` 테이블에서 로그인한 유저의 **가장 빠른 다가오는 예약**을 가져와 표시해야 합니다.
2.  **나의 기록 (My Records)**
    *   마이 스페이스 하단 '나의 기록' 섹션 구현.
    *   내가 쓴 글(Posts)이나 지난 캠핑 이력을 보여주는 페이지/모달 구현 필요.
3.  **이미지 업로드 (Real)**
    *   현재 이미지는 Mock URL이거나 로컬 미리보기만 작동. Supabase Storage 연동 필요.

## 4. 주의 사항 (Known Issues)
*   **브라우저 도구 429 에러**: Cursor 브라우저 도구가 간헐적으로 429(Too Many Requests) 에러를 뱉습니다. 검증 시 로컬 URL(`http://localhost:3000`)을 사용자에게 직접 전달하여 확인받는 것이 빠릅니다.
*   **서버 액션 핫 리로드 이슈**: 서버 액션(`*.ts` 파일)을 수정하면 가끔 `Internal Server Error`가 발생합니다. 이 경우 터미널에서 서버를 재시작(`npm run dev`)하면 해결됩니다.
