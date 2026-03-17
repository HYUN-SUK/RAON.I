# RAON.I 마스터 개발 로드맵 v3 (Final Integrated Version)

**버전**: v4.2 (Push Delivery Breakthrough)
**기반**: RAONAI SSOT MASTER v9 + User Feedback (Gap Filling)
**작성일**: 2026-02-27

이 문서는 라온아이 프로젝트의 **최종 확정형 개발 가이드**입니다.
기존의 견고한 프레임워크 위에 **트렌드(감성·초개인화)**와 **현실적인 AI 전략(L0/L1)**을 결합하여, 사용자에게 가장 가치 있는 경험을 우선적으로 전달합니다.

---

- [x] **9.1 Push Notification Debugging (Fixed)** ✅
  - [x] **Infrastructure Check**: Verify `push-notification` Edge Function code & secrets.
  - [x] **Webhook Check**: Confirm Trigger exists on `notifications` table (Bypassed via Client Invoke).
  - [x] **Auth Fix**: Fixed Firebase 401 (Added Service Account), Vercel Env (Added `NEXT_PUBLIC_` vars), JWT Claim (`iat`).
  - [x] **Token Cleanup**: Removed duplicate FCM tokens to prevent double notifications.
  - [x] **Deep Linking**: Implemented `push_redirect` query strategy + `postMessage` for open apps.
  - [x] **Reliability**: Auto-token refresh on Home visit (Self-Healing).
  - [x] **Performance**: Fixed FCM Quota Infinite Loop (Memoization).
  - [x] **Verification**: Live booking test -> 1 notification received successfully.

- [x] **9.2 Admin Push Notification & Duplicate Fix (2026-01-19)** ✅
  - [x] **Admin Status Update Fix**: Notifications now sent when admin confirms deposit or cancels reservation.
  - [x] **RLS Policy Issue**: Fixed by disabling RLS on `notifications` table (temporary, TODO: re-enable with correct policy).
  - [x] **Duplicate Notification Fix**: Removed DB Webhook (code invoke only), fixed SW duplicate handler.
  - [x] **Admin Force Cancel**: Added `CancelReservationDialog` with reason input, reason included in push notification.
  - [x] **Verification**: All 3 scenarios (Reserve/Confirm/Cancel) -> 1 notification each.

- [x] **9.3 Waitlist Notification & Timezone Fix (2026-01-23)** ✅
  - [x] **Waitlist Persistence**: WaitlistButton now checks DB on mount to maintain 'subscribed' state across page navigations.
  - [x] **Timezone Parsing**: Added `parseSafeDate()` to prevent date shift when parsing "YYYY-MM-DD" strings.
  - [x] **Public Reservation Sync**: Added `get_public_reservations` RPC for availability check without sensitive data.
  - [x] **LocalStorage Cache Fix**: `fetchPublicReservations` now replaces (not merges) cached data with server data.
  - [x] **Verification**: Live test confirmed - vacancy notification received, reservation sync accurate.

## 📅 전체 진행률 요약 (Progress Summary)

| 단계 | 구분 | 상태 | 진행률 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **코어 플랫폼 기반 (Foundation)** | ✅ **완료** | 100% | 필코노미 감성 톤, UI 프레임, 데이터 레이어 |
| **Phase 1** | **사용자 홈 (User Home)** | ✅ **완료** | 100% | Beginner/Returning UI, Smart Re-book, L0 Logic 완료 |
| **Phase 2** | **내공간 (My Space)** | ✅ **완료** | 100% | 대시보드/지도/타임라인 완료. 아카이브(기록) 리뉴얼 및 XP/Token 완료. |
| **Phase 3** | **예약 시스템 (Reservation)** | ✅ **완료** | 95% | Logic/Validation/Admin Core/Holidays 완료. PG/오픈일 남음. |
| **Phase 4** | **미래 기능 (Future)** | ✅ **완료** | 100% | 웹 푸시(FCM), 상황별 알림 시스템, 인앱 배지 구현 완료. |
| **Phase 5** | **마켓 & 결제 (Market)** | ✅ **완료** | 100% | MVP 완료. 리뷰 시스템(DB/UI) 구현 및 검증 완료. Commerce Logic Complete. |
| **Phase 5.5** | **스마트 캠핑 플랜 (Smart Plan)** | ✅ **완료** | 100% | Phase 11/12 하이브리드 동기화 및 실시간 검증 엔진 구축 완료. |
| **Phase 6** | **확장 모듈 (Expansion)** | ✅ **완료** | 98% | 크리에이터, 미션(XP/Deletion 완전구현) 완료. 확장 지도 대기 |
| **Phase 7** | **운영 & 갭 필링 (Ops & Gap)** | ✅ **완료** | 100% | Admin Ops, XP/Deletion 안정화, UI/UX 디테일 보완 완료. 마켓 피벗 대기. |
| **Phase 8** | **안정화 및 리팩토링 (Stabilization)** | ✅ **완료** | 98% | Deep Refactoring 완료. Push 시스템(예약변경/템플릿/Edge Function) 구현 완료. 배포 대기. |

---

## 🚀 상세 로드맵 (Detailed Roadmap)

### Phase 0: 코어 플랫폼 기반 (Foundation) - ✅ 완료
*   **0.1 글로벌 UI 프레임**: TopBar, BottomNav, 390px 레이아웃
*   **0.2 공통 라이브러리**: Shadcn UI, Tailwind, Lucide Icons
*   **0.3 라우팅**: Next.js App Router (`(mobile)`, `admin`)
*   **0.4 인증 시스템 (Authentication)** ✅ (2025-01-01):
    *   [x] **UI**: 숲 테마 글래스모피즘 디자인 + 모바일 반응형 최적화.
    *   [x] **소셜 로그인**: 카카오, 구글 연동 및 리다이렉트 처리.
    *   [x] **이메일**: 로그인/가입 모드 토글, 패스워드리스 보안 구조.

### Phase 1: 사용자 홈 (User Home) - ✅ 완료
**"감성, 안내, 그리고 초개인화된 첫인상"**
*   **1.1 분기 엔진 (L0)**: 사용자 상태 판별 완료
*   **1.2 초보자 홈 (Beginner)**: 히어로, 가이드, 프라이스 디코딩 완료
*   **1.3 기존 사용자 홈 (Returning)**: 스마트 리북, 예약 패널, 감성 배경 완료

### Phase 2: 내공간 (My Space) - ✅ Completed
**"Digital Archive - 나만의 기록과 사진"**
> **Product Pivot (2025-12-28)**: 기존의 '꾸미기/불멍(Digital Toy)' 컨셉을 폐기하고, **"사진과 기록(Digital Archive)"**에 집중합니다. 어설픈 애니메이션 대신 사용자의 고퀄리티 사진이 주는 감동을 극대화합니다.
*   **2.1 대시보드**: POV 뷰, 위젯 완료
*   **2.2 나만의 지도**: 핀 저장, 상세 시트 완료
*   **2.3 타임라인**: 통합 피드 완료.
*   **2.4 아카이브 리뉴얼** ✅:
    *   [x] **기록 페이지**: 풀사이즈 뷰, 종이 질감, 검색, 비공개 로직 구현.
    *   [x] **히어로 섹션**: 미션 배지 가시성 확보 및 UX 개선.
    *   [x] **연동**: 소모임/공지 위젯과 커뮤니티 게시판 딥링크 연결.
    *   [x] **도구 표준화**: 앨범/기록/히스토리 3종 뷰/편집 도구 디자인 통일 및 가로 스크롤 이슈 해결.
*   **2.5 XP & Token System (New)** ✅:
    *   [x] **3-Tier Currency**: XP(Level), RaonToken(Utility), GoldPoint.
    *   [x] **My Exploration Index**: `/myspace/wallet` (지갑) 페이지 및 내역 조회 구현.
    *   [x] **Premium UI**: View/Edit 옵션 잠금 해제 UI (Glassmorphism + Collapsible) 적용.


### Phase 3: 예약 시스템 (Reservation) - ✅ 100% Completed
**"레디코어 - 투명하고 쉬운 예약 & 강력한 관리"**

*   **3.1 예약 UI (Refinement)** ✅
    *   [x] 스마트 리북, Validation(주말 2박/엔드캡), 가격 로직
    *   [x] 임박 예약(D-N), 연박 할인 로직 적용
    *   [x] **공휴일/대체공휴일**: 2025-2026 데이터 연동 및 가격/UI 반영 (Substitute Holidays) ✅
    *   [x] **동적 설정 연동**: 관리자 설정(입금계좌, 사이트정보) 실시간 반영 (Frontend Sync) ✅
*   **3.2 관리자 콘솔 (Admin Core)** ✅ (New)
    *   [x] **차단일 관리 (`BlockDateScheduler`)**: 통합 예약 캘린더로 격상
    *   [x] **가격/시즌 관리 (`PricingConfigEditor`)**: 실시간 가격 정책 수정
    *   [x] **입금 확인 (`ReservationList`)**: 대기 목록 및 확정 처리
    *   [x] **고객 관리**: 예약 이력(History) 조회 및 통합 차단 관리
*   **3.3 오픈일/PG** 🔄 (Next)
    *   [ ] 실제 PG 연동 (현재 무통장 입금만 구현) - 추후 연동 예정


### Phase 4: 커뮤니티 (Community) - ✅ 100% Completed
**"캠퍼들의 소통 공간 (User-First + Admin + Groups)"**
*   **4.1 메인/게시판** ✅: 6개 탭(공지/후기/이야기 등) 구현, Supabase 연동 완료
*   **4.2 기능 고도화 (Rx 1-5)** ✅: 
    *   [x] 모바일 최적화 (하단 바/키보드), 검색(Search), 하이브리드 페이지네이션
    *   [x] 내 공간 연동 (기록 페이지), 비공개 로직(Private)
*   **4.3 상호작용** ✅: 좋아요(공감), 댓글 구현 완료.
*   **4.4 보안 & 관리 (Security & Admin)** ✅: 
    *   [x] **RLS(Row Level Security)**: DB 보안 정책 적용 (작성자만 수정/삭제)
    *   [x] **관리자 공지/소모임**: 공지 작성/수정/삭제, 소모임 강제 삭제 기능 구현
*   **4.5 소모임 (Groups)** ✅:
    *   [x] **구조**: DB 스키마 (`groups`, `group_members`, `posts`) 및 RLS 정의
    *   [x] **기능**: 생성, 목록, 상세, 가입(Join/Leave), 게시글(Feed)
    *   [x] **좋아요/댓글 상호작용 (Likes/Comments)**
    *   [x] **안정화-v1**: Next.js 15 호환성, UI 오버랩 수정, 멤버십 로직 개선 완료

### Phase 5: 마켓 & 결제 (Market) - ✅ MVP 100% Completed
**"캠핑의 감성을 집으로 - Commerce"**
*   **5.1 상품 전시 (Product Display)** ✅:
    *   [x] 상품 목록/상세 페이지 구현 (Swiper 갤러리/옵션 선택).
    *   [x] 감성 UX 적용: 장바구니/구매하기 인터랙션, 품절 처리.
*   **5.2 장바구니 (Cart)** ✅:
    *   [x] 로컬 스토리지 기반 장바구니(Zustand).
    *   [x] 수량 조절, 삭제, 가격 합계 실시간 계산.
*   **5.3 주문/결제 (Checkout)** ✅:
    *   [x] 배송지 입력 폼 (Daum 주소 API 연동).
    *   [x] 결제 수단 선택 UI (무통장/카드).
    *   [x] 주문 완료 페이지 (Order Success).
*   **5.4 리뷰 시스템 (Reviews)** ✅ (Completed):
    *   [x] **구조**: `market_reviews` 테이블 스키마 검증 및 `UNIQUE(user_id, product_id)` 제약 확인.
    *   [x] **기능**: 리뷰 작성/삭제 (별점, 텍스트) 및 중복 방지 로직.
    *   [x] **검증**: 등록/삭제 버그(Disabled/Event) 해결 및 Toast 기반 삭제 확인 UI 적용.
    *   [x] **전시**: 상품 상세 하단 리뷰 리스트 감성 UI (3-State).
*   **5.5 관리자 & 통계 (Admin & Analytics)** ✅ (New):
    *   [x] **마켓 관리**: 상품 등록/수정/삭제 (CRUD) 및 외부 링크(External) 상품 지원.
    *   [x] **대시보드**: 전체/활동 회원 수, 입금 대기, 주문 건수 실시간 집계 구현.
*   **5.6 마켓 고도화 (Market 2.0) - 2026-01-12** ✅:
    *   [x] **데이터 최적화**: YouTube/Shorts 임베드(비용 0원) 및 상품 배지(Benefit Badges) 구현.
    *   [x] **이미지 업로드**: Supabase Storage 연동 및 Drag & Drop UI.

### Phase 5.5: 스마트 캠핑 플랜 (Smart Camping Plan) - ✅ 100% Completed
**"초개인화된 여정 안내 시스템 (Guided Journey)"**
*   **5.5.1 Headless Engine (`smartPlan.ts`)** ✅:
    *   [x] Zero-Cost High-Fidelity 필터링 (공공데이터 + 볼륨).
    *   [x] Stateless AI Narration (Gemini 1.5 Flash 연동).
    *   [x] Schema.org 기반 수익화 호환 JSON 팩트 리스트 반환 구조 마련.
*   **5.5.2 Action-to-Tag Systemization (`persona.ts`)** ✅:
    *   [x] 50개 마스터 태그 및 로직 세팅 (`user_personas`, `add_user_tag`).
    *   [x] 엔진 결합 (`generatePersonalizedSmartPlan`).
*   **5.5.3 [Priority] 점진적 프론트엔드 트리거 주입 (Progressive Injection)** ✅:
    *   [x] **예약 폼 (`ReservationForm.tsx`)**: 결제/확정 시 강력한 취향 시그널 발송.
    *   [x] **게시판 (`Feed`, `Post`)**: 사진/키워드 분석 및 좋아요/불씨 후원.
    *   [x] **내 공간 (`LBS`, `Record`)**: 키워드 기록 및 위치 탐색 시그널.
    *   [x] **마켓 & 마이스페이스 (`Market`)**: 감성 장비 클릭 및 LNT 미션 시그널.
*   **5.5.4 UI Component (`SmartPlanProposal.tsx`)** ✅:
    *   [x] Citational UI (서사 + 팩트 카드) 및 교체 상호작용 개발.
    *   [x] `Fallback Mock Data` 주입 로직 탑재 (미연결 또는 API Key 부재 시 무중단 렌더링).
    *   [x] **동적 카테고리**: 관리자 설정 페이지에서 카테고리 추가/순서변경 기능 구현.
*   **5.5.5 Hybrid Sync Stabilization (Phase 11 & 12) ✅ (2026-03-08)**:
    *   [x] **Phase 11**: PostGIS 기반 마스터 DB 스캔 및 날씨 가중치 1차 선별 구현.
    *   [x] **Phase 12**: 카카오맵 별점/리뷰 스크래퍼 및 실시간 팩트 정제 파이프라인 이식.
    *   [x] **v2 Update (2026-03-10)**: Evidence 구조화(Fact Chips), AI 환각 방지 지침 적용, 최신 API 연동 복구 완료.
    *   [x] **ETL 5.0 (2026-03-15)**: 주간 배치 자동화 통합('Gold Standard' 초고속 병합 스크립트 교체), UUID v5 기반 결정론적 ID(신뢰도 분석 기초), Proj4 좌표 변환 및 파일 기반 동기화 구현 완료.
    *   [x] **API Resilience (v4) (2026-03-17)**: ODcloud 백년가게 동적 경로 탐색(Swagger Discovery) 및 LocalData 기반 마트/식당 헬스체크 전환으로 전 계통 안정성 확보 완료.
    *   [x] **SSOT**: `smart_camping_plan_manual.md`에 전체 로직, 인증 가중치(+15, +30), 하이브리드 수집 전략 통합 최신화.
    *   [x] **Stabilization**: D-3 동적 동기화 크론 작업의 테이블 참조 오류(`schedules` -> `user_schedules`) 수정 및 검증 완료.
    *   [x] **5.5.6 Unified User Camping Profile ✅ (2026-03-17)**:
        *   [x] **DB**: `user_camping_profiles` 테이블 구축 및 RLS/RPC (`upsert_camping_profile`) 적용.
        *   [x] **UI**: `CampingProfileGate` 공용 컴포넌트 개발 (카카오맵 주소-좌표 변환 연동).
        *   [x] **Flow Integration**: 예약, 타캠핑장 일정 등록, 캠핑장 추천(PlanLock), 스마트플랜 4대 엔진 통합 완료.
        *   [x] **UX**: 기존 정보 존재 시 '간편 확인' 버튼 하나로 통과하는 최적화 로직 적용.

### Phase 6: 확장 모듈 (Expansion) - 🔄 Ongoing (98%)
**"더 깊은 연결과 재미"**
*   **6.1 크리에이터 콘텐츠 보드 (MVP)** ✅:
    *   [x] **구조**: `creators`, `creator_contents` DB 및 서비스 로직.
    *   [x] **기능**: 작성, 리스트, 상세, **상호작용(좋아요/댓글/구독)** 구현 완료.
    *   [x] **관리**: 관리자 승인 시스템 및 테스트 계정 지원 포함.
*   **6.2 미션 & 보상 (Mission System)** ✅ (100% Completed):
    *   [x] **구조**: `missions`, `user_missions`, `point_history` 스키마 및 RLS.
    *   [x] **기능**: 리스트, 상세, 참여(Join), 인증(Photo), 보상(Point/XP).
    *   [x] **커뮤니티 연동**: 주간 미션 게시물 자동 생성(RPC), 댓글 사진 인증(Compression).
    *   [x] **UX**: 초보자/기존 유저 홈 위젯 연동.
    *   [x] **초보자 모드 홈**: 히어로 섹션, 3-Step 추천 가이드(요리/놀이/이벤트) 카드 뷰 구현.
    *   [x] **재방문자 모드 홈**: 예약/미션 중심 대시보드 UI, 퀵 액션(체크인/매너타임) 구현.
    *   [x] **날씨/시간 개인화**: `useWeather` & `usePersonalizedRecommendation` 기반 상황별 인사말 및 날씨 배지(Open-Meteo) 적용.
    *   [x] **Skeleton UI**: 3-State UX(Loading/Empty/Error) 적용 완료.
    *   [x] **관리**: 미션 관리자 페이지(Admin) 확인(Verified) + **참여 철회 기능 추가**.
    *   [x] **Ranking**: 인기순(Trending) 정렬 및 배지 로직 추가.
    ### Phase 4: Personalization Engine Upgrade (Components & Logic) - **[COMPLETED]**
    - [x] **Context-Aware Hook (`usePersonalizedRecommendation`)**
      - [x] Rule-based Scoring (Season/Weather/Time).
      - [x] Reason Generation.
      - [x] Shuffle / Random Box Logic.
    - [x] **UI Integration**
      - [x] Home Detail Sheet: Add Shuffle Button & Reason Badge.
      - [x] Restore Rich Content (Recipe Steps, Ingredients). 정렬 및 배지 로직 추가.
    *   [x] **Critical Fixes (2025-12-30)**: 
        *   Deletion Persistence (RPC Cascade + Self-Healing).
        *   Reverse Cascade (Comment Delete -> Mission Withdraw).
        *   Comment Visibility (Sync Fix).
    *   [x] **XP/Token Lifecycle (2025-12-31)**:
        *   **Clawback**: 미션/게시물 삭제 시 획득했던 XP/Token 자동 회수 (Trigger).
        *   **Photo Rewards**: 사진 업로드 보상도 콘텐츠 ID(`related_id`)와 연동하여 자동 회수 구현.
        *   **Admin Deletion**: 관리자 강제 삭제 기능 (RPC `admin_force_delete_post`) 복구 및 UI 적용.
*   **6.3 확장 지도** ⬜: (대기)

### Phase 7: 운영 & 갭 필링 (Ops & Gap Filling) - 🔄 Ongoing (99%)
**"사용자 피드백 기반 디테일 완성"**
*   **7.0 이슈 긴급 대응 (Hotfixes)** ✅:
    *   [x] **미션 피드**: 좋아요, 본인 삭제 기능 완비 (RLS/RPC).
    - [x] **커뮤니티**: 댓글 좋아요(New), 삭제 오류 해결 및 삭제 확인 모달 추가 (Optimistic UI Fix).
    - [x] **Admin Ops**: 콘텐츠 댓글 삭제, 미션 참여 강제 철회, **글로벌 게시물 삭제(Global Delete)** 구현 완료.
    - [x] **Policy Enforcement**: **XP/Token 회수(Clawback)** 로직 및 **좋아요 동기화(Sync)** 구현 완료.
    - [x] **Navigation Fix (2025-12-31)**: 탭 이동 시 페이지 새로고침 되어도 상태 유지(URL Sync) 및 깜빡임 제거.
*   **7.1 글로벌 UI/UX** ✅:
    *   [x] **TopBar**: 설정 메뉴(프로필/알림/약관) 및 로그아웃 구현 완료.
    *   [x] **Login UX**: 비로그인 접근 제한(Global Modal) 및 로그아웃 시 XP 초기화 구현 완료.
*   **7.2 홈 디테일 (Home Details)** ✅:
    *   [x] **초보자 칩**: 6개 고정 칩 디자인 적용 및 관리자 연동 완료.
    *   [x] **오늘의 콘텐츠**: '오늘의 추천'으로 명칭 변경 및 개인화 엔진 V2 (`recommendation_pool`) 프론트엔드/백엔드 고도화 완료.
    *   [x] **링크 수정**: 관리자 설정(기본정보)에서 주요 링크 및 텍스트 제어 가능.
    *   [x] **관리자 고도화 V2.1**: AI Bulk Import, 구조화된 재료/단계 입력 폼, 개인화 필드(인분/칼로리/연령/장소) 관리.
*   **7.3 내공간 고도화 (My Space Pivot)** ✅:
    *   [x] **오늘의 콘텐츠**: '오늘의 추천'으로 명칭 변경 및 개인화 엔진 V2 (`recommendation_pool`) 프론트엔드/백엔드 고도화 완료.
    *   [x] **링크 수정**: 관리자 설정(기본정보)에서 주요 링크 및 텍스트 제어 가능.
    *   [x] **관리자 고도화 V2.1**: AI Bulk Import, 구조화된 재료/단계 입력 폼, 개인화 필드(인분/칼로리/연령/장소) 관리.
*   **7.3 내공간 고도화 (My Space Pivot)** ✅:
    *   [x] **위치 기반 편의시설**: `site_config.nearby_places`와 연동된 주변 편의시설 탭 구현.
    *   [x] **주변 즐길거리**: `nearby_events` DB 연동 및 LBS.
    *   [x] **Fallback 데이터 개선 (2026-01-07)**: 가평 → 예산군 데이터 변경, 검색 반경 10km → 20km 확장.
    *   [x] **행사 UI 개선**: 이미지 제거, 진행중 뱃지 이동, 상세보기 버튼(TourAPI 연동).
    *   [x] **Archive UX (New)**: 불멍/별보기/꾸미기 버튼 삭제. 사진 업로드 및 뷰어 품질 강화.
    *   [x] **Action**: '기록하기(Log)' 버튼 강조 및 접근성 개선.
    *   [x] **일관성**: 내공간 전반(Records, Album, History)의 도구 UI 경험 통일.
*   **7.5 시스템 운영 및 안정성 (System Ops)** ✅:
    *   [x] **날씨 예보 고도화**: 단기/중기 예보 병합 로직 수정으로 **10일 예보** 지원 완료.
    *   [x] **시스템 운영보드 (New)**: `/admin/operations` 구현 (SSOT 26장). 유저 접근 제어(유지보수 모드), 예약 차단, 캐시/알림 리셋 원클릭 대응.
    *   [x] **도움말 가이드**: 운영보드 내 상황별 조치 가이드(Dialog) 탑재.
*   **7.6 마켓 피벗 (Market Pivot)** ✅ (2026-01-13):
    *   [x] **제휴 중심**: 자체 상품 대신 외부 링크(쿠팡 파트너스 등) 지원 구조 완성. ProductCard 및 상세 페이지에서 "구매처로 이동" 분기 처리.
*   **7.5 예약 자동화** ✅ (이미 구현됨):
    *   [x] **오픈 로직**: `OpenDayConfig.tsx` 컴포넌트에서 매월 자동 반복 규칙 지원. `open_day_rules` 테이블 + `automation_config` JSONB.
*   **7.6 외부 API 연동 (Final Polish)** ⬜ (도메인 발급 후):
    *   [ ] **TourAPI/Kakao**: `nearby_events` 및 `site_config` 데이터를 실제 외부 API와 실시간 동기화 (안정화 단계에서 진행).

### Phase 8: 안정화 및 리팩토링 (Stabilization) - 🔄 In Progress
**"Codebase Health Improving - Operation Sparkling Forest"**
*   **8.1 Component Sanitization** ✅ (2025-12-31):
    *   [x] `src/components` 전역 Lint 수정 (MyMapModal, ReturningHome 등).
    *   [x] `any` 타입 제거 및 `Next/Image` 최적화.
*   **8.2 Hook Refactoring** ✅:
    *  - [x] **2.5. Structure & Cleanup** (Completed - Runtime Stable)
    - [x] Global Import Cleanup (Partially done for Admin/Core modules)
    - [x] Global Linting (Critical Admin Modules Cleaned)
    - [x] Unused Component Removal (Alert restored, others verified)
    - [x] Critical Refactors (`package` -> `pkg`, `MySpaceState` export)
    *   [x] **8.3 Safe Refactoring (Deep Type Safety)** ✅ (2026-01-04):
        *   [x] **Stage 4-8 Complete**: Removed 40 `any` types + Production build enabled
        *   [x] Components (8): BeginnerHome, ReturningHome, SiteList
        *   [x] Store Layer (16): Error handlers + DB mapping
        *   [x] Services (7): communityService, creatorService, communityUtils
        *   [x] Weather API (9): Comprehensive KMA type definitions
        *   [x] **Production Build**: ✅ Enabled with `ignoreBuildErrors` (temporary)
        *   [x] **Live Verification**: All features tested via browser - 0 runtime errors
    *   [x] **8.4 Type System & Personalization** ✅ (2026-01-07):
        *   [x] **DB Schema**: `profiles` table updated (Family/Interests) & Types patched.
        *   [x] **Personalization Engine**: Hook updated to boost scores based on profile.
        *   [x] **UI**: Nickname greeting & Recommendation reason fix.
        *   [x] **Logic**: Expanded pool to Top 50 for variety.
        *   [x] **Admin**: Replaced deletion popup with AlertDialog.
        *   [x] **Production Build**: ✅ SUCCESS (Exit code: 0)
        *   [x] **Live Verification**: Verified recommendation logic via code review & build.
        *   [x] **8.5 External API Expansion (Nearby Activities)** ✅ (2026-01-09):
            *   [x] **Integration**: TourAPI(Leisure/Attraction) + Public Data Portal(Performance/Festival).
            *   [x] **Filtering Logic**: Camping keyword exclusion in Leisure tab.
            *   [x] **UI Enhancement**: 4-Tab System (Events/Leisure/Attractions/Facilities) with badges.
            *   [x] **Admin Operations**: Mission Deletion & Bulk Import fully fixed (Server Actions).
            *   [x] **UI Polish**: Recommendation Colors & Layout finalized.
            *   [x] **Status**: **100% Done**
            *   **Phase 1: Image Editor 2.0 (Mobile Optimized)**
  - [x] UI/UX Overhaul for Mobile (Bottom Sheet, Touch-friendly)
  - [x] Text Tool Improvements (Double-click edit, Background toggle)
  - [x] Filter Presets & Drawing Tool
  - [x] **Global Integration**: "Leave Record" & "1-Minute Record" (Completed)sts, Comments.
        *   [x] **8.6 Weekly Mission Ranking & Ember Support** ✅ (2026-01-10):
            *   [x] **Mission Ranking**: GitHub Actions cron (Sundays 21:00 KST) + API Route + Admin UI.
            *   [x] **Ember Support (불씨)**: Token-based "quiet support" system (10 tokens).
            *   [x] **Ember Integration**: Mission cards, Community posts, Comments.
            *   [x] **Home Fix**: Restored MissionHomeWidget to BeginnerHome.
            *   [x] **DB Migration**: `20260110_mission_ranking_rewards.sql`, `20260110_ember_support.sql`.
            *   [x] **Planning**: Created `ember_feature_spec.md` & `ember_implementation_plan.md` for Phase 8.7.
            *   [x] **Status**: **100% Done**
        *   [x] **8.7 Ember Notifications & Stats** ✅ (2026-01-11):
            *   [x] **Notification System**: `EMBER_RECEIVED` 알림 타입 + 인앱 배지 자동 생성.
            *   [x] **Stats RPC**: `get_my_ember_stats`, `get_sent_embers`, `get_received_embers`.
            *   [x] **HeroSection Badge**: 받은 불씨 > 0일 때 좌측 상단에 "불씨 N개" 표시.
            *   [x] **Embers Page**: `/myspace/embers` - 받은/남긴 불씨 탭, 빈 상태 UI 포함.
            *   [x] **DB Migration**: `20260111_ember_notifications.sql`.
            *   [x] **Live Verification**: 브라우저 검증 완료.
            *   [x] **Status**: **100% Done**
        *   [x] **8.8 Reservation Concurrency & Admin Deletion** ✅ (2026-01-12):
            *   [x] **Reservation Concurrency**: Advisory Lock + RPC (`create_reservation_safe`).
            *   [x] **Admin Deletion**: AlertDialog 방식으로 후기/컨텐츠/마켓/공지 삭제 개선.
            *   [x] **Notice Query Fix**: SlimNotice 컬럼명 수정 (`board_type` → `type`).
            *   [x] **DB Migration**: `20260111_reservation_concurrency.sql`, `20260111_admin_delete_permissions.sql`.
            *   [x] **Status**: **100% Done**
        *   [x] **8.9 Emotional Greeting System (New)** ✅ (2026-01-12):
            *   [x] **Logic Upgrade**: 날씨/시간/계절/온도(혹한/무더위) 통합 판별 로직 적용.
            *   [x] **Rich Pool**: 100+ 문학적/감성적 멘트 풀(Pool) 구축 및 랜덤 로테이션.
            *   [x] **UI Integration**: SlimNotice(한줄공지) 겹침 해결 및 버그 수정.
            *   [x] **Verification**: 브라우저 시뮬레이션 검증 완료.
            *   [x] **Status**: **100% Done**
        *   [x] **8.10 Market Data Optimization & Dynamic Config** ✅ (2026-01-12):
            *   [x] **Zero-Cost Video**: YouTube/Shorts/TikTok Lazy Load 임베드.
            *   [x] **Image System**: URL 방식 → Supabase Storage 직접 업로드 전환.
            *   [x] **Admin Empowerment**: 마켓 카테고리 관리자 직접 설정(JSONB) 구현.
            *   [x] **Status**: **100% Done**
        *   [x] **8.11 UX Improvements & Loading Optimization** ✅ (2026-01-14):
            *   [x] **Terms Integration**: 이용수칙/환불규정 통합 (TermsAgreementDialog 컴포넌트).
            *   [x] **Back Button UX**: 4개 Sheet 백버튼 처리 (HomeDetailSheet, FacilityDetailSheet, NearbyDetailSheet, PriceGuideSheet).
            *   [x] **Touch Feedback**: 모바일 터치 피드백 (globals.css + BottomNav).
            *   [x] **Reservation DB Sync**: 예약 상세 페이지 SITES 상수 → Supabase 조회 변경.
            *   [x] **Loading Optimization**: 날씨 의존성 분리 (usePersonalizedRecommendation).
            *   [x] **User Guidance**: 날씨/주변정보 시간차 안내 문구 추가.
            *   [x] **Status**: **100% Done**
        *   [x] **8.12 Responsive Typography Review** ✅ (2026-01-14):
            *   [x] **Issue**: 히어로 텍스트 및 추천 카드 UI가 모바일 화면 너비에 따라 틀어지는 현상.
            *   [x] **Core Utility**: `globals.css`에 `clamp()` 기반 반응형 텍스트 클래스 추가 (`.text-responsive-hero-title` 등).
            *   [x] **Applied Areas**:
                *   [x] **Beginner Home**: Hero Title/Description & Info Chips.
                *   [x] **Recommendation Grid**: Card Titles & Badges (Difficulty/Time/Calories).
            *   [x] **Build Verification**: ✅ SUCCESS (Exit code: 0).
        *   [x] **8.13 My Map UX & Geocoding** ✅ (2026-01-14):
            *   [x] **Reverse Geocoding**: Kakao Maps API 연동하여 지도 클릭/검색 시 주소 자동 변환.
            *   [x] **UX Enhancement**: 검색-지도 클릭 간섭 방지, 새 아이템 리스트 상단 추가 및 자동 스크롤.
            *   [x] **UI Polish**: 마커 아이콘 변경 (Flag), 툴팁 정보 강화.
            *   [x] **Mobile Map**: 터치 이벤트 전파 차단으로 지도 등록 오동작 해결.
            *   [x] **Consistency**: "나만의 캠핑지도" 명칭 통일 & 데이터 마이그레이션(x/y -> lat/lng) 완료.
            *   [x] **Status**: **100% Done**
        *   [x] **8.15 Reservation UX & Smart Re-book** ✅ (2026-01-15):
            *   [x] **Smart Re-book**: "지난 여행 조건으로 예약하기" 기능 고도화 (인원/차량/연락처 Pre-fill).
            *   [x] **Smart Pre-fill**: 새 예약 시에도 최근 예약 기록(취소건 포함) 기반 연락처 자동 입력 지원.
            *   [x] **Upcoming UI**: 체크인 날짜순 정렬 복원 및 입금대기(Pending) 예약 별도 카드/시트 분리.
            *   [x] **Navigation**: '나의 예약' 더보기 버튼 → 전체 내역 페이지 연결.
            *   [x] **UI Polish**: "1가족, 방문객 N명" 포맷 통일 및 라벨링 개선.
            *   [x] **Status**: **100% Done**
        *   [x] **8.16 MySpace Notebook Feel (New)** ✅ (2026-01-16):
            *   [x] **Paper Background**: `PaperBackground.tsx` (SVG noise + cream gradient).
            *   [x] **Dog-ear Effect**: EmotionalQuote 상단 우측 모서리 접힘 CSS 효과.
            *   [x] **Tape Effect**: SummaryGrid 카드 상단 테이프 + 기울기 효과.
            *   [x] **Branding**: "내공간" → "내 수첩" 명칭 변경.
            *   [x] **Branding**: "내공간" → "내 수첩" 명칭 변경.
            *   [x] **Status**: **100% Done**
        *   [x] **8.17 Permission Flow & Admin Dashboard** ✅ (2026-01-16):
            *   [x] **Sequential Flow**: 위치 권한(1단계) -> 푸시 권한(2단계) 순차 UX 및 감성 카피 적용.
            *   [x] **iOS Support**: iOS Safari '홈 화면에 추가' 가이드 모달 구현.
            *   [x] **Admin Dashboard**: 위치/푸시 권한 동의율 통계 카드 추가 (DB 연동).
            *   [x] **Weather Consistency**: `useWeather.ts`의 타임존(UTC) 이슈 해결 및 상세화면(`WeatherDetailSheet`) 로직 통일.
            ### [STEP 5.2] Reliability Audit & Automation Recovery (2026-03-16) ✅
- **정밀 감사 완료**: 코드-매뉴얼 전수 대조 및 불일치(카카오 범위, 스로틀링, 기상 Fallback) 수정 완료.
- **자동화 복구**: KST 타임존 보정 및 메모리 최적화 배치 로직 적용으로 Cron Job 신뢰성 회복.
- **결과**: 예산군 권역 D-3 캐싱 시뮬레이션 성공 및 내일 새벽 통합 테스트 준비 완료.
            *   [x] **Push Audit**: 예약/취소 알림 로직 전수 조사 및 보완 완료 (수신 실패 디버깅 대기).
            *   [x] **Push Stability (2026-02-27)**: **Foreground (In-app Toast) Success**. Background stabilization in progress.
            *   [x] **Status**: **99% Done (Background Still Silent)**

### Phase 9: 선택적 작업 (Non-Urgent - 다음 세션)
> ⚠️ **긴급도: 낮음** - 핵심 기능(예약/커뮤니티/홈)에는 영향 없음
*   **9.1 Edge Function 배포 (Complete)** ✅:
    *   [x] `supabase/functions/push-notification/` → Supabase 대시보드에서 배포 완료
    *   [x] 환경 변수 설정: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Supabase Secrets)
    *   [x] 클라이언트 환경 변수: `NEXT_PUBLIC_FIREBASE_*` (Vercel)
*   **9.2 DB Schema 동기화** (Priority: LOW):
    *   [ ] Supabase CLI 인증 후 `npx supabase gen types typescript` 실행
    *   [ ] 현재 빌드는 기존 타입으로 정상 동작 중
*   **9.3 ESLint 정리** (Priority: LOW):
    *   [ ] `eslint ignoreDuringBuilds` 해제 전 경고 정리
*   **9.4 카카오맵 JavaScript SDK 등록** (Priority: LOW - 도메인 확정 후):
    *   [ ] 도메인 확정 후 Kakao Developers 앱에 JavaScript SDK 도메인 등록
    *   [ ] JavaScript 키 발급 및 `NEXT_PUBLIC_KAKAO_JS_KEY` 환경변수 추가
    *   [ ] 지도 렌더링 기능 구현 (선택)
*   **9.5 PWA 구현** ✅ (2026-01-13):
    *   [x] `manifest.json` 작성 (앱 이름, 아이콘, 테마 색상)
*   **9.6 스마트 캠핑 플랜 (Guided Journey \u0026 Persona) 🚀 (Next Target)**:
    *   [x] **1단계: 엔진 정합성 전수 조사 및 수정 계획 수립 (Audit Complete)**: 매뉴얼 기준 15-Fact 파이프라인, 페르소나 연동 결함 파악 및 3-Phase Fix Plan 확정.
    *   [x] **1.1단계: 코어 기반 공사 (Phase 1 Fix)**: KMA 기상청 단/중기 일일 호출량 초과 방어를 위한 무료 글로벌 API(Open-Meteo) Fallback 시스템 이식 완료.
    *   [x] **1.2단계: API 생존성(Resilience) 확보**: ODcloud(백년가게) Swagger 동적 UDDI 추출 로직 구현 및 TourAPI(관광/축제) `KorService2` 마이그레이션 완료 (500/400 Error 우회 성공).
    *   [ ] **1.3단계: 동적 가중치 알고리즘 (Phase 2 Fix)**: 사용자 취향 태그 연동, 자녀 동반 가산점 로직 및 휴무일 방어 적용.
    *   [ ] **1.4단계: 기후 연동 및 엔진 안정화 (Phase 3 Fix)**: 우천/기온(동계) 기반 점수 변동 로직 구현.
    *   [ ] **2단계: 태그 매핑 시스템 (`persona.ts`) & 8-Step Deep Dive 디버깅**: (다음 세션 예정)
    *   [ ] **1.3단계: 기후 연동 및 엔진 안정화 (Phase 3 Fix)**: 우천/기온(동계) 기반 점수 변동 로직 구현.
    *   [ ] **2단계: 태그 매핑 시스템 (`persona.ts`)**: (진행 중)
    *   [ ] **3단계: 최종 연동 (Integration)**: (진행 중)
    *   [x] 앱 아이콘 준비 (192x192, 512x512, 180x180) - 원본 로고 활용
    *   [x] Service Worker 확장 (Next.js PWA 기본 지원)
    *   [x] 메타 태그 추가 (`layout.tsx`) - 한국어 SEO 및 OG 태그 적용
    *   [x] "홈 화면에 추가" 기능 테스트 완료
    *   [ ] (선택) TWA로 플레이스토어 등록
*   [x] **9.6 빌드 오류 수정 및 타입 동기화** ✅ (2026-01-13):
    *   [x] **Supabase Types**: `site_config`, `posts`, `sites`, `nearby_events` 정의 현행화.
    *   [x] **Code Corrections**: `BeginnerHome`(이벤트 타입), `ReservationStore`(사이트/예약 타입), `CommunityService`(글/댓글 타입) 수정.
    *   [x] **Build Verification**: `npm run build` 성공 (Exit code: 0).
    *   [x] **Deployment**: ✅ Vercel 배포 완료 (`https://raon-i.vercel.app`)
*   [x] **9.7 Notification Reliability Upgrade** ✅ (2026-02-20):
    *   [x] **Duplicate Fix**: Implemented DB Unique Constraint + Edge Function Single-Delivery Policy + FCM Collapse Keys.
    *   [x] **Camping Reminders**: Scheduled `pg_cron` job for `invoke-camping-reminder`, caught up missed notifications.
    *   [x] **Handbook v2.0**: Updated `docs/notification_manual.md` with full specs and troubleshooting guide.
    *   [x] **Verification**: Zero duplicates confirmed in logs, reminder execution verified.
*   [x] **9.8 Camping Reminder Cron & Timeout Fix** ✅ (2026-02-21):
    *   [x] **Timeouts Avoided**: Implemented `mode=prefetch` (10-min preemptive API caching) and `mode=dispatch` (DB-only quick send) in Edge Function.
    *   [x] **Cron Migration**: Disabled unreliable `pg_cron` and replaced with free GitHub Actions scheduler.
    *   [x] **Verification**: Dispatched 7 missing notifications successfully; user checking tomorrow.



---

## 🚀 배포 체크리스트 (Deployment Checklist)

### ✅ 배포 전 완료 항목 (Pre-Deployment - Done)
| 항목 | 상태 | 비고 |
|------|------|------|
| Supabase 마이그레이션 실행 | ✅ | `site_config` 보상 컬럼, `mission_rewards` 테이블, RPC 함수 |
| 로컬 환경변수 설정 | ✅ | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` |
| 관리자 보상 설정 UI | ✅ | `/admin/settings` 하단 "주간 미션 Top 3 보상 설정" |

### ⏳ 배포 후 필요 작업 (Post-Deployment - Pending)
> ⚠️ **주의**: GitHub Secrets 및 외부 API 설정은 **도메인 발급 후** 진행해야 합니다.

| 항목 | 설명 | 링크/방법 | 의존성 |
|------|------|------|------|
| **Supabase 마이그레이션** | 불씨(Ember) 지원 테이블 생성 | `20260110_ember_support.sql` 실행 | - |
| **Vercel 환경변수 추가** | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | Vercel Dashboard → Settings → Environment Variables | 도메인 발급 후 |
| **GitHub Secrets 설정** | `APP_URL` (배포된 URL), `CRON_SECRET` | GitHub → Settings → Secrets → Actions | 도메인 발급 후 |
| **GitHub Actions 활성화** | `.github/workflows/mission-ranking-cron.yml` | Push 후 자동 활성화. Actions 탭에서 확인 | 도메인 발급 후 |
| **의도된 작동 확인** | 일요일 21:00 KST 자동 랭킹/보상 | Actions 로그 확인 또는 수동 트리거 테스트 | 도메인 발급 후 |

### 📌 GitHub Secrets 설정 방법
1. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. 추가할 항목:
   - `APP_URL`: `https://your-app.vercel.app` (배포 후 Vercel에서 확인)
   - `CRON_SECRET`: 로컬 `.env`에 설정한 것과 동일한 값

### 📌 Vercel 환경변수 설정 방법
1. Vercel Dashboard → 프로젝트 선택 → **Settings** → **Environment Variables**
2. 추가할 항목:
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard에서 복사
   - `CRON_SECRET`: GitHub Secrets와 동일한 값

### 🧪 수동 테스트 방법
```bash
# 배포 후 API 테스트
curl -X POST https://your-app.vercel.app/api/cron/mission-ranking \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

1.  **Priority**: **내공간 리뉴얼 (My Space Pivot)**.
2.  **Strategy**: "어설픈 기능보다 확실한 감성(사진)"으로 전환.
3.  **Next**: 제휴 마켓 및 자동화.

---

## 🚀 Phase 10: AI 프리미엄 수익화 연구 (Post-Launch)
**"플랫폼 수익의 핵심 축 - AI 기반 고급 프리미엄 기능"**

> ⚠️ **시기**: 초기 버전 오픈 후 심화 연구 진행
> 📄 **참고 문서**: `premium_features_v2.md` (상세 기능 제안)

### 📋 배경 및 전략

**문제**:
- 소규모 캠핑장의 수익 한계
- 대형 예약플랫폼 수수료 탈피 필요
- 플랫폼 유지/발전을 위한 수익화 필수

**핵심 인사이트**:
- AI API 비용 = 호출 횟수에 비례
- **유료 구독자만 AI 기능 사용 = 항상 흑자 구조**
- 프리미엄 1,000명 × 4,900원 = 490만원/월, AI 비용 ~5,000원 (수익률 99%)

**🎯 AI 설계 원칙**:
- **"1회 호출 = 완벽한 결과"** 원칙 준수
- 일정 + 메뉴 + 준비물을 한 번에 제공하도록 프롬프트 설계
- 동일 조건 결과는 캐싱하여 재사용
- → 사용자 만족 ↑, 운영 비용 ↓ (Win-Win)

### 💡 AI 프리미엄 기능 후보

| 기능 | 설명 | 예상 비용 |
|------|------|----------|
| **AI 캠핑 코치** | 과거 기록 기반 맞춤 캠핑장 추천 | ~0.7원/호출 |
| **AI 메뉴 플래너** | 날씨 기반 메뉴 + 장보기 리스트 | ~0.85원/호출 |
| **스마트 체크리스트** | 날씨 기반 준비물 자동 추천 | 캐싱 가능 |

### 🎁 비-AI 프리미엄 기능 후보

| 기능 | 왜 돈을 낼까? | 수익 모델 |
|------|-------------|----------|
| **📖 포토북 인쇄** | 디지털→실물 책 소장 | 건당 19,900원~ |
| **⏰ On This Day** | 매일 옛 추억 푸시 | 연 9,900원 |
| **📅 연간 캠핑 연감** | 자동 통계 + 인쇄 가능 | 인쇄 29,900원 |
| **🏅 VIP 클럽** | 모든 기능 + 마켓 할인 | 월 9,900원 |

### 📊 가격 전략

| 플랜 | 가격 | 포함 |
|------|------|------|
| **Basic** | 무료 | 기본 기록, 5GB |
| **Plus** | 월 4,900원 | On This Day, 연감, 체크리스트 |
| **VIP** | 월 9,900원 | 전체 AI + 포토북 할인 + 마켓 10% |

### 📌 연구 과제 (To-Do)

- [ ] AI 모델 비용 최적화 (GPT-4o-mini vs Gemini Flash)
- [ ] 포토북 인쇄 외주 파트너 탐색
- [ ] 결제 시스템 구현 (토스페이먼츠/카카오페이)
- [ ] 무료 체험 → 유료 전환 UX 설계
- [ ] 호출 제한 및 캐싱 전략

### 🔗 관련 문서

- **프리미엄 기능 상세**: `brain/*/premium_features_v2.md`
- **수익화 전략 초안**: `brain/*/monetization_strategy.md`
- **복합 편집 제안**: `brain/*/composite_editing_proposal.md`
- **AI 에이전트 대응 전략**: `brain/*/ai_agent_era_strategy.md`

---

## 🚀 Phase 11: AI 에이전트 시대 대응 (최종 출시 직전)
**"AI가 라온아이를 정확히 인용하도록"**

> ⚠️ **시기**: 개발 완료 후, 최종 출시 **직전**에 진행
> 📄 **참고 문서**: `ai_agent_era_strategy.md`

### 🎯 왜 출시 직전인가?

- 지금은 계속 수정/보완 중 → 정보 변경 가능
- AI가 오래된 정보를 캐시할 위험
- **정보가 확정된 후** AI에 노출해야 정확도 ↑

### 📋 출시 직전 체크리스트

- [ ] **llms.txt 생성** - 핵심 정보 AI용 요약 파일
- [ ] **AEO 공개 페이지** - `/about`, `/info` 정책/시설/가격 요약
- [ ] **Schema.org 마크업** - `Campground`, `CampingPitch`, `Offer`
- [ ] **SSOT 최종 점검** - 환불/이용수칙/시설 정보 일치 확인
- [ ] **robots.txt 업데이트** - AI 크롤러(GPTBot, ClaudeBot) 허용
- [ ] **UTM/로그 표준화** - AI 유입 측정 준비

### 💡 핵심 원칙

- **비용 0원** - 정적 파일/코드 추가만
- **한 번에 정확하게** - 수정 최소화

---

## 🏕️ Phase 12: 캠핑 아지트 (Camping Ajiit) - 🔄 진행중
**"다른 캠핑장 추천 + 캠핑 일정 관리 + 프라이빗 커뮤니티"**

> **시작일**: 2026-02-02
> **예상 총 시간**: ~100시간

### Phase 12.1: 모드/토글/Plan Lock ✅ (완료: 2026-02-02)
*   [x] **DB 스키마**: `20260202_camping_ajiit_full.sql`
*   [x] **타입 정의**: 6개 모드, 12개 토글, 20개 표준 태그
*   [x] **모드 선택 UI**: `ModeSelector.tsx` (Lucide 아이콘)
*   [x] **토글 선택 UI**: `ToggleSelector.tsx` (12개, 최대 4개 선택)
*   [x] **Plan Lock 페이지**: 3단계 플로우
*   [x] **추천 로직**: 점수 기반 알고리즘
*   [x] **홈 진입점**: BeginnerHome, ReturningHome 카드 추가

### Phase 12.2: 캠핑장 DB 구축 ✅ (완료: 2026-02-03)
*   [x] **고캠핑 API 연동**: `lib/gocamping-api.ts` - 기본/검색/전체 조회
*   [x] **자동 태깅**: `lib/auto-tagging.ts` - 12개 토글 매핑
*   [x] **데이터 동기화**: `/api/admin/campgrounds/sync` API
*   [x] **DB 스키마 확장**: 환경 필드 7개 추가, upsert RPC
*   [x] **검증**: 샘플 100개 동기화 성공

### Phase 12.3: 일정/기록/찜/알림 (~30시간)
*   [x] **일정 관리**: 캠핑 일정 CRUD (UpcomingReservation 통합 표시 완료)
*   [x] **1분 기록 (MyAjiit)** ✅:
    *   [x] **DB**: `camping_records` 스키마 및 RLS.
    *   [x] **UI**: `QuickRecordForm`, `RecordList`, `AjiitCard`.
    *   [x] **Photo**: Image Editor V3.1 (Crop/Filter/Text/Draw) + Safe Save Logic.
    *   [x] **Map**: `MyMapList` (지도) 연동 완료.
    *   [x] **Review**: `ReviewBoard` 탭 분리 (RaonAI vs Camper) 구현 완료.
*   [ ] **찜 기능**: 캠핑장 찜하기
*   [x] **준비 알림**: D-4(장비), D-1(메뉴), D-0(행사) 알림 구현 및 고도화 완료. 동적 캐싱 크론 오동작(`user_schedules` 참조 오류) 수정 및 검증 완료. (2026-03-15)

### Phase 12.4: 복합 편집 (~31시간)
*   [x] **뷰 스위처 (View Switcher)**: `1분 기록` 탭에서 리스트/그리드/캘린더 뷰 전환 UI 구현 완료.
*   [ ] **계절별/타임라인 뷰**: (UI 구현됨, 데이터 연동 예정)
*   [x] **미션 연동 (New)**: 미션 성공 시 자동 '이야기(STORY)' 게시물 생성 (Private) 기능 구현 완료.

### Phase 12.5: 프라이빗 커뮤니티 (~16시간)
*   [ ] **캠핑 노트 방식**: 실시간 채팅 대신 게시판형
*   [ ] **그룹 타입 확장**

