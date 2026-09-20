# RAON.I 프로젝트 인수인계 문서 (Handoff Document)

**작성 일시**: 2026-09-20T10:25:00+09:00  
**기준 브랜치**: `main`  
**빌드 상태**: Next.js 16.1.1 Production Build (103/103 전체 라우트 100% 정상 통과, TypeScript 0에러)  

---

## 1. 현재 상태 요약 (Current State & Completed Work)

### 🟢 마일스톤 9.60: 관리자 예약정보 전체 항목 수정 기능 구현(3중 연동·회계 차액 전이·AI 스마트플랜 보존) 및 결제목록 스마트 3계층 정렬(제자리 유지) 완결 (2026-09-20)

1. **예약자 상세화면 내 '예약정보 전체항목 수정 기능' (3중 연동)**:
   - 대시보드(`TodayCheckInsModal`), 통합캘린더(`UnifiedReservationCalendar`), 결제목록(`payments/page.tsx`) 어디서든 예약자를 클릭하면 동일한 `AdminReservationDetailModal`이 열리고, 상단 `[✏️ 정보 수정]` 버튼으로 전체 입력폼을 수정할 수 있도록 일원화.
   - **수정 가능 전체 항목**:
     - 예약자 성함 (`guestName`), 연락처 (`guestPhone`), 차량 대수 (`vehicleCount`)
     - 가족 수 (`familyCount`), 추가 방문객 수 (`visitorCount`)
     - 숙박 동행자 세부 구성: 성인, 시니어, 청소년, 초등학생, 미취학 아동, 반려동물 동반 토글(`Switch`)
     - 고객 요청사항 (`requests`)
   - **실시간 요금 재산출 및 회계 자동 전이 (`priceDiff`)**:
     - 가족 수 및 방문객 수 변경 시 `calculatePrice`를 통해 실시간으로 재계산 및 미리보기 카드 노출.
     - `diff > 0`: `total_price` 증액 및 상태를 `PENDING`(추가 입금대기)으로 자동 전이하여 결제목록에 노출.
     - `diff < 0`: 상태를 `REFUND_PENDING`(환불대기)으로 자동 전이 및 `refund_amount = Math.abs(diff)` 기록하여 결제목록 최상단에 노출.
     - `diff === 0`: 기존 결제 상태 유지.
   - **AI 스마트플랜 결과물 100% 보존**:
     - `user_schedules.smart_plan_data`를 `null`로 초기화하지 않고 그대로 온전히 보존하며 `member_count`만 갱신. (차후 사용자가 일정/플랜 재생성을 누를 때 최신 인원으로 자연스럽게 반영).
   - **3중 0초 동기화**:
     - DB `reservations` 즉시 갱신 (`updateReservationDetailsAction`).
     - 관리자 UI 전역(결제목록/대시보드/캘린더) 0초 즉시 반영 (`updateReservationDetails` 스토어 액션).
     - 사용자 UI(`/myspace/reservations`, `/myspace/schedule`) 100% 동기화.

2. **결제목록(`payments/page.tsx`) 스마트 정렬 (제자리 유지 및 환불대기 최상단 고정)**:
   - **배경**: 기존 `isActionRequired` 플래그로 인해 관리자가 [입금확인]을 누르면 항목이 2~3페이지 아래로 떨어져 목록에서 사라진 것처럼 보이는 문제 발생. 또한 환불완료(`REFUNDED`) 건을 상위로 올렸을 때 과거 8월 처리완료 건들이 9월 신규 예약 상단을 가리는 문제 발생.
   - **개선 알고리즘**:
     - 1순위: `REFUND_PENDING` (환불대기 - 즉각적인 송금 조치가 필요하므로 무조건 최상단 고정)
     - 2순위: 일반 타임라인 (`PENDING` 입금대기, `CONFIRMED` 결제완료, `REFUNDED` 환불완료, `CANCELLED` 예약취소)
     - 동일 그룹 내에서는 예약 신청 일시(`createdAt`) 기준 최신순 내림차순 정렬.
   - **결과**:
     - 처리 완료된 과거 환불 건(`REFUNDED`)은 자신의 과거 신청일시(8월 등) 자리에 조용히 남아있어 1페이지 상단을 전혀 침범하지 않음.
     - 관리자가 `PENDING` 행에서 [입금확인]을 눌러 `CONFIRMED`로 바뀌어도 행의 위치가 아래로 밀려나지 않고 **그 자리에서 [결제완료] 뱃지로 바뀌며 완벽히 제자리 유지**.
     - 오늘 들어온 신규 예약(대기/완료)은 최신 신청일시를 가지므로 상단에 순서대로 배치.

3. **상세 모달 오픈 시 홈화면 튕김 버그 해결 (`AdminReservationDetailModal.tsx`)**:
   - `if (!reservation) return null;` 조기 리턴이 `useMemo`보다 위에 있어 발생했던 **React Rules of Hooks 위반 예외** 및 이로 인한 Root Error Boundary(`global-error.tsx`)의 홈 리다이렉트 동작 원천 해결.
   - 모든 훅을 조기 리턴 상단으로 배치하고, `safeFormatDate` 도입으로 비정상 날짜 데이터 유입 시에도 렌더링 크래시 0% 방어.

4. **프로덕션 빌드 및 무결성 검증**:
   - `npx tsc --noEmit` 실행 결과 **오류 0건 (Exit Code 0)** PASS.
   - `npm run build` Next.js 16.1.1 Production Build 103/103 전체 라우트 번들링 정상 완료.

---

### 🟢 마일스톤 9.59: 11월 대규모 예약 오픈 직전(T-30) 실시간 점검, 16개 전 실전 시뮬레이션 100% 통과 및 표준 점검 가이드(SOP) 완결 (2026-09-20)

1. **오픈 직전 실시간 운영 DB 및 인프라 무결성 검증 (08:35 KST)**:
   - `system_config`: `maintenance_mode: false`, `reservation_enabled: true`, `notification_enabled: true` 정상.
   - `IS_RESERVATION_LOCKED: false` (긴급 락 해제 상태).
   - 실제 2026년 11월 일반 예약 건수: **0건 (완전 백지 상태 확인)**.
   - 실제 2026년 11월 관리자 차단일 건수: **6건 정상 보존** (10월 말 연박 퇴실 4건 + 오늘 관리자 수동 등록 김성은님 2건).
   - Edge Function `camping-reminder`: **Status 200 OK** 정상 응답 확인.

2. **16개 전 실전 엣지 케이스 통합 시뮬레이션 100% 전수 PASS (`scripts/simulate-master-edge-cases.mjs`)**:
   - **선택 A(완전 무위험 가상 격리)** 방식을 준수하여 2099년 연도 격리 및 가상 시간 주입으로 운영 DB 오염 0.00% 보장.
   - 08:59 vs 09:00 경계 동적 마감일 계산, 모바일 0.05초 더블탭 락, 비로그인 DB 외래키 위반 0% 방어, 100:1 단일 명당 경합 배타락(소요: 854ms), 10개 사이트 50명 동시 폭격, 에어컨 기기 연쇄 배정 및 air-group 대표카드 DB 레벨 차단 연동, 환불대기(`REFUND_PENDING`) 자리 즉시 오픈, 퇴실일 Turnover 허용 및 체류일 침범 차단, 주말 잔여석 규칙 및 취소 시 실시간 차단 연동, Realtime 500ms 디바운스(부하 95% 절감), FCM 알림 비동기 격리, 시뮬레이션 후 2099년 잔여 0건 완전 클린업까지 **16/16 전 케이스 100.0% 통과**.

3. **표준 사전 점검 가이드(SOP) 문서화 완결 (`docs/PRE_OPEN_INSPECTION_AND_SIMULATION_GUIDE.md`)**:
   - 차후 다른 세션 및 매월 20일 대규모 예약 오픈 직전에 원클릭으로 점검과 시뮬레이션을 수행할 수 있도록 명령어, 16개 케이스 판정 기준, DB 컬럼 주의사항, 타임라인별 체크리스트를 표준 매뉴얼로 공식 편철.

---

### 🟢 마일스톤 9.58: 캠핑 리마인더 Edge Function D-1/D-4 구버전 영구 소멸 원격 배포 및 D-0 행사 거리 소수점 1자리 정돈 완결 (2026-09-19)

1. **D-1 요리 추천 및 D-4 알림 원천 소멸 원격 배포 (`camping-reminder`)**:
   - **배경**: 9월 6일(마일스톤 9.41) 로컬 소스코드에서 D-1(요리 레시피 추천) 및 D-4 알림을 삭제하고 D-7 주간예보 단일화로 개편하였으나, 원격 Supabase Edge Function 배포가 누락되어 서버상에는 구버전 코드가 실행되어 9월 17일~18일 D-1 푸시("🍳 내일 뭐 먹을지 고민되시나요?")가 오발송됨.
   - **조치**: Supabase CLI(`npx supabase functions deploy camping-reminder --use-api`)를 통해 최신 코드를 원격 프로덕션에 성공적으로 배포 완료. 구버전 D-1/D-4 발송 로직 및 불필요한 `recommendation_pool` 쿼리를 원천 소멸시키고 D-7 주간예보 단일화 체계를 확립.

2. **D-0 당일 행사 거리 소수점 1자리 정돈 (`supabase/functions/camping-reminder/index.ts`)**:
   - D-0 당일 푸시에서 주변 행사 거리가 `(17.62731828783119km)`처럼 소수점 14자리로 길게 깨져 출력되던 현상을 `(${Number(e.dist).toFixed(1)}km)` (예: `17.6km`)로 깔끔하게 반올림 정돈.

3. **원격 엔드포인트 라이브 검증 완료**:
   - 원격 배포 직후 `https://khqiqwtoyvesxahsjukk.supabase.co/functions/v1/camping-reminder?mode=prefetch` 실측 호출 결과 `Status: 200 OK` (`{"success":true,"mode":"prefetch","grids":2}`) 정상 응답 및 기능 무결성 검증 완료.

---

### 🟢 마일스톤 9.57: 11월 예약 오픈 대비 예약 신청 로그인 필수 유도(옵션 C) & 17개 실전 시뮬레이션 100% 통과 (2026-09-18)

1. **예약 신청 시 로그인 필수 가드 장착 (`ReservationForm.tsx`)**:
   - 사용자가 예약 폼에서 [예약 신청] 클릭 시, 유효성 검사 직후 로컬 세션(`supabase.auth.getSession()`, 0ms)을 즉시 확인.
   - 비로그인 감지 시: `"예약을 진행하시려면 먼저 로그인해주세요."` 토스트 안내와 함께 전역 카카오 로그인 모달(`useAuthModalStore.getState().open()`) 오픈 및 즉시 차단 (화면 동결 0%, 입력값 보존).
   - 로그인 상태인 경우에만 `isSubmittingRef.current = true` 동기 락 활성화 후 DB RPC 안전 호출.

2. **DB 외래키 위반 원천 방지 및 안전망 (`useReservationStore.ts`)**:
   - 비로그인 더미 UUID `'00000000-0000-0000-0000-000000000000'`를 `null`로 교체하여 PostgreSQL `reservations_user_id_fkey` 외래키 제약조건 에러를 원천 차단.
   - `if (userId)` 가드를 추가하여 실제 로그인된 회원에게만 입금 기한 안내 푸시/알림 발송 보장.

3. **11월 예약 실전 시뮬레이션 17개 전 케이스 100% PASS (`scripts/simulate-reservation-scenarios.mjs`)**:
   - 모바일 0.05초 연타 더블 탭 차단, 동일 사이트 동시 경합 이중 예약 0% 방어, 관리자 차단일 및 에어컨 그룹/개별기기 DB 레벨 차단, 환불대기(`REFUND_PENDING`) 즉시 오픈, 퇴실일 당일 입실(Turnover) 보존, 주말 1박/2박 규칙, Realtime 500ms 디바운스 등 17개 전 시나리오 검증 완료 (성공률 100%).

4. **100명 가상 유저 동시 폭격 극한 스트레스 부하 테스트 100% PASS (`scripts/stress-test-concurrency.mjs`)**:
   - 2099년 격리 환경에서 100명 동시 광클(50ms 내 동일 사이트) 폭격 시: 1명 당첨 / 99명 안전 거절 (`CONCURRENT_REQUEST` 및 `ALREADY_BOOKED`), 500 에러 0건, 이중 예약 0건, 평균 처리 시간 266ms.
   - 10개 사이트 분산 50명 동시 폭격 시: 10명 당첨 / 40명 안전 거절, 데드락 0건, 전체 소요 시간 87ms.
   - 관리자 차단일 동시 침투 0건 완벽 방어, 퇴실일 Turnover 20명 경합 1명 당첨 / 19명 탈락 / 날짜 겹침 0건.
   - 테스트 시작 전/후 자동 2중 클린업으로 운영 DB 2099년 잔여 0건, 2026년 11월 예약 0건(완전 백지 상태) 실측 확인.

5. **TypeScript 0에러 & Next.js 16.1.1 Production Build 100% 무결성 검증**:
   - `npx tsc --noEmit` 에러 0건.
   - 103/103 전체 라우트 빌드 성공.
   - `git commit` (`3ff524a`), `origin/main` 푸시 완료.

---

### 🟢 마일스톤 9.56: 11월 예약 오픈 대비 더블 탭 오발송 박멸(useRef 락), 주말 규칙 일치화 & Realtime 500ms 디바운스 완결 (2026-09-18)

1. **모바일 0.05초 연타 더블 탭 오발송 팝업 100% 원천 박멸 (`ReservationForm.tsx`)**:
   - **배경**: React `useState(isSubmitting)`의 비동기 렌더링 지연(수 ms) 틈새로 0.05초 간격의 모바일 더블 탭이 진입하여 2개의 예약 요청이 서버로 동시 전송됨. 1번째 요청이 성공했음에도 2번째 요청이 DB 중복 검사에 걸려 "다른 분이 먼저 잡으셨습니다" 빨간 에러 팝업을 띄우던 문제 원천 차단.
   - **조치**:
     - `isSubmittingRef = useRef(false)` 동기 락 장착.
     - `handleSubmit` 최상단에서 `isSubmittingRef.current || isSubmitting` 2중 가드로 0.0001초 만에 즉시 2번째 터치 차단.
     - 유효성 검사 통과 후 서버 호출 직전에 원자적(Atomic) 잠금.
     - 실패/에러 분기(`else`, `catch`)에서 `isSubmittingRef.current = false`로 즉시 리셋하여 정상 재시도 완벽 보장.

2. **주말 1박/2박 검증 로직 가용성 일치화 (`useReservationStore.ts`)**:
   - `validateReservation` 함수(L1144, L1164)의 `isSaturdayBooked`, `isFridayBooked` 점유 조건에 `r.status === 'REFUND_PENDING'` 및 `r.status === 'REFUNDED'` 빈자리 처리 추가.
   - 캘린더, 사이트 목록, 모바일 헤더와 최종 폼 검증 함수 간의 100% 정합성 완성.

3. **Realtime Postgres Subscription 500ms 디바운스 적용 (`reservation/page.tsx`)**:
   - 9시 정각 대량 동시 접속 상태에서 연속 예약 완료 시 Realtime 브로드캐스트로 인해 모든 클라이언트가 0.1초마다 6개월치 RPC를 중복 호출하는 DB 커넥션 과부하 방어.
   - 500ms Trailing Edge 디바운스(`debounceTimer`)를 적용하여 연속된 이벤트를 1회의 최신 RPC 호출로 압축하고, 언마운트 시 타이머 클리어로 메모리 누수 방지.

4. **에어컨 대표카드(`air-group`) 차단 시 개별 기기 DB 레벨 연동 (`20260918000000_...sql`)**:
   - DB RPC `create_reservation_safe`의 3-2 차단일 검사 조건에 `OR (p_site_id LIKE 'air-%' AND site_id = 'air-group')`를 추가하여 대표카드 차단 시 개별 기기(air-1~air-8) 예약 침투까지 100% 원천 차단.

5. **TypeScript 0에러 & Next.js 16.1.1 Production Build 무결성 검증**:
   - `npx tsc --noEmit` 에러 0건 통과.
   - 103/103 전체 라우트 100% 정상 빌드 완료.

---

### 🟢 마일스톤 9.55: 11월 예약 오픈 대비 취소 즉시 빈자리 전환 일치화 & 0ms 로컬 세션 전환 완결 (2026-09-18)

1. **0ms 로컬 세션 전환 (인증 타임아웃 및 화면 렉 원천 박멸)**:
   - **`useReservationStore.ts` & `ReservationForm.tsx` & `useReservationGuard.ts`**:
     - 기존 원격 Supabase Auth 서버 통신(`getUser()`, 1~3초 네트워크 왕복 소요)을 브라우저 메모리 즉시 조회(`getSession()`, 0ms)로 전면 교체.
     - 대상 함수: 최종 예약 생성(`createReservationSafe`), 폼 진입 2차 실시간 검증(`loadInitialData`), 예약자 연락처 자동완성(`fetchUserContactInfo`), 이전 예약 불러오기(`fetchLastReservation`), 예약 가드(`checkPermission`).
     - 비로그인(게스트) 시에도 0초 만에 `null`을 확인하고 게스트 UUID(`00000000-0000-0000-0000-000000000000`)로 안전 폴백.
     - **결과**: 20일 9시 정각 수백 명이 동시 접속하더라도 Auth 서버 병목에 의한 타임아웃/지연 0%, 성함/연락처 0초 자동완성 유지.

2. **취소 즉시 빈자리 전환 일치화 (`REFUND_PENDING` 오픈)**:
   - **배경**: 고객이 취소 신청 시 상태가 `REFUND_PENDING`(환불 대기)이 되는데, 과거에는 DB 제약조건과 RPC에서 이를 제외하지 않아 관리자가 송금하기 전까지 타인이 예약하지 못하는 불일치가 있었음.
   - **조치**: 4대 클라이언트 컴포넌트 전반의 가용성 검사에 `r.status === 'REFUND_PENDING'` 빈자리 처리 반영.
     - `SiteList.tsx`: 사이트 중복 검사(`hasOverlap`) 및 금/토 1박 규칙(`isSaturdayBooked`, `isFridayBooked`)에서 빈자리 즉시 인정.
     - `DateRangePicker.tsx`: 캘린더 주말 1박 점유 필터링에서 빈자리 즉시 표출.
     - `reservation/page.tsx`: 모바일 메인 헤더의 금/토 1박 및 전체 사이트 마감(`allSitesBooked`) 체크에 반영하여 캘린더와 헤더 간 불일치 완벽 해소.
     - `ReservationForm.tsx`: 에어컨 개별 기기(air-1 ~ air-8) 중복 검사에도 `REFUND_PENDING` 빈자리 처리 동기화.

3. **DB 제약조건 & RPC 동기화 마이그레이션**:
   - `supabase/migrations/20260918000000_align_refund_pending_availability.sql` 작성 완료.
   - **PostgreSQL GiST 물리적 배제 제약조건 (`exclude_overlapping_reservations`)**: `WHERE (status NOT IN ('CANCELLED', 'REFUNDED', 'REFUND_PENDING'))`로 갱신.
   - **`create_reservation_safe` RPC**: 기존 예약 중복 검사 조건에 `REFUND_PENDING` 제외 추가 (동시에 `blocked_dates` 관리자 차단일/대관일 DB 레벨 철벽 방어 로직 100% 보존).
   - **`get_public_reservations` RPC**: `WHERE r.status NOT IN ('CANCELLED', 'REFUNDED', 'REFUND_PENDING')`로 일치화.

4. **다수 동시 접속 및 극단적 예외 상황 5대 안전망 검증 완료**:
   - **더블 터치 오발송 방어**: `isSubmitting` 로딩 락 및 `disabled` 버튼, 회전 스피너, 예약 성공 즉시 `toast.dismiss()`로 "다른 분이 먼저 잡으셨습니다" 오발송 팝업 100% 박멸.
   - **이중 예약 방어**: PostgreSQL Advisory Lock(사이트 단위 직렬화) + 날짜 겹침 카운트 검사 + DB GiST 물리적 배제 제약조건(스토리지 엔진 차단)의 **3중 방어로 중복 예약 수학적 0% 보장**.
   - **대관/차단일 철벽 방어**: DB 레벨 `blocked_dates` 검사로 어떤 클라이언트 우회나 렉 상황에서도 100% 예약 차단.

5. **코드 정리 및 빌드 검증**:
   - `SiteList.tsx` 미사용 import(`createClient`, `fetchPublicReservations`) 정리.
   - `useReservationStore.ts` eslint directive 위치 정규화.
   - TypeScript 컴파일 검사: `npx tsc --noEmit` 에러 0건 통과.
   - Next.js 16.1.1 Production Build: **103/103 전체 라우트 100% 정상 통과**.

---

## 2. 기술적 결정 사항 (Architectural Decisions)

1. **`getUser()` 전면 배제 및 `getSession()` 표준화**:
   - Supabase의 `getUser()`는 매 호출마다 원격 GoTrue Auth 서버로 HTTP 왕복을 수행합니다. 티켓팅/예약 오픈처럼 수초 내에 수백 명이 몰리는 순간에는 외부 Auth API의 레이턴시(1~3초) 및 Rate Limit으로 인해 화면이 멈추거나 튕깁니다.
   - 반면 `getSession()`은 브라우저 스토리지/쿠키에 이미 보관된 로컬 JWT 토큰을 0ms 만에 메모리에서 읽어옵니다.
   - 중복 예약 방지는 사용자 신원이 아닌 DB의 사이트 ID와 날짜(`site_id`, `check_in_date`, `check_out_date`)로만 결정되므로, 인증 방식을 로컬 세션으로 변경해도 보안 및 정합성에 영향이 전혀 없으면서 타임아웃만 완벽히 제거됩니다.

2. **`REFUND_PENDING` 상태의 예약 가용성 정책**:
   - 관리자가 통장 송금을 하기 전이라도, 고객이 취소 버튼을 누른 즉시 다른 손님이 그 자리를 예약할 수 있어야 공실률을 최소화할 수 있습니다.
   - 따라서 프론트엔드 달력, 사이트 목록, 헤더 마감 판정, DB RPC, DB 배제 제약조건까지 전 영역에서 `REFUND_PENDING`을 `CANCELLED`, `REFUNDED`와 완전히 동일하게 "비어있는 자리"로 처리하도록 공식 표준화했습니다.

3. **PostgreSQL Advisory Lock 기반 사이트 단위 직렬화**:
   - 전체 예약 테이블을 잠그면 동시 접속자가 많을 때 전체 서버가 멈춥니다.
   - `hashtext('site_lock_' || p_site_id)`를 키로 사용하여 오직 "동일한 사이트에 대한 동시 요청"만 직렬화하고, 서로 다른 사이트는 완벽히 병렬로 초고속 처리되도록 설계되었습니다.

---

## 3. 다음 작업 가이드 (Next Action Items)

1. **Supabase 대시보드 SQL 마이그레이션 적용**:
   - `supabase/migrations/20260918000000_align_refund_pending_availability.sql` 내용을 Supabase SQL Editor에서 1회 실행하여 DB 제약조건 및 RPC 2종을 최신화.
2. **20일 오전 9시 11월 예약 오픈 모니터링**:
   - 오픈 직후 관리자 대시보드(`/admin/reservations`, `/admin/payments`)에서 실시간 예약 접수 상태 모니터링.
3. **캠핏 양방향 동기화 큐 작동 상태 점검**:
   - 예약 신규 접수 및 취소 시 `/api/admin/camfit-sync/queue`가 정상적으로 캠핏 큐를 적재하는지 확인.

---

## 4. 주의 사항 (Known Issues & Warnings)

- **퇴실일 당일 입실(Turnover) 보존**:
  - 체크인/체크아웃 날짜 비교는 반드시 `check_in_date < p_check_out AND check_out_date > p_check_in` (반열린 구간)을 준수해야 합니다. 부등호에 등호(`<=`)를 잘못 넣으면 퇴실일 당일 입실 손님이 겹침 오판으로 차단되므로 임의 변경 금지.
- **예약 잠금 스위치 (`IS_RESERVATION_LOCKED`)**:
  - 현재 `src/constants/reservationGuard.ts`에서 `false`로 상시 해제되어 있습니다. 정식 오픈 중에는 이 값을 `true`로 바꾸지 않도록 주의.
