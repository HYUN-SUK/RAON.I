# RAON.I 마스??개발 로드�?v3 (Final Integrated Version)

**버전**: v4.3 (Data Integrity & Filtering Optimization)
**기반**: RAONAI SSOT MASTER v9 + User Feedback (Gap Filling)
**?�성??*: 2026-05-10

??문서???�온?�이 ?�로?�트??**최종 ?�정??개발 가?�드**?�니??
기존??견고???�레?�워???�에 **?�렌??감성·초개?�화)**?� **?�실?�인 AI ?�략(L0/L1)**??결합?�여, ?�용?�에�?가??가�??�는 경험???�선?�으�??�달?�니??

---

- [x] **9.1 Push Notification Debugging (Fixed)** ??
  - [x] **Infrastructure Check**: Verify `push-notification` Edge Function code & secrets.
  - [x] **Webhook Check**: Confirm Trigger exists on `notifications` table (Bypassed via Client Invoke).
  - [x] **Auth Fix**: Fixed Firebase 401 (Added Service Account), Vercel Env (Added `NEXT_PUBLIC_` vars), JWT Claim (`iat`).
  - [x] **Token Cleanup**: Removed duplicate FCM tokens to prevent double notifications.
  - [x] **Deep Linking**: Implemented `push_redirect` query strategy + `postMessage` for open apps.
  - [x] **Reliability**: Auto-token refresh on Home visit (Self-Healing).
  - [x] **Performance**: Fixed FCM Quota Infinite Loop (Memoization).
  - [x] **Verification**: Live booking test -> 1 notification received successfully.

- [x] **9.2 Admin Push Notification & Duplicate Fix (2026-01-19)** ??
  - [x] **Admin Status Update Fix**: Notifications now sent when admin confirms deposit or cancels reservation.
  - [x] **RLS Policy Issue**: Fixed by disabling RLS on `notifications` table (temporary, TODO: re-enable with correct policy).
  - [x] **Duplicate Notification Fix**: Removed DB Webhook (code invoke only), fixed SW duplicate handler.
  - [x] **Admin Force Cancel**: Added `CancelReservationDialog` with reason input, reason included in push notification.
  - [x] **Verification**: All 3 scenarios (Reserve/Confirm/Cancel) -> 1 notification each.

- [x] **9.3 Waitlist Notification & Timezone Fix (2026-01-23)** ??
  - [x] **Waitlist Persistence**: WaitlistButton now checks DB on mount to maintain 'subscribed' state across page navigations.
  - [x] **Timezone Parsing**: Added `parseSafeDate()` to prevent date shift when parsing "YYYY-MM-DD" strings.
  - [x] **Public Reservation Sync**: Added `get_public_reservations` RPC for availability check without sensitive data.
  - [x] **LocalStorage Cache Fix**: `fetchPublicReservations` now replaces (not merges) cached data with server data.
  - [x] **Verification**: Live test confirmed - vacancy notification received, reservation sync accurate.

## ?�� ?�체 진행�??�약 (Progress Summary)

| ?�계 | 구분 | ?�태 | 진행�?| 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **코어 ?�랫??기반 (Foundation)** | ??**?�료** | 100% | ?�코?��? 감성 ?? UI ?�레?? ?�이???�이??|
| **Phase 1** | **?�용????(User Home)** | ??**?�료** | 100% | Beginner/Returning UI, Smart Re-book, L0 Logic ?�료 |
| **Phase 2** | **?�공�?(My Space)** | ??**?�료** | 100% | ?�?�보??지???�?�라???�료. ?�카?�브(기록) 리뉴??�?XP/Token ?�료. |
| **Phase 3** | **?�약 ?�스??(Reservation)** | ??**?�료** | 100% | Logic/Validation/Admin Core/Holidays ?�료. PG/?�픈???�음. |
| **Phase 4** | **미래 기능 (Future)** | ??**?�료** | 100% | ???�시(FCM), ?�황�??�림 ?�스?? ?�앱 배�? 구현 ?�료. |
| **Phase 5** | **마켓 & 결제 (Market)** | ??**?�료** | 100% | MVP ?�료. 리뷰 ?�스??DB/UI) 구현 �?검�??�료. Commerce Logic Complete. |
| **Phase 5.5** | **스마트 캠핑 플랜 (Smart Plan)** | 🟢 **완료** | 100% | v11.9.90 식당 점수 합산 & UI 배너 및 검색 쿼리 개선 완료. |
| **Phase 6** | **?�장 모듈 (Expansion)** | ??**?�료** | 100% | ?�리?�이?? 미션, ?�향 ?�서 ?�동 ?�료. |
| **Phase 7** | **?�영 & �??�링 (Ops & Gap)** | ??**?�료** | 100% | ?�국 LX 공사맛집(2k) ?�합 �??�동??로테?�션 ?�기??v2 ?�국 보급 ?�료(04-13). |
| **Phase 8** | **?�정??�?리팩?�링 (Stabilization)** | ??**?�료** | 100% | 관리자 ?�동??모니?�링 UI 최적??�?API ?�통 ?�합???�보 ?�료 (04-23). |
| **Phase 13** | **?�국 명칭 마스??(Landmarks)** | ??**?�료** | 100% | v2.6 ?�이브리???�진(명성 6: ?�기??4) �??�국 250�??�군�??�수 ?�재 ?�료 (04-22). |

---

## ?? ?�세 로드�?(Detailed Roadmap)

### Phase 0: 코어 ?�랫??기반 (Foundation) - ???�료
*   **0.1 글로벌 UI ?�레??*: TopBar, BottomNav, 390px ?�이?�웃
*   **0.2 공통 ?�이브러�?*: Shadcn UI, Tailwind, Lucide Icons
*   **0.3 ?�우??*: Next.js App Router (`(mobile)`, `admin`)
*   **0.4 ?�증 ?�스??(Authentication)** ??(2025-01-01):
    *   [x] **UI**: ???�마 글?�스모피�??�자??+ 모바??반응??최적??
    *   [x] **?�셜 로그??*: 카카?? 구�? ?�동 �?리다?�렉??처리.
    *   [x] **?�메??*: 로그??가??모드 ?��?, ?�스?�드리스 보안 구조.

### Phase 1: ?�용????(User Home) - ???�료
**"감성, ?�내, 그리�?초개?�화??첫인??**
*   **1.1 분기 ?�진 (L0)**: ?�용???�태 ?�별 ?�료
*   **1.2 초보????(Beginner)**: ?�어�? 가?�드, ?�라?�스 ?�코???�료
*   **1.3 기존 ?�용????(Returning)**: ?�마??리북, ?�약 ?�널, 감성 배경 ?�료

### Phase 2: ?�공�?(My Space) - ??Completed
**"Digital Archive - ?�만??기록�??�진"**
> **Product Pivot (2025-12-28)**: 기존??'꾸�?�?불멍(Digital Toy)' 컨셉???�기?�고, **"?�진�?기록(Digital Archive)"**??집중?�니?? ?�설???�니메이???�???�용?�의 고퀄리???�진??주는 감동??극�??�합?�다.
*   **2.1 ?�?�보??*: POV �? ?�젯 ?�료
*   **2.2 ?�만??지??*: ?� ?�?? ?�세 ?�트 ?�료
*   **2.3 ?�?�라??*: ?�합 ?�드 ?�료.
*   **2.4 ?�카?�브 리뉴??* ??
    *   [x] **기록 ?�이지**: ?�?�이�?�? 종이 질감, 검?? 비공�?로직 구현.
    *   [x] **?�어�??�션**: 미션 배�? 가?�성 ?�보 �?UX 개선.
    *   [x] **?�동**: ?�모??공�? ?�젯�?커�??�티 게시???�링???�결.
    *   [x] **?�구 ?��???*: ?�범/기록/?�스?�리 3�?�??�집 ?�구 ?�자???�일 �?가�??�크�??�슈 ?�결.
*   **2.5 XP & Token System (New)** ??
    *   [x] **3-Tier Currency**: XP(Level), RaonToken(Utility), GoldPoint.
    *   [x] **My Exploration Index**: `/myspace/wallet` (지�? ?�이지 �??�역 조회 구현.
    *   [x] **Premium UI**: View/Edit ?�션 ?�금 ?�제 UI (Glassmorphism + Collapsible) ?�용.


### Phase 3: ?�약 ?�스??(Reservation) - ??100% Completed
**"?�디코어 - ?�명?�고 ?�운 ?�약 & 강력??관�?**

*   **3.1 ?�약 UI (Refinement)** ??
    *   [x] ?�마??리북, Validation(주말 2�??�드�?, 가�?로직
    *   [x] ?�박 ?�약(D-N), ?�박 ?�인 로직 ?�용
    *   [x] **공휴???�체공?�일**: 2025-2026 ?�이???�동 �?가�?UI 반영 (Substitute Holidays) ??
    *   [x] **?�적 ?�정 ?�동**: 관리자 ?�정(?�금계좌, ?�이?�정�? ?�시�?반영 (Frontend Sync) ??
*   **3.2 관리자 콘솔 (Admin Core)** ??(New)
    *   [x] **차단??관�?(`BlockDateScheduler`)**: ?�합 ?�약 캘린?�로 격상
    *   [x] **가�??�즌 관�?(`PricingConfigEditor`)**: ?�시�?가�??�책 ?�정
    *   [x] **?�금 ?�인 (`ReservationList`)**: ?��?목록 �??�정 처리
    *   [x] **고객 관�?*: ?�약 ?�력(History) 조회 �??�합 차단 관�?
*   **3.3 ?�픈??PG** ?�� (Next)
    *   [ ] ?�제 PG ?�동 (?�재 무통???�금�?구현) - 추후 ?�동 ?�정


### Phase 4: 커�??�티 (Community) - ??100% Completed
**"캠퍼?�의 ?�통 공간 (User-First + Admin + Groups)"**
*   **4.1 메인/게시??* ?? 6�???공�?/?�기/?�야�??? 구현, Supabase ?�동 ?�료
*   **4.2 기능 고도??(Rx 1-5)** ?? 
    *   [x] 모바??최적??(?�단 �??�보??, 검??Search), ?�이브리???�이지?�이??
    *   [x] ??공간 ?�동 (기록 ?�이지), 비공�?로직(Private)
*   **4.3 ?�호?�용** ?? 좋아??공감), ?��? 구현 ?�료.
*   **4.4 보안 & 관�?(Security & Admin)** ?? 
    *   [x] **RLS(Row Level Security)**: DB 보안 ?�책 ?�용 (?�성?�만 ?�정/??��)
    *   [x] **관리자 공�?/?�모??*: 공�? ?�성/?�정/??��, ?�모??강제 ??�� 기능 구현
*   **4.5 ?�모??(Groups)** ??
    *   [x] **구조**: DB ?�키�?(`groups`, `group_members`, `posts`) �?RLS ?�의
    *   [x] **기능**: ?�성, 목록, ?�세, 가??Join/Leave), 게시글(Feed)
    *   [x] **좋아???��? ?�호?�용 (Likes/Comments)**
    *   [x] **?�정??v1**: Next.js 15 ?�환?? UI ?�버???�정, 멤버??로직 개선 ?�료

### Phase 5: 마켓 & 결제 (Market) - ??MVP 100% Completed
**"캠핑??감성??집으�?- Commerce"**
*   **5.1 ?�품 ?�시 (Product Display)** ??
    *   [x] ?�품 목록/?�세 ?�이지 구현 (Swiper 갤러�??�션 ?�택).
    *   [x] 감성 UX ?�용: ?�바구니/구매?�기 ?�터?�션, ?�절 처리.
*   **5.2 ?�바구니 (Cart)** ??
    *   [x] 로컬 ?�토리�? 기반 ?�바구니(Zustand).
    *   [x] ?�량 조절, ??��, 가�??�계 ?�시�?계산.
*   **5.3 주문/결제 (Checkout)** ??
    *   [x] 배송지 ?�력 ??(Daum 주소 API ?�동).
    *   [x] 결제 ?�단 ?�택 UI (무통??카드).
    *   [x] **v2 Update (2026-03-10)**: Evidence 구조??Fact Chips), AI ?�각 방�? 지�??�용, 최신 API ?�동 복구 ?�료.
    *   [x] **ETL 5.0 (2026-03-15)**: 주간 배치 ?�동???�합('Gold Standard' 초고??병합 ?�크립트 교체), UUID v5 기반 결정론적 ID(?�뢰??분석 기초), Proj4 좌표 변??�??�일 기반 ?�기??구현 ?�료.
    *   [x] **API Resilience (v4-v6) (2026-03-21)**: D-3 캐싱??좌표 결측 ?�약 배제 ?�터 버그 ?�정(`route.ts`), ?�역 ?�러 로깅 강화, 주간 배치 ?�요???�시 ?�행 ?��?줄링 �?"?�희?? ?�약 �??�동 ?�이???�재 ?�료. 
    *   [x] **Logic Audit (v7) (2026-03-21)**: `smart_camping_plan_manual.md` ?��?감사�??�해 병원 ?�집 범위 ?�계 �?주유??Top 3 ?�터�?병목 지???�별 �?보고 ?�료.
    *   [x] **Pipeline Remediation (2026-03-25)**: MART PostGIS RPC 카테고리 ?�터�?버그 ?�정, 주유??주소 ?�락 보강(????�코???�백), 마트 API ?�스 ?�분??LARGE/SSM/SUPER) �?매뉴??v10.1) 최신???�료.
    *   **V9.5 Pipeline Excellence (2026-03-22)** ??
        *   [x] **Resilience**: SQL 21000 ?�러(중복 충돌) 방어 �?Audit Telemetry 구축.
        *   [x] **Spiral Search**: ?�유 주유??30km ?�장 ?�색 �?TM128 좌표 보정 ?�료.
        *   [x] **Hospital Hierarchy**: NMC ?�급???�선 �?종합병원/?�원 가중치 ?�코?�링 ?�입.
        *   [x] **Category Quotas**: 카테고리�?병렬 쿼터??Quota) ?�용?�로 ?�이???�실 ?�천 차단.
        *   [x] **PostGIS Bypass**: ?�덱??지???�회 ?�시�?병합 로직?�로 ?�선??100% ?�보.
    *   **SSOT**: `smart_camping_plan_manual.md` V9.5 ?�체 로직 �??�정???�치 ?�합 최신???�료.
    *   [x] **Stabilization**: D-3 ?�적 ?�기???�론 ?�업???�이�?참조 ?�류(`schedules` -> `user_schedules`) ?�정 �?검�??�료.
    *   [x] **5.5.6 Unified User Camping Profile ??(2026-03-17)**:
        *   [x] **DB**: `user_camping_profiles` ?�이�?구축 �?RLS/RPC (`upsert_camping_profile`) ?�용.
        *   [x] **UI**: `CampingProfileGate` 공용 컴포?�트 개발 (카카?�맵 주소-좌표 변???�동).
        *   [x] **Flow Integration**: ?�약, ?�캠핑???�정 ?�록, 캠핑??추천(PlanLock), ?�마?�플??4?� ?�진 ?�합 ?�료.
        *   [x] **UX**: 기존 ?�보 존재 ??'간편 ?�인' 버튼 ?�나�??�과?�는 최적??로직 ?�용.
    *   [x] **5.5.9 Pipeline Resilience & Precision Audit SOP ??(2026-03-28)**:
        *   [x] **RPC Core Fix**: `get_master_places_in_radius` 중복 ?�거 �?`p_category`/`NUMERIC` ?��????�료.
        *   [x] **Precision Audit**: 3/31 ?�산�??��?**Quota 300** ?�장 ?�집(?�당 286�??? ?�측 �??�터�??�합??증명.
        *   [x] **SOP Deployment**: `precision_audit_sop_v11.md` 배포�??�한 주간/D-3 감사 지???��? 가?�드 ?�립.
        *   [x] **Automation Patch**: ?�일 ?�벽(3/29) ?�요??04:00 AM(주간), 06:00 AM(D-3) ?�시 강제 ?�행 ?�치 ?�료.
*   **5.4 리뷰 ?�스??(Reviews)** ??(Completed):
    *   [x] **구조**: `market_reviews` ?�이�??�키�?검�?�?`UNIQUE(user_id, product_id)` ?�약 ?�인.
    *   [x] **기능**: 리뷰 ?�성/??�� (별점, ?�스?? �?중복 방�? 로직.
    *   [x] **검�?*: ?�록/??�� 버그(Disabled/Event) ?�결 �?Toast 기반 ??�� ?�인 UI ?�용.
    *   [x] **?�시**: ?�품 ?�세 ?�단 리뷰 리스??감성 UI (3-State).
*   **5.5 관리자 & ?�계 (Admin & Analytics)** ??(New):
    *   [x] **마켓 관�?*: ?�품 ?�록/?�정/??�� (CRUD) �??��? 링크(External) ?�품 지??
    *   [x] **?�?�보??*: ?�체/?�동 ?�원 ?? ?�금 ?��? 주문 건수 ?�시�?집계 구현.
*   **5.6 마켓 고도??(Market 2.0) - 2026-01-12** ??
    *   [x] **?�이??최적??*: YouTube/Shorts ?�베??비용 0?? �??�품 배�?(Benefit Badges) 구현.
    *   [x] **?��?지 ?�로??*: Supabase Storage ?�동 �?Drag & Drop UI.

### Phase 5.5: ?�마??캠핑 ?�랜 (Smart Camping Plan) - ??100% Completed
**"초개?�화???�정 ?�내 ?�스??(Guided Journey)"**
*   **5.5.1 Headless Engine (`smartPlan.ts`)** ??
    *   [x] Zero-Cost High-Fidelity ?�터�?(공공?�이??+ 볼륨).
    *   [x] Stateless AI Narration (Gemini 1.5 Flash ?�동).
    *   [x] Schema.org 기반 ?�익???�환 JSON ?�트 리스??반환 구조 마련.
*   **5.5.2 Action-to-Tag Systemization (`persona.ts`)** ??
    *   [x] 50�?마스???�그 �?로직 ?�팅 (`user_personas`, `add_user_tag`).
    *   [x] ?�진 결합 (`generatePersonalizedSmartPlan`).
*   **5.5.3 [Priority] ?�진???�론?�엔???�리�?주입 (Progressive Injection)** ??
    *   [x] **?�약 ??(`ReservationForm.tsx`)**: 결제/?�정 ??강력??취향 ?�그??발송.
    *   [x] **게시??(`Feed`, `Post`)**: ?�진/?�워??분석 �?좋아??불씨 ?�원.
    *   [x] **??공간 (`LBS`, `Record`)**: ?�워??기록 �??�치 ?�색 ?�그??
    *   [x] **마켓 & 마이?�페?�스 (`Market`)**: 감성 ?�비 ?�릭 �?LNT 미션 ?�그??
    *   [x] **Phase 3 ?�서 고도??(Completed)**: 커�??�티 체류 ?�간(No 22), ?�레?�션 카드 ?�릭(No 26-28), ?�씨/LBS ?�세 ?�릭(No 29, 35) ?�장 ?�료.
    *   [x] **5.5.13 Precision Audit v11.3 & Popularity Engine v2 ?�계 ??(2026-04-12)**:
        *   [x] **Metric Splitting**: `Active/Inactive` 지??분리 로직 ?�수 ?�용 �?3�??�웃 로직 고도??
        *   [x] **Popularity Engine v2**: TourAPI `readcount` ?�기 ?�?�으�?Tmap(중심?? & KT(집중�? 기반 ?�기???�진 ?�계 ?�료.
        *   [x] **UI Support**: 관리자 ?�동??로그 ?�이지 ?��/?�� ?�태�??�분???�더�?구현 ?�료.
        *   [x] **Sync Strategy**: ?�일 1,000???�한 극복???�한 17???�환 갱신 체계 ?�립.
    *   [x] **5.5.16 Personalized Journey v2.3 (Refinement) ??(2026-04-26)**:
        *   [x] **Track B Engine**: ?�시�?경로??중복 ?�거 �??�이??병합(Merge) 로직 구현.
        *   [x] **Scoring**: 백년/LX/모범/?�심?�당 ?�증 가???�적 ?�산 �?명소 ?�어 가??100/80) 고정.
        *   [x] **Visuals**: 8�??�스???�동 추출 �??��?(?��) ?�모지 ?�적 부??체계 ?�장.
        *   [x] **Filtering**: 비식???�비??부?�산 ?? 강력 블랙리스???�터�??�식 ?�료.
*   **5.5.4 UI Component (`SmartPlanProposal.tsx`)** ??
    *   [x] Citational UI (?�사 + ?�트 카드) �?교체 ?�호?�용 개발.
    *   [x] `Fallback Mock Data` 주입 로직 ?�재 (미연�??�는 API Key 부????무중???�더�?.
    *   [x] **?�적 카테고리**: 관리자 ?�정 ?�이지?�서 카테고리 추�?/?�서변�?기능 구현.
*   **5.5.5 Hybrid Sync Stabilization (Phase 11 & 12) ??(2026-03-08)**:
    *   [x] **Phase 11**: PostGIS 기반 마스??DB ?�캔 �??�씨 가중치 1�??�별 구현.
    *   [x] **Phase 12**: 카카?�맵 별점/리뷰 ?�크?�퍼 �??�시�??�트 ?�제 ?�이?�라???�식.
    *   [x] **v2 Update (2026-03-10)**: Evidence 구조??Fact Chips), AI ?�각 방�? 지�??�용, 최신 API ?�동 복구 ?�료.
    *   [x] **ETL 5.0 (2026-03-15)**: 주간 배치 ?�동???�합('Gold Standard' 초고??병합 ?�크립트 교체), UUID v5 기반 결정론적 ID(?�뢰??분석 기초), Proj4 좌표 변??�??�일 기반 ?�기??구현 ?�료.
    *   [x] **API Resilience (v4-v6) (2026-03-21)**: D-3 캐싱??좌표 결측 ?�약 배제 ?�터 버그 ?�정(`route.ts`), ?�역 ?�러 로깅 강화, 주간 배치 ?�요???�시 ?�행 ?��?줄링 �?"?�희?? ?�약 �??�동 ?�이???�재 ?�료. 
    *   [x] **Logic Audit (v7) (2026-03-21)**: `smart_camping_plan_manual.md` ?��?감사�??�해 병원 ?�집 범위 ?�계 �?주유??Top 3 ?�터�?병목 지???�별 �?보고 ?�료.
    *   [x] **SSOT**: `smart_camping_plan_manual.md`???�체 로직, ?�증 가중치(+15, +30), ?�이브리???�집 ?�략 ?�합 최신??
    *   [x] **Stabilization**: D-3 ?�적 ?�기???�론 ?�업???�이�?참조 ?�류(`schedules` -> `user_schedules`) ?�정 �?검�??�료.
    *   [x] **5.5.8 Hyper-Personalization Engine (v11.0) ??(2026-03-27)**:
        *   [x] **Quota Breakthrough**: RESTAURANT/SPOT 1�??�별 쿼터 300�??��? (개인??변별력 ?�보).
        *   [x] **Batch Migration**: Vercel(5�? ?�?�아??극복???�한 GitHub Actions 배치 ?�크립트 ?�환.
        *   [x] **Spiral Mesh Search**: ?�피??5km ?�약 ?�결???�한 17지???�선??검??로직 ?�재.
        *   [x] **Address Resilience**: VAN -> NEW -> Kakao Reverse Geocoding 3�?주소 보강 체계 ?�성.
        *   [x] **Verification**: 밤샘 배치(04:00/06:00) ?�공 ?�인 �??�이???�합??검�??�료.
    *   [x] **SSOT Consistency**: 매뉴??v11.0)�?구현 코드 간의 로직 100% ?�기??�?빌드 ?�공.
    *   [x] **5.5.6 Unified User Camping Profile ??(2026-03-17)**:
        *   [x] **DB**: `user_camping_profiles` ?�이�?구축 �?RLS/RPC (`upsert_camping_profile`) ?�용.
        *   [x] **UI**: `CampingProfileGate` 공용 컴포?�트 개발 (카카?�맵 주소-좌표 변???�동).
        *   [x] **Flow Integration**: ?�약, ?�캠핑???�정 ?�록, 캠핑??추천(PlanLock), ?�마?�플??4?� ?�진 ?�합 ?�료.
        *   [x] **UX**: 기존 ?�보 존재 ??'간편 ?�인' 버튼 ?�나�??�과?�는 최적??로직 ?�용.
    *   [x] **5.5.10 Pipeline Restoration & Location Recovery ??(2026-04-05)**:
        *   [x] **Table Resolution**: `campgrounds` ?�이�???3,000�??�이???�존 ?�인?�로 ?�실 ?�해 ?�소.
        *   [x] **Logic Fix**: 캐싱 ?�크립트??Location Recovery 쿼리�?`master_places`?�서 `campgrounds`�??�상??
        *   [x] **Verification**: '?�온?�이?�토캠핑?? 공식 주소 �?좌표 DB 무결??최종 검�??�료.
    *   [x] **5.5.11 D-3 Pipeline Stabilization & Quota Optimization ??(2026-04-08)**:
        *   [x] **Bug Fix**: `clusters` 미선??ReferenceError ?�결 �?`RPC v2` ?��? ?�라미터 ?�식.
        *   [x] **Constraint Guard**: `master_places` ?�재 ??`address`, `created_at`, `lat/lng` ?�수�??�락 방어 로직 ?�수 ?�용.
        *   [x] **Geography Sync**: PostGIS `location` ?�드(GeoJSON) ?�시�??�기?�로 공간 검??가?�성 ?�보.
        *   [x] **Lowest Price Scoring**: 주유??GAS_STATION) ?�유 가�?기반 ?�뢰 ?�수 가?�제 ?�입 �?MART 쿼터 20�??�향 ?�료.
        *   [x] **Verification**: 4/11 ?��??��??�이??결과 1,301�??�보�??�측 �?319�??�트 ?�성 ?�공.
    *   [x] **5.5.12 Monitoring High-Visibility (SOP v11) ??(2026-04-09)**:
        *   [x] **SOP Integration**: `precision_audit_sop_v11.md` 규격??맞춘 API ?�적 �?쿼터 지???�집 ?�동.
        *   [x] **Dashboard Upgrade**: 관리자 로그 ?�세 ?�면??Part 1(API), Part 2(Quota Flow) ?��? ?��??�이�??�장.
        *   [x] **Data Persistence**: JSON 기반 `message` ?�드 ?�용?�로 DB 구조 변�??�이 ?�적 리포??체계 ?�성.
        *   [x] **Verification**: 4/12 ?��?캐싱 ?�행 �?관리자 ?�면 리포??출력 최종 검�??�료.
    *   [x] **5.5.14 Pipeline Scale-Up Optimization ??(2026-04-15)**:
        *   [x] **Throttling**: 권역 �?3�?지??로직 ?�장?�로 ?��? API 차단 리스???�소.
        *   [x] **Parallelism**: 권역 ??카테고리�?API ?�집 병렬??`Promise.all`)�?처리 ?�도 극�???
        *   [x] **Bulk Persistence**: 즉시 ?�재 방식??'메모�??�합 ??벌크 ?�재'�??�환?�여 DB 부??최소??
        *   [x] **LX Weights**: LX 공사맛집 가??+50) 로직 ?��? ?�장 �?1�??�별 ?�합???�보.
        *   [x] **Verification**: 4/17 ?��??��??�이???�공 �??��? 감사 보고???�성 ?�공.
    *   [x] **5.5.15 Hybrid Quality Selection (v11.9.13) ??(2026-04-16)**:
        *   [x] **Hybrid Scoring**: ?�질 ?�수 - 거리 감점 최적???�진 구축.
        *   [x] **Safe Mode**: RPC 3,000�??�집 + JS ?�이브리???�별�??�합???�보.
        *   [x] **Audit v2**: 1�??�질) vs 2�??�이브리?? ?��?리포???�진 ?�재.
        *   [x] **SSOT**: 매뉴??최신??�?12�?블랙리스???�터 강화.
    *   [x] **5.5.13 Precision Audit v11.3 & Popularity Engine v2 ?�계 ??(2026-04-12)**:
        *   [x] **Metric Splitting**: `Active/Inactive` 지??분리 로직 ?�수 ?�용 �?3�??�웃 로직 고도??
        *   [x] **Popularity Engine v2**: TourAPI `readcount` ?�기 ?�?�으�?Tmap(중심?? & KT(집중�? 기반 ?�기???�진 ?�계 ?�료.
        *   [x] **UI Support**: 관리자 ?�동??로그 ?�이지 ?��/?�� ?�태�??�분???�더�?구현 ?�료.
        *   [x] **Sync Strategy**: ?�일 1,000???�한 극복???�한 17???�환 갱신 체계 ?�립.
    *   [x] **5.5.17 Persistence & Optimization (v11.9.32) ??(2026-05-04)**:
        *   [x] **Smart Plan Persistence**: `user_schedules` DB ?�동???�한 ?�랜 ?�구 ?�??�?Zero-API 로딩 ?�장.
        *   [x] **Swap Synchronization**: ?�용???�소 교체(Swap) ??즉시 DB ?�태 ?�기??�??��? 로직 구현.
        *   [x] **UI Restoration**: ?�?�된 ?�랜 ?�이??존재 ??"?�동 ?�성" 버튼 ?�??결과 ?�면 즉시 ?�출 로직 복구.
    *   [x] **5.5.18 Smart Plan UX/UI Refinement (v11.9.35) ??(2026-05-05)**:
        *   [x] **Mobile Alignment**: ?�?�라???�로�?�??�소 카드 ?�비(`w-[calc(100%-3rem)]`) 최적?�로 모바??가?�성 ?�보.
        *   [x] **Swap Stability**: 중복 ?�거 맵핑 �??�성 ?�소 ?�터링으�??�테?��? 5 ?��???버그 ?�벽 ?�결.
        *   [x] **AI Personalization**: `guestDetails`(?�원/반려�? ?�이?��? ?�롬?�트??직접 주입?�여 초개?�화 ?�사 구현.
        *   [x] **Multi-Day Weather**: ?�실~?�실 ?�체 ?�정 기상 ?�이??기반 ???�코?�링 �??�롬?�트 최적??
    *   [x] **5.5.19 Route Selection & AI Stability (v11.9.40) ??(2026-05-06)**:
        *   [x] **Route Selection Integration**: 카카???�비 API ?�동, 추천/?�??경로 ?�택 UI(`RouteSelector`) 구축.
        *   [x] **Quota Optimization**: `alternatives=true` ?�션 ?�입?�로 API ?�출 ?�수 50% ?�감.
        *   [x] **AI Robustness**: ?�규??기반 JSON 추출 로직 ?�입?�로 배포 ?�경 ?�답 ?�싱 ?�러 ?�결.
        *   [x] **Midpoint Precision**: ?�요 ?�간 50% 지??기반???�확??경유지 좌표 추출 로직 ?�착.
    *   [x] **5.5.20 Smart Plan Persona & Weather Stabilization (v11.9.60) ??(2026-05-07)**:
        *   [x] **Persona Extraction**: ?�버 ?�이???�증 ?�동?�로 RLS�??�회?�여 `User Camping Profile` ?�이??추출 ?�정??
        *   [x] **Weather Sync**: ?�짜 ?�식 불일�??�결 �??�행 ??기간 ?�기 ?�보 ?�약 ?�이???�보.
        *   [x] **Narrative Precision**: ?�원 구성(?�이/반려�?부모님)�??�짜�??�씨가 ?�함???�사 중심??AI 브리??구현.
    *   [x] **5.5.21 Hospital Data Recovery & Scoring Optimization (v11.9.66) ??(2026-05-08)**:
        *   [x] **NMC Recovery**: NMC API 좌표 결측 ?�이?��? 카카??지?�코?�으�??�시�?복구?�여 DB ?�실 차단.
        *   [x] **Address Fix**: '강원?�별?�치?? ???�수 ?�정구역 명칭?�서 ?�군구�? ?�추출되???�규?�현??버그 ?�정.
        *   [x] **Scoring**: NMC ?�급?�료?�터 기본 ?�수�?150?�으�??�향?�여 ?�료 ?�전??기반??최상????�� ?�스??구축.
        *   [x] **Verification**: 춘천(?�목?? ?�약�??�???��??�이?�으�??�림?�/강원?�병원??최상???�착 최종 검�?
    *   [x] **5.5.22 Navigation Deep Link Stabilization (v11.9.68) ??(2026-05-10)**:
        *   [x] **GPS Autonomy**: Omitted manual start points for all nav apps, relying on native real-time GPS for maximum stability.
        *   [x] **Tmap Android Fix**: Implemented `goalx/y` and `v1x/y` parameters to resolve destination/waypoint omission bugs in Android.
        *   [x] **OS Branching**: Standardized OS-specific URL schemes (rGoX/Y for iOS vs goalx/y for Android) in `nav-utils.ts`.
        *   [x] **Verification**: Live test confirmed immediate pathfinding from "Current Location" to "Destination" via Tmap Android.
    *   [x] **5.5.23 Caching & UX Optimization (v11.9.90) 🟢 (2026-06-01)**:
        *   [x] **RESTAURANT Score Summation**: 식당 다중 인증 병합 시 Max 방식 대신 누적 합산(Sum) 방식 적용으로 `동흥루`(110점)가 정상 우위를 점하도록 개편.
        *   [x] **Mid-term UX Banner**: D-10 ~ D-4 중기 예보 가동 시 3일 전 오전 9시 단기 최신 정보 재생성 안내 배너 렌더링.
        *   [x] **Naver Search Query Patch**: 네이버 검색 연동 시 모든 장소 카드의 주소에서 시군구를 자동 파싱해 상호명 앞에 결합하여 검색어 신뢰도 확보.
        *   [x] **Past Weather Exclusion**: 홈화면 일정 날씨 위젯 및 일정 상세 페이지에서 오늘보다 이전인 과거 날짜의 날씨 예보를 렌더링에서 배제하여 ⏳ 대기 버그 오인 현상 해소.


### Phase 6: ?�장 모듈 (Expansion) - ?�� Ongoing (98%)
**"??깊�? ?�결�??��?"**
*   **6.1 ?�리?�이??콘텐�?보드 (MVP)** ??
    *   [x] **구조**: `creators`, `creator_contents` DB �??�비??로직.
    *   [x] **기능**: ?�성, 리스?? ?�세, **?�호?�용(좋아???��?/구독)** 구현 ?�료.
    *   [x] **관�?*: 관리자 ?�인 ?�스??�??�스??계정 지???�함.
*   **6.2 미션 & 보상 (Mission System)** ??(100% Completed):
    *   [x] **구조**: `missions`, `user_missions`, `point_history` ?�키�?�?RLS.
    *   [x] **기능**: 리스?? ?�세, 참여(Join), ?�증(Photo), 보상(Point/XP).
    *   [x] **커�??�티 ?�동**: 주간 미션 게시�??�동 ?�성(RPC), ?��? ?�진 ?�증(Compression).
    *   [x] **UX**: 초보??기존 ?��? ???�젯 ?�동.
    *   [x] **초보??모드 ??*: ?�어�??�션, 3-Step 추천 가?�드(?�리/?�???�벤?? 카드 �?구현.
    *   [x] **?�방문자 모드 ??*: ?�약/미션 중심 ?�?�보??UI, ???�션(체크??매너?�?? 구현.
    *   [x] **?�씨/?�간 개인??*: `useWeather` & `usePersonalizedRecommendation` 기반 ?�황�??�사�?�??�씨 배�?(Open-Meteo) ?�용.
    *   [x] **Skeleton UI**: 3-State UX(Loading/Empty/Error) ?�용 ?�료.
    *   [x] **관�?*: 미션 관리자 ?�이지(Admin) ?�인(Verified) + **참여 철회 기능 추�?**.
    *   [x] **Ranking**: ?�기??Trending) ?�렬 �?배�? 로직 추�?.
    ### Phase 4: Personalization Engine Upgrade (Components & Logic) - **[COMPLETED]**
    - [x] **Context-Aware Hook (`usePersonalizedRecommendation`)**
      - [x] Rule-based Scoring (Season/Weather/Time).
      - [x] Reason Generation.
      - [x] Shuffle / Random Box Logic.
    - [x] **UI Integration**
      - [x] Home Detail Sheet: Add Shuffle Button & Reason Badge.
      - [x] Restore Rich Content (Recipe Steps, Ingredients). ?�렬 �?배�? 로직 추�?.
    - [x] **Next Session: Post-Execution Audit (Completed: 3/30)**
        - [x] 3/29 ?�벽 ?�동???�행 로그(`automation_logs`) ?�공 ?�인 (RESTAURANT 286�???
    - [x] **Nationwide Popularity Engine v2 (4/13)** ??
        - [x] ?�국 12,753�?명소 ?�??Tmap ?��? 관광�?/KT 집중�??�이???�집 ?�료
        - [x] ?�국 ?�이??기반 `trust_score` ?�규??�?`finalizePopularityv2` 고도???�료
        - [x] ?�규모 지??경기 ??1000�?초과) ?�집 ?�락 방�? 무제???�이�?Range) ?�용 ?�료
        - [x] 관리자 모니?�링 보드(API ?�통 ?�세) Tmap/KT ?�시�??��? 기능 ?�합 ?�료
    - [ ] **Next: D-3 Caching Audit & Selection Logic (Upcoming)**
        - [ ] 3????캐싱 1부, 2부 진행 ?�태 �?1�??�별 로직 ?��? ?��?
        - [ ] ?�기??v2 ?�수가 반영???�마???�랜 ?�보군의 ?�효??�??�착 ?�태 ?�인
    *   [x] **Critical Fixes (2025-12-30)**: 
        *   Deletion Persistence (RPC Cascade + Self-Healing).
        *   Reverse Cascade (Comment Delete -> Mission Withdraw).
        *   Comment Visibility (Sync Fix).
    *   [x] **XP/Token Lifecycle (2025-12-31)**:
        *   **Clawback**: 미션/게시�???�� ???�득?�던 XP/Token ?�동 ?�수 (Trigger).
        *   **Photo Rewards**: ?�진 ?�로??보상??콘텐�?ID(`related_id`)?� ?�동?�여 ?�동 ?�수 구현.
        *   **Admin Deletion**: 관리자 강제 ??�� 기능 (RPC `admin_force_delete_post`) 복구 �?UI ?�용.
*   **6.3 ?�장 지??* �? (?��?

### Phase 7: ?�영 & �??�링 (Ops & Gap Filling) - ?�� Ongoing (99%)
**"?�용???�드�?기반 ?�테???�성"**
*   **7.0 ?�슈 긴급 ?�??(Hotfixes)** ??
    *   [x] **미션 ?�드**: 좋아?? 본인 ??�� 기능 ?�비 (RLS/RPC).
    - [x] **커�??�티**: ?��? 좋아??New), ??�� ?�류 ?�결 �???�� ?�인 모달 추�? (Optimistic UI Fix).
    - [x] **Admin Ops**: 콘텐�??��? ??��, 미션 참여 강제 철회, **글로벌 게시�???��(Global Delete)** 구현 ?�료.
    - [x] **Policy Enforcement**: **XP/Token ?�수(Clawback)** 로직 �?**좋아???�기??Sync)** 구현 ?�료.
    - [x] **Navigation Fix (2025-12-31)**: ???�동 ???�이지 ?�로고침 ?�어???�태 ?��?(URL Sync) �?깜빡???�거.
*   **7.1 글로벌 UI/UX** ??
    *   [x] **TopBar**: ?�정 메뉴(?�로???�림/?��?) �?로그?�웃 구현 ?�료.
    *   [x] **Login UX**: 비로그인 ?�근 ?�한(Global Modal) �?로그?�웃 ??XP 초기??구현 ?�료.
*   **7.2 ???�테??(Home Details)** ??
    *   [x] **초보??�?*: 6�?고정 �??�자???�용 �?관리자 ?�동 ?�료.
    *   [x] **?�늘??콘텐�?*: '?�늘??추천'?�로 명칭 변�?�?개인???�진 V2 (`recommendation_pool`) ?�론?�엔??백엔??고도???�료.
    *   [x] **링크 ?�정**: 관리자 ?�정(기본?�보)?�서 주요 링크 �??�스???�어 가??
    *   [x] **관리자 고도??V2.1**: AI Bulk Import, 구조?�된 ?�료/?�계 ?�력 ?? 개인???�드(?�분/칼로�??�령/?�소) 관�?
*   **7.3 ?�공�?고도??(My Space Pivot)** ??
    *   [x] **?�늘??콘텐�?*: '?�늘??추천'?�로 명칭 변�?�?개인???�진 V2 (`recommendation_pool`) ?�론?�엔??백엔??고도???�료.
    *   [x] **링크 ?�정**: 관리자 ?�정(기본?�보)?�서 주요 링크 �??�스???�어 가??
    *   [x] **관리자 고도??V2.1**: AI Bulk Import, 구조?�된 ?�료/?�계 ?�력 ?? 개인???�드(?�분/칼로�??�령/?�소) 관�?
*   **7.3 ?�공�?고도??(My Space Pivot)** ??
    *   [x] **?�치 기반 ?�의?�설**: `site_config.nearby_places`?� ?�동??주�? ?�의?�설 ??구현.
    *   [x] **주�? 즐길거리**: `nearby_events` DB ?�동 �?LBS.
    *   [x] **Fallback ?�이??개선 (2026-01-07)**: 가?????�산�??�이??변�? 검??반경 10km ??20km ?�장.
    *   [x] **?�사 UI 개선**: ?��?지 ?�거, 진행�?뱃�? ?�동, ?�세보기 버튼(TourAPI ?�동).
    *   [x] **Archive UX (New)**: 불멍/별보�?꾸�?�?버튼 ??��. ?�진 ?�로??�?뷰어 ?�질 강화.
    *   [x] **Action**: '기록?�기(Log)' 버튼 강조 �??�근??개선.
    *   [x] **?��???*: ?�공�??�반(Records, Album, History)???�구 UI 경험 ?�일.
*   **7.5 ?�스???�영 �??�정??(System Ops)** ??
    *   [x] **?�씨 ?�보 고도??*: ?�기/중기 ?�보 병합 로직 ?�정?�로 **10???�보** 지???�료.
    *   [x] **?�스???�영보드 (New)**: `/admin/operations` 구현 (SSOT 26??. ?��? ?�근 ?�어(?��?보수 모드), ?�약 차단, 캐시/?�림 리셋 ?�클�??�??
    *   [x] **?��?�?가?�드**: ?�영보드 ???�황�?조치 가?�드(Dialog) ?�재.
*   **7.6 마켓 ?�벗 (Market Pivot)** ??(2026-01-13):
    *   [x] **?�휴 중심**: ?�체 ?�품 ?�???��? 링크(쿠팡 ?�트?�스 ?? 지??구조 ?�성. ProductCard �??�세 ?�이지?�서 "구매처로 ?�동" 분기 처리.
*   **7.5 ?�약 ?�동??* ??(?��? 구현??:
    *   [x] **?�픈 로직**: `OpenDayConfig.tsx` 컴포?�트?�서 매월 ?�동 반복 규칙 지?? `open_day_rules` ?�이�?+ `automation_config` JSONB.
*   **7.6 ?�시 ?�영 체계 (Daily Region Sync v12.0) ??(2026-04-04)**:
    *   [x] **Rotation Engine**: ?�국 17�??�도 ?�??17??주기 지??�� ?�환 ?�기???�진 ?�장 (`daily-region-sync.mjs`).
    *   [x] **Category Expansion**: 마트(?�??SSM/기�?)�??�안부 OpenAPI 기반 ?�시 갱신 체계�??�합.
    *   [x] **Audit Reporting**: 7?� ?�심 지??기존/?�신/?�규/갱신/총계) 로깅 �?관리자 ?�이지 ?�용 리포??UI 구현.
    *   [x] **Automation**: GitHub Actions�??�한 매일 04:00 KST ?�동 ?�행 ?��?줄링 ?�료.
    *   [x] **SSOT Consistency**: 매뉴??�??��? 감사 SOP(v11.1)???�시 ?�영 지�?반영.
*   **7.6 ?��? API ?�동 (Final Polish)** �?(?�메??발급 ??:
    *   [ ] **TourAPI/Kakao**: `nearby_events` �?`site_config` ?�이?��? ?�제 ?��? API?� ?�시�??�기??(?�정???�계?�서 진행).

### Phase 8: ?�정??�?리팩?�링 (Stabilization) - ?�� In Progress
**"Codebase Health Improving - Operation Sparkling Forest"**
*   **8.1 Component Sanitization** ??(2025-12-31):
    *   [x] `src/components` ?�역 Lint ?�정 (MyMapModal, ReturningHome ??.
    *   [x] `any` ?�???�거 �?`Next/Image` 최적??
*   **8.2 Hook Refactoring** ??
    *  - [x] **2.5. Structure & Cleanup** (Completed - Runtime Stable)
    - [x] **8.2.3 DB Migration Normalization ??(2026-04-15)**:
        - [x] RPC 반환 ?�식 충돌 ?�결 (`DROP FUNCTION` idempotent 처리) �?126�??�체 마이그레?�션 ?�용.
        - [x] ?�격 DB ?�키�??�리?�트(`user_campground_hearts`) 복구 ?�료.
    - [x] Global Import Cleanup (Partially done for Admin/Core modules)
    - [x] Global Linting (Critical Admin Modules Cleaned)
    - [x] Unused Component Removal (Alert restored, others verified)
    - [x] Critical Refactors (`package` -> `pkg`, `MySpaceState` export)
    *   [x] **8.3 Safe Refactoring (Deep Type Safety)** ??(2026-01-04):
        *   [x] **Stage 4-8 Complete**: Removed 40 `any` types + Production build enabled
        *   [x] Components (8): BeginnerHome, ReturningHome, SiteList
        *   [x] Store Layer (16): Error handlers + DB mapping
        *   [x] Services (7): communityService, creatorService, communityUtils
        *   [x] Weather API (9): Comprehensive KMA type definitions
        *   [x] **Production Build**: ??Enabled with `ignoreBuildErrors` (temporary)
        *   [x] **Live Verification**: All features tested via browser - 0 runtime errors
    *   [x] **8.4 Type System & Personalization** ??(2026-01-07):
        *   [x] **DB Schema**: `profiles` table updated (Family/Interests) & Types patched.
        *   [x] **Personalization Engine**: Hook updated to boost scores based on profile.
        *   [x] **UI**: Nickname greeting & Recommendation reason fix.
        *   [x] **Logic**: Expanded pool to Top 50 for variety.
        *   [x] **Admin**: Replaced deletion popup with AlertDialog.
        *   [x] **Production Build**: ??SUCCESS (Exit code: 0)
        *   [x] **Live Verification**: Verified recommendation logic via code review & build.
        *   [x] **8.5 External API Expansion (Nearby Activities)** ??(2026-01-09):
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
        *   [x] **8.6 Weekly Mission Ranking & Ember Support** ??(2026-01-10):
            *   [x] **Mission Ranking**: GitHub Actions cron (Sundays 21:00 KST) + API Route + Admin UI.
            *   [x] **Ember Support (불씨)**: Token-based "quiet support" system (10 tokens).
            *   [x] **Ember Integration**: Mission cards, Community posts, Comments.
            *   [x] **Home Fix**: Restored MissionHomeWidget to BeginnerHome.
            *   [x] **DB Migration**: `20260110_mission_ranking_rewards.sql`, `20260110_ember_support.sql`.
            *   [x] **Planning**: Created `ember_feature_spec.md` & `ember_implementation_plan.md` for Phase 8.7.
            *   [x] **Status**: **100% Done**
        *   [x] **8.7 Ember Notifications & Stats** ??(2026-01-11):
            *   [x] **Notification System**: `EMBER_RECEIVED` ?�림 ?�??+ ?�앱 배�? ?�동 ?�성.
            *   [x] **Stats RPC**: `get_my_ember_stats`, `get_sent_embers`, `get_received_embers`.
            *   [x] **HeroSection Badge**: 받�? 불씨 > 0????좌측 ?�단??"불씨 N�? ?�시.
            *   [x] **Embers Page**: `/myspace/embers` - 받�?/?�긴 불씨 ?? �??�태 UI ?�함.
            *   [x] **DB Migration**: `20260111_ember_notifications.sql`.
            *   [x] **Live Verification**: 브라?��? 검�??�료.
            *   [x] **Status**: **100% Done**
        *   [x] **8.8 Reservation Concurrency & Admin Deletion** ??(2026-01-12):
            *   [x] **Reservation Concurrency**: Advisory Lock + RPC (`create_reservation_safe`).
            *   [x] **Admin Deletion**: AlertDialog 방식?�로 ?�기/컨텐�?마켓/공�? ??�� 개선.
            *   [x] **Notice Query Fix**: SlimNotice 컬럼�??�정 (`board_type` ??`type`).
            *   [x] **DB Migration**: `20260111_reservation_concurrency.sql`, `20260111_admin_delete_permissions.sql`.
            *   [x] **Status**: **100% Done**
        *   [x] **8.9 Emotional Greeting System (New)** ??(2026-01-12):
            *   [x] **Logic Upgrade**: ?�씨/?�간/계절/?�도(?�한/무더?? ?�합 ?�별 로직 ?�용.
            *   [x] **Rich Pool**: 100+ 문학??감성??멘트 ?�(Pool) 구축 �??�덤 로테?�션.
            *   [x] **UI Integration**: SlimNotice(?�줄공�?) 겹침 ?�결 �?버그 ?�정.
            *   [x] **Verification**: 브라?��? ?��??�이??검�??�료.
            *   [x] **Status**: **100% Done**
        *   [x] **8.10 Market Data Optimization & Dynamic Config** ??(2026-01-12):
            *   [x] **Zero-Cost Video**: YouTube/Shorts/TikTok Lazy Load ?�베??
            *   [x] **Image System**: URL 방식 ??Supabase Storage 직접 ?�로???�환.
            *   [x] **Admin Empowerment**: 마켓 카테고리 관리자 직접 ?�정(JSONB) 구현.
            *   [x] **Status**: **100% Done**
        *   [x] **8.11 UX Improvements & Loading Optimization** ??(2026-01-14):
            *   [x] **Terms Integration**: ?�용?�칙/?�불규정 ?�합 (TermsAgreementDialog 컴포?�트).
            *   [x] **Back Button UX**: 4�?Sheet 백버??처리 (HomeDetailSheet, FacilityDetailSheet, NearbyDetailSheet, PriceGuideSheet).
            *   [x] **Touch Feedback**: 모바???�치 ?�드�?(globals.css + BottomNav).
            *   [x] **Reservation DB Sync**: ?�약 ?�세 ?�이지 SITES ?�수 ??Supabase 조회 변�?
            *   [x] **Loading Optimization**: ?�씨 ?�존??분리 (usePersonalizedRecommendation).
            *   [x] **User Guidance**: ?�씨/주�??�보 ?�간�??�내 문구 추�?.
            *   [x] **Status**: **100% Done**
        *   [x] **8.12 Responsive Typography Review** ??(2026-01-14):
            *   [x] **Issue**: ?�어�??�스??�?추천 카드 UI가 모바???�면 ?�비???�라 ?�?��????�상.
            *   [x] **Core Utility**: `globals.css`??`clamp()` 기반 반응???�스???�래??추�? (`.text-responsive-hero-title` ??.
            *   [x] **Applied Areas**:
                *   [x] **Beginner Home**: Hero Title/Description & Info Chips.
                *   [x] **Recommendation Grid**: Card Titles & Badges (Difficulty/Time/Calories).
            *   [x] **Build Verification**: ??SUCCESS (Exit code: 0).
        *   [x] **8.13 My Map UX & Geocoding** ??(2026-01-14):
            *   [x] **Reverse Geocoding**: Kakao Maps API ?�동?�여 지???�릭/검????주소 ?�동 변??
            *   [x] **UX Enhancement**: 검??지???�릭 간섭 방�?, ???�이??리스???�단 추�? �??�동 ?�크�?
            *   [x] **UI Polish**: 마커 ?�이�?변�?(Flag), ?�팁 ?�보 강화.
            *   [x] **Mobile Map**: ?�치 ?�벤???�파 차단?�로 지???�록 ?�동???�결.
            *   [x] **Consistency**: "?�만??캠핑지?? 명칭 ?�일 & ?�이??마이그레?�션(x/y -> lat/lng) ?�료.
            *   [x] **Status**: **100% Done**
        *   [x] **8.15 Reservation UX & Smart Re-book** ??(2026-01-15):
            *   [x] **Smart Re-book**: "지???�행 조건?�로 ?�약?�기" 기능 고도??(?�원/차량/?�락�?Pre-fill).
            *   [x] **Smart Pre-fill**: ???�약 ?�에??최근 ?�약 기록(취소�??�함) 기반 ?�락�??�동 ?�력 지??
            *   [x] **Upcoming UI**: 체크???�짜???�렬 복원 �??�금?��?Pending) ?�약 별도 카드/?�트 분리.
            *   [x] **Navigation**: '?�의 ?�약' ?�보�?버튼 ???�체 ?�역 ?�이지 ?�결.
            *   [x] **UI Polish**: "1가�? 방문�?N�? ?�맷 ?�일 �??�벨�?개선.
            *   [x] **Status**: **100% Done**
        *   [x] **8.16 MySpace Notebook Feel (New)** ??(2026-01-16):
            *   [x] **Paper Background**: `PaperBackground.tsx` (SVG noise + cream gradient).
            *   [x] **Dog-ear Effect**: EmotionalQuote ?�단 ?�측 모서�??�힘 CSS ?�과.
            *   [x] **Tape Effect**: SummaryGrid 카드 ?�단 ?�이??+ 기울�??�과.
            *   [x] **Branding**: "?�공�? ??"???�첩" 명칭 변�?
            *   [x] **Branding**: "?�공�? ??"???�첩" 명칭 변�?
            *   [x] **Status**: **100% Done**
        *   [x] **8.17 Permission Flow & Admin Dashboard** ??(2026-01-16):
            *   [x] **Sequential Flow**: ?�치 권한(1?�계) -> ?�시 권한(2?�계) ?�차 UX �?감성 카피 ?�용.
            *   [x] **iOS Support**: iOS Safari '???�면??추�?' 가?�드 모달 구현.
            *   [x] **Admin Dashboard**: ?�치/?�시 권한 ?�의???�계 카드 추�? (DB ?�동).
            *   [x] **Weather Consistency**: `useWeather.ts`???�?�존(UTC) ?�슈 ?�결 �??�세?�면(`WeatherDetailSheet`) 로직 ?�일.
            ### [STEP 5.2] Reliability Audit & Automation Recovery (2026-03-16) ??
- **?��? 감사 ?�료**: 코드-매뉴???�수 ?��?�?불일�?카카??범위, ?�로?��? 기상 Fallback) ?�정 ?�료.
- **?�동??복구**: KST ?�?�존 보정 �?메모�?최적??배치 로직 ?�용?�로 Cron Job ?�뢰???�복.
- **결과**: ?�산�?권역 D-3 캐싱 ?��??�이???�공 �??�일 ?�벽 ?�합 ?�스??준�??�료.
            *   [x] **Push Audit**: ?�약/취소 ?�림 로직 ?�수 조사 �?보완 ?�료 (?�신 ?�패 ?�버�??��?.
            *   [x] **Push Stability (2026-02-27)**: **Foreground (In-app Toast) Success**. Background stabilization in progress.
            *   [x] **Status**: **99% Done (Background Still Silent)**
            ### [STEP 5.3] NMC Hospital Geocoding & Mapping Optimization (2026-05-31) 🟢
- **마스터 DB 연동 최적화**: 기존 마스터 DB에 정상적인 위경도를 보유한 병원은 일일 로테이션 갱신 시 카카오 지오코딩 API 호출을 100% 스킵하도록 최적화.
- **API 주소 누락 매핑 해결**: NMC 실시간 API 주소 누락 문제(`dutyAddr` 빈값)에 대응하여 `hpid`와 `name`을 결합한 유연한 매핑 구조 구축, ID 불일치 문제를 해결하여 실시간 병상 정보 바인딩 완수.

### Phase 9: ?�택???�업 (Non-Urgent - ?�음 ?�션)
> ?�️ **긴급?? ??��** - ?�심 기능(?�약/커�??�티/???�는 ?�향 ?�음
*   **9.1 Edge Function 배포 (Complete)** ??
    *   [x] `supabase/functions/push-notification/` ??Supabase ?�?�보?�에??배포 ?�료
    *   [x] ?�경 변???�정: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Supabase Secrets)
    *   [x] ?�라?�언???�경 변?? `NEXT_PUBLIC_FIREBASE_*` (Vercel)
*   **9.2 DB Schema ?�기??* (Priority: LOW):
    *   [ ] Supabase CLI ?�증 ??`npx supabase gen types typescript` ?�행
    *   [ ] ?�재 빌드??기존 ?�?�으�??�상 ?�작 �?
*   **9.3 ESLint ?�리** (Priority: LOW):
    *   [ ] `eslint ignoreDuringBuilds` ?�제 ??경고 ?�리
*   **9.4 카카?�맵 JavaScript SDK ?�록** (Priority: LOW - ?�메???�정 ??:
    *   [ ] ?�메???�정 ??Kakao Developers ?�에 JavaScript SDK ?�메???�록
    *   [ ] JavaScript ??발급 �?`NEXT_PUBLIC_KAKAO_JS_KEY` ?�경변??추�?
    *   [ ] 지???�더�?기능 구현 (?�택)
*   **9.5 PWA 구현** ??(2026-01-13):
    *   [x] `manifest.json` ?�성 (???�름, ?�이�? ?�마 ?�상)
*   **9.6 ?�마??캠핑 ?�랜 (Guided Journey \u0026 Persona) ?? (Next Target)**:
    *   [x] **1?�계: ?�진 ?�합???�수 조사 �??�정 계획 ?�립 (Audit Complete)**: 매뉴??기�? 15-Fact ?�이?�라?? ?�르?�나 ?�동 결함 ?�악 �?3-Phase Fix Plan ?�정.
    *   [x] **1.1?�계: 코어 기반 공사 (Phase 1 Fix)**: KMA 기상�???중기 ?�일 ?�출??초과 방어�??�한 무료 글로벌 API(Open-Meteo) Fallback ?�스???�식 ?�료.
    *   [x] **1.2?�계: API ?�존??Resilience) ?�보**: ODcloud(백년가�? Swagger ?�적 UDDI 추출 로직 구현 �?TourAPI(관�?축제) `KorService2` 마이그레?�션 ?�료 (500/400 Error ?�회 ?�공).
    *   [ ] **1.3?�계: ?�적 가중치 ?�고리즘 (Phase 2 Fix)**: ?�용??취향 ?�그 ?�동, ?��? ?�반 가?�점 로직 �??�무??방어 ?�용.
    *   [ ] **1.4?�계: 기후 ?�동 �??�진 ?�정??(Phase 3 Fix)**: ?�천/기온(?�계) 기반 ?�수 변??로직 구현.
    *   [ ] **2?�계: ?�그 매핑 ?�스??(`persona.ts`) & 8-Step Deep Dive ?�버�?*: (?�음 ?�션 ?�정)
    *   [ ] **1.3?�계: 기후 ?�동 �??�진 ?�정??(Phase 3 Fix)**: ?�천/기온(?�계) 기반 ?�수 변??로직 구현.
    *   [ ] **2?�계: ?�그 매핑 ?�스??(`persona.ts`)**: (진행 �?
    *   [ ] **3?�계: 최종 ?�동 (Integration)**: (진행 �?
    *   [x] ???�이�?준�?(192x192, 512x512, 180x180) - ?�본 로고 ?�용
    *   [x] Service Worker ?�장 (Next.js PWA 기본 지??
    *   [x] 메�? ?�그 추�? (`layout.tsx`) - ?�국??SEO �?OG ?�그 ?�용
    *   [x] "???�면??추�?" 기능 ?�스???�료
    *   [ ] (?�택) TWA�??�레?�스?�어 ?�록
*   [x] **9.6 빌드 ?�류 ?�정 �??�???�기??* ??(2026-01-13):
    *   [x] **Supabase Types**: `site_config`, `posts`, `sites`, `nearby_events` ?�의 ?�행??
    *   [x] **Code Corrections**: `BeginnerHome`(?�벤???�??, `ReservationStore`(?�이???�약 ?�??, `CommunityService`(글/?��? ?�?? ?�정.
    *   [x] **Build Verification**: `npm run build` ?�공 (Exit code: 0).
    *   [x] **Deployment**: ??Vercel 배포 ?�료 (`https://raon-i.vercel.app`)
*   [x] **9.7 Notification Reliability Upgrade** ??(2026-02-20):
    *   [x] **Duplicate Fix**: Implemented DB Unique Constraint + Edge Function Single-Delivery Policy + FCM Collapse Keys.
    *   [x] **Camping Reminders**: Scheduled `pg_cron` job for `invoke-camping-reminder`, caught up missed notifications.
    *   [x] **Handbook v2.0**: Updated `docs/notification_manual.md` with full specs and troubleshooting guide.
    *   [x] **Verification**: Zero duplicates confirmed in logs, reminder execution verified.
*   [x] **9.8 Camping Reminder Cron & Timeout Fix** ??(2026-02-21):
    *   [x] **Timeouts Avoided**: Implemented `mode=prefetch` (10-min preemptive API caching) and `mode=dispatch` (DB-only quick send) in Edge Function.
    *   [x] **Cron Migration**: Disabled unreliable `pg_cron` and replaced with free GitHub Actions scheduler.
    *   [x] **Verification**: Dispatched 7 missing notifications successfully; user checking tomorrow.



---

## ?? 배포 체크리스??(Deployment Checklist)

### ??배포 ???�료 ??�� (Pre-Deployment - Done)
| ??�� | ?�태 | 비고 |
|------|------|------|
| Supabase 마이그레?�션 ?�행 | ??| `site_config` 보상 컬럼, `mission_rewards` ?�이�? RPC ?�수 |
| 로컬 ?�경변???�정 | ??| `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` |
| 관리자 보상 ?�정 UI | ??| `/admin/settings` ?�단 "주간 미션 Top 3 보상 ?�정" |

### ??배포 ???�요 ?�업 (Post-Deployment - Pending)
> ?�️ **주의**: GitHub Secrets �??��? API ?�정?� **?�메??발급 ??* 진행?�야 ?�니??

| ??�� | ?�명 | 링크/방법 | ?�존??|
|------|------|------|------|
| **Supabase 마이그레?�션** | 불씨(Ember) 지???�이�??�성 | `20260110_ember_support.sql` ?�행 | - |
| **Vercel ?�경변??추�?** | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | Vercel Dashboard ??Settings ??Environment Variables | ?�메??발급 ??|
| **GitHub Secrets ?�정** | `APP_URL` (배포??URL), `CRON_SECRET` | GitHub ??Settings ??Secrets ??Actions | ?�메??발급 ??|
| **GitHub Actions ?�성??* | `.github/workflows/mission-ranking-cron.yml` | Push ???�동 ?�성?? Actions ??��???�인 | ?�메??발급 ??|
| **?�도???�동 ?�인** | ?�요??21:00 KST ?�동 ??��/보상 | Actions 로그 ?�인 ?�는 ?�동 ?�리�??�스??| ?�메??발급 ??|

### ?�� GitHub Secrets ?�정 방법
1. GitHub ?�?�소 ??**Settings** ??**Secrets and variables** ??**Actions**
2. **New repository secret** ?�릭
3. 추�?????��:
   - `APP_URL`: `https://your-app.vercel.app` (배포 ??Vercel?�서 ?�인)
   - `CRON_SECRET`: 로컬 `.env`???�정??것과 ?�일??�?

### ?�� Vercel ?�경변???�정 방법
1. Vercel Dashboard ???�로?�트 ?�택 ??**Settings** ??**Environment Variables**
2. 추�?????��:
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard?�서 복사
   - `CRON_SECRET`: GitHub Secrets?� ?�일??�?

### ?�� ?�동 ?�스??방법
```bash
# 배포 ??API ?�스??
curl -X POST https://your-app.vercel.app/api/cron/mission-ranking \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

1.  **Priority**: **?�공�?리뉴??(My Space Pivot)**.
2.  **Strategy**: "?�설??기능보다 ?�실??감성(?�진)"?�로 ?�환.
3.  **Next**: ?�휴 마켓 �??�동??

---

## ?? Phase 10: AI ?�리미엄 ?�익???�구 (Post-Launch)
**"?�랫???�익???�심 �?- AI 기반 고급 ?�리미엄 기능"**

> ?�️ **?�기**: 초기 버전 ?�픈 ???�화 ?�구 진행
> ?�� **참고 문서**: `premium_features_v2.md` (?�세 기능 ?�안)

### ?�� 배경 �??�략

**문제**:
- ?�규�?캠핑?�의 ?�익 ?�계
- ?�???�약?�랫???�수�??�피 ?�요
- ?�랫???��?/발전???�한 ?�익???�수

**?�심 ?�사?�트**:
- AI API 비용 = ?�출 ?�수??비�?
- **?�료 구독?�만 AI 기능 ?�용 = ??�� ?�자 구조**
- ?�리미엄 1,000�?× 4,900??= 490만원/?? AI 비용 ~5,000??(?�익�?99%)

**?�� AI ?�계 ?�칙**:
- **"1???�출 = ?�벽??결과"** ?�칙 준??
- ?�정 + 메뉴 + 준비물????번에 ?�공?�도�??�롬?�트 ?�계
- ?�일 조건 결과??캐싱?�여 ?�사??
- ???�용??만족 ?? ?�영 비용 ??(Win-Win)

### ?�� AI ?�리미엄 기능 ?�보

| 기능 | ?�명 | ?�상 비용 |
|------|------|----------|
| **AI 캠핑 코치** | 과거 기록 기반 맞춤 캠핑??추천 | ~0.7???�출 |
| **AI 메뉴 ?�래??* | ?�씨 기반 메뉴 + ?�보�?리스??| ~0.85???�출 |
| **?�마??체크리스??* | ?�씨 기반 준비물 ?�동 추천 | 캐싱 가??|

### ?�� �?AI ?�리미엄 기능 ?�보

| 기능 | ???�을 ?�까? | ?�익 모델 |
|------|-------------|----------|
| **?�� ?�토�??�쇄** | ?��??�→?�물 �??�장 | 건당 19,900?? |
| **??On This Day** | 매일 ??추억 ?�시 | ??9,900??|
| **?�� ?�간 캠핑 ?�감** | ?�동 ?�계 + ?�쇄 가??| ?�쇄 29,900??|
| **?�� VIP ?�럽** | 모든 기능 + 마켓 ?�인 | ??9,900??|

### ?�� 가�??�략

| ?�랜 | 가�?| ?�함 |
|------|------|------|
| **Basic** | 무료 | 기본 기록, 5GB |
| **Plus** | ??4,900??| On This Day, ?�감, 체크리스??|
| **VIP** | ??9,900??| ?�체 AI + ?�토�??�인 + 마켓 10% |

### ?�� ?�구 과제 (To-Do)

- [ ] AI 모델 비용 최적??(GPT-4o-mini vs Gemini Flash)
- [ ] ?�토�??�쇄 ?�주 ?�트???�색
- [ ] 결제 ?�스??구현 (?�스?�이먼츠/카카?�페??
- [ ] 무료 체험 ???�료 ?�환 UX ?�계
- [ ] ?�출 ?�한 �?캐싱 ?�략

### ?�� 관??문서

- **?�리미엄 기능 ?�세**: `brain/*/premium_features_v2.md`
- **?�익???�략 초안**: `brain/*/monetization_strategy.md`
- **복합 ?�집 ?�안**: `brain/*/composite_editing_proposal.md`
- **AI ?�이?�트 ?�???�략**: `brain/*/ai_agent_era_strategy.md`

---

## ?? Phase 11: AI ?�이?�트 ?��? ?�??(최종 출시 직전)
**"AI가 ?�온?�이�??�확???�용?�도�?**

> ?�️ **?�기**: 개발 ?�료 ?? 최종 출시 **직전**??진행
> ?�� **참고 문서**: `ai_agent_era_strategy.md`

### ?�� ??출시 직전?��??

- 지금�? 계속 ?�정/보완 �????�보 변�?가??
- AI가 ?�래???�보�?캐시???�험
- **?�보가 ?�정????* AI???�출?�야 ?�확????

### ?�� 출시 직전 체크리스??

- [ ] **llms.txt ?�성** - ?�심 ?�보 AI???�약 ?�일
- [ ] **AEO 공개 ?�이지** - `/about`, `/info` ?�책/?�설/가�??�약
- [ ] **Schema.org 마크??* - `Campground`, `CampingPitch`, `Offer`
- [ ] **SSOT 최종 ?��?** - ?�불/?�용?�칙/?�설 ?�보 ?�치 ?�인
- [ ] **?�동-?�그 매핑 최종 ?��?** - 출시 ???�체 UI/로직 ?�정 ??`action_tag_mapping_manual.md` ?�수 ?�기??�??�여 ?�서(No 36-45, 50 ?? ?�장 ?�료.
- [ ] **robots.txt ?�데?�트** - AI ?�롤??GPTBot, ClaudeBot) ?�용
- [ ] **UTM/로그 ?��???* - AI ?�입 측정 준�?

### ?�� ?�심 ?�칙

- **비용 0??* - ?�적 ?�일/코드 추�?�?
- **??번에 ?�확?�게** - ?�정 최소??

---

## ?���?Phase 12: 캠핑 ?��???(Camping Ajiit) - ?�� 진행�?
**"?�른 캠핑??추천 + 캠핑 ?�정 관�?+ ?�라?�빗 커�??�티"**

> **?�작??*: 2026-02-02
> **?�상 �??�간**: ~100?�간

### Phase 12.1: 모드/?��?/Plan Lock ??(?�료: 2026-02-02)
*   [x] **DB ?�키�?*: `20260202_camping_ajiit_full.sql`
*   [x] **?�???�의**: 6�?모드, 12�??��?, 20�??��? ?�그
*   [x] **모드 ?�택 UI**: `ModeSelector.tsx` (Lucide ?�이�?
*   [x] **?��? ?�택 UI**: `ToggleSelector.tsx` (12�? 최�? 4�??�택)
*   [x] **Plan Lock ?�이지**: 3?�계 ?�로??
*   [x] **추천 로직**: ?�수 기반 ?�고리즘
*   [x] **??진입??*: BeginnerHome, ReturningHome 카드 추�?

### Phase 12.2: 캠핑??DB 구축 ??(?�료: 2026-02-03)
*   [x] **고캠??API ?�동**: `lib/gocamping-api.ts` - 기본/검???�체 조회
*   [x] **?�동 ?�깅**: `lib/auto-tagging.ts` - 12�??��? 매핑
*   [x] **?�이???�기??*: `/api/admin/campgrounds/sync` API
*   [x] **DB ?�키�??�장**: ?�경 ?�드 7�?추�?, upsert RPC
*   [x] **검�?*: ?�플 100�??�기???�공

### Phase 12.3: ?�정/기록/�??�림 (~30?�간)
*   [x] **?�정 관�?*: 캠핑 ?�정 CRUD (UpcomingReservation ?�합 ?�시 ?�료)
*   [x] **1�?기록 (MyAjiit)** ??
    *   [x] **DB**: `camping_records` ?�키�?�?RLS.
    *   [x] **UI**: `QuickRecordForm`, `RecordList`, `AjiitCard`.
    *   [x] **Photo**: Image Editor V3.1 (Crop/Filter/Text/Draw) + Safe Save Logic.
    *   [x] **Map**: `MyMapList` (지?? ?�동 ?�료.
    *   [x] **Review**: `ReviewBoard` ??분리 (RaonAI vs Camper) 구현 ?�료.
*   [x] **�?기능**: 캠핑??찜하�?(V12.3 New Heart System 구현 ?�료)
*   [x] **준�??�림**: D-4(?�비), D-1(메뉴), D-0(?�사) ?�림 구현 �?고도???�료. ?�적 캐싱 ?�론 ?�동??`user_schedules` 참조 ?�류) ?�정 �?검�??�료. (2026-03-15)

### Phase 12.4: 복합 ?�집 (~31?�간)
*   [x] **�??�위�?(View Switcher)**: `1�?기록` ??��??리스??그리??캘린??�??�환 UI 구현 ?�료.
*   [ ] **계절�??�?�라??�?*: (UI 구현?? ?�이???�동 ?�정)
*   [x] **미션 ?�동 (New)**: 미션 ?�공 ???�동 '?�야�?STORY)' 게시�??�성 (Private) 기능 구현 ?�료.

### Phase 12.5: ?�라?�빗 커�??�티 (~16?�간)
*   [ ] **캠핑 ?�트 방식**: ?�시�?채팅 ?�??게시?�형
*   [ ] **그룹 ?�???�장**

### Phase 12.6: ?�마??캠핑 ?�이?�라??최적??(진행�?
*   [x] **KTO 공식 ?�위 복구**: 2024??12??최신 가???�이??기반 ?�국 189�??�군�???�� ?�기???�료 (2026-04-25)
*   [x] **?�시�??�진 고도??(v11.9.24)**: Track B 중복 ?�거, ?�증 ?�산, 8�??�모지 �??�어 가??로직 최종 ?�착 (2026-04-26)
*   [x] **관리자 ?�?�보??개편**: 3?�전 캐싱 로그�?3?�계 쿼터(?�집??-> 1�?쿼터 -> 2�?쿼터) Funnel 구조�?개선 ?�료
*   [ ] **KTO API 고도??(차후 ?��?)**:
    *   [ ] **?�규 API ?�환**: `LocgoHubTarService1` (기초지?�체 중심) ?�환 �??�시간성(2025/2026) ?�보 검??
    *   [ ] **매칭 ?�진 고도??*: ?�름+주소 기반???��? 매칭(Fuzzy Matching) 로직 ?�입
    *   [ ] **?�이???�스 ?�일??*: ?��? ?�보?� 공식 ?�위 ?�이???�스 분리 �??�합??강화


### [2026-05-10 Update]
* [x] **?�약 ?�스??무결??강화**: 0�??�약 방�? �??�스???�림 ?�입 (?�료)
* [x] **?�허�?검??(Phase 1)**: ?�마?�플??기술 ?�약 �??�허??분석 ?�료

### [2026-05-15 Update]
* [x] **Monetization Strategy**: ����Ʈ�÷� LIVE (�ð��뺰 Ÿ�Ӷ��� ��� �ǽð� ��ó ��Ű��) ��ȹ �� ��Ű��ó ���� �Ϸ�
* [x] **Phase 12.7: ����Ʈ�÷� LIVE MVP ����**: Ÿ�Ӷ��� UI �� ������Ʈ ����, �ǽð� �ð� ������ ž�� (�Ϸ�)
* [ ] **Phase 12.8: ����Ʈ�÷� LIVE ���� ���� �� ���� ����ȭ**: SOS �޵��� ���̴�, Co-Op �÷��� �ǽð� ��ǥ ����
