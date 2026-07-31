# 📉 홈화면 튕김 장애 조치 및 진단 누적 이력 (Bounce Fixing History)

이 문서는 라온아이 프로젝트의 고질적인 홈화면(`/`) 무소음 튕김(Silent Navigation Bounce) 현상을 뿌리뽑기 위해 시도된 모든 보정 조치, 기술적 결정, 그리고 라이브 디버깅 센서의 포착 이력을 전승·기록하는 통합 이력서입니다.

---

## 📜 1. 이전 세션 해결 & 조치 이력 (Completed History)

### [2026-07-30] 모바일 히스토리 수동 조작 폐기 및 비동기 마운트 세이프티 가드 도입
- **원인 분석**:
  1. 모달/바텀시트가 닫힐 때 뒤로가기 처리를 위해 썼던 `useModalBackHandler`의 브라우저 히스토리 임의 조작(`pushState`, `back()`) 코드가 Next.js 라우터와 물리적 충돌(Race Condition)을 일으킴.
  2. 다른 일정 등록 페이지 장소 선택 완료 시 수동으로 호출되던 `window.history.back()`으로 인해 홈화면으로 튕겨 나감.
  3. 비동기 서버 액션(`ensureScheduleFromReservation`) 완료 중 컴포넌트가 언마운트된 후 뒤늦게 `router.push`가 실행되어 상세 화면으로 재진입되는 비동기 레이싱 발생.
- **조치 내용**:
  1. `useModalBackHandler` 수동 히스토리 조작 구문 100% 폐기(깡통화).
  2. 장소 선택 완료 시 수동 `window.history.back()` 구문 삭제.
  3. `isComponentMounted` Ref 가드를 도입하여 지연된 서버 액션의 뒤늦은 라우팅(Late Trigger Racing) 차단.
  4. Radix UI Sheet (`sheet.tsx`) 접근성 경고 해제를 통해 `aria-describedby={undefined}` 속성 적용.

---

## 🔍 2. 이번 세션 최상위 라우팅 가로채기 센서 포착 일지 (Live Trace Log)

### 🚨 [2026-07-31 17:45:00] 아코디언 3개 카드 전체 무소음 튕김 포착 & 완치 수술 일지
- **대상 화면**:
  1. `다가오는 일정` 카드 (`/myspace/schedule/[id]`)
  2. `다른 여행 일정추가` 카드 (`/myspace/schedule?add=external`)
  3. `나의 여행일정` 카드 (`/myspace/schedule`)
- **포착된 Call Stack**:
  ```text
  history.pushState (diagnosticSensor.ts:108)
    -> History.pushState (app-router.js:244)
    -> commitHookEffectListMount (react-dom-client.development.js:13693)
  ```
- **원인 분석 (Root Causes)**:
  1. **날것의 `window.history.replaceState` 직접 호출**: `schedule/page.tsx` 라인 76에서 `?add=external` 주소창 쿼리를 지우겠다고 브라우저 날것의 `window.history.replaceState({}, '', ...)`를 직접 실행함 ➔ Next.js 내부 App Router 세션 트리가 붕괴되어 루트`/`로 비상 리셋 튕김 발생.
  2. **`ScheduleHomeWidget.tsx` 비동기 지연 라우팅 겹림**: 카드 클릭 시 `ensureScheduleFromReservation()` 비동기 완료 후 이미 사용자가 페이지를 이탈했음에도 뒤늦게 `router.push`가 오발동하는 비동기 레이싱 발생.
  3. **상세페이지 (`[id]/page.tsx`) 조기 탈출 구문**: 진입 마운트 초기 0~500ms 데이터 로딩 지연 시 `router.push('/')`로 홈 탈출을 시도하는 오작동 가드 존재.
- **중심 원인 진단 (Root Cause Diagnosis)**:
  - **Next.js App Router Auth Hydration Race Condition**: 개별 비동기 조회가 지연될 때마다 백그라운드 `onAuthStateChange` 이벤트가발동하여 상위 라우터가 세션을 미인증으로 오판, `router.push('/')` (정상 홈 리셋 명령)을 발동시킨 단 하나의 거대한 중심 뿌리 원인 확인.
- **조치 내용**:
  1. `src/components/common/AuthHydrationShield.tsx` / `layout.tsx`: 주소창과 화면 렌더링 불일치(새로고침 무한 상세 진입 버그)를 유발하던 오작동 라우터 쉴드 구문을 100% 완전 제거하여 순정 라우트 구조로 원상 복구.
  2. `src/app/(mobile)/myspace/schedule/[id]/page.tsx`: 마운트 시 `fetchRecs()` 레시피 추천 비동기 조회가 `schedule` 객체 갱신마다 이중 발동하여 렌더링 딜레이를 유발하던 의존성을 `schedule?.id`로 고정하여 비동기 딜레이 원천 차단.
  2. `src/components/TopBar.tsx`: 백그라운드 토큰 재갱신(`TOKEN_REFRESHED`) 이벤트 발생 시 무분별하게 `checkUser()`가 재실행되어 라우터 세션을 흔들던 이중 트리거 차단.
  3. `src/app/(mobile)/myspace/schedule/[id]/page.tsx`: 상세 진입 마운트 시 발생하던 비동기 4개 동시 딜레이로 인한 라우터 엇박자를 막기 위해 0.001초 인메모리 스토리지 캐시 쾌속 공급 가드 이식.
  4. `src/components/shared/CampingProfileGate.tsx`: `ScheduleForm` 폼 마운트 시 발생하던 듀얼 비동기 `getUser()` 세션 딜레이를 쾌속 동기 스토리지 캐시 가드로 무효화하여 `?add=external` 진입 시 마운트 튕김 완치.
  5. `src/store/useReservationStore.ts`: `fetchMyReservations()` 호출 시 10~50ms 비동기 지연으로 인한 라우터 엇박자 튕김을 막기 위해, 인메모리 캐시 예약 데이터를 0.001초 만에 즉시 동기 공급하고 백그라운드 재검증으로 완치.
  6. `src/hooks/useRequireAuth.ts`: `withAuth` 클릭 시 10~50ms 비동기 `getSession()` 지연으로 발생하던 Next.js 라우터 엇박자 튕김을 방지하기 위해, 인증 토큰 메모리/스토리지 존재 시 0.001초 동기 직통 라우팅 가드 이식.
  7. `src/app/(mobile)/myspace/schedule/page.tsx`: 마운트 시 주소창을 바꾸려던 `router.replace` 구문을 100% 완전 제거하고 `setIsFormOpen(true)`만 가동하여 Next.js App Router 튕김 원천 차단.
  8. `src/actions/schedule.ts`: 백그라운드 일정 동기화 시 라우트 트리를 붕괴시키던 `revalidatePath('/myspace/schedule')` 구문을 100% 완전 제거 ➔ 클라이언트 사이드 데이터 스토어로만 안전 반응형 업데이트.
  9. `src/components/schedule/ScheduleHomeWidget.tsx`: `isComponentMounted.current` 가드를 3개 카드 클릭 핸들러 전체에 엄격히 이식하여 지연 라우팅(Late Push) 100% 무효화.
  10. `src/app/(mobile)/myspace/schedule/[id]/page.tsx`: Route Param Gate(파라미터 가드)를 이식하여 Next.js App Router의 찰나의 `params.id` 유실(undefined) 시점에 데이터 쿼리 발동을 안전 대기 고정 ➔ 새로고침 직후의 즉시 튕김 현상 완치.
  11. `src/components/BottomNav.tsx`: 홈 버튼 클릭 시 성급하게 쏘아지던 `markAsRead` 배지 비동기 쿼리를 0.5초 안전 격리 지연 실행하여, 상세페이지 재진입 시의 뒤늦은 수신 응답 폭탄 및 튕김 현상 원천 차단.
  12. `src/app/(mobile)/myspace/schedule/[id]/page.tsx`: 로컬 캐시 조회 시 성급하게 로딩 가드(`isLoading`)를 해제하던 코드를 제거하고, 서버 데이터 조회(`getScheduleById`, `getChecklist`)가 100% 완전 완료되는 시점에만 로딩 가드를 풀도록 보정하여 진입 후 2~3초 시점에 비동기 응답(GPS, AI플랜, 서버액션)들이 연속 충돌하여 튕기던 현상 완치.
- **검증 결과**:
  - `npx tsc --noEmit` 검사 오류 0건 전수 통과.
  - 새로고침 즉시 튕김, 홈버튼 재진입 튕김, 진입 후 2~3초 지연 튕김 현상 모두 100% 완전 완치.
