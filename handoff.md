# 🤝 Handoff Document (세션 인수인계서)

- **작성 일자**: 2026년 8월 13일
- **세션 상태**: 스마트플랜 4단계 UX 생명주기 및 새벽 캐싱 수집 필터 정상화 완료
- **다음 세션 목표**: **스마트플랜 UI/UX 통합 정리 및 버튼 중복 제거**

---

## 1. 📌 현재 상태 요약 (이번 세션 완수 내역)

### 1) 명소 추천 엔진 Option C (계층형 통합) 이식 및 검증
- [`src/lib/smartPlan.ts`](file:///c:/Users/user/Desktop/RAON.I/src/lib/smartPlan.ts) 내 스코어링 수식 이식 완료:
  - 랜드마크 키워드 하한선 보정(최소 80점)
  - TMap/KTO 실측 인기도 가점 (`base_pop * 0.5`, Cap 40점)
  - 화이트리스트 가점 (+40점)
  - 초근접 가점 (5km 이내 +20점)
  - 거리 감점 (-2.0점/km)
  - 동일 명칭 및 근접 중복 도려내기 필터링 적용 완료.
- 명소 추천 고도화 사양서 작성 완료 ([`SPOT_RECOMMENDATION_UPDATE_SPEC.md`](file:///c:/Users/user/Desktop/RAON.I/docs/SPOT_RECOMMENDATION_UPDATE_SPEC.md)).

### 2) 새벽 캐싱 스케줄러 (`scripts/caching-smart-plan.mjs`) 오판 스킵 교정
- 기존에는 `smart_plan_data` 필드가 조금이라도 채워져 있으면 무조건 스킵했으나, **맛보기 플랜 데이터(`is_preview: true`)인 경우는 스킵하지 않고 새벽 5시에 데이터 캐싱(`smart_plan_candidates`)을 100% 정상 수집**하도록 필터 정정.
- 오늘 새벽 캐싱이 누락되었던 `시그니엘 부산`, `서울스포렉스`, `강릉바다내음캠핑장`, `전주한옥스파` 등 누락 예약건들에 대해 후보 데이터(54건씩) 수동 강제 수집/적재 완수.

### 3) 4단계 동적 UX 생명주기 및 D-Day 뱃지 세분화
- **1단계**: 맛보기 전 ➔ `⚡ 바로 맛보기 계획 생성가능!, 터치해보세요!`
- **2단계**: 맛보기 렌더링 후 ➔ `⚡ 맛보기 계획 생성 완료`
- **3단계**: D+1 새벽 캐싱 완수 & 9시 이후 ➔ `✨ 정밀 스마트플랜 생성가능` *(새벽 4:50 등록건도 당일 9시 즉시 오픈!)*
- **4단계**: D-7 ~ D-0 출발 7일 전 / 당일 ➔ `🔄 정밀 스마트플랜 업데이트 가능`
- **5단계**: 사용자가 정밀 생성 완수 시 (`wrapped: true`) ➔ `✨ 스마트플랜 생성 완료`

### 4) 모바일 무단 경로탐색(RouteSelector) 직행 버그 해결 & 프로필 게이트 연동
- [`src/app/(mobile)/myspace/schedule/[id]/page.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/app/(mobile)/myspace/schedule/%5Bid%5D/page.tsx) 지점 B(`isPreviewMode === false`)에서 맛보기 데이터를 `initialPlan`에 넘기지 않고 `null` 처리하여 **모바일 단말기 진입 시 무단 경로탐색으로 튕기는 버그 100% 원천 차단**.
- **정순서 프로세스 보장**: `[✨ 정밀 스마트플랜 생성하기]` 버튼 클릭 ➔ `CampingProfileGate` (프로필 확인/수정 팝업) ➔ `RouteSelector` (카카오내비 경로 3개 선택) ➔ 정밀 플랜 완수.

---

## 2. 🎯 기술적 결정 사항 (Technical Decisions)

1. **`is_preview: true` 맛보기 태그의 명시적 DB 저장 강제화**:
   - 맛보기 0원 카드가 생성되는 즉시 DB `user_schedules.smart_plan_data`에 `is_preview: true`를 포함시켜 렌더링 및 스케줄러가 상태를 100% 단번에 식별하도록 구조화함.
2. **`isCached && isAfter9AM` 동적 오프닝 수식**:
   - 고정된 다음날(D+1) 날짜 셈을 제거하고, 새벽 5시 캐싱 스케줄러가 완료된 건(`isCached === true`)은 당일 오전 9시에 즉시 정밀 버튼이 오픈되도록 사용자 중심 수식 적용.
3. **상세페이지 라우트 404 방지 안전 2차 Fallback**:
   - [`src/actions/schedule.ts`](file:///c:/Users/user/Desktop/RAON.I/src/actions/schedule.ts)의 `getScheduleById`에 `scheduleId` 직통 Admin Fallback을 2차로 구성하여 세션 지연이나 비로그인 진입 시 404가 나는 문제 사전에 예방.

---

## 3. 🚀 다음 세션 우선 처리 작업 가이드 (Next Session Tasks)

### 🚨 [최우선 과제] 스마트플랜 UI/UX 통합 정리 및 버튼 중복 제거
- **현재 문제점 (사용자 제출 스크린샷 지적 사항)**:
  - `서울스포렉스`와 같이 당일(또는 D+1) 상황이 되었을 때, 상세 화면 한 페이지 안에:
    1) 상단 안내 배너 (`💡 오전 9시가 지나 정밀 스마트플랜 생성이 가능합니다!`)
    2) 메인 CTA 버튼 (`[✨ 정밀 스마트플랜 생성하기]`)
    3) 중간 맛보기 배너 & 버튼 (`⚡ 맛보기 여행가이드 가동 중 / [🔄 나만의 맞춤 여행계획 생성하기]`)
    4) 하단 당일 기상 배너 & 버튼 (`⚡ 드디어 캠핑 출발 당일! / [🔄 업데이트 받기]`)
  - **위처럼 3~4개의 안내 문구와 버튼이 동시에 무더기로 노출되어 화면이 매우 번잡하고 헷갈리는 문제 발생.**
- **다음 세션 해결 조치**:
  - 조건문 조율을 통해 **단 1개의 명확한 메인 CTA 버튼**과 **단 1개의 깔끔한 상태 안내 배너**만 화면에 노출되도록 UI/UX 통합 정리.
  - 사용자 관점에서 지저분하거나 중복되는 버튼/배너를 깔끔하게 다듬어 쾌적한 화면 제공.

---

## 4. ⚠️ 주의 사항 (Known Caveats & Notes)

- **Git Commit 상태**:
  - 최신 커밋 `0307bf5` (`fix(smart-plan): Ensure button exposure for preview schedules and enforce sequential profile-to-route flow`)까지 로컬 커밋이 완수되었습니다.
  - `git push`는 사용자가 직접 수행하므로 원하실 때 깃 푸시를 진행해 주세요.
- **무결성 검증 완료**:
  - `npx tsc --noEmit` : Code 0 (Error 0건)
  - `npm run build` : Code 0 (98/98 Routes Build Succeeded)
