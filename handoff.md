# RAON.I 프로젝트 인수인계 문서 (Handoff Document)

**작성 일시**: 2026-10-19T15:06:00+09:00  
**기준 브랜치**: `main`  
**빌드 상태**: Next.js 16.1.1 (TypeScript 0에러, Production Build 104/104 전체 라우트 100% 통과)  
**실서버 배포**: Vercel 프로덕션 자동 배포 연동 (`https://raon-i.co.kr`)  

---

## 1. 현재 상태 요약 (Current State & Completed Work)

### 🟢 마일스톤 9.94: 예약 마감 표시 유지(`publicReservations` 상태 분리·백그라운드 복귀 동기화), 사이트 예약가능/마감 시인성 및 빈자리 알림 버튼 선명도 개선, 10초 기록 지도 미니 장소카드 전환 완결 (2026-10-19)

1. **공개 예약 마감 현황(`publicReservations`) 슬롯 분리 및 앱 백그라운드 복귀 시 즉시 동기화 (`26bd56d`)**:
   - **대상 파일**:
     - [`src/store/useReservationStore.ts`](file:///c:/Users/user/Desktop/RAON.I/src/store/useReservationStore.ts)
     - [`src/app/(mobile)/reservation/page.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/app/%28mobile%29/reservation/page.tsx)
     - [`src/components/reservation/SiteList.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/SiteList.tsx)
     - [`src/components/reservation/DateRangePicker.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/DateRangePicker.tsx)
     - [`src/components/reservation/ReservationForm.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/ReservationForm.tsx)
   - **원인 규명 및 해결 내용**:
     - 기존에는 전체 사이트의 6개월치 마감 현황을 조회하는 `fetchPublicReservations`와 로그인 사용자의 개인 예약을 조회하는 `fetchMyReservations`가 동일한 `state.reservations` 배열을 공유하고 있었음. 이로 인해 내 예약이 0건인 사용자가 홈 화면을 다녀오거나 앱 백그라운드 복귀 시 `fetchMyReservations()`가 실행되면 `state.reservations`가 빈 배열(`[]`)로 덮어써지면서 마감된 사이트가 모두 열린 것처럼 보이던 현상 발생.
     - `useReservationStore`에 전용 **`publicReservations: Reservation[]`** 상태를 분리하여, `fetchMyReservations`는 `reservations`(개인 예약)만, `fetchPublicReservations`는 `publicReservations`(전체 사이트 마감 현황)만 업데이트하도록 완벽 격리.
     - `fetchPublicReservations` 호출 시 앱 백그라운드 복귀 직후 만료된 사용자 JWT 토큰 헤더로 인해 1차 RPC 호출이 실패하더라도, 즉시 순수 `anon` 키로 PostgREST 엔드포인트(`/rest/v1/rpc/get_public_reservations`)를 재호출하는 2차 폴백(Fallback) 및 네트워크 단절 시 기존 `publicReservations` 보존 가드 장착.
     - `/reservation` 페이지에 `visibilitychange`, `focus`, `pageshow` 이벤트 리스너(300ms 디바운스)를 추가하여 앱을 내렸다가 다시 올리거나 뒤로가기로 복귀할 때 최신 마감 현황을 즉시 동기화.
     - 예약 생성(`createReservationSafe`), 취소 요청(`requestCancelReservation`), 주말 1박 검증(`validateReservation`) 및 사용자 예약 UI 4종 모두 `publicReservations` 기준으로 연동.

2. **예약가능 vs 예약마감 사이트 시각적 대비 강화 및 빈자리 알림 버튼 선명도 100% 복원 (`d1e341c`, `492d7c9`)**:
   - **대상 파일**: [`src/components/reservation/SiteList.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/SiteList.tsx)
   - **조치 내용**:
     - **배지 원색 복원 및 `예약가능` 배지 신설**: 기존에는 이미지와 배지를 감싸는 부모 `<div className="relative h-44 w-full">`에 `grayscale`이 걸려 있어 빨간색 `마감` 배지까지 회색으로 변해 파쇄석 사진에 묻히던 문제를 해결하기 위해, `grayscale brightness-75`를 `<Image>`에만 단독 적용. 우측 상단에 예약 가능 사이트는 에메랄드 그린 **`예약가능` 배지**(`bg-[#2E7D47] text-white`), 마감 사이트는 선명한 코랄 레드 **`마감` 배지**(`bg-[#E06B62] text-white`)를 노출.
     - **상단 배지 줄바꿈 원천 차단**: 모바일 2열 그리드의 좁은 가로폭에서도 `⚡ AUTO`와 `예약가능` 글씨가 두 줄로 꺾이지 않도록 `whitespace-nowrap shrink-0` 및 여백·패딩(`left-2.5 right-2.5`, `px-2 py-0.5 text-[11px]`) 최적화.
     - **마감 카드 본문 톤다운 & 빈자리 알림 영역 선명화**: 마감된 사이트의 배경(`bg-[#F5F7F5]`), 테두리(`border-stone-200`), 가격표, 설명, 해시태그는 차분한 무채색(Stone)으로 톤다운하고, 카드 최외곽의 `opacity-75` 상속을 제거한 뒤 하단 `빈자리 알림` 영역을 깨끗한 화이트 활성 박스(`bg-white border border-[#68A678]/40 rounded-2xl`)로 분리하여 `WaitlistButton`이 비활성화된 것처럼 흐릿하게 보이던 현상 완치.

3. **10초 기록 직후 '지도에 핀 꽂기' 진입 시 지도 중심 노출 및 하단 미니 장소카드 전환 (`f659188`)**:
   - **대상 파일**: [`src/components/myspace/MyMapModal.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/myspace/MyMapModal.tsx)
   - **조치 내용**:
     - 10초 기록 완료 후 지도 진입 시(`optimisticRecordPin`) 화면 전체를 가리던 상세 시트(`isDetailOpen = true`) 자동 오픈을 제거하고, 방금 꽂힌 핀을 중심으로 지도를 보여주면서 하단에 컴팩트 플로팅 미니 장소카드(`selectedPin && !isDetailOpen`)를 노출하도록 개선.
     - 하단 미니 장소카드 터치 시 상세 내용 확인 및 수정 시트가 열리도록 연결하고, 모바일 하드웨어 뒤로가기(`popstate`) 4단계 계층 가드(상세시트 ➔ 미니 장소카드 ➔ 검색창 ➔ 지도 모달) 연동.

---

### 🟢 마일스톤 9.93: 내비게이션 3사(카카오맵·카카오내비·T맵) 완벽 연결 및 즉시 여행계획 대체리스트/지도 찜(💖) 기능 전면 반영 완결 (2026-10-11 ~ 2026-10-12)
- [`src/lib/nav-utils.ts`](file:///c:/Users/user/Desktop/RAON.I/src/lib/nav-utils.ts): 카카오내비 `kakaonavi-sdk://navigate` JSON 프로토콜 적용, T맵 `tmap://route` 순수 스킴 일원화, 안드로이드 미설치 폴백 `market://details?id=...` 및 4000ms 타이머 적용.
- [`src/components/home/InstantPlanModal.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/home/InstantPlanModal.tsx), [`src/components/plan/SmartPlanProposal.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/plan/SmartPlanProposal.tsx): 즉시 여행계획 대체리스트·지도 찜(💖) 전면 반영 및 정밀 스마트플랜 영구 승계.

---

## 2. 기술적 결정 사항 (Technical Decisions)

| 결정 사항 | 적용 파일 | 채택 이유 |
| :--- | :--- | :--- |
| **`reservations`(개인 예약)와 `publicReservations`(전체 마감 현황) 상태 완전 분리** | [`src/store/useReservationStore.ts`](file:///c:/Users/user/Desktop/RAON.I/src/store/useReservationStore.ts) | 홈 위젯(`ScheduleHomeWidget`)이나 백그라운드 복귀 시 실행되는 `fetchMyReservations()`가 전체 사이트 마감 데이터를 덮어쓰지 않도록 상태를 물리적으로 분리하여, 어떤 화면 이동이나 백그라운드 전환에서도 마감 표시가 100% 유지되도록 보장. |
| **`fetchPublicReservations` 순수 `anon` 키 PostgREST 2차 폴백 및 상태 보존 가드** | [`src/store/useReservationStore.ts`](file:///c:/Users/user/Desktop/RAON.I/src/store/useReservationStore.ts) | 앱을 장시간 내려두었다가 올렸을 때 만료된 사용자 JWT 헤더 때문에 1차 RPC 호출이 실패하더라도 `anon` 권한으로 공개 마감 현황을 즉시 가져오고, 오프라인 상태에서도 기존 마감 목록이 빈 배열로 초기화되지 않도록 방어. |
| **마감 사이트 카드의 `<Image>` 단독 `grayscale` 및 외곽 `opacity-75` 제거** | [`src/components/reservation/SiteList.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/SiteList.tsx) | 부모 컨테이너에 걸려 있던 `grayscale`과 `opacity-75`가 자식 요소인 `마감` 배지와 `빈자리 알림` 버튼의 색상·투명도까지 훼손하던 문제를 해결하여, `WaitlistButton.tsx` 원본(`animate-pulse` 포함)을 건드리지 않고도 배지와 알림 버튼의 선명도를 100% 복원. |
| **10초 기록 지도 진입 시 하단 플로팅 미니 장소카드(`selectedPin && !isDetailOpen`) 도입** | [`src/components/myspace/MyMapModal.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/myspace/MyMapModal.tsx) | 핀 꽂기 직후 지도가 상세 시트에 가려지지 않고 지도 위 핀 위치를 먼저 확인한 뒤, 하단 카드를 터치해 상세 확인·수정을 진행할 수 있도록 사용성 개선. |

---

## 3. 다음 작업 가이드 (Next Action Items for Next Session)

다음 세션에서는 실기기 점검을 이어가며 아래 항목들을 우선순위에 따라 진행합니다.

### 📌 1순위: 예약 화면 및 10초 기록 지도 UI 실기기 점검 및 추가 피드백 반영
- 앱 백그라운드 전환/복귀 및 탭 이동 시 예약 마감 사이트 유지 여부 실기기 최종 확인.
- 개선된 `예약가능` / `마감` 배지 시인성 및 마감 카드 하단 `빈자리 알림` 활성 박스 실기기 확인.
- 10초 기록 후 지도 핀 꽂기 진입 시 하단 미니 장소카드 노출 및 터치 상세/수정 전환 확인.

### 📌 2순위: 사용자 추가 점검 항목 순차 진행
- 실기기 테스트 과정에서 발견되는 추가 UI/UX 또는 기능 점검 사항을 **"점검 및 원인/계획 보고 ➔ 사용자 승인 ➔ 정밀 구현 ➔ 타입(`tsc --noEmit`) 및 빌드(`npm run build`) 검증"** 절차에 따라 순차 진행.

---

## 4. 주의 사항 (Caveats & Known Characteristics)

1. **작업 진행 원칙 준수**:
   - 사용자가 점검을 요청할 때는 **절대 바로 코딩하지 않고**, 먼저 코드 레벨 원인 분석과 세부 구현 계획·부작용 점검 결과를 보고한 뒤 **명시적 승인("승인")**을 받은 후 코드를 수정합니다.
   - 코드 반영 후에는 **단독 타입 검증(`npx.cmd tsc --noEmit`)과 프로덕션 빌드 검증(`npm.cmd run build`)을 모두 수행**하여 무결성을 확인합니다.
2. **예약 상태 스토어 슬롯 구분 주의**:
   - `useReservationStore`에서 **`reservations`**는 로그인한 사용자의 개인 예약 내역(`fetchMyReservations`) 및 관리자 전체 예약 조회(`fetchAllReservations`)용이며, **`publicReservations`**는 사용자 예약 화면의 전체 사이트 마감/가용성 판별(`fetchPublicReservations`) 전용입니다. 향후 사용자 예약 가용성 관련 UI 수정 시 반드시 `publicReservations`를 참조해야 합니다.
