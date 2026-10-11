# RAON.I 프로젝트 인수인계 문서 (Handoff Document)

**작성 일시**: 2026-10-11T10:12:00+09:00  
**기준 브랜치**: `main`  
**빌드 상태**: Next.js 16.1.1 (TypeScript 0에러, ESLint 통과, 104/104 빌드 100% 통과)  
**실서버 배포**: Vercel 프로덕션 자동 배포 연동 (`https://raon-i.co.kr`, 최신 커밋 `094ecc9`)  

---

## 1. 현재 상태 요약 (Current State & Completed Work)

### 🟢 마일스톤 9.91: 예약 흐름 전체(사이트 상세 ➔ 예약 정보 입력폼 ➔ 예약완료 팝업 ➔ 신청완료 화면) '클린 화이트 & 세이지 그린' 라이트 테마 통일 및 커뮤니티 상단 안전 여백 확보 완결 (2026-10-10 ~ 2026-10-11)

1. **예약 흐름 '1안: 클린 화이트 & 세이지 그린' 컬러 전면 통일 (`ccdb4e3`)**:
   - **대상 파일**:
     - [SiteImageSlider.tsx](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/SiteImageSlider.tsx)
     - [SitePriceDisplay.tsx](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/SitePriceDisplay.tsx)
     - [reservation/[id]/page.tsx](file:///c:/Users/user/Desktop/RAON.I/src/app/(mobile)/reservation/[id]/page.tsx)
     - [ReservationForm.tsx](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/ReservationForm.tsx)
     - [reservation/complete/page.tsx](file:///c:/Users/user/Desktop/RAON.I/src/app/(mobile)/reservation/complete/page.tsx)
   - **조치 내용**:
     - 기존 다크모드 고정(`#1a1a1a`, `#121212`)으로 인해 밝은 홈 화면 및 예약 메인 화면과 시각적 이질감이 있던 문제를 해결하기 위해, 기능·상태·배치는 100% 그대로 유지하고 순수 색상 클래스만 1:1 교체(`121 insertions, 121 deletions`).
     - 전체 배경을 포레스트 화이트(`#F4F8F5`), 외곽 카드를 순백색(`#FFFFFF`) + 세이지 테두리(`#D2E5D7`), `AUTO` 배지·편의시설 칩·입금계좌 박스를 연한 세이지 그린(`#EDF5EE`), 안쪽 입력폼을 소프트 세이지 화이트(`#F8FBF9`), 총 결제금액 및 CTA 버튼을 라온 시그니처 그린(`#2E7D47`), 예약 완료 팝업 모달을 화이트 카드로 일괄 통일.

2. **커뮤니티 화면 및 글쓰기 화면 상단 안전 여백(`--sat` Safe Area) 확보 (`094ecc9`)**:
   - **대상 파일**: [CommunityHeader.tsx](file:///c:/Users/user/Desktop/RAON.I/src/components/community/CommunityHeader.tsx), [CommunityWriteForm.tsx](file:///c:/Users/user/Desktop/RAON.I/src/components/community/CommunityWriteForm.tsx)
   - **조치 내용**: 안드로이드 네이티브 앱(`html.is-native-app`)에서 상태표시줄과 겹쳐 밀려 올라가던 현상을 해결하기 위해 `CommunityHeader`에 `pt-[calc(1.25rem+var(--sat,0px))]`를 적용하고, `CommunityWriteForm` 상단 헤더를 `header.sticky.top-0`로 전환하여 다른 화면들과 동일한 상단 여백 확보.

---

### 🟢 마일스톤 9.90: 하단 내비게이션 바(`BottomNav.tsx`) 0ms 낙관적 즉각 활성화 & 연초록 캡슐 알약 바운스 피드백 완결 (2026-10-10)

1. **0ms 낙관적 즉각 활성화 (`activeTab` 상태 도입, `f5db157`)**:
   - **근본 원인**: Next.js `router.push()`가 다음 페이지 청크를 로드하고 마운트할 때까지 `pathname`이 바뀌지 않아, 터치 후 0.1~0.3초 동안 눌린 탭이 회색으로 남아 유저가 "터치가 안 먹혔나?"라고 느끼던 현상 규명.
   - **해결**: 탭 터치 즉시(0.00초) 로컬 `activeTab` 상태를 갱신하여 초록색(`#2E7D47`) 및 볼드(Bold) 상태를 즉각 점등하고, `useEffect`로 실제 `pathname` 변경(뒤로가기, 외부 링크 이동)과 100% 동기화. 비로그인 보호 탭은 `withAuth` 통과 시점에만 활성화되도록 방어.
2. **연초록 캡슐 알약(Pill Capsule) 하이라이트 & 마이크로 스프링 바운스**:
   - 활성 아이콘 주변에 `bg-[#2E7D47]/12` 캡슐 알약 배경과 `scale-105` 탄성 모션, `active:scale-90` 터치 반응성 및 웹 진동(`navigator.vibrate(10)`) 보조 연동, 동일 탭 중복 터치 가드 장착.

---

### 🟢 마일스톤 9.89: 탭 고속 왕복 및 백그라운드 복귀 시 프로필/라온토큰/다가오는 일정(타캠핑장) 풀림 현상 3중 방어 완결 (2026-10-10)

1. **전체 여행일정(`/myspace/schedule/page.tsx`) 무한 리렌더링 및 DB 무한 호출 루프 원천 차단 (`07b7770`)**:
   - `loadData`의 `useCallback` 의존성에서 `schedules` 상태를 제거하고 `hasSchedulesCacheRef` 및 `isFetchingRef` 동기 락을 적용하여, 일정 페이지 진입 시 수백 회 발생하던 DB 호출 루프를 마운트 당 1회로 완벽 격리.
2. **3초 타임아웃 오판(`isTimedOut`) 분리 및 탭 전환 시 세션 풀림 차단 (`supabase-client.ts`, `TopBar.tsx`, `myspace/page.tsx`, `7de2783`)**:
   - `getSessionWithTimeout`에 `isTimedOut: true` 플래그를 신설하여, 네트워크/WebView 일시 지연으로 인한 타임아웃을 '진짜 로그아웃'과 엄격히 구분(기존 캐시 보존).
   - `TopBar.tsx`의 `useEffect`에서 `[pathname]` 의존성을 제거하여 탭 이동마다 `checkUser()`가 재실행되던 현상을 차단하고 마운트 시 1회 + `onAuthStateChange` 이벤트 기반으로 정착.
   - `myspace/page.tsx`에서 느린 원격 `getUser()` 대신 0ms 로컬 `getSession()`을 우선 판정하도록 개선.
3. **백그라운드 복귀 시 서버 쿠키 엇박자로 인한 다가오는 일정("병지방오토캠핑장") 증발 방어막 (`actions/schedule.ts`, `ScheduleHomeWidget.tsx`, `3f2cfb0`)**:
   - `getMySchedules(accessToken?)` Server Action이 쿠키 인증 실패 시 클라이언트가 전달한 Bearer `accessToken`으로 2차 검증(Fallback)하도록 보강하고, 인증 미확인 시 `{ schedules: [], authFailed: true }`를 반환.
   - `ScheduleHomeWidget.tsx`에서 `authFailed`이거나 로컬 캐시가 있는데 빈 배열이 내려올 경우 기존 `user_schedules_cache`를 덮어쓰지 않고 보존하도록 방어.

---

### 🟢 마일스톤 9.88: FCM v1 푸시 알림 안정화(페이로드 규격화, 청크 분할, 선택적 재시도 워커) 및 예약 취소 영구 REST API 전환 완결 (2026-10-09 ~ 2026-10-10)

1. **FCM v1 안드로이드 알림 페이로드 명시 (`push-notification/index.ts`, `3a0d65a`)**:
   - `android.notification` 블록에 `title`, `body`, `ticker: '라온아이'`를 명시하여 백그라운드/종료 상태에서도 안드로이드 시스템 트레이 알림 표출 보장.
2. **청크 릴레이 및 선택적 재시도 스윕 워커 (`17d19e2`, `1894d1b`)**:
   - 대량 발송 시 타임아웃 방지 및 실패 건 자동 복구 파이프라인 구축.
3. **예약 취소 영구 REST API(`/api/reservation/cancel`) 전환 (`6f54cdd`)**:
   - Server Action 직렬화 지연을 우회하는 전용 REST 엔드포인트 신설, Bearer 토큰 이중 인증, `try-finally` UI 락 해제 및 빈자리 대기 알림 백그라운드 비동기 분리.

---

## 2. 기술적 결정 사항 (Technical Decisions)

| 결정 사항 | 적용 파일 | 채택 이유 |
| :--- | :--- | :--- |
| **`isTimedOut` 플래그를 통한 타임아웃 vs 로그아웃 분리** | `src/lib/supabase-client.ts`, `src/components/TopBar.tsx` | 모바일 WebView 백그라운드 복귀나 네트워크 지연 시 3초 타임아웃이 발생했을 때, 이를 비로그인(`session === null`)으로 오판하여 프로필과 토큰 게이지를 날려버리던 부작용을 원천 차단하고, 무한 로딩 방어 목적은 그대로 유지. |
| **Server Action 내 Bearer Token 2차 Fallback 인증** | `src/actions/schedule.ts`, `src/components/schedule/ScheduleHomeWidget.tsx` | 모바일 앱 장기 미사용 후 복귀 시 브라우저 쿠키 동기화보다 컴포넌트 마운트가 먼저 일어나 서버가 빈 배열(`[]`)을 반환하고 로컬 일정 캐시를 증발시키던 현상을 100% 방어. |
| **`BottomNav` 0ms 낙관적 활성화 (`activeTab`)** | `src/components/BottomNav.tsx` | 앱 재빌드(구글 플레이 재등록) 없이도 웹 배포만으로 탭 터치 즉시(0.00초) 시각적 피드백(초록색 점등 + 연초록 캡슐 알약 바운스)을 제공하여 라우팅 지연 체감을 완전히 제거. |
| **예약 상세/입력폼/완료 화면 1:1 순수 색상 클래스 치환** | `ReservationForm.tsx`, `reservation/complete/page.tsx` 등 5개 파일 | 11월 예약 오픈을 앞두고 검증된 예약 동시성 제어 및 상태 로직에 단 1%의 영향도 주지 않기 위해, 로직 수정 없이 순수 Tailwind 색상 클래스만 1:1 치환하여 홈 화면과 통일된 라이트 테마 달성. |

---

## 3. 다음 작업 가이드 (Next Action Items for Next Session)

다음 세션에서는 실기기 운영 모니터링과 함께 아래 항목들을 우선순위에 따라 점검 및 진행합니다.

### 📌 1순위: 최근 반영된 UX/안정화 패치 실기기 종합 점검
- **하단 내비게이션(`BottomNav`) 터치 반응성**: 탭 전환 시 0ms 연초록 캡슐 알약 점등 및 바운스 모션 체감 확인.
- **예약 흐름 라이트 테마(`클린 화이트 & 세이지`)**: 사이트 상세 ➔ 예약 정보 입력폼 ➔ 예약완료 팝업 ➔ 신청완료 화면의 시인성 및 가독성 실기기 확인.
- **커뮤니티 상단 안전 여백**: 안드로이드 앱에서 상태표시줄과 '캠퍼들의 이야기' 헤더 간 여백 정상 여부 확인.

### 📌 2순위: 전주 허브원캠프 등 타캠핑장 정밀 스마트플랜 응답 속도 및 내비 버튼 UI 점검
- 마스터 DB 반경 쿼리 응답 속도 모니터링 및 필요 시 프리셋 캐싱 고도화.
- 스마트플랜 카드 내비게이션 연결 버튼 모바일 좁은 화면 텍스트 레이아웃 점검.

---

## 4. 주의 사항 (Caveats & Known Characteristics)

1. **안드로이드 웹뷰 캐시 정책**:
   - `capacitor.config.ts`의 `server.url: 'https://raon-i.co.kr'` 환경에서는 Vercel 배포 완료 후 실기기 반영을 위해 **앱을 최근 앱 목록에서 완전히 종료한 후 재실행**하는 것이 가장 확실합니다.
2. **Next.js 전역 `loading.tsx` 생성 금지**:
   - 루트나 `(mobile)` 레이아웃에 전역 `loading.tsx`를 두면 탭 전환 시 기존 화면이 언마운트되며 깜빡임이 발생할 수 있으므로, 현재의 SWR 로컬 캐시 즉시 복원 + `BottomNav` 0ms 낙관적 활성화 아키텍처를 유지해야 합니다.
3. **진동(`VIBRATE`) 권한 관련**:
   - 현재 `AndroidManifest.xml`에는 `android.permission.VIBRATE`가 포함되어 있지 않으므로, 향후 네이티브 APK/AAB 신규 버전 빌드 시 매니페스트에 추가하면 `BottomNav`에 심어둔 `navigator.vibrate(10)`이 네이티브 앱에서도 자동 활성화됩니다.
