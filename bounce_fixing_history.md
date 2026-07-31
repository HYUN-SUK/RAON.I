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

> **[상태]**: 최상위 라우팅 가로채기 센서(Navigation Interceptor) 가동 준비 완료.
> 아래 양식으로 3개 카드(`다가오는 일정`, `다른 여행일정 추가`, `나의 여행일정`) 상세화면 진입 시 발생하는 silent bounce를 포착 및 기록합니다.

```markdown
### 🚨 [YYYY-MM-DD HH:mm:ss] 라우팅 튕김 포착 일지
- **대상 화면**: (예: /myspace/schedule/123)
- **포착된 Call Stack**: (예: useRequireAuth.ts:45 -> router.replace('/'))
- **원인 분석**: 
- **조치 내용**: 
- **검증 결과**: 
```
