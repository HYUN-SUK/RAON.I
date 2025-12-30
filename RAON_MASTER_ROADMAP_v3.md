# RAON.I 마스터 개발 로드맵 v3 (Final Integrated Version)

**버전**: v4.0 (Gap Analysis & Final Polish)
**기반**: RAONAI SSOT MASTER v9 + User Feedback (Gap Filling)
**작성일**: 2025-12-06

이 문서는 라온아이 프로젝트의 **최종 확정형 개발 가이드**입니다.
기존의 견고한 프레임워크 위에 **트렌드(감성·초개인화)**와 **현실적인 AI 전략(L0/L1)**을 결합하여, 사용자에게 가장 가치 있는 경험을 우선적으로 전달합니다.

---

## 📅 전체 진행률 요약 (Progress Summary)

| 단계 | 구분 | 상태 | 진행률 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **코어 플랫폼 기반 (Foundation)** | ✅ **완료** | 100% | 필코노미 감성 톤, UI 프레임, 데이터 레이어 |
| **Phase 1** | **사용자 홈 (User Home)** | ✅ **완료** | 100% | Beginner/Returning UI, Smart Re-book, L0 Logic 완료 |
| **Phase 2** | **내공간 (My Space)** | 🔄 **진행 중** | 90% | 대시보드/지도/타임라인 완료. 아카이브(기록) 리뉴얼 및 미션 배지 완료. |
| **Phase 3** | **예약 시스템 (Reservation)** | ✅ **완료** | 90% | Logic/Validation/Admin Core 완료. PG/오픈일 남음. |
| **Phase 4** | **커뮤니티 (Community)** | ✅ **완료** | 100% | RLS 보안, 관리자 공지/소모임 관리, 소모임 기능(생성/가입/조회) 완료 |
| **Phase 5** | **마켓 & 결제 (Market)** | ✅ **완료** | 100% | MVP 완료. 리뷰 시스템(DB/UI) 구현 및 검증 완료. Commerce Logic Complete. |
| **Phase 6** | **확장 모듈 (Expansion)** | 🔄 **진행 중** | 80% | 크리에이터 보드, 미션(MVP/Admin/Skeleton) 완료. 확장 지도 대기 |
| **Phase 7** | **운영 & 갭 필링 (Ops & Gap)** | 🔄 **진행 중** | 98% | 미션 Admin, UI/UX 디테일 보완(Gap Filling), 설정/알림/마켓 피벗 진행. |

---

## 🚀 상세 로드맵 (Detailed Roadmap)

### Phase 0: 코어 플랫폼 기반 (Foundation) - ✅ 완료
*   **0.1 글로벌 UI 프레임**: TopBar, BottomNav, 390px 레이아웃
*   **0.2 공통 라이브러리**: Shadcn UI, Tailwind, Lucide Icons
*   **0.3 라우팅**: Next.js App Router (`(mobile)`, `admin`)

### Phase 1: 사용자 홈 (User Home) - ✅ 완료
**"감성, 안내, 그리고 초개인화된 첫인상"**
*   **1.1 분기 엔진 (L0)**: 사용자 상태 판별 완료
*   **1.2 초보자 홈 (Beginner)**: 히어로, 가이드, 프라이스 디코딩 완료
*   **1.3 기존 사용자 홈 (Returning)**: 스마트 리북, 예약 패널, 감성 배경 완료

### Phase 2: 내공간 (My Space) - 🔄 Ongoing (Logic & Polish)
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


### Phase 3: 예약 시스템 (Reservation) - ✅ Core Logic Done
**"레디코어 - 투명하고 쉬운 예약 & 강력한 관리"**

*   **3.1 예약 UI (Refinement)** ✅
    *   [x] 스마트 리북, Validation(주말 2박/엔드캡), 가격 로직
    *   [x] 임박 예약(D-N), 연박 할인 로직 적용
*   **3.2 관리자 콘솔 (Admin Core)** ✅ (New)
    *   [x] **차단일 관리 (`BlockDateScheduler`)**: 달력 기반 제어
    *   [x] **가격/시즌 관리 (`PricingConfigEditor`)**: 실시간 가격 정책 수정
    *   [x] **입금 확인 (`ReservationList`)**: 대기 목록 및 확정 처리
*   **3.3 오픈일/PG** ⬜
    *   [ ] 실제 PG 연동 (현재 무통장 입금만 구현)


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

### Phase 6: 확장 모듈 (Expansion) - 🔄 Ongoing (40%)
**"더 깊은 연결과 재미"**
*   **6.1 크리에이터 콘텐츠 보드 (MVP)** ✅:
    *   [x] **구조**: `creators`, `creator_contents` DB 및 서비스 로직.
    *   [x] **기능**: 작성, 리스트, 상세, **상호작용(좋아요/댓글/구독)** 구현 완료.
    *   [x] **관리**: 관리자 승인 시스템 및 테스트 계정 지원 포함.
*   **6.2 미션 & 보상 (Mission System)** ✅ (New):
    *   [x] **구조**: `missions`, `user_missions`, `point_history` 스키마 및 RLS.
    *   [x] **기능**: 리스트, 상세, 참여(Join), 인증(Photo), 보상(Point/XP).
    *   [x] **커뮤니티 연동**: 주간 미션 게시물 자동 생성(RPC), 댓글 사진 인증(Compression).
    *   [x] **UX**: 초보자/기존 유저 홈 위젯 연동.
    *   [x] **초보자 모드 홈**: 히어로 섹션, 3-Step 추천 가이드(요리/놀이/이벤트) 카드 뷰 구현.
    *   [x] **재방문자 모드 홈**: 예약/미션 중심 대시보드 UI, 퀵 액션(체크인/매너타임) 구현.
    *   [x] **날씨/시간 개인화**: `useWeather` & `usePersonalizedRecommendation` 기반 상황별 인사말 및 날씨 배지(Open-Meteo) 적용.
    *   [x] **Skeleton UI**: 3-State UX(Loading/Empty/Error) 적용 완료.
    *   [x] **관리**: 미션 관리자 페이지(Admin) 확인(Verified).
*   **6.3 확장 지도** ⬜: (대기)

### Phase 7: 운영 & 갭 필링 (Ops & Gap Filling) - 🔄 Ongoing (95%)
**"사용자 피드백 기반 디테일 완성"**
*   **7.0 이슈 긴급 대응 (Hotfixes)** ✅:
    *   [x] **미션 피드**: 좋아요, 본인 삭제 기능 완비 (RLS/RPC).
    - [x] **커뮤니티**: 댓글 좋아요(New), 삭제 오류 해결 및 삭제 확인 모달 추가 (Optimistic UI Fix).
*   **7.1 글로벌 UI/UX** ✅:
    *   [x] **TopBar**: 설정 메뉴(프로필/알림/약관) 및 로그아웃 구현 완료.
*   **7.2 홈 디테일 (Home Details)** ✅:
    *   [x] **초보자 칩**: 6개 고정 칩 디자인 적용 및 관리자 연동 완료.
    *   [x] **오늘의 콘텐츠**: '오늘의 추천'으로 명칭 변경 및 개인화 엔진 V2 (`recommendation_pool`) 프론트엔드/백엔드 고도화 완료.
    *   [x] **링크 수정**: 관리자 설정(기본정보)에서 주요 링크 및 텍스트 제어 가능.
    *   [x] **관리자 고도화 V2.1**: AI Bulk Import, 구조화된 재료/단계 입력 폼, 개인화 필드(인분/칼로리/연령/장소) 관리.
*   **7.3 내공간 고도화 (My Space Pivot)** ✅:
    *   [x] **위치 기반 편의시설**: `site_config.nearby_places`와 연동된 주변 편의시설 탭 구현.
    *   [x] **주변 즐길거리**: `nearby_events` DB 연동 및 LBS.
    *   [x] **Archive UX (New)**: 불멍/별보기/꾸미기 버튼 삭제. 사진 업로드 및 뷰어 품질 강화.
    *   [x] **Action**: '기록하기(Log)' 버튼 강조 및 접근성 개선.
    *   [x] **일관성**: 내공간 전반(Records, Album, History)의 도구 UI 경험 통일.
*   **7.4 마켓 피벗 (Market Pivot)** ⬜:
    *   [ ] **제휴 중심**: 자체 상품 대신 외부 링크(쿠팡 파트너스 등) 지원 구조로 변경.
*   **7.5 예약 자동화** ⬜:
    *   [ ] **오픈 로직**: 매월 1일 09시 -> 익익월 말일까지 자동 오픈 로직 구현.
*   **7.6 외부 API 연동 (Final Polish)** ⬜:
    *   [ ] **TourAPI/Kakao**: `nearby_events` 및 `site_config` 데이터를 실제 외부 API와 실시간 동기화 (안정화 단계에서 진행).


---

1.  **Priority**: **내공간 리뉴얼 (My Space Pivot)**.
2.  **Strategy**: "어설픈 기능보다 확실한 감성(사진)"으로 전환.
3.  **Next**: 제휴 마켓 및 자동화.

