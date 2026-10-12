# RAON.I 프로젝트 인수인계 문서 (Handoff Document)

**작성 일시**: 2026-10-12T09:32:00+09:00  
**기준 브랜치**: `main`  
**빌드 상태**: Next.js 16.1.1 (TypeScript 0에러, ESLint 통과, Production Build 100% 통과)  
**실서버 배포**: Vercel 프로덕션 자동 배포 연동 (`https://raon-i.co.kr`, 최신 커밋 `9628890`)  

---

## 1. 현재 상태 요약 (Current State & Completed Work)

### 🟢 마일스톤 9.93: 내비게이션 3사(카카오맵·카카오내비·T맵) 완벽 연결 및 즉시 여행계획 대체리스트/지도 찜(💖) 기능 전면 반영 완결 (2026-10-11 ~ 2026-10-12, 실기기 검증 완료)

1. **내비게이션 3사(카카오맵·카카오내비·T맵) 딥링크 및 스토어 폴백 완벽 정규화 (`8a8342d`, `42ff827`, `9628890`)**:
   - **대상 파일**: [`src/lib/nav-utils.ts`](file:///c:/Users/user/Desktop/RAON.I/src/lib/nav-utils.ts)
   - **카카오내비 (`getKakaoNaviUrl`)**:
     - Capacitor 안드로이드 WebView(`Bridge.java`)에서 외부 인텐트 변환이 누락되어 무반응이던 `intent://` 스킴과, 앱만 켜지고 홈 화면(`"어디로 갈까요?"`)에 멈추던 일반 `kakaonavi://navigate` 스킴의 한계를 규명.
     - 카카오 공식 JavaScript SDK(`kakao.js`) 내부의 `NAVI_SCHEME` 규격인 **`kakaonavi-sdk://navigate?appkey=...&apiver=1.0&extras=...&param=...`**(JSON 직렬화 `destination` `{ name, x, y }` 및 `option` `{ coord_type: 'wgs84', vehicle_type: 1, rpoption: 100, route_info: false }`)를 100% 일치시켜 목적지 길안내 직행 완치.
   - **T맵 (`getTMapUrl`)**:
     - 안드로이드 분기에서 `intent://` 강제 치환을 제거하고 순수 커스텀 스킴 `tmap://route?goalname=...&goalx=...&goaly=...`로 일원화하여 즉시 길안내 연결 완치.
   - **미설치 스토어 폴백 분리 및 `ERR_UNKNOWN_URL_SCHEME` 흰색 에러 방어 (`getWebFallbackUrl`, `openNavApp`)**:
     - 미설치 폴백이 모든 앱을 무조건 카카오맵 웹으로 보내던 하드코딩을 제거하고 앱별(카카오내비·T맵·네이버지도·카카오맵)로 분리.
     - 안드로이드 WebView에서 `https://play.google.com/...`을 `window.open`으로 열면 구글 서버가 `intent://play.google.com/...`으로 리다이렉트하며 `net::ERR_UNKNOWN_URL_SCHEME` 흰색 에러 화면을 띄우던 문제를 해결하기 위해, 안드로이드에서는 **`market://details?id=...`** 순수 마켓 스킴과 `window.location.href`를 사용하도록 수정.
     - 최초 실행 시 안드로이드 시스템의 '연결 프로그램(항상/한 번만)' 선택 팝업에서 사용자가 선택할 시간을 충분히 보장하도록 폴백 대기 시간을 `2500ms` ➔ `4000ms(4초)`로 연장 (`700ms` 상단 안내 토스트 노출 지연은 100% 보존).

2. **즉시 여행계획(`InstantPlanModal.tsx`) 대체리스트·지도 찜(💖) 기능 전면 반영 및 React Hook #310 차단 (`3d72b97`, `8a8342d`)**:
   - **대상 파일**: [`src/components/home/InstantPlanModal.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/home/InstantPlanModal.tsx), [`src/components/plan/SmartPlanProposal.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/plan/SmartPlanProposal.tsx)
   - **조치 내용**:
     - `InstantPlanModal` 최상단(조기 반환문 이전, 158~203행)에 `bookmarkedPlaceIds` 상태, `handleToggleBookmark`(`logPlanBookmark` 해자 로깅 연동), `instantSwapData` `useMemo`(찜한 후보 최상단 우선 정렬)를 고정 배치하여 React Error #310(Hook 개수 불일치 크래시) 원천 차단.
     - 장소 카드(`renderInstantCard`), 대체리스트 바텀시트(`💖 찜` 배지 및 우측 하트 토글 버튼), 지도 모달(`SmartPlanMapViewModal` 붉은색 4단 융합 마커 및 하단 미니카드 하트 토글)에 찜 기능을 정밀 스마트플랜과 100% 동일하게 연동.
     - 비로그인 상태 로그인 이동(`saveDraftAndRedirectToLogin`) 및 내 일정 확정 저장(`handleProfileCompleteAndSave`) 시 `bookmarked_place_ids`를 `StandardizedPlanJSON`에 포함하여 정밀 스마트플랜으로 영구 승계.
     - `handleNavChoice`에서 `openNavApp` 호출 시 3번째 인자 `metadata`를 전달하여 즉시 여행계획에서도 상단 안내 토스트 노출 후 내비 앱 전환이 정밀 스마트플랜과 1:1 동일하게 동작하도록 통일.
     - `SmartPlanProposal.tsx`에서 비동기 `initialPlan` 로드 시 `bookmarked_place_ids` 동적 복원 및 장소 교체/숨김/순서변경 저장 시 `bookmarked_place_ids` 보존 보강.

---

### 🟢 마일스톤 9.92: 다가오는 일정 D-7/D-0 오전 9시 활성화 동기화 및 D-Day 무한 스피너·상세화면 튕김 완치 (2026-10-11, `6f66a8e`, `4c94585`)

1. **일정 목록 카드(`ScheduleCard.tsx`) 스마트플랜 잠금 해제 타이밍 동기화**:
   - [`src/components/schedule/ScheduleCard.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/schedule/ScheduleCard.tsx)에서 D-7~D-1 및 D-0 오전 9시 스마트플랜 잠금 해제 조건(`isD0Unlocked`, `isD7Unlocked`)을 일정 상세 화면과 100% 일치화.
2. **홈 다가오는 일정(`ScheduleHomeWidget.tsx`) D-Day 무한 스피너 완치**:
   - [`src/components/schedule/ScheduleHomeWidget.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/schedule/ScheduleHomeWidget.tsx)에서 D-Day 오전 9시 이후 배지 판별 시 `weather_window === 'SHORT'` 완료 여부를 정확히 반영하여 무한 스피너(`생성 중...`) 현상 해결.
3. **일정 상세 페이지(`myspace/schedule/[id]/page.tsx`) 튕김 방어**:
   - [`src/app/(mobile)/myspace/schedule/[id]/page.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/app/(mobile)/myspace/schedule/[id]/page.tsx)에서 로컬 캐시 미스 시 서버 `getScheduleById` 조회가 끝나기 전에 목록으로 튕겨내던 조기 리다이렉트를 제거하고, `smart_plan_data`가 배열(`FactCard[]`) 형태일 때도 안전하게 언래핑하도록 보완.

---

### 🟢 마일스톤 9.91: 예약 흐름 전체 '클린 화이트 & 세이지 그린' 라이트 테마 통일 및 커뮤니티 상단 안전 여백 확보 완결 (2026-10-10 ~ 2026-10-11)

1. **예약 흐름 '1안: 클린 화이트 & 세이지 그린' 컬러 전면 통일 (`ccdb4e3`)**:
   - [`SiteImageSlider.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/SiteImageSlider.tsx), [`SitePriceDisplay.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/SitePriceDisplay.tsx), [`reservation/[id]/page.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/app/(mobile)/reservation/[id]/page.tsx), [`ReservationForm.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/ReservationForm.tsx), [`reservation/complete/page.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/app/(mobile)/reservation/complete/page.tsx) 대상 순수 색상 클래스 1:1 치환 완료.
2. **커뮤니티 화면 및 글쓰기 화면 상단 안전 여백(`--sat` Safe Area) 확보 (`094ecc9`)**:
   - [`CommunityHeader.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/community/CommunityHeader.tsx), [`CommunityWriteForm.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/community/CommunityWriteForm.tsx) 상단 상태표시줄 겹침 해결.

---

## 2. 기술적 결정 사항 (Technical Decisions)

| 결정 사항 | 적용 파일 | 채택 이유 |
| :--- | :--- | :--- |
| **카카오내비 `kakaonavi-sdk://navigate` JSON 프로토콜 채택** | [`src/lib/nav-utils.ts`](file:///c:/Users/user/Desktop/RAON.I/src/lib/nav-utils.ts) | Capacitor WebView는 `intent://` 스킴을 가로채지 못해 무반응이 되고, 일반 `kakaonavi://navigate`는 단순 앱 런처로만 동작하여 홈 화면에서 멈춤. 카카오 공식 SDK(`kakao.js`)의 `kakaonavi-sdk://navigate` + JSON `param`/`extras` 규격을 적용해야만 외부 SDK 스크립트 의존 없이 목적지 길안내 화면으로 직행함. |
| **안드로이드 미설치 폴백 `market://` 스킴 및 4000ms 타이머 적용** | [`src/lib/nav-utils.ts`](file:///c:/Users/user/Desktop/RAON.I/src/lib/nav-utils.ts) | 안드로이드 WebView에서 `https://play.google.com/...`을 열면 구글 서버가 `intent://`로 리다이렉트하여 `ERR_UNKNOWN_URL_SCHEME` 흰색 에러 화면이 발생함. `market://details?id=...` 스킴은 Capacitor가 네이티브 플레이스토어 앱으로 즉시 위임하여 현재 화면을 보존하며, 4초 대기 시간으로 최초 '연결 프로그램' 선택 시에도 뒤쪽 화면이 깨지지 않음. |
| **`InstantPlanModal` 최상단 Hook 고정 및 `bookmarked_place_ids` 승계** | [`src/components/home/InstantPlanModal.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/home/InstantPlanModal.tsx) | 조건부 렌더링 분기보다 위에 모든 `useState`/`useCallback`/`useMemo`를 선언하여 React Error #310을 원천 예방하고, 즉시 여행계획에서 찜한 장소가 내 일정 등록 후 정밀 스마트플랜에서도 그대로 유지되도록 설계. |
| **D-7 / D-0 오전 9시 스마트플랜 잠금 해제 수식 일원화** | [`src/components/schedule/ScheduleCard.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/schedule/ScheduleCard.tsx), [`ScheduleHomeWidget.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/schedule/ScheduleHomeWidget.tsx) | 홈 위젯·일정 목록·일정 상세 3곳의 상태 배지 판별 기준을 일치시켜 사용자 혼선 및 D-Day 무한 스피너 현상을 근본 해결. |

---

## 3. 다음 작업 가이드 (Next Action Items for Next Session)

다음 세션에서는 실기기 운영 모니터링과 함께 아래 항목들을 우선순위에 따라 진행합니다.

### 📌 1순위: 11월 예약 오픈 대비 실기기 전체 시나리오 최종 점검
- **예약 ➔ 다가오는 일정 ➔ 즉시 여행계획 / 정밀 스마트플랜 ➔ 찜(💖) ➔ 내비게이션 3사(카카오맵·카카오내비·T맵) 길안내**로 이어지는 전체 사용자 여정(E2E) 모니터링.
- **예약 흐름 라이트 테마(`클린 화이트 & 세이지`)**: 사이트 상세 ➔ 예약 정보 입력폼 ➔ 예약완료 팝업 ➔ 신청완료 화면 및 취소/환불 요청 플로우 최종 점검.

### 📌 2순위: 해자 데이터(`plan_bookmark_log`, `nav_intent_log`, `plan_swap_log`) 누적 현황 확인 및 추천 가중치 고도화
- 사용자가 즉시 여행계획 및 정밀 스마트플랜에서 찜(`logPlanBookmark`)하거나 길안내(`logNavIntent`)를 실행한 로그가 Supabase 테이블에 정상 적재되는지 확인하고, 향후 장소 추천 신뢰도(Trust Score) 가중치 반영 검토.

---

## 4. 주의 사항 (Caveats & Known Characteristics)

1. **구버전 `U+ 카카오내비(종료 예정)` 공존 기기 안내**:
   - 일부 LG U+ 안드로이드 기기에 서비스 종료된 구버전 `U+ 카카오내비`와 정식 `카카오내비`가 함께 설치되어 있는 경우, 안드로이드 OS가 최초 1회 '연결 프로그램' 선택 창을 띄웁니다. 이때 정식 **`카카오내비`를 선택하고 '항상'을 누르면** 이후부터는 선택 창 없이 즉시 목적지 길안내로 직행합니다.
2. **Capacitor 안드로이드 WebView 내 커스텀 스킴 규칙**:
   - Capacitor Android `Bridge.java`는 `http:`/`https:`가 아닌 순수 커스텀 스킴(`kakaomap://`, `kakaonavi-sdk://`, `tmap://`, `nmap://`, `market://`)은 자동으로 `Intent.ACTION_VIEW`로 실행하지만, `intent://` 스킴이나 `https://play.google.com`의 `intent://` 리다이렉트는 별도 파싱 없이 실패하므로 **절대 `intent://`나 `https://play.google.com` 웹 URL을 안드로이드 WebView 내부에서 직접 열지 말고 순수 스킴(`kakaonavi-sdk://`, `tmap://`, `market://`)을 유지**해야 합니다.
3. **안드로이드 웹뷰 캐시 정책**:
   - `capacitor.config.ts`의 `server.url: 'https://raon-i.co.kr'` 환경에서는 Vercel 배포 완료 후 실기기 반영을 위해 **앱을 최근 앱 목록에서 완전히 종료한 후 재실행**하는 것이 가장 확실합니다.

