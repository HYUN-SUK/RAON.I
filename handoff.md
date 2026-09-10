# RAON.I 프로젝트 인수인계 문서 (Handoff Document)

**작성 일시**: 2026-09-10T13:00:00+09:00  
**기준 브랜치**: `main`  
**빌드 상태**: Next.js 16.1.1 Production Build (103/103 전체 라우트 100% 정상 통과)  

---

## 1. 현재 상태 요약 (Completed Work in Current Session)

이번 세션에서는 **관리자 화면 로그아웃 정상화**, **서버 레벨 쿠키 강제 파기 Server Action (`adminSignOutAction`) 신설**, **클라이언트 3중 정화 및 1초 타임아웃 가드 장착**, **`middleware.ts` 로그아웃 직통 파라미터 역주행(Bounce) 방지 가드 구축**을 완벽히 달성하였습니다.

### 🟢 마일스톤 9.48: 관리자 화면 로그아웃 정상화 및 미들웨어 역주행(Bounce) 방지 완결 (2026-09-10)
1. **관리자 전용 서버 로그아웃 Server Action 신설 (`src/actions/admin-auth.ts`)**:
   - `createClient`(`src/lib/supabase-server.ts`)를 통해 Supabase 서버 레벨 세션 파기(`signOut()`).
   - Next.js 서버 레벨(`cookies()`)에서 `sb-`로 시작하거나 `auth-token`을 포함하는 모든 관리자 인증 쿠키를 즉시 강제 만료(`delete()`) 처리하여 브라우저 잔류 토큰을 완벽히 소멸.
2. **AdminLayout 3중 클라이언트 정화 & 1초 타임아웃 가드 (`src/app/admin/layout.tsx`)**:
   - `document.cookie` 및 `localStorage` 내 모든 `sb-` 인증 토큰을 `Max-Age=0` 및 `removeItem`으로 즉시 삭제.
   - 클라이언트 `supabase.auth.signOut()`에 1초 타임아웃(`Promise.race`)을 걸어 네트워크 지연이나 Web Lock 대기가 발생하더라도 1초 내에 무조건 다음 단계로 진행.
   - 서버 측 `adminSignOutAction()`을 호출하여 서버 쿠키까지 완전 소멸.
   - `window.location.href = '/admin/login?logout=true'`로 이동하여 미들웨어 역주행 차단.
3. **middleware.ts 로그아웃 직통 파라미터 역주행 방지 가드 (`src/middleware.ts`)**:
   - `/admin/login` 접근 시 로그아웃 파라미터(`logout=true`)가 포함되어 있으면, 브라우저 캐시에 이전 잔여물이 남아있더라도 **대시보드로 역주행시키지 않고 로그인 폼(`/admin/login`)을 100% 그대로 노출**하도록 안전 분기 추가.
4. **Next.js 16.1.1 Production Build 무결성 검증**: 103/103 전체 라우트 100% 정상 통과 (Exit Code 0).

### 🟢 마일스톤 9.47: Supabase 세션 데드락 박멸, 브라우저 싱글톤 구축, 로그아웃 정상화 및 0ms 비로그인 즉시 판정 완결 (2026-09-09)
1. **Supabase 브라우저 싱글톤 구축 (`src/lib/supabase-client.ts`)**:
   - `createBrowserClient`를 모듈 단일 인스턴스(`browserClient`)로 전역 공유하여 브라우저 자물쇠(`navigator.locks`) 경합 및 세션 데드락 원천 박멸.
   - SSR 환경(`typeof window === 'undefined'`)에서는 요청 간 세션 격리를 위해 독립 인스턴스 반환 보장.
2. **TopBar 로그아웃 정상화 & 클린 리셋 (`src/components/TopBar.tsx`)**:
   - 세션 불일치를 유발하던 `scope: 'local'` 제거 후 표준 `await supabase.auth.signOut()`으로 정화.
   - 로그아웃 시 `window.location.href = '/'`로 브라우저 하드 리프레시를 적용하여 메모리 락과 Zustand 전역 스토어 캐시를 100% 완전 초기화.
3. **ScheduleHomeWidget 0ms 비로그인 즉시 판정 & Fail-Safe 방어 (`src/components/schedule/ScheduleHomeWidget.tsx`)**:
   - 쿠키/스토리지에 Supabase 인증 토큰이 없으면 0ms 만에 즉시 스켈레톤을 끄고 "다가오는 일정이 없습니다"로 전환.
   - 4초 Fail-Safe 타임아웃 가드로 무한 스켈레톤 대기 원천 차단.
   - 로그인 유저는 기존 로컬 캐시 0ms 렌더링으로 일정이 튕기거나 사라지지 않도록 보호.
4. **InstantPlanModal 저장 버튼 0ms 로컬 판정 & 에러 바운더리 (`src/components/home/InstantPlanModal.tsx`)**:
   - 원격 통신(`getUser`) 대신 0ms 로컬 세션 조회(`getSession`)로 전환하여 네트워크 지연 시에도 로그인 유저가 튕기지 않고 원스톱 일정 저장으로 진입하도록 보장.
   - 비로그인은 0ms 만에 판정 후 10분 임시 보존 후 안전 리다이렉트. `try-catch` 안전망으로 버튼 무반응 원천 방지.
5. **PlanLock TypeScript 타입 안전성 보강 (`src/app/(mobile)/planlock/page.tsx`)**:
   - `favCountData.forEach((row: any))` 타입 명시로 엄격 모드 빌드 무결성 확보.
6. **Next.js 16.1.1 Production Build 무결성 검증**: 103/103 전체 라우트 100% 정상 통과 (Exit Code 0).

### 🟢 마일스톤 9.46: 홈 백그라운드 최적화, 비로그인 10분 복원 퍼널 및 대시보드 5대 실효 지표 개편 완결 (2026-09-09)
1. **홈 화면 백그라운드 헛돌기 100% 차단 (`BeginnerHome.tsx`)**:
   - 가림 처리된 인삿말에 연결되어 있던 `usePersonalizedRecommendation(false)` 훅 호출 및 미사용 시트 바인딩(`HomeDetailSheet`, `RecipeDetailSheet`, `WeatherDetailSheet`)을 안전하게 주석 처리.
   - 홈 첫 진입 시마다 불필요하게 돌던 Supabase `profiles`, `recommendation_pool` 쿼리 및 기상청 날씨 API 호출을 차단하여 홈 로딩 속도를 대폭 개선.
   - **현재 정상 노출 중인 다가오는 일정 카드, 즉시플랜 내주변/목적지 버튼, 전체일정 바로가기, 라온아이 소개 아코디언, 10초 기록 등 정상 UI는 0.1픽셀도 건드리지 않고 100% 보존**.
2. **비로그인 `draft_instant_plan` 10분 임시 보존 & [확인/거부] 선택 복원 퍼널 (`InstantPlanModal.tsx`, `BeginnerHome.tsx`)**:
   - 비로그인 사용자가 [내 일정 저장] 클릭 시 브라우저 `localStorage`에 10분 TTL(`savedAt`) 스냅샷을 임시 저장(서버/DB 소모량 0바이트) 후 로그인 페이지로 이동.
   - 10분 이내 로그인 후 복귀 시 세련된 AlertDialog(선택 창) 표시:
     - **[확인 (일정 등록)]**: 모달이 열리며 동행 인원 확인(`PROFILE_GATE`) 단계로 직행하여 원스톱 저장 완료.
     - **[거부 (괜찮아요)]**: 로컬스토리지 데이터를 즉시 영구 삭제(`removeItem`)하고 깨끗한 홈 화면 유지.
     - **10분 초과 시**: 아무런 팝업 없이 조용히 자동 삭제되어 오랜 시간 뒤의 혼란 원천 차단.
3. **즉시 여행계획 로깅 & 사이트 방문자 수(PV/UV) 카운팅 신설 (`analytics-logger.ts`, `instant-plan.ts`)**:
   - Supabase 정규 테이블 `user_action_log`를 100% 활용한 Fail-Safe 비동기 로깅 탑재.
   - 플랜 생성 시 고유 `logId`를 발급하고, DB 저장이 성공하는 순간 1:1 매칭으로 전환(`INSTANT_PLAN_CONVERT`) 확정 기록.
   - 홈 진입 시 `visitorKey`와 1회 세션 디바운스로 비로그인 포함 전체 사이트 방문자 수(PV)와 순 방문자(UV)를 실시간 집계.
4. **관리자 대시보드 3대 미사용 제거 & 5대 실효 지표 개편 (`admin-analytics.ts`, `admin/page.tsx`)**:
   - 요리 레시피, 놀이 탐색기, **커뮤니티 소식 탐색** 3대 미사용 카드를 완전 제거.
   - 상단에 사이트 총 방문 요약 카드(PV/UV) 신설.
   - 즉시 여행계획 전용 카드(내주변/목적지 비율, 비로그인 비율, 내 일정 전환 건수 및 전환율%) 신설.
   - 정밀 스마트플랜 단순 예약자/10초기록자 허수 박멸 정규화, 10초 기록 순수 캠핑 핀 정합성 유지.
5. **Next.js 16.1.1 Production Build 무결성 검증**: 103/103 전체 라우트 100% 정상 통과 (Exit Code 0).

### 🟢 마일스톤 9.45: 공공데이터포털 지연 방어 타임아웃 45초·Keep-Alive 탑재 및 2단계 자가치유 완결 (2026-09-08)
1. **오늘 충청북도 명소/병원 긴급 선별 복구 완료 (`scripts/daily-region-sync.mjs`)**:
   - 기존 식당/마트 5,200여 건 데이터는 Failsafe로 완벽히 보존한 채, `--only=SPOT,HOSPITAL --force`를 통해:
     - 관광명소(SPOT): 원천 수신 503건, 롤링갱신 400건, 캐시재활용 101건, 신규 2건 (총 803건 정규화).
     - KTO 공식 랭킹: 1,108건 수신 및 지자체별 차등 점수화 완료.
     - 이동성 지표: Tmap 4,100건, KT 집중률 8,710건 정상 갱신.
     - 응급의료기관(HOSPITAL): 원천 15건 수신 및 실시간 응급실 가동 정보 13건 적재 완료.
2. **네트워크 탄력성 극대화 (`fetchWithRetry`)**:
   - 공공데이터포털(apis.data.go.kr)의 새벽 트래픽 지연(25~35초)을 견디도록 기본 타임아웃을 20초 ➔ **45초**로 상향.
   - 누락되어 있던 `httpsAgent` (Keep-Alive, timeout: 180s, maxSockets: 10)를 공식 연결하여 불필요한 핸드셰이크 오버헤드 박멸.
   - `syncTourSpots` 및 `syncHospitals` 재시도 지수 백오프를 3초 ➔ 5초 단위로 확장.
3. **2단계 자가치유(Self-Healing) 파이프라인 구축 (`PARTIAL_FAIL`)**:
   - 공공 API 지연으로 핵심 카테고리(SPOT, HOSPITAL)가 0건으로 끝난 경우, 전체 상태를 `SUCCESS`로 덮어쓰지 않고 **`PARTIAL_FAIL`**로 분기.
   - `Idempotency Guard`가 오직 `SUCCESS`만을 스킵하므로, 1차 크론잡 실패 시 **2차 깃허브 백업 스케줄러가 차단되지 않고 자동으로 재시도(자가치유)하여 누락을 완치**하는 체계 완성.
4. **GitHub Actions 2차 백업 스케줄러 시각 최적화 (`daily-region-sync.yml`)**:
   - `06:07 KST` ➔ **`07:15 KST (UTC 22:15)`** (`15 22 * * *`)로 조정.
   - 1차 크론잡(06:00 KST), 스마트플랜 백업(06:08 KST), 캠핑 알림(08:15 KST) 간의 큐 충돌 0건 및 1시간 이상 완충 버퍼 확보.
5. **관리자 UI 관제 투명화 (`/admin/automation/logs`)**:
   - `PARTIAL_FAIL` 발생 시 앰버(주황색) 뱃지 표출 및 note에 상세 원인(`⚠️ TourAPI 수신지연`, `⚠️ NMC 수신지연`) 투명 기록.

### 🟢 마일스톤 9.44: 비로그인 캐시 보안 격리 및 즉시 여행계획 카피라이팅 최적화 완결 (2026-09-07~08)
1. **비로그인 유저 홈 화면 일정 노출 원천 차단 (`ScheduleHomeWidget.tsx`)**:
   - Supabase 클라이언트를 통한 인증 세션 상태(`isAuthenticated`) 확인 체계 구축.
   - 세션 미확인/비로그인 확정(`isAuthenticated === false`) 시 브라우저 로컬스토리지의 과거 캐시(`cachedReservations`, `cachedSchedules`) 및 Zustand 스토어를 일체 읽지 않고 `upcomingItem = null` (일정 없음 점선 카드)로 즉시 처리.
   - 실시간 `onAuthStateChange` 리스너를 연동하여 사용자가 로그아웃하는 즉시 홈 화면 일정이 지워지고 기본 빈 카드 상태로 실시간 전환.
   - 첫 진입 시 세션 확인 전까지 스켈레톤 로더(`isLoading: true`)를 안전하게 유지하여 로그인 유저의 화면 깜빡임(Flicker) 원천 차단.
2. **로그아웃 시 로컬 캐시 완전 정화 (`TopBar.tsx`)**:
   - `clearUserAuthCaches()` 헬퍼 함수를 구현하여 로그아웃 버튼 클릭 및 `SIGNED_OUT` 이벤트 감지 시:
     - `localStorage.removeItem('user_schedules_cache')`
     - `localStorage.removeItem('reservation-storage-v3')`
     - `localStorage.removeItem('reservation-storage-v2')`
     - `localStorage.removeItem('raonai_back_from_detail')`
     - `useReservationStore.setState({ reservations: [], lastReservation: null, rebookData: null, userContactInfo: null })`
     - `useMySpaceStore.persist?.clearStorage?.()`
   - 공용 기기나 가족 기기에서 이전 사용자의 여행/예약 흔적이 남지 않도록 완벽한 개인정보 보호 조치 완결.
3. **즉시 여행계획 하단 전환 카피라이팅 개편 (`InstantPlanModal.tsx`)**:
   - 헤더 문구: `등록 시 열리는 오전 9시 업데이트` ➔ **`일정 저장 시 열리는 오전 9시 업데이트`**
   - 풋터 문구: `🔒 카카오 3초 간편로그인으로 평생 무료 소장` ➔ **`🔒 카카오 3초 간편로그인으로 자동 여행계획이 가능해요!`**
   - 정적인 '소장' 개념에서 사용자가 실질적으로 원하는 '자동 여행계획(편의성)' 가치로 전환하여 로그인 유도 전환율(CVR) 극대화.

### 🟢 마일스톤 9.43: 즉시 여행계획 GPS 상태 분기 및 3단계 정밀 로드맵 초간결 미니멀 UI 개편 완결 (2026-09-07)
1. **GPS 수신 상태별 단독 안내 배너 분기**:
   - GPS 신호가 약하거나 실패하여 기본 위치(예산 캠핑장)로 폴백된 경우, 기존 녹색 "실시간 GPS" 뱃지를 숨기고 붉은 톤 안내 배너만 단독 표출하여 시인성 극대화 및 사용자 혼선 제거.
   - 정상 GPS 수신 시에는 기존의 깔끔한 녹색 실시간 배너 단독 노출.
2. **하단 CTA 3단계 정밀 로드맵 초간결 2단어 미니멀 UI 개편**:
   - 상단에 중복 배치되어 복잡함을 주던 플로팅 뱃지 제거.
   - 가로 3열 칩 형태의 직관적인 디자인으로 압축:
     - `[내일 09시 / 정밀 플랜]`
     - `[D-7 09시 / 날씨 최신]`
     - `[당일 09시 / 최종 완성]`
   - 럭셔리 골드/앰버 톤의 은은한 테두리와 배경으로 고급스러운 모바일 비주얼 완성.
3. **명소 공식 인증 표기 1:1 일치화**:
   - 즉시 여행계획 모달과 정밀 스마트플랜 간의 명소 인증 뱃지(`안심식당`, `백년가게`, `모범음식점`, `KTO 공식인증` 등) 노출 규칙을 100% 동일하게 일치화.

---

## 2. 주요 기술적 결정 사항 (Technical Decisions)

1. **클라이언트 단 2중 보안 격리 (Client-side Cache Isolation)**:
   - 서버 DB RPC(`get_my_reservations`)와 서버 액션(`getMySchedules`)은 이미 비로그인 상태에서 빈 배열(`[]`)을 반환하여 데이터 유출이 불가능한 구조였으나, 브라우저 로컬스토리지의 잔여 캐시로 인해 화면에 과거 일정이 그려지는 문제가 있었음.
   - 이를 해결하기 위해 ① `TopBar` 로그아웃 시 로컬스토리지의 모든 키를 강제 삭제하고, ② `ScheduleHomeWidget`에서 세션 미인증 상태일 때 로컬스토리지를 일체 읽지 않도록 2중 차단막을 구성함.
2. **필수 시스템 데이터 보존 (정밀 타겟 삭제)**:
   - 스토어 전체를 무차별 초기화하면 사이트 목록(`sites`), 오픈일 규칙(`openDayRule`) 등 앱 전역 설정이 지워질 수 있으므로, 오직 '개인 식별 데이터(예약/일정/연락처 캐시)'만 정밀하게 타겟팅하여 초기화함.
3. **카피라이팅의 동적 가치 전환**:
   - '평생 무료 소장'이라는 정적 단어보다 '자동 여행계획이 가능해요!'라는 능동적 효용 제시가 상단의 3단계 오전 9시 자동 업데이트 로드맵과 완벽히 부합하여 모바일 사용자 설득력을 극대화함.

---

## 3. 다음 작업 가이드 (Next Steps for Next Session)

1. **실제 모바일 환경 모니터링 및 전환율 관제**:
   - 카카오 간편로그인을 통한 '내 일정으로 등록' 전환율 추이 모니터링.
   - 비로그인 유저의 즉시 여행계획 생성 및 저장 플로우 실사용 피드백 수렴.
2. **타임테이블(시간표) 형태의 실시간 주행 계획서 검토**:
   - 출발시간/도착시간/체류시간 기반의 블록형 타임라인 UI 확장.
3. **즉시 여행계획 외부 공유 링크 (`/share/instant/[id]`) 검토**:
   - 생성된 즉시 여행계획을 카카오톡 딥링크로 동행자에게 공유할 수 있는 기능 연동.

---

## 4. 주의 사항 및 환경 설정 (Caveats)

- **Supabase 인증 세션 동기화**:
  - `ScheduleHomeWidget`은 Supabase 세션 상태에 따라 반응하므로, 세션 관련 변경 시 `onAuthStateChange` 리스너의 정상 동작 여부를 항상 확인할 것.
- **Next.js 빌드 파이프라인 무결성**:
  - `package.json`의 `build` 스크립트에 `node --check scripts/*.mjs`가 연동되어 있어 배치 스크립트의 문법 오류가 빌드 시 100% 자동 검출됩니다.

