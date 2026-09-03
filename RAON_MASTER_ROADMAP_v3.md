# RAON.I 마스??개발 로드�?v3 (Final Integrated Version)

**버전**: v4.3 (Data Integrity & Filtering Optimization)
**기반**: RAONAI SSOT MASTER v9 + User Feedback (Gap Filling)
**?�성??*: 2026-05-10

??문서???�온?�이 ?�로?�트??**최종 ?�정??개발 가?�드**?�니??
기존??견고???�레?�워???�에 **?�렌??감성·초개?�화)**?� **?�실?�인 AI ?�략(L0/L1)**??결합?�여, ?�용?�에�?가??가�??�는 경험???�선?�으�??�달?�니??

- [x] **9.35 카테고리별 대체리스트 지도 전용 [이 장소로 선택] 버튼 탑재 및 최종 동선 정품 카드 분기 완결 (2026-09-03)** 🟢
  - [x] **카테고리별 대체지도 분기 (`mode === 'alternatives'`)**: 마커 터치 시 카드 하단 `⚠️ 정보가 달라요` 왼쪽에 `[✔ 이 장소로 선택]` 버튼 노출 ➔ 탭 시 즉시 스와프 확정 & 지도 닫힘 & 본문 반영.
  - [x] **최종 여행 전체 동선 분기 (`mode === 'full_timeline'`)**: 이미 확정된 일정이므로 선택 버튼 없이 스마트플랜 본문과 100% 동일한 정품 순수 카드 팝업.
  - [x] **빌드 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 정상 통과.

- [x] **9.34 스마트플랜 정품 장소 카드 지도 연동 및 터치 버튼 세로 2배 확대 완결 (2026-09-03)** 🟢
  - [x] **스마트플랜 정품 장소 카드 지도 하단 연동**: 이모지, 뱃지, 주소, 상세정보, 유선확인, ⚠️ 정보신고까지 본문과 100% 동일한 기능/디자인 렌더링.
  - [x] **터치 버튼 세로 2배 확대 (`h-14 w-9`)**: 좌측 `⇄` 스와프 및 `📍` 길안내 버튼 높이를 32px ➔ 56px 세로 알약형으로 2배 확대하여 모바일 원클릭 터치감 극대화.
  - [x] **모달 닫기 버튼 탑재**: 지도 하단 카드 우측 상단 `[X 닫기]` 버튼 배치 ➔ 누르면 카드 닫힘 및 지도 100% 즉시 확장.
  - [x] **지도 내 스와프 연동**: 지도 하단 카드에서 `⇄` 스와프 터치 시 지도가 닫히고 해당 카테고리 대체리스트 시트가 즉시 오픈.
  - [x] **빌드 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 정상 통과.

- [x] **9.33 스마트플랜 최종 여행 동선 단순화 및 마커 터치 팝업 UX 완결 (2026-09-03)** 🟢
  - [x] **추천 장소 연결선 제거**: 산/바다를 가로지르는 인위적 경유지 연결 점선 완전 제거, 카카오내비 실제 주행 도로선(출발지 ➔ 도착지)만 단독 표출.
  - [x] **하단 리스트 기본 노출 제거**: 전체 동선 모달 진입 시 화면 100%를 시원한 지도로 채움.
  - [x] **마커 터치 1위 장소 카드 팝업 & 지우기**: 지도 위의 마커 터치 시 스마트플랜 1위 장소 카드 팝업, 같은 마커 재터치 또는 우측 `[X]` 지우기 버튼 터치 시 카드가 쏙 닫히며 지도가 100% 즉시 확장.
  - [x] **동선 변경 드래그 로직 정밀 제거**: 불필요한 롱프레스 및 순서 변경 리스트를 정밀 제거하여 반응속도 대폭 향상.
  - [x] **빌드 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 정상 통과.

- [x] **9.32 스마트플랜 지도 UX 3대 정밀 고도화 완결 (2026-09-03)** 🟢
  - [x] **리스트 ↔ 지도 양방향 1초 스위칭 연동**: 지도로 보기 터치 시 리스트 시트 닫힘 ➔ 지도 우측 상단 `[📋 리스트로 보기]` 터치 시 지도가 닫히고 리스트 바텀시트 즉시 복귀.
  - [x] **마커 0.1픽셀 정밀 고정 (`xAnchor: 0.5, yAnchor: 1.0`)**: 카카오 공식 앵커 속성 적용 및 이중 CSS 간섭 제거를 통해 줌 인/아웃 배율에 무관하게 마커 꼭지점이 육지 도로 위치에 100% 자석 고정.
  - [x] **하단 카드 노출 (`z-[999]` 승격 & `pb-8` 안전 패딩)**: 앱 하단 네비게이션 바(80px) 가림을 완전 해소하고 마커 터치 시 하단 상세 카드 100% 시원하게 노출.
  - [x] **비용/데이터 무결성 재점검**: 우리 서버 데이터 비용 0원, 카카오 일일 30만 건 무료 쿼터 및 싱글톤 메모리 캐시 재확인 완료.
  - [x] **빌드 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 정상 통과.

- [x] **9.31 스마트플랜 3대 실전 지도 동선 고도화 및 롱프레스 방문 순서 변경 구현 완결 (2026-09-03)** 🟢
  - [x] **대체리스트 지도로 보기**: 스와프 바텀시트 상단 `[지도로 보기]` 토글 연동, 카카오 도로 경로선 바탕에 `[① 상호명 ⭐인증]` 말풍선 마커 표출 및 마커 터치 시 하단 단일 카드 슬라이드 원클릭 선택 UX 탑재.
  - [x] **추천 장소 카드 숨기기/보이기**: 카드 우측 상단 `[👁️ 숨기기]` 버튼, 슬림 바 UI 접힘 처리 및 고유 ID 기반 DB 영구 저장 연동.
  - [x] **스테이지 5 하단 전체 여행 동선 지도**: '목적지' 명칭 통일, 출발지 ➔ 1일차 ➔ 목적지 ➔ 2일차 ➔ 복귀지 `①, ②, ③...` 번호 핀 및 이동선 표출, 숨김 장소 자동 제외 및 `LatLngBounds` 화면 자동 피팅.
  - [x] **0.3초 롱프레스 방문 순서 변경**: 하단 카드 어디든 0.3초 꾹 누르면 햅틱 진동과 함께 드래그 이동 활성화, 순서 변경 시 지도 위 번호 핀 및 경로선 실시간 자동 재정렬, `visit_order` 순서표 분리 및 300ms 제스처 격리로 무결성 100% 보장.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 정상 통과.

- [x] **9.30 일일로테이션 syncHospitals 구문 오류 완치 및 배치 검증 파이프라인(node --check) 탑재 완결 (2026-09-02)** 🟢
  - [x] **구문 오류(SyntaxError) 완벽 치유**: `scripts/daily-region-sync.mjs`의 `syncHospitals`에서 누락되었던 `if (items)` 닫는 중괄호(`}`)를 복구하여 정상 컴파일 및 실행 완료.
  - [x] **오늘자(9/2) 전남광주시 동기화 실시간 검증 완료**: 관광명소 821건, 병원 65건, 식당 5,968건, 마트 553건 정상 수신 및 DB 자동화 로그 완벽 반영 확인.
  - [x] **배치 스크립트 빌드 검증 강제화**: `package.json`의 `build` 명령어에 `node --check scripts/daily-region-sync.mjs` 및 `caching-smart-plan.mjs`를 필수 연동하여 향후 배치 스크립트의 구문 오류를 빌드 단계에서 100% 원천 차단.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.29 홈 화면 다가오는 여행 카드와 일정 관리 카드 5단계 생명주기 뱃지 100% 완전 동기화 (2026-09-01)** 🟢
  - [x] **09:00 이후 자동 승격 가드 정규화**: `ScheduleHomeWidget.tsx`의 `isSmartPlanAvailable` 수식에서 `hasSmartPlan` 가드를 제거하여 맛보기 플랜이 있는 일정이라도 09:00 도달 시 `ScheduleCard.tsx`와 동일하게 3단계/4단계(`🌤️ 날씨정보 업데이트 가능`)로 즉시 승격되도록 일치.
  - [x] **이모지 중복 표출 정규화**: `ScheduleHomeWidget.tsx`의 뱃지 JSX에서 중복 선언되어 있던 `<span>✨</span>`를 제거하여 깔끔한 단일 이모지 표출 일치.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.28 스마트플랜 캐싱 정시 실행 100% 보장 및 일일로테이션 TourAPI/NMC 지능형 재시도 보완 완결 (2026-09-01)** 🟢
  - [x] **스마트플랜 캐싱 GitHub API 직접 연동**: `cron-job.org`에서 스마트플랜 캐싱 URL을 GitHub Actions Workflow Dispatch API로 전환하여 새벽 04:05 정각 실행 100% 보장 (1.52초 즉각 트리거 검증 완료).
  - [x] **일일 로테이션 점검 회피 및 지능형 재시도**: `cron-job.org` 실행 시각을 공공 API 점검 시간을 피한 04:30 AM으로 조정하고, `scripts/daily-region-sync.mjs`에 TourAPI/NMC 3회 지능형 백오프 재시도 및 실패 원인 정직한 표기 안전장치 탑재.
  - [x] **인천광역시 재실행 검증**: 관광명소 140건, 병원 22건 실시간 수신 및 DB 자동화 로그 정상 반영 완료.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.27 스마트플랜 생성 직후 weather_window 메모리 동기화 및 D-7~D-1 / D-0 생명주기 락(Lock) 완결 (2026-08-31)** 🟢
  - [x] **weather_window 즉시 메모리 동기화**: `SmartPlanProposal.tsx`의 `fetchPlan` 및 `handleCardSwap`에서 현재 D-Day 시기(`diffDays <= 0 ? 'SHORT' : (diffDays <= 7 ? 'MID' : 'NONE')`)에 맞는 `calculatedWeatherWindow`를 `plan` 상태에 즉시 주입하여 버튼 깜빡임 재활성화 버그 완치.
  - [x] **D-7~D-1 및 D-0 시기별 1회 락 정책 정규화**: `D-7~D-1` 시점에 생성 시 `[✨ 주간 예보 업데이트 완료]`(비활성화 락) 즉시 고정(D-0 전까지 재활성화 방지), `D-0` 시점에 생성 시 `[✨ 출발 당일 스마트플랜 최신화 완료]` 최종 락 고정.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.26 일일지역로테이션 관광명소(SPOT) 및 병원(HOSPITAL) 수신 카운터 및 3대 메트릭 정상화 완결 (2026-08-31)** 🟢
  - [x] **수신 카운터 원천 집계 정규화**: `scripts/daily-region-sync.mjs`의 `syncTourSpots` 및 `syncHospitals`에서 API 목록 응답 즉시 `stat.fetched.active` 가산 및 3대 지표(`modified/rolling/cached`) 집계 스코프 정상화.
  - [x] **대구광역시 재동기화 검증 완결**: `automation_logs`에서 관광명소 195건, 병원 21건 실시간 정상 수신 및 3색 뱃지 반영 확인.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.25 환불대기 상태 전용 환불 완료 처리 버튼 및 환불 송금 정보 카드 탑재 완결 (2026-08-31)** 🟢
  - [x] **통합 상세 모달 환불 송금 카드 신설**: `AdminReservationDetailModal.tsx`에 `isRefundCase` 시 환불 계좌, 환불 처리 금액, 환불율, 취소 사유 안내 카드 렌더링.
  - [x] **상태별 버튼 동적 분기 & 환불완료 버튼 활성화**: `REFUND_PENDING` 상태일 때만 `[환불 완료 (송금 완료)]` 인디고색 버튼 단독 활성화 및 원클릭 환불 완료 처리 연동.
  - [x] **결제관리 테이블 빠른 액션 탑재**: `/admin/payments` 테이블 행 우측에 `REFUND_PENDING` 시 `[환불완료]` 빠른 실행 버튼 탑재.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.24 환불대기 사이트 즉시 오픈 & 관리자 결제관리 Pin-to-Top 정렬 완결 (2026-08-31)** 🟢
  - [x] **사이트 가용성 점유 조건 정규화**: `UnifiedReservationCalendar.tsx`와 `useReservationStore.ts`에서 `PENDING` 및 `CONFIRMED`만 점유로 인정하여, `REFUND_PENDING`인 10/16 영희네·석이네를 즉시 오픈하여 타 사용자 예약 가능화.
  - [x] **결제관리 Pin to Top 및 변동일시 복구**: `fetchAllReservations`의 `updatedAt` 매핑을 복구하고, `/admin/payments` 전체 탭에서 `REFUND_PENDING` 및 `PENDING` 건을 최상단 1페이지에 고정 배치.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.23 스마트플랜 날씨 브리핑 KST 타임존 정규화(UTC 9시간 시차 왜곡 완치) 완결 (2026-08-31)** 🟢
  - [x] **서버 날씨 브리핑 KST 표준화**: `src/lib/smartPlan.ts`에 `toKstYMD` 및 `toKstDashDate` 표준 함수를 적용하여 UTC 환경 서버에서도 입실일(9/8) 및 날씨 브리핑(`09/08(화) ~ 09/10(목)`) 100% 일치 보장.
  - [x] **클라이언트 날짜 전송 정규화**: `SmartPlanProposal.tsx`에서 `toISOString()` 대신 `YYYY-MM-DD` 로컬 포맷 직송 적용.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.22 홈 화면 다가오는 여행 카드 5단계 스마트플랜 생명주기 뱃지 일치화 완결 (2026-08-31)** 🟢
  - [x] **5단계 D-Day 생명주기 뱃지 수식 동기화**: `ScheduleHomeWidget.tsx`의 `badgeText`를 `ScheduleCard.tsx`와 100% 동일하게 일치시켜 맛보기/정밀/D-7 주간예보/D-0 당일 날씨 갱신 안내 뱃지 통일.
  - [x] **뱃지 렌더링 스타일 통일**: `완료`(에메랄드), `정밀/업데이트`(앰버 펄스) 뱃지 시각화 적용.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.21 스마트플랜 캐싱 엔진 ReferenceError 버그 완치 & 5건 캐싱 복구 완결 (2026-08-31)** 🟢
  - [x] **변수명 정규화**: `scripts/caching-smart-plan.mjs` line 308~310의 미정의 변수 `todayKst`를 `kstNow`로 수정하여 런타임 크래시 완전 박멸.
  - [x] **오늘 대상 5건 캐싱 완료**: 충남 예산, 충북 제천, 경남 김해 등 3개 권역 5건 예약에 대해 411개 facts 캐싱 완수 및 `/admin/automation/logs` 정상 복구.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.20 스마트 푸시 알림 10초 쿨다운 가드 & 다량 푸시 50개 청크 병렬 큐 최적화 완결 (2026-08-30)** 🟢
  - [x] **10초 쿨다운 Idempotency 스마트 가드 탑재**: `notificationService.ts`에서 최근 10초 이내 광클은 100% 방어하면서도, 10초 이후의 2회차/3회차 예약 변경 알림 100% 실시간 발송 달성.
  - [x] **50개 단위 청크 병렬 큐(Chunked Parallel Queue v2.0) 탑재**: `push-notification` Edge Function에서 대량 푸시 발송 시 50개 청크 분할 + 50ms 간격 딜레이로 Google FCM Rate Limit 완벽 준수 및 소켓 고갈 방어.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.19 일일 로테이션 명소 3대 갱신 지표(수정감지/롤링갱신/캐시재활용) UI 관제 고도화 완결 (2026-08-30)** 🟢
  - [x] **동기화 엔진 4대 정밀 메트릭 탑재**: `modified_count`(수정감지), `rolling_count`(400개 롤링), `cached_count`(캐시재활용), `new_spot_count`(신규) 실시간 집계.
  - [x] **관리자 자동화 화면 3색 직관 뱃지 적용**: `/admin/automation/logs`의 SPOT 행 비고 컬럼에 `⚡수정감지 / 🔄롤링갱신 / 🚀캐시재활용` 실시간 시각화.
  - [x] **스마트플랜 3대 캐싱 생명주기(예약 다음날/7일전/당일새벽) 및 당일 0건 정상 스킵 무결성 검증 완료**.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.18 관리자 예약 변경 날짜 정규화(UTC 오차 완치) & 사이트 점유/차단 철벽 방어 완결 (2026-08-30)** 🟢
  - [x] **날짜 하루 전 밀림(UTC 타임존 오차) 완치**: `toISOString().split('T')[0]` 제거 및 `formatLocalDate`/`parseSafeDate` 전면 적용으로 KST 로컬 날짜 무결성 보장.
  - [x] **신청/예약완료/차단 3중 방어선 구축**: `blockedDates` 차단일 + `PENDING`, `CONFIRMED` 중복 예약 완벽 차단 (환불대기, 취소 건 및 퇴실일 당일은 정상 오픈).
  - [x] **UI 모달 실시간 가용성 뱃지(🚫차단, 🔴예약중) & 사전 비활성화 가드**: 선택된 사이트 충돌 시 즉시 경고 및 확정 차단.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.17 관리자 반응 속도 0.01초 최적화 & 해자 데이터 자산(/admin/moat)·팩트검증(/admin/verifications) 정상화 완결 (2026-08-29)** 🟢
  - [x] **입금확인 & 삭제/취소 반응 속도 0.01초 고속화**: FCM 푸시/대기자 알림 백그라운드 분리 + 낙관적 UI 적용 + 불필요한 전체 DB 재조회 제거.
  - [x] **해자 데이터 자산 대시보드(`/admin/moat`) 0 표기 완치**: RLS 우회 `createAdminClient` 적용 및 2-Step 피드 매핑으로 12건+ 피드백/내비 로그 실시간 집계 복구.
  - [x] **관리자 팩트검증 1단계(`/admin/verifications`) 외래키 에러(`PGRST200`) 완전 제거**: 실제 컬럼명(`check_in`, `check_out`, `campground_name`) 정규화 및 2-Step 매핑으로 1~3단계 전체 플로우 정상화.
  - [x] **무결성 검증**: Next.js 16.1.1 Production Build 103/103 전체 라우트 100% 통과.

- [x] **9.16 일일 지역 로테이션 & 스마트플랜 캐싱 04시/06시 2중 안전망, 400개 분할 롤링 갱신 & 0초 스킵 락 구축 (2026-08-29)** 🟢
  - [x] **04:00/06:00 2중 안전망 구축**: 1차 `cron-job.org` 정시 발동(04:00 지역 / 04:05 스마트플랜) + 2차 `GitHub Actions`(06:07 / 06:08) 백업 스케줄러 연동.
  - [x] **당일 1회 완료 0초 스킵 락 (Idempotency Guard)**: 오늘(KST) 이미 완료된 경우 0초 만에 스킵하여 2차/중복 실행 0건 보장.
  - [x] **관광공사 수정일시(`modifiedtime`) 실시간 감지 & 400개 분할 롤링 갱신**: 전국 16개 시도에서 변경된 명소 당일 즉각 갱신 + 400개 분할 롤링(15초 완료)으로 타임아웃 0건 달성.
  - [x] **NMC 병원 57개 전수 실시간 수집 파이프라인**: 5-Worker 병렬 풀로 서울 및 전 시도 응급의료기관 진료시간/응급실 상세 100% 완전 수집.
  - [x] **스마트플랜 외부 트리거 API 라우트 신설**: `src/app/api/cron/trigger-smart-plan/route.ts` 배포 및 cron-job.org 연동 검증 완료 (`200 OK`).

- [x] **9.15 10초 기록 의견수집 2중 유도·나만의 캠핑지도 0초 핀 고속화·PWA 푸시 분기 & 맛집/명소 영구저장 및 +100P 적립 완결 (2026-08-24)** 🟢
  - [x] **10초 기록 불변 스냅샷 고정 (`QuickRecordForm.tsx`)**: 방금 작성한 일정 정보를 스냅샷으로 캡처하여 부모의 미작성 일정 변경 교란을 100% 차단.
  - [x] **의견수집 2중 유도 체계**: 10초 기록 완료 직후 1차 황금 버튼 + 지도 이탈 시 2차 전역 바텀시트 모달(`VerificationPromptModal.tsx`) 연계.
  - [x] **나만의 캠핑지도 0초 핀 즉시 주입 & 4단계 상세 지형 뷰(`level={4}`)**: 비동기 대기 없이 0.01초 만에 별 핀(⭐) 포커스.
  - [x] **FCM PWA 전용 독립 앱 최우선 포커스 & 웹 자동 분기**: 브라우저 새 탭 탈취를 차단하고 앱 설치자 PWA 화면 복원.
  - [x] **팩트체크 화면 하단 바 상시 고정 & 5대 탭 자동 숨김 (`verify/[scheduleId]/page.tsx`)**: 화면 맨 밑바닥에 내 지도에 담기 버튼 상시 노출.
  - [x] **선택한 맛집/명소 내 지도 영구 저장 (`addMapItem`) & 카테고리 정합성 분리**: 🍽️ 맛집 핀, 🏞️ 명소 핀으로 즉시 표출 및 캠핑장 기록 오분류 완치.
  - [x] **팩트체크 완료 시 +100P 포인트 실시간 적립**: `profiles.raon_token` 및 `point_history` 트랜잭션 적재.

- [x] **9.14 라온아이 ↔ 캠핏 양방향 실시간 예약 자동 연동 시스템 구축 (2026-08-23)** 🟢

  - [x] **크롬 확장프로그램 패키징 (`raoni-camfit-sync-extension/`)**: 구글 Manifest V3, 15초 백그라운드 큐 감시 서비스 워커, 캠핏 관리자 화면 내 고객명/연락처/메모 자동 기재 및 차단 RPA 스크립트.
  - [x] **실시간 대기 큐 및 ACK API (`/api/admin/camfit-sync/queue`, `ack`)**: 라온아이 신규 예약 자동 감시 및 캠핏 연동 로그 영구 적재 파이프라인.
  - [x] **무한 루프(Echo Loop) 100% 원천 차단**: 캠핏 알림톡 수신 시 `[라온아이]` 태그 감지 시 0초 만에 스킵 처리하여 중복 생성 방어.

- [x] **9.13 관리자 대시보드 & 결제 목록 UI 전면 개편 (캠핏 스타일 10개 페이징 & 최신순 정렬) (2026-08-23)** 🟢
  - [x] **'오늘 입실' 카드 원클릭 모달 (`TodayCheckInsModal.tsx`)**: 오늘 입실팀 및 연박 체류팀 명단 고밀도 표출 및 행 클릭 시 예약 상세 연동.
  - [x] **메인 대시보드 '결제 목록' 카드 개편**: 오늘 결제 총액 메인 표출 및 `결제대기 N건`, `환불대기 N건` 실시간 서브 정보 뱃지 표기.
  - [x] **캠핏 스타일 결제/환불 관리 전면 리뉴얼 (`src/app/admin/payments/page.tsx`)**: 상단 3종 요약 카드 + 6대 상태 탭 바 + 10열 고밀도 테이블 + 10개씩 페이징 + 최신 변동 시각(`updatedAt || createdAt`) 우선 정렬.
  - [x] **환불 계좌정보 선명한 표출**: 환불/취소 내역에는 예약 취소자의 은행명, 계좌번호, 예금주명 자동 분기 렌더링.

- [x] **9.1 Push Notification Debugging (Fixed)** 🟢

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

- [x] **9.4 Public Shared Viewer & UI Optimization (2026-07-23)** 🟢
  - [x] **Public Shared Viewers**: Implemented `/share/plan/[id]` and `/share/record/[id]` to bypass RLS and auth guards safely for shared links.
  - [x] **Zero-Cost Features**: Provided place swap, nav deep links, and place details without additional Gemini AI API costs.
  - [x] **Regeneration Guard**: Hidden all regeneration/update banners in public views to prevent unauthorized API costs and plan mutation.
  - [x] **Layout Synchronization**: Applied `max-w-[430px] mx-auto overflow-x-hidden` fixed frame, warm beige background (`#F7F5EF`), and TopBar title to match app original view 100%.
- [x] **9.5 Bounce Bug Elimination & Clean Refactoring (2026-07-24~26)** 🟢
  - [x] **Bounce Bug Root-Cause Eradication**: Removed toxic auto-exit `router.back()` triggers from `ScheduleDetailPage.tsx`, freezing the viewport safely with skeleton & retry UI.
  - [x] **Codebase Clean-Up**: Removed temporary diagnostic sensors (`diagnosticSensor.ts`, `BounceDebugBanner.tsx`) and 600ms timeout suppression guards, restoring clean original architecture.
  - [x] **CampWarm ReservationLockModal**: Built aesthetic custom reservation lock modal with `tel:` direct dial to camp owner's real phone number (`010-7404-0108`).
  - [x] **Community QNA Auto-Private**: Enforced automatic `PRIVATE` visibility setting for error report category in `CommunityWriteForm.tsx` with admin/author view permissions.
  - [x] **UI Streamlining**: Removed redundant Kakao Map route card from schedule detail page.
- [x] **9.6 Smart Plan Weather Briefing & Live Synchronization (2026-07-27)** 🟢
  - [x] **Dead-Center Axis Alignment**: Aligned min temp (`24°C`) to card's horizontal center line.
  - [x] **8-Way Wind Direction & Indicators**: Exposed 8-way wind direction (`💨 남동 1.5m/s`) and explicit Korean labels (`평균풍속`, `최대풍속(방향)`, `평균습도`).
  - [x] **Single-Source Live Weather Sync**: Unified top weather card data with Smart Plan engine (`prefetchedWeather`), achieving 0% data error and 300ms speed boost.
  - [x] **D-3 Truncation Fix**: Removed `.slice(0, 3)` bug to restore full Day 3 temperature display.
  - [x] **Cache Restored**: Restored 4-hour session cache TTL in `useWeather.ts`.

- [x] **9.7 TWA Bounce Prevention & Asynchronous Racing Safetynet (2026-07-30~31)** 🟢
  - [x] **History Stack Cleanup Bypass**: Removed redundant pushState/back() handlers from `useModalBackHandler.ts` to prevent client router crashes on mobile devices.
  - [x] **Place Picker Back-Routing Deletion**: Deleted hardcoded `window.history.back()` from `MyMapModal.tsx` to stop page-exiting bounces when selecting search results.
  - [x] **Mount-State Routing Protection**: Implemented `isComponentMounted` tracking ref in `ScheduleHomeWidget.tsx` to avoid late-running server action navigation loops.
  - [x] **Freeze Warning Suppression**: Downgraded handled push exception triggers to warn logs, and added `aria-describedby` bypass to sheet components to optimize rendering performance.
- [x] **9.8 홈화면 다가오는 일정 튕김 근본 원인 해결 및 엇박자 완치 (2026-08-03)** 🟢
  - [x] **Root dynamic = force-dynamic 제거**: 최상위 layout.tsx의 force-dynamic을 제거하여 페이지 이동 시마다 불필요한 전체 RSC 재요청으로 라우터 트리 붕괴 및 홈('/') 리셋을 유발하던 메커니즘 차단.
  - [x] **조회(Read) 중 DB 갱신(Write-on-Read) 제거**: `getScheduleById` 서버 액션 내 만료 날짜 경과 시 인라인 DB update를 제거하고 순수 읽기 함수로 복원하여, Next.js App Router 캐시 무효화 및 튕김 방지.
  - [x] **useSearchParams Suspense 경계 보완**: `records`, `admin/reservations`, `community`, `schedule/[id]` 상세페이지에 각각 `<Suspense>` 안전 포장을 씌워 Next.js prerender 빌드 에러 및 라우터 이탈 튕김 최종 완치.
  - [x] **비동기 이중 트랜잭션 동시성 충돌 정밀 완치**: 홈 위젯의 백그라운드 자동 동기화 `syncAll()`을 제거해 예약 변환 시 중복 DB 쓰기 충돌을 제거하고, 이미 로컬에 매핑된 일정이 있으면 즉시 0.001초 직통 이동하도록 정밀 엇박자 통제.

- [x] **9.10 스마트플랜 4단계 UX 생명주기 및 새벽 캐싱 오판 스킵 정밀 정상화 (2026-08-13)** 🟢
  - [x] **새벽 캐싱 스케줄러 오판 스킵 수정**: `smart_plan_data`가 맛보기 플랜(`is_preview: true`)인 경우도 새벽 5시에 예외 없이 전수 캐싱 수집을 가동하도록 교정.
  - [x] **누락 수집 예약건 수동 즉시 적재**: `시그니엘 부산`, `서울스포렉스`, `강릉바다내음` 등 누락 예약건에 후보 데이터 54건 수동 적재 완료.
  - [x] **D-Day 4단계 동적 생명주기 뱃지**: 등록 당일 맛보기 -> 맛보기 완료 -> D+1/D-8 정밀 생성 가능 -> D-7/D-0 정밀 업데이트 가능 -> 정밀 완료 5단계 뱃지 세분화.
  - [x] **모바일 무단 경로탐색 직행 원천 차단**: 맛보기 data 전달 시 initialPlan null 처리로 모바일 튕김 차단 및 프로필 게이트 -> 경로 선택 정순서 보장.

- [x] **9.11 스마트플랜 2단계 무결성 검증, Master DB 전체 메타데이터 동기화 & 2중 자동 청소 파이프라인 (2026-08-15)** 🟢
  - [x] **단독 숫자 "0" 뱃지 버그 소멸**: `SmartPlanProposal.tsx` 및 `SmartPlanTimelinePro.tsx` 내 거리 뱃지 조건식을 `!!(card.distanceKm && card.distanceKm > 0)`로 안전화하여 노출 버그 완치.
  - [x] **2단계 무결성 검증 & 0원 DB 미시적 보수 파이프라인**: `runPostCachingAuditAndMicroRepair()` 구축으로 결함 데이터 0.05초 감지 및 0원 비용 100% 자가 보정.
  - [x] **Master DB 메타데이터 100% 동기화**: `master_places` 원본 `raw_data`(안심식당, 모범음식점, 백년가게, 주차, 영업시간 등)를 1:1로 읽어와 `정동진해물탕` 및 전체 맛집 `🎖️안심식당` 이모지 뱃지 100% 복원 완료.
  - [x] **2중 DB 자동 청소(Auto-Purge) 파이프라인**: 예약 취소 시 0.05초 즉시 삭제 및 퇴실 7일 경과 데이터 일일 자동 청소(`runCandidatesCleanup()`)로 DB 4,808행 ➔ 3,140행으로 1,668행(약 35%) 즉시 슬림 최적화.

- [x] **9.12 환불 계좌정보 노출, 관리자 통합 캘린더 잠금 해제 & 모바일 캐시/로그아웃 완치 (2026-08-20~21)** 🟢
  - [x] **스마트플랜 5단계 D-Day 생명주기 뱃지 수식 완비**: D-7 주간 예보, D-0 정밀 날씨 업데이트 문구 세분화 완벽 적용.
  - [x] **권한 동의 중복 팝업 원천 차단**: DB `user_permission_consents` 실시간 확인으로 이미 동의한 사용자 팝업 0% 차단.
  - [x] **10초 기록 글 작성 후 배너 즉시 영구 종료**: `createRecord` 시 `record_written = true` 업데이트 및 취소된 일정 배너 필터링.
  - [x] **환불 계좌정보 DB 100% 안전 저장**: Server Action `requestReservationCancelAction` 구축으로 은행, 계좌번호, 예금주 DB 안전 저장.
  - [x] **관리자 결제/환불 관리 전용 탭**: `[입금 대기]` & `[환불 대기 (계좌 확인)]` 2개 탭 구성 및 환불 계좌정보 선명한 표출.
  - [x] **환불 완료(`REFUNDED`) 시 관리자 통합 캘린더 잠금 즉시 해제**: 캘린더 점유 체크에서 `r.status !== 'REFUNDED'` 추가로 환불 즉시 빈자리 자동 풀림.
  - [x] **모바일 캘린더 실시간 동시 동기화**: `visibilitychange` & `focus` 자동 재조회 + 30초 주기적 백그라운드 폴링 적용.
  - [x] **모바일 `localStorage` 캐시 오염 완전 근절**: `useReservationStore` partialize 적용 & 스토리지 키 v3 격상으로 스마트폰 메모리 구 캐시 영구 제거.
  - [x] **모바일 관리자 로그아웃 버튼 무반응 완치**: `AdminLayout.tsx`의 소프트 네비게이션을 하드 리다이렉트(`window.location.href = '/admin/login'`)로 전면 교체.


## 📊 전체 진행 현황 요약 (Progress Summary)

| ?계 | 구분 | ?태 | 진행?| 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | **?�용????(User Home)** | ??**?�료** | 100% | Beginner/Returning UI, Smart Re-book, L0 Logic ?�료 |
| **Phase 2** | **?�공�?(My Space)** | ??**?�료** | 100% | ?�?�보??지???�?�라???�료. ?�카?�브(기록) 리뉴??�?XP/Token ?�료. |
| **Phase 3** | **?�약 ?�스??(Reservation)** | ??**?�료** | 100% | Logic/Validation/Admin Core/Holidays ?�료. PG/?�픈???�음. |
| **Phase 4** | **미래 기능 (Future)** | ??**?�료** | 100% | ???�시(FCM), ?�황�??�림 ?�스?? ?�앱 배�? 구현 ?�료. |
| **Phase 5** | **마켓 & 결제 (Market)** | ??**?�료** | 100% | MVP ?�료. 리뷰 ?�스??DB/UI) 구현 �?검�??�료. Commerce Logic Complete. |
| **Phase 5.5** | **스마트 캠핑 플랜 (Smart Plan)** | 🟢 **완료** | 100% | v12.5.5 로컬 감성 엔진 이식 및 2중 공간 중복 제거 100% 완결. |
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
    *   [x] **5.5.24 Caching & Timing Optimization (v11.9.95) 🟢 (2026-06-12)**:
        *   [x] **Next-day Activation**: 스마트플랜 활성화 시점을 예약 다음 날 오전 9시로 앞당겨 2달 전 예약 건도 조기 수립 허용.
        *   [x] **D-7 Second Caching**: D-7 기점으로 2차 캐싱이 재작동하도록 크론 범위 및 스킵 가드 임계값 상향.
        *   [x] **15px Gold Badge Repositioning**: 다가오는 일정 카드의 골드 뱃지를 사이트/캠핑장 이름 우측 정렬로 레이아웃을 다듬고 15px로 확대.
        *   [x] **D-3 Guidance Notice**: 일정 상세 페이지 내 D-3 정밀 날씨 연동 추천 안내 배너 적용.
    *   [x] **5.5.25 Smart Plan Weather Hallucination Prevention (v11.9.96) 🟢 (2026-06-13)**:
        *   [x] **Weather Availability Branching**: 날씨 정보가 없는 10일 초과 미래 예약 시 AI 히어로가 날씨를 마음대로 지어내는 환각(Hallucination) 현상을 차단하기 위해 프롬프트를 조건부 분기.
        *   [x] **Supabase Client Fallback**: CLI 테스트 및 크론 환경(Request Context가 없는 환경)에서 cookies() 호출 에러가 날 때, 서비스 롤 기반 Supabase 클라이언트를 타도록 내결함성(Robustness) 로직 추가.
    *   [x] **5.5.26 Travel & Camping Recipe Explorer (v11.9.97) 🟢 (2026-06-13)**:
        *   [x] **Database Migration**: `travel_recipe_categories` 및 `travel_recipes` 독립 테이블 스키마 설계 및 마이그레이션 SQL 파일 배치.
        *   [x] **Seed Data Ingestion Script**: 상황별 14개 서브 카테고리와 40여 종의 꼼꼼한 여행 요리(재료, 여행 팁, 키워드 포함) 데이터 CLI 자동 적재 스크립트 구축.
        *   [x] **Explorer Page & Bottom Sheet UI**: 대분류/소분류 2-Step 최소 터치 탐색기 UI, 장보기 체크리스트, 여행 전용 팁 및 유튜브/인스타 검색어 딥링크 모듈 개발 완료.
        *   [x] **Home UI Entry Banners**: 초보자 및 기존 사용자용 모바일 홈에 탐색기 진입로용 배너 연동.
    *   [x] **5.5.27 Recommendations DB RLS Fix & Travel Recipes AI JSON Paste Upload (v11.9.98) 🟢 (2026-06-13)**:
        *   [x] **DB RLS Policies Security Fix**: `recommendation_pool` 및 `nearby_events` 테이블에 대해 authenticated 사용자에게 모든 CRUD 권한을 부여하여 관리자 삭제 오류 해결.
        *   [x] **Travel Recipes AI JSON Paste Upload**: 여행 레시피 탭에 AI JSON 데이터를 직접 붙여넣어 일괄 또는 단일로 업로드할 수 있는 Dialog UI 및 파싱 엔진 구현.
        *   [x] **Smart Category Mapping**: 업로드 시 AI가 출력한 한글 카테고리명을 데이터베이스의 실제 카테고리 ID로 지능형 매핑하는 변환 로직 구축.
    *   [x] **5.5.28 Travel Play & Game Explorer (v11.9.99) 🟢 (2026-06-15)**:
        *   [x] **Database Schema & Seeding**: `travel_play_categories` 및 `travel_plays` 테이블에 RLS 적용. `seed-play-recommendations.ts`와 `supplement-category6.ts`를 실행하여 야외 액티브 가족 동반을 포함한 총 478개 놀이 데이터의 Supabase 적재 완료.
        *   [x] **Mobile Play Explorer UI**: `src/app/(mobile)/play/page.tsx`에 2-Step 필터링, GPS/기상 캐싱 연동 매칭, 로컬 스코어러 탑재. 사용자가 "추천받기" 로직을 쉽게 인지할 수 있도록 실시간 매칭 세부 설명 및 명칭 수정.
        *   [x] **Interactive Mini-Games**: 8분할 conic-gradient 기반 물리 가속 회전 룰렛 판 및 CSS 3D Y축 회전을 결합한 3D 랜덤 카드 뒤집기 인터랙티브 게임 컴포넌트 탑재.
        *   [x] **Optimization**: 품질 피드백에 따라 Web Audio ASMR 합성 엔진을 제거하여 🧘 명상 타이머 기능에 충실하도록 코드와 UI 경량화 완료.
        *   [x] **Home entry**: 자동 날씨 API 호출을 막기 위해 홈 화면의 `RecommendationGrid`를 놀이 탐색기 진입 정적 배너로 교체 완료.
    *   [x] **5.5.29 스마트플랜 상세화면 모바일 레이아웃 최적화 (v11.9.99-patch1) 🟢 (2026-06-20)**:
        *   [x] **Mobile Layout Alignment**: 스마트플랜 상세 페이지 내 Stage 1~5의 1줄설명 및 추천 장소 카드(`renderFactCard`)가 화면 가로폭을 침범하여 우측으로 삐져나오던 정렬 문제 수정.
        *   [x] **Explicit Sizing & Overflow Protection**: 카드 가로폭 계산 방식을 `w-[calc(100%-2rem)]`로 고정하고, 1줄설명 부모 블록들에 `min-w-0`을 추가하여 모바일 뷰포트 내 텍스트 줄바꿈 및 여백 가두기 완벽 보장.
    *   [x] **5.5.30 식당 가점 개편 및 10초 기록 독려 버그 패치 (v11.9.99-patch2) 🟢 (2026-06-22)**:
        *   [x] **Restaurant Score Adjustments**: 백년가게 및 LX인증맛집 중복 가점을 기존 +50점에서 +80점으로 전격 상향 조정하여 추천 랭킹 스코어링의 신뢰도 대폭 제고.
        *   [x] **10s Record Bug Fix**: `user_schedules` 테이블 조회 시 존재하지 않던 `start_date`/`end_date` 컬럼을 실제 존재 컬럼인 `check_in`/`check_out`으로 전격 교체 및 KST 타임존 오차 수정 완료.
        *   [x] **Home Reminder Integration**: 홈화면 최상단에 미작성 기록 리마인더 배너를 노출하고 클릭 시 10초 기록 팝업 모달이 유기적으로 뜨도록 홈-마이스페이스 연계 퍼널 완성.



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
    *   [x] **TopBar**: ?정 메뉴(?로???림/??) ?로그?웃 구현 ?료.
    *   [x] **Login UX**: 비로그인 ?근 ?한(Global Modal) ?로그?웃 ??XP 초기??구현 ?료.
*   **7.2 ???테??(Home Details)** ??
    *   [x] **초보???*: 6?고정 ??자???용 ?관리자 ?동 ?료.
    *   [x] **?늘??콘텐?*: '?늘??추천'?로 명칭 변??개인???진 V2 (`recommendation_pool`) ?론?엔??백엔??고도???료.
    *   [x] **링크 ?정**: 관리자 ?정(기본?보)?서 주요 링크 ??스???어 가??
    *   [x] **관리자 고도??V2.1**: AI Bulk Import, 구조?된 ?료/?계 ?력 ?? 개인???드(?분/칼로??령/?소) 관?
*   **7.3 ?공?고도??(My Space Pivot)** ??
    *   [x] **?늘??콘텐?*: '?늘??추천'?로 명칭 변??개인???진 V2 (`recommendation_pool`) ?론?엔??백엔??고도???료.
    *   [x] **링크 ?정**: 관리자 ?정(기본?보)?서 주요 링크 ??스???어 가??
    *   [x] **관리자 고도??V2.1**: AI Bulk Import, 구조?된 ?료/?계 ?력 ?? 개인???드(?분/칼로??령/?소) 관?
*   **7.3 ?공?고도??(My Space Pivot)** ??
    *   [x] **?치 기반 ?의?설**: `site_config.nearby_places`? ?동??주? ?의?설 ??구현.
    *   [x] **주? 즐길거리**: `nearby_events` DB ?동 ?LBS.
    *   [x] **Fallback ?이??개선 (2026-01-07)**: 가?????산??이??변? 검??반경 10km ??20km ?장.
    *   [x] **?사 UI 개선**: ??지 ?거, 진행?뱃? ?동, ?세보기 버튼(TourAPI ?동).
    *   [x] **Archive UX (New)**: 불멍/별보?꾸??버튼 ??. ?진 ?로???뷰어 ?질 강화.
    *   [x] **Action**: '기록?기(Log)' 버튼 강조 ??근??개선.
    *   [x] **????*: ?공??반(Records, Album, History)???구 UI 경험 ?일.
*   **7.5 ?스???영 ??정??(System Ops)** ??
    *   [x] **?씨 ?보 고도??*: ?기/중기 ?보 병합 로직 ?정?로 **10???보** 지???료.
    *   [x] **?스???영보드 (New)**: `/admin/operations` 구현 (SSOT 26??. ?? ?근 ?어(??보수 모드), ?약 차단, 캐시/?림 리셋 ?클????
    *   [x] **???가?드**: ?영보드 ???황?조치 가?드(Dialog) ?재.
*   **7.6 마켓 ?벗 (Market Pivot)** ??(2026-01-13):
    *   [x] **?휴 중심**: ?체 ?품 ????? 링크(쿠팡 ?트?스 ?? 지??구조 ?성. ProductCard ??세 ?이지?서 "구매처로 ?동" 분기 처리.
*   **7.5 ?약 ?동??* ??(?? 구현??:
    *   [x] **?픈 로직**: `OpenDayConfig.tsx` 컴포?트?서 매월 ?동 반복 규칙 지?? `open_day_rules` ?이?+ `automation_config` JSONB.
*   **7.6 ?시 ?영 체계 (Daily Region Sync v12.0) ??(2026-04-04)**:
    *   [x] **Rotation Engine**: ?국 17??도 ???17??주기 지?? ?환 ?기???진 ?장 (`daily-region-sync.mjs`).
    *   [x] **Category Expansion**: 마트(???SSM/기?)??안부 OpenAPI 기반 ?시 갱신 체계??합.
    *   [x] **Audit Reporting**: 7? ?심 지??기존/?신/?규/갱신/총계) 로깅 ?관리자 ?이지 ?용 리포??UI 구현.
    *   [x] **Automation**: GitHub Actions??한 매일 04:00 KST ?동 ?행 ??줄링 ?료.
    *   [x] **SSOT Consistency**: 매뉴????? 감사 SOP(v11.1)???시 ?영 지?반영.
    *   [x] **Playwright Scraper**: 식당/카페 및 마트 대상 Playwright 기반 동적 DOM 스크래핑 모듈 탑재 및 일일 300건 쿼터제 수집엔진 구축 (`fast-enrich.mjs`).
    *   [x] **Public API Detail Integration**: 관광공사 TourAPI 및 NMC 병원 상세 API 연동 완료 및 일일 지역 순환 동기화 단계 (`syncTourSpots`, `syncHospitals`) 내 실시간 상세정보 결합 적재 보정 완료.
    *   [x] **Admin Logs Dashboard**: 자동화 로그 대시보드 내 명소/병원 상세 배지 및 식당/마트 쿼터제 성공 통계 그리드 모니터링 시각화 보정.
    *   [x] **마스터 DB 상세정보 벌크적재 (v10 기반 고속화)**: 식당/카페/마트 10만 건 벌크적재 루프 완전 이행 (미시도 0건 달성).
    *   [/] **공공 API 상세정보 벌크적재 (명소/병원/축제)**: 쿼터 소진으로 2,214건 대기 상태, 다음 세션 재개 예정.
    *   [x] **백년가게 필터링 및 인천광역시 정밀 복원**: 백년가게 비음식점(472건) 클리닝 가드 장착 완료, 카테고리별 정밀 병합(Merge Guard) 연동 적용, 인천 식당/마트 Playwright 전체 7,450건 백그라운드 완주로 최종 6,190건 복원 완료.
    *   [x] **전국 행정코드 매핑 오류 수정 및 누락 데이터 보완**: admin-code-mapping.mjs 약칭 보완 리팩토링(SIDO_SYNONYMS), Null 주소 3,184건 파싱 복원 배치(100% 완료), 갭 검사기를 통한 누락 갭 최종 0건(제주도 1건 제외) 및 TMAP 모빌리티 정상화 완료.
    *   [/] **제미나이(Gemini) 유료 API 기반 장소 1줄 설명 사전 적재**: 파이프라인 최적화 튜닝 적용, 식당 100%(5.1만 건) 및 마트 100%(1.1만 건) 요약 수집 완료, 10건 정밀 과금 테스트(건당 5.1원 실 청구 규명) 완료 후 추가 비용 검증 대기.
    *   [x] **KTO 인기도 동기화 고속화 및 누락 복구**: 9단계 KTO 공식 랭킹 업데이트 시 DB 쿼리 폭발을 인메모리 매칭 맵 기법 및 UPDATE 스킵 가드로 개선 완료, 경기도/강원도 로테이션 복구 완수.
*   **7.6 ?? API ?동 (Final Polish)** ?(?메??발급 ??:
    *   [ ] **TourAPI/Kakao**: `nearby_events` ?`site_config` ?이?? ?제 ?? API? ?시??기??(?정???계?서 진행).

### Phase 8: ?정???리팩?링 (Stabilization) - ? In Progress
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
    *   [ ] (선택) TWA로 플레이스토어 등록 (안드로이드 백그라운드 푸시 알림 도달율 최종 보완)
    *   [ ] (선택) iOS 전용 하이브리드 앱 패키징(Capacitor/WebView) 및 스토어 등록 (iOS 백그라운드 푸시 알림 수신 보완)

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
* [x] **?약 ?스??무결??강화**: 0??약 방? ??스???림 ?입 (?료)
* [x] **?허?검??(Phase 1)**: ?마?플??기술 ?약 ??허??분석 ?료

### [2026-05-15 Update]
* [x] **Monetization Strategy**: 스마트플랜 LIVE (시간대별 타임라인 및 실시간 밀착 추천 패키징) 기획 및 아키텍처 설계 완료
* [x] **Phase 12.7: 스마트플랜 LIVE MVP 빌드**: 타임라인 UI 및 컴포넌트 마크업, 실시간 시간 재계산 모듈 탑재 (완료)
* [ ] **Phase 12.8: 스마트플랜 LIVE 기능 고도화 및 서비스 실시간화**: SOS 긴급대응 메신저, Co-Op 실시간 투표 연동

### [2026-06-25 Update]
* [x] **인천 식당/마트 Playwright 상세정보 7,450건 정밀 복원 작업**: 하이브리드 Playwright 복구 엔진을 통해 최종 6,190건 복원 성공 및 1,260건 Placeholder 유지 방어 완료.
* [x] **전국 행정코드 매핑 오류 수정 및 누락 데이터 보완 (v2)**: SIDO_SYNONYMS 구축으로 약칭 매핑 누수 문제 교정 및 Null 주소 3,184건 파싱 복원 완료 (최종 매핑 갭 0건 확인).
* [/] **공공 API 상세정보 벌크적재 이행 (명소/병원/축제)**: 2,214건 대기 상태 (금일 성공 917건 / 실패 727건 적재 후 쿼터 소진으로 중단, 다음 세션 재개 대기).
* [/] **제미나이(Gemini) 유료 API 기반 장소 1줄 설명 사전 적재 이행**: 결제 등록 및 계획서 승인 완료, 파이프라인 최적화 튜닝 적용, 식당 100%(5.1만 건) 및 마트 100%(1.1만 건) 요약 수집 완료, 10건 정밀 과금 테스트(건당 5.1원 실 청구 규명) 완료 후 추가 비용 검증 대기.

### [2026-06-29 Update]
* [x] **TWA 플레이스토어 심사 준비 완료**: 개인정보처리방침(`privacy-policy/page.tsx`) 및 이용약관(`terms/page.tsx`) 신설 및 연동, 스토어 규격 앱 아이콘(512x512/192x192 PNG) 및 대표 그래픽 배너(1024x500 PNG) AI 제작 및 정합 완료.
* [x] **앱 이름 및 스플래시 동기화**: 앱 노출명 및 스플래시 화면을 "라온아이 - 스마트 여행 수첩"으로 일괄 수정 및 배포용 manifest.json 연동.
* [x] **디지털 에셋 링크 배포**: 패키지명 `kr.co.raoni.app`과 SHA-256 서명 지문을 연동한 `assetlinks.json`을 public 경로에 업로드 및 도메인 검증 완료.
* [/] **DUNS(던스) 번호 발급 대기**: 나이스디앤비 수수료 부과 회피를 위해 D&B 미국 본사(애플 개발자 포털 연계) 무료 발급 우회 신청 완료 (접수 및 3~5일 영업일 대기 중).

### [2026-07-02 Update]
* [x] **일일 크롤러 100건 최적화 및 3진 아웃 오진단 가드 적용**: 하루 60분 시간 제한 해결을 위해 식당 90건, 마트 10건(총 100건) 수집 한도 조정. 네트워크/타임아웃 등 일시 오류 시 `miss_count` 누적을 건너뛰는 예외 가드 도입.
* [x] **일일 로테이션 WAF 영구 우회 (Vercel Proxy)**: 깃허브 Actions 가상머신 IP가 행안부 WAF에 ETIMEDOUT 차단되는 로또성 장애를 해결하기 위해 Next.js 백엔드에 CSV 프록시 API Route 개설 및 연동 완료.
* [x] **GHA 쓰기 권한 부여**: 커서 파일 자동 푸시 단계(`Commit and Push Cursor File`)를 무사 완수하도록 `permissions: contents: write` 권한 및 자동 커밋 스텝 최종 활성화.
* [x] **3진 아웃 마트 2개 매장 정밀 복구**: 오늘 새벽 오진단 비활성화 처리되었던 마트 2개 매장(`주식회사 엔마트용인점`, `(주)이마트에브리데이 가운점`)만 정밀 타겟팅해 DB 활성 및 miss_count 초기화 완료.

### [2026-07-05 Update]
* [x] **식당/카페 영업시간 압축 정규식 수정 및 가독성 고도화**: `cleanOperatingHours` 정규식의 `요일?` 문제를 `(?:요일)?` 비캡처 그룹 및 대시/물결 Or 그룹 `(?:~|～|∼|-|—|–)`으로 수정하여 파싱 성공률 100% 확보.
* [x] **영업시간 접두사 중립화**: 7일 동일 시 표출되던 `'매일'` 접두사를 `'운영시간'`으로 교체하여 정보 왜곡 우려 차단.
* [x] **중복 메시지 전면 청소**: 상세 정보 전무 시 표시되던 정적 폴백 문구들을 `""`로 변경하여 하단 넛지와의 텍스트 2중 겹침 현상 원천 제거.
* [x] **병원 응급실 전화 버튼 이중 노출 차단**: 병원(`HOSPITAL`) 카테고리에 빨간색 응급실 다이렉트 버튼이 존재하는 경우, 위쪽의 파란색 유선 넛지 출력을 생략하여 레이아웃을 간소화 및 정돈 완료.

### [2026-07-10 Update]
* [x] **스마트플랜 여행 서사 기승전결 고도화**: 인사말 ➔ 동반자 ➔ 날씨(시간 흐름 및 전환사 결합) ➔ 제안형 맺음말(Fallback 적용) 순으로 조립 방식을 전면 개편하여 문맥의 자연스러움을 극대화함.
* [x] **기상 수급 주기 D-Day 기준 리비전**: 기상청 단기예보의 물리적 한계를 고려해 단기 업데이트를 **출발 당일(D-Day 이하)**로 변경하고, 주간 업데이트는 **1~7일 전**으로 정돈함.
* [x] **어드민 예약 수정 ➔ 사용자 일정 동기화 연동**: 관리자가 캘린더에서 예약일자를 바꾸면 연동된 사용자 일정의 일자도 자동 갱신되고, **기존의 스마트플랜 캐시가 null로 즉시 자동 리셋**되도록 연동 로직을 완료함.

### [2026-07-13 Update]
* [x] **주간 축제 동기화 로그 뷰어 복구**: WEEKLY_FESTIVAL_SYNC 로그 통계 표의 잘림 결함을 상단 독립 상세 모달창(Full-Width) 연동으로 해결 및 정상 작동 검증.
* [x] **예약 통합 캘린더 일괄 차단/해제**: DAILY 모달에 [전체 차단] 및 [전체 해제] 버튼을 추가하고, siteId = 'ALL' 데이터의 효율적인 DB 적재 및 개별/전체 차단 일괄 삭제 청소 로직 연동 완료.
* [x] **예약 어플 'ALL' 차단 동기화 완료**: 관리자에서 적용한 일괄 전체 차단이 모바일 예약 어플의 8대 모든 사이트 슬롯에 실시간 '예약 불가' 상태로 분기 전개(Unpacking)되어 연동되도록 클라이언트 스토어 로직 수정 완료.
* [x] **에어컨 대여 air-group DB화 및 스토어 실시간 동기화**: 에어컨 대여 대표 통합 카드를 DB Row로 개설하고 상세 페이지 조회 단일화 및 사용자 목록 마운트 시 `fetchSites()` 트리거로 실시간 동기화 지연 결함 완료.
* [x] **어드민 RLS 차단 우회 및 개별 에어컨 동적 관리**: Service Role 권한의 어드민 서버 액션(`updateSiteAdmin`, `admin-aircon.ts`)을 신설하여 RLS DML 차단을 무력화하고, 에어컨 관리 화면 내에서 개별 에어컨 기기(`air-1` ~ `air-N`)들을 추가, 삭제, 인라인 수정(이름/요금), 스위치 제어할 수 있는 가로 레이아웃(col-span-3) 완비.
* [x] **에어컨 대표카드("대여" 칩) 예약 선택지 노출 필터링 핫픽스**: 사용자 예약 폼 내 개별 기기 선택 칩 목록에서 대표 통합 카드 `'air-group'`이 노출되는 필터 결함 수정 완료 (14차 빌드 통과).### [2026-07-16 Update]
* [x] **통합 캘린더 에어컨 상태 표기 및 사용자 수량 즉시 동기화 보완**: DAILY 및 AIRCON_DAILY 모달 내에 예약의 실제 상태(PENDING/CONFIRMED)에 따라 대기/확정이 정확히 렌더링되도록 표기 수정. 사용자 예약 폼 마운트 시 `fetchSites()`를 강제 실행하여 관리자 페이지에서의 에어컨 기기 수량 변동(삭제/추가)이 사용자 화면에 캐싱 없이 즉시 반영되도록 패치.
* [x] **캠핏(Camfit) 알림톡 자동 연동 및 실시간 모니터링 시스템 구축**: 캠핏 예약 신청(PENDING), 확정(CONFIRMED), 취소(CANCELLED) 알림톡 수신 시 DB에 자동 연동하는 웹훅 API 구축 완료. 카톡 메시지의 줄바꿈(`\n`)이 JSON 파싱에서 SyntaxError(400)를 일으키는 현상을 `req.text()` 하이브리드 바디 수신 방식으로 완벽하게 우회하여 해결.
* [x] **3단계 유연한 사이트명 정규화 매칭 도입**: DB의 `'에어컨 4번'`과 캠핏의 `'에어컨 4'` 등의 명칭 불일치를 해결하는 3단계(완전 일치 ➔ 접미사 보정 ➔ 상호 포함) 비교 알고리즘 도입. 외래키 제약을 통과하기 위해 유효 프로필 ID를 동적으로 할당하는 안전망 구축.
* [x] **통합 캘린더 내 실시간 "캠핏 연동 모니터" 및 경고 배지 추가**: 캘린더 우측 상단에 실패 로그 개수를 실시간 감지하는 빨간색 경고 배지 연동. 클릭 시 최근 50건의 연동 성공/실패 로그 타임라인과 실패 원인을 한눈에 확인하고 원본 카톡 문자를 아코디언 형태로 바로 확인 가능한 관제 모달 탑재 완료.

### [2026-07-17 Update]
* [x] **히어로 타이포그래피 및 비주얼 여백 정교화**: 긴 인삿말과 타이틀 간의 여백(`mb-4`, `mb-5`)을 늘려 세로 겹침 현상을 해소하고 모바일 가독성을 최적화함.
* [x] **"다른 여행 일정추가" 알림 팝업 및 오늘 하루 안보기 기능 도입**: 서브 설명을 삭제하여 1줄짜리 정돈된 버튼으로 단순화. 팝업 창에 `오늘 하루 보지 않기` 체크박스를 연동하여 `localStorage` 타임스탬프 기준으로 24시간 동안 팝업 없이 직접 진입하는 UX 구현 완료.
* [x] **바텀 시트 타이틀 텍스트 통일**: 새로운 일정 등록 시트의 명칭을 기존의 제한적인 `'새 캠핑 일정'`에서 범용적인 `'새로운 여행 등록'`으로 일괄 교체 완료.
* [x] **구글 플레이스토어 검증용 도메인 소유권 승인 완료**: `layout.tsx` 내 metadata에 구글 서치 콘솔 인증용 검증 키를 추가 주입하고 빌드를 완료하여 플레이스토어 심사 통과를 보장함.

### [2026-07-18 Update]
* [x] **Vercel 빌드 무결성 복구 및 홈 화면 X안 적용**: `route.ts` Supabase 쿠키 옵션 널 가드 스프레드 적용으로 빌드 차단 해결. 초보자 홈 화면 뒷배경 백색화(`bg-white`) 및 카드 3종 최종 X안("Fresh Sage & Sweet Warmth" - 세이지 그린, 선샤인 앰버, 살구 코랄) 비주얼 완성.
* [x] **홈 화면 히어로 여백 반감 및 적정 수준 복원**: 인삿말 윗부분 여백(배너 세로 높이)을 최상단 공지/알림 바 공간을 확보하기 위해 42vh / 380px 수준으로 보완 및 복원 완료. 라온아이 텍스트 하단 마진을 `mb-8`로 절반 축소하여 시각적 가독성 개선.
* [x] **ESLint explicit-any 타입 린트 에러 해결**: `BeginnerHome.tsx` 내 명시적 `as any` 구문 4개를 `as unknown` 캐스팅 기법으로 대체 수정하여 빌드를 중단시키는 크리티컬 린트 에러를 완전히 0개로 소멸시켰습니다.
* [x] **FCM 푸시알림 기상청 중기 날씨 버그 해결**: Supabase Edge Function `camping-reminder` 내의 중기 날씨 API 호출 시 서비스키 인코딩(`encodeURIComponent`) 문제를 제거하여 디코딩 키 원본 전달로 교체, 기상청 `NO_DATA` 갱신 오류 완벽 해결.
* [x] **축제 일정 오버랩 날짜 필터링 도입**: 반경 30km 내 거리 필터 외에, 실제 여행 기간과 축제 개최 기간이 겹치는지 판단하는 일정 오버랩 필터 식 `!(e.endDate < startStr || e.startDate > endStr)` 구현 및 적용 완료.
* [x] **Supabase 배포 및 Secrets 적용**: 수정한 Edge Function `camping-reminder`를 Supabase에 Deployed 완료 및 Secrets 환경변수(`KMA_SERVICE_KEY`, `TOUR_API_KEY`) 주입 완료.

### [2026-07-20 Update]
* [x] **스마트플랜 여행개요 2세대 감성 서사 엔진 구축**: 날씨/습도/풍속 코멘트가 각각 독립적으로 나열되어 기상 보고서처럼 보이던 1세대 레고 블록식 구조를 파괴하고, 감성 접속사(Bridge Phrase)를 통해 하나의 흐름으로 조립하는 2세대 엔진을 구현했습니다.
* [x] **252개 전체 날씨 서사 문구풀 수필형 리라이팅**: `smartPlanPhrases.ts` 내의 전체 날씨 서사 문구에 최저/최고 기온, 강수확률, 습도, 풍속의 5대 기상 지표를 서정적으로 완전히 용해하고, 종결어미를 격식체, 해요체, 감탄/청유체로 3등분(각 6개씩) 다양화하여 문맥의 리듬감을 대폭 개선했습니다.
* [x] **실시간 습도(REH) 기상 데이터 파이프라인 복구**: 단기예보 파싱 로직(`route.ts`) 및 `smartPlan.ts`의 타임라인 루프 내에 누락되어 있던 습도(`REH`) 데이터의 파이프라인을 복구하여, 생성 시 실시간 기상청 예보 습도가 정확히 연동되도록 보완했습니다.
* [x] **캠핏 웹훅 미입금 자동 취소 연동 완결**: 캠핏에서 결제대기 후 미입금으로 인한 자동 취소 알림톡 수신 시, 우리 어플에서도 입금대기 상태이던 예약이 자동으로 취소 상태로 연동 처리되도록 보완을 완료했습니다.

### [2026-07-21 Update]
* [x] **일일 지역 동기화(경기도) 안심식당 기존/최종 데이터 0건 노출 오류 해결**: 대량 테이블에서 `count: 'exact'` 호출 시 Supabase PostgREST 타임아웃(HTTP 500)으로 집계가 0으로 오염되던 현상을 페이지네이션 기반 고속 정확 카운트(`.select('id').range()`) 방식으로 전면 개편하여 완결 및 검증 성공.
* [x] **TWA (Trusted Web Activity) 플레이스토어 정식 출시 심사 신청 완료**: 20명 테스터/14일 연속 대기 조항이 면제되는 조직/법인 계정의 이점을 활용해 프로덕션(정식 출시) 트랙으로 직행 성공. 스토어 규격 불일치 그래픽 배너(`feature_graphic.png`)를 1024x500px로 중앙 크롭 정합하고, 광고 ID 및 네임서버 미전파 도메인 임시 Vercel 도메인 우회 연동 적용 후 최종 제출 완료.

### [2026-07-22 Update]
* [x] **스마트플랜 카카오내비 딥링크 공식 엔드포인트 전면 개편 및 연동 해결**: 카카오 모빌리티 보안 정책으로 외부 웹/TWA 환경에서 차단되던 원시 `kakaonavi://` 스키마 대신 공식 딥링크(`https://map.kakao.com/link/to/`)로 전환하여 *"인증 실패 / 필수 파라미터 누락"* 에러를 영구 해제함.
* [x] **구글 플레이스토어 진짜 앱 서명 키 해시 동기화**: 로컬 키스토어 파싱을 통해 실기기 배포용 앱 서명 SHA-1 지문(`0E:9C:65:ED...`)을 확보하고, 카카오 28자리 키 해시 `Dpxl7f/dS0PcNG3w/Nw55ToGY10=` 로 변환하여 카카오 디벨로퍼스 Android 플랫폼 다중 등록을 완성함.
* [x] **장소 상세설명 휴무일 텍스트 오염 정제 Engine 탑재**: `cleanClosedDays` 정규식 정제 함수를 신설하여 상세설명에 적재되어 있던 과거 특정 일자(`6월 22일` 등)를 소멸시키고 범용 요일/주기만 안전 노출되도록 보완함.

### [2026-07-23 Update]
* [x] **홈 화면 일정 위젯 UX 보완 & 뒤로가기 0.0001초 캐시 복원 완결**: 일정이 0개인 유저에게 "다른 여행 일정추가" 버튼과 안내 팝업을 노출하고, 첫 진입/새로고침 시 스켈레톤 화면 정상 노출을 보원함.
* [x] **상세페이지 뒤로가기 복귀 시 0.0001초 즉시 카드가 짠! 노출**: `user_schedules_cache` 및 `reservation-storage-v2` 동기 캐시 구조를 바탕으로 스켈레톤 및 일정등록 카드로의 추락 2개를 100% 원천 차단함.
* [x] **'나의 여행일정' 카드의 세션스토리지 플래그 안전 보장**: `/myspace/schedule` 및 하위 상세 경로 진입/복귀 시 세션 플래그가 유실되지 않고 3개 카드 아코디언이 펼쳐진 상태로 안전 복귀함.
* [x] **인앱 브라우저 Storage 차단 & Null 참조 크래시 100% 원천 방어**: 전역 `sessionStorage` try-catch 안전 래핑 및 `upcomingItem` null-safe 가드를 연동하여 클라이언트 예외(Application Error)를 소멸함.

### [2026-08-16~17 Update - Data Moat & Synchronization]
* [x] **장소 시계열 이력(`place_history`) 테이블 & AFTER UPDATE 트리거 구축 (Phase 1 완료)**: `master_places` 테이블의 상태 변경(`DEACTIVATED`, `REACTIVATED`, `STRIKE`)을 자동 감지하여 영구 적재하는 PL/pgSQL 트리거 및 시계열 테이블을 구축하여 라온아이 고유의 데이터 해자(Data Moat)를 완성했습니다.
* [x] **축제(FESTIVAL) 데이터 정규화 및 연간 반복 개최 이력 체계화 (Phase 2 완료)**: 421건 축제명에서 연도 정규식 자동 제거, 384개 고유 축제 정규화 및 `years_held` 연간 개최 이력 누적 저장, 중복 37건 소프트 비활성화 보존을 완료했습니다.
* [x] **스마트플랜 폐업 조기경보 감점 (-50점) 장착 (Phase 3 완료)**: `miss_count >= 2`인 2스트라이크 폐업 위험 장소에 `-50점` 감점을 부여하여 폐업 식당/마트 추천을 원천 차단했습니다.
* [x] **전남광주통합특별시 신규 행정명칭 및 일일 로테이션 수집 엔진 100% 완치**:
  * 행안부 LocalData 신규 통합 기관코드 `6130000_ALL` 연동 및 직접/프록시 2중 다운로드로 모범식당(5,550건), 대형마트(168건), 기타식품마트(817건) 대량 수신 성공.
  * 농식품부 안심식당 `전남광주통합특별시` 매핑으로 5,530건 정상 수신.
  * 한국관광공사 명소 836건 확장(총계 2,267건) 및 KTO 공식 순위(3,051건) 갱신.
  * NMC 응급의료기관 병원 약칭('광주', '전남') 전달로 병원 56건 정상 수신.
  * TMAP/KT 모빌리티 인기도 `areaCd` 단일 분기 매핑으로 KT 집중률 23,016건 갱신.
  * 사전/사후 카운트 쿼리 `.in('sido', aliases)` 적용으로 기존 14,919건 장소 정상 집계 완료.




