# Content (Influencer) Board Implementation Plan
**Based on User Proposal & SSOT v9**

## 1. 개요 (Overview)
커뮤니티 탭의 확장 기능으로 **"Creator (인플루언서) 보드"**를 신설합니다.
*   **철학**: 경쟁 지양, 조용한 공감 (Quiet Empathy).
*   **MVP 전략**: 라이브는 외부 임베드(URL)로 비용 최소화, 운영자 승인(Approval) 기반 퀄리티 관리.

## 2. 데이터베이스 설계 (Supabase)

### 2.1 Tables
*   **`creators`** (창작자 프로필)
    *   `id` (UUID, PK): `users.id`와 1:1 매핑
    *   `bio` (Text): 소개
    *   `region` (Text): 활동 지역
    *   `portfolio_links` (JSONB): 외부 링크
*   **`creator_contents`** (작품/콘텐츠 메타)
    *   `id` (UUID, PK)
    *   `creator_id` (FK -> creators.id)
    *   `type` (Enum): `LIVE`, `NOVEL`, `WEBTOON`, `ESSAY`, `ALBUM`
    *   `title` (Text)
    *   `cover_image_url` (Text)
    *   `status` (Enum): `DRAFT`, `PENDING_REVIEW` (승인대기), `PUBLISHED` (노출), `REJECTED`, `HIDDEN`
    *   `visibility` (Enum): `PUBLIC`, `PRIVATE` (나만보기)
    *   `published_at` (Timestamp)
*   **`creator_episodes`** (회차/상세 내용)
    *   `id` (UUID, PK)
    *   `content_id` (FK -> creator_contents.id)
    *   `episode_no` (Int): 1, 2, 3... (단편인 경우 1)
    *   `title` (Text): 회차 제목
    *   `body_ref` (Text/JSON):
        *   NOVEL/ESSAY: 텍스트 본문 (HTML or Markdown)
        *   WEBTOON: 이미지 URL 배열
        *   LIVE: Youtube/Twitch URL
        *   ALBUM: Audio URL

### 2.2 RLS Policies
*   **Public (Anon/Auth)**: `status = 'PUBLISHED'`인 레코드만 `SELECT` 가능.
*   **Creator (Owner)**: 본인의 모든 레코드 `SELECT`, `INSERT`, `UPDATE` 가능.
*   **Admin**: 모든 레코드 `SELECT`, `UPDATE` (승인 처리) 가능.

## 3. UI/UX 구현 (Community Content Tab)

### 3.1 진입 & 리스트 (`/community/content`)
*   **필터**: 전체 / 라이브 / 연재(소설/툰/에세이) / 앨범
*   **오늘의 모닥불 (Pinned)**: 운영자가 큐레이션한 1~3개 콘텐츠 상단 고정.
*   **카드 디자인**: 표지(썸네일) 위주, 타입 배지(LIVE 등), 심플한 정보.

### 3.2 상세 보기 (`/community/content/[id]`)
*   **Dynamic Viewer**: `type`에 따라 다른 컴포넌트 렌더링.
    *   `<LivePlayer url="..." />`: Youtube Iframe Wrapper.
    *   `<NovelViewer content="..." />`: 가독성 좋은 텍스트 뷰어 (리디북스 스타일).
    *   `<WebtoonViewer images={[...]} />`: 세로 스크롤 이미지.
*   **에피소드 리스트**: 하단에 다른 회차 목록 표시.
*   **크리에이터 공간 링크**: "작가 홈 가기" 버튼.

### 3.3 작성/업로드 (`/community/content/create`)
*   입력 폼: 제목, 커버 이미지, 타입 선택.
*   타입별 입력:
    *   LIVE: "방송 링크 입력"
    *   OTHERS: "원고 작성" 에디터
*   **승인 요청**: "발행하기" 버튼 클릭 시 `status = 'PENDING_REVIEW'`로 저장.

## 4. 운영자 기능 (Admin Console)
*   **메뉴**: "콘텐츠 승인 (Content Approval)"
*   **기능**:
    *   `PENDING_REVIEW` 상태인 콘텐츠 목록 조회.
    *   미리보기 후 **[승인]** (`PUBLISHED`로 변경) 또는 **[반려]** (`REJECTED`로 변경).

## 5. 다음 세션 우선순위
1.  **DB 마이그레이션**: 위 테이블 생성 SQL 작성 및 실행.
2.  **API/Service**: `CreatorService` 구현.
3.  **UI 개발**: 작성 폼 -> 리스트 -> 상세 순으로 개발.
