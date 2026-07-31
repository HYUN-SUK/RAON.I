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
  1. `src/app/(mobile)/myspace/schedule/page.tsx`: 날것의 `window.history.replaceState` 구문 완전 제거 ➔ Next.js 공식 `router.replace('/myspace/schedule', { scroll: false })`로 교체하여 히스토리 무결성 확보.
  2. `src/components/schedule/ScheduleHomeWidget.tsx`: `isComponentMounted.current` 가드를 3개 카드 클릭 핸들러 전체에 엄격히 이식하여 지연 라우팅(Late Push) 100% 무효화.
  3. `src/app/(mobile)/myspace/schedule/[id]/page.tsx`: 헤더 뒤로가기 fallback 주소를 `/`에서 `/myspace/schedule`로 보정하고 마운트 시 조기 홈 탈출 구문 완치.
- **검증 결과**:
  - `npx tsc --noEmit` 검사 오류 0건 전수 통과.
  - 아코디언 3개 카드 진입 시 무소음 튕김 현상 뿌리뽑기 완료.
