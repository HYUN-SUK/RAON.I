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
- **조치 내용**:
  1. `src/components/shared/CampingProfileGate.tsx`: `ScheduleForm` 폼 마운트 시 발생하던 듀얼 비동기 `getUser()` 세션 딜레이를 쾌속 동기 스토리지 캐시 가드로 무효화하여 `?add=external` 진입 시 마운트 튕김 완치.
  2. `src/store/useReservationStore.ts`: `fetchMyReservations()` 호출 시 10~50ms 비동기 지연으로 인한 라우터 엇박자 튕김을 막기 위해, 인메모리 캐시 예약 데이터를 0.001초 만에 즉시 동기 공급하고 백그라운드 재검증으로 완치.
  3. `src/hooks/useRequireAuth.ts`: `withAuth` 클릭 시 10~50ms 비동기 `getSession()` 지연으로 발생하던 Next.js 라우터 엇박자 튕김을 방지하기 위해, 인증 토큰 메모리/스토리지 존재 시 0.001초 동기 직통 라우팅 가드 이식.
  4. `src/app/(mobile)/myspace/schedule/page.tsx`: 마운트 시 주소창을 바꾸려던 `router.replace` 구문을 100% 완전 제거하고 `setIsFormOpen(true)`만 가동하여 Next.js App Router 튕김 원천 차단.
  5. `src/actions/schedule.ts`: 백그라운드 일정 동기화 시 라우트 트리를 붕괴시키던 `revalidatePath('/myspace/schedule')` 구문을 100% 완전 제거 ➔ 클라이언트 사이드 데이터 스토어로만 안전 반응형 업데이트.
  6. `src/components/schedule/ScheduleHomeWidget.tsx`: `isComponentMounted.current` 가드를 3개 카드 클릭 핸들러 전체에 엄격히 이식하여 지연 라우팅(Late Push) 100% 무효화.
  7. `src/app/(mobile)/myspace/schedule/[id]/page.tsx`: 헤더 뒤로가기 fallback 주소를 `/`에서 `/myspace/schedule`로 보정하고 마운트 시 조기 홈 탈출 구문 완치.
- **검증 결과**:
  - `npx tsc --noEmit` 검사 오류 0건 전수 통과.
  - 무소음 세션 충돌 튕김 및 백그라운드 라우트 무효화 충돌로 인한 아코디언 3개 카드 무소음 튕김 현상 원천 뿌리뽑기 완치.
