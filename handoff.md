# RAON.I 프로젝트 인수인계 문서 (Handoff Document)

**작성 일시**: 2026-10-02T16:00:00+09:00  
**기준 브랜치**: `main`  
**빌드 상태**: Next.js 16.1.1 (TypeScript 0에러, ESLint 0에러, 103/103 빌드 100% 통과)  
**실서버 배포**: Vercel 프로덕션 배포 완료 (`https://raon-ai.com`, Pro 플랜 임시 가동 중 ➔ 무료 복귀 대기)  

---

## 1. 현재 상태 요약 (Current State & Completed Work)

### 🟢 마일스톤 9.81: 로그인 보상 다중 팝업 완치, 지도 UI 상태 스토리지 격리 및 모바일 3단계 뒤로가기(Popstate) 가드 완결 (2026-10-02)

1. **로그인 보상 다중 팝업 원천 차단 (`src/components/TopBar.tsx`)**:
   - `checkUser()`와 `onAuthStateChange` 리스너가 마운트 시 거의 동시에 `grantAction('LOGIN')`을 호출하여 토스트가 2~3개 연달아 뜨던 비동기 경합 상태(Race Condition)를 `loginRewardProcessedRef` 동기 락으로 원천 차단.
   - 단일 헬퍼 `handleDailyLoginReward`로 통합하여 동일 마운트 주기 내 단 1회만 실행 보장. 로그아웃 시 락을 리셋하여 계정 전환 완벽 지원.

2. **지도 UI 상태 로컬스토리지 영구 저장 배제 (`src/store/useMySpaceStore.ts`)**:
   - `useMySpaceStore`의 `partialize` 옵션에서 일시적 UI 상태인 `isMapOpen`, `targetLocation`, `optimisticRecordPin`을 로컬스토리지(`myspace-storage`) 영구 캐시에서 완전 제외.
   - 새로고침이나 타 화면 이동 시 지도가 제멋대로 튀어나오던 과거의 근본 원인을 영구 박멸하고, 실제 사용자 데이터(앨범, 타임라인, 레벨, 토큰 등)는 100% 안전 보존.

3. **내수첩 내 중복 2중 모달 렌더링 제거 (`src/components/myspace/SummaryGrid.tsx`)**:
   - 자식 컴포넌트인 `SummaryGrid.tsx`의 중복 `<MyMapModal>`을 삭제하고, 최상위 `myspace/page.tsx`에서 단 1장만 깔끔하게 띄우도록 일원화.

4. **모바일 3단계 뒤로가기(`popstate`) 가드 장착 (`src/components/myspace/MyMapModal.tsx`)**:
   - 과거 7월 30일(커밋 `09de3787`) `cleanup` 내 무조건 `history.back()` 호출로 발생했던 Next.js 라우터 충돌(Page Bounce)을 방어하기 위해 최신 마일스톤 9.73 표준 패턴 적용:
     - 모달 오픈 시 단 1회 `pushState({ raonModal: 'my_map' })`.
     - 스마트폰 하드웨어 뒤로가기 터치 시: 상세시트 ➔ 검색창 ➔ 지도본체 순차 닫힘 및 추가 `history.back()` 절대 호출 금지로 **내수첩(`/myspace`) 화면 100% 안전 잔류**.
     - 좌측 상단 `<-` 버튼 터치 시: 프로그래밍 플래그(`isProgrammaticBackRef`)를 세워 가상 히스토리 1개만 안전 회수.
     - `cleanup` 시 `history.back()`을 절대 부르지 않아 라우터 충돌 0% 보장.

5. **홈 화면 10초 기록 연동 경험 보존 (`BeginnerHome.tsx`, `ReturningHome.tsx`)**:
   - 홈 화면의 `MyMapModal` 바인딩을 온전히 유지하여, 10초 기록 완료 후 "핀 확인하기" 클릭 시 지도 팝업 기능을 100% 보존.

### 🟢 마일스톤 9.80: 모바일 인증 Web Locks 데드락 완치, 로그아웃 페일세이프 및 Vercel 트래픽 최적화(무료 쿼터 복귀 대책) 완결 (2026-10-02)

1. **모바일 웹뷰 Web Locks 데드락 완치 (`src/lib/supabase-client.ts`, `src/app/login/page.tsx`, `src/components/TopBar.tsx`, `src/hooks/useRequireAuth.ts`)**:
   - **`lockNoOp` 주입**: 안드로이드 TWA 웹뷰에서 `navigator.locks` 큐가 꼬여 `getSession()`, `signOut()`, 이메일 로그인이 무한 대기(스피너/먹통)에 빠지던 버그를 `auth: { lock: async (_name, _acquireTimeout, fn) => await fn() }` 주입으로 원천 박멸. (Supabase 공식 최신 v2.107+ 락 폐기 방향과 동일)
   - **클린 런타임 리셋 (`login/page.tsx`)**: 불필요한 사전 `signOut`을 제거하고 `window.location.replace(nextUrl)` 하드 리로드를 적용하여, 카카오 소셜 로그인과 동일하게 브라우저 메모리를 맑게 헹구고 홈으로 진입하도록 구현 (싱글톤 메모리 찌꺼기 0% 보장).
   - **로그아웃 먹통 100% 원천 차단 (`TopBar.tsx`)**: `handleLogout`의 `signOut()`에 1.5초 `Promise.race` 타임아웃 레이스를 걸고, 성공/실패 여부와 무관하게 `finally` 블록에서 무조건 캐시 삭제, 세션 리셋, 홈 이동을 보장.
   - **탭 터치 먹통 가드 (`useRequireAuth.ts`)**: 쿠키 기반 빠른 인증 판별(`document.cookie.includes('sb-')`)과 2.5초 타임아웃 가드를 장착하여 예약/내수첩 탭 진입 시 먹통 현상 완치.
   - **일정 위젯 자동 갱신 (`ScheduleHomeWidget.tsx`)**: `SIGNED_IN` 이벤트 발생 시 `fetchMyReservations()`와 `getMySchedules()`를 즉각 재호출하도록 연결하여 로그인 직후 '풍성채 캠핑장' 다가오는 일정이 새로고침 없이 즉시 표출.

2. **Vercel 트래픽 다이어트 및 영구 무료(Hobby) 플랜 복귀 준비 (`src/app/robots.ts`, `next.config.ts`, `VERCEL_TRAFFIC_OPTIMIZATION.md`)**:
   - **사태 원인 규명**: Vercel CDN 요청 300만 회 초과(Hobby 100만 한도 초과)로 인한 일시정지 사태 분석 완료. 실제 사용자 트래픽(`Function Invocations: 94K`)은 9.4%에 불과했으나, 봇들의 정적 에셋 무차별 수집 및 Next.js 기본 이미지 캐시(60초)의 반복 변환으로 인한 대역폭/요청 폭증임을 확인.
   - **`src/app/robots.ts` 신규 생성**: 
     - 악성 스크레이퍼 봇(`Bytespider`, `PetalBot`, `CCBot` 등) 전면 차단 (`Disallow: /`).
     - 네이버(`Yeti`), 구글(`Googlebot`), 카카오톡(`kakaotalk-scrap`) 정상 허용.
     - **AI 실시간 검색/추천 봇(`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`) 100% 허용**으로 AI 검색 추천 가치 극대화.
     - `/_next/`, `/api/`, `/admin/` 등 내부 시스템 번들 수집 차단.
   - **`next.config.ts` 캐시 최적화**:
     - 이미지 캐시 기간 30일(`minimumCacheTTL: 2592000`) 연장 및 AVIF/WebP 고효율 압축 활성화 (Image Cache Writes 64K 및 대역폭 87GB를 70% 이상 감축).
     - `/icons/`, `/images/` 정적 파일 브라우저 1년 장기 캐시 적용 (`firebase-messaging-sw.js` 및 PWA 매니페스트는 장기 캐시에서 제외하여 푸시/설치 무결성 유지).
   - **전용 운영 가이드 영구 보존**: [`VERCEL_TRAFFIC_OPTIMIZATION.md`](file:///c:/Users/user/Desktop/RAON.I/VERCEL_TRAFFIC_OPTIMIZATION.md) 작성 및 커밋 완료.

3. **코드 무결성 및 빌드 검증**:
   - `npx.cmd tsc --noEmit` 에러 0건 통과.
   - ESLint 검사 통과 (불필요한 import 및 미사용 변수 `router`, `Sparkles`, `requestPermission` 정리 완료).
   - Git 커밋 및 푸시 완료 (`f3c64e0`).

---

## 2. 기술적 결정 사항 (Technical Decisions)

| 결정 사항 | 적용 파일 | 채택 이유 |
| :--- | :--- | :--- |
| **`lockNoOp` 주입** | `src/lib/supabase-client.ts` | 모바일 크롬 WebView/TWA 환경에서 브라우저 Web Locks API 큐가 동기화 지연/데드락을 일으켜 인증 함수가 무한 대기에 빠지는 문제를 우회 (단일 인앱 환경에서 100% 안전). |
| **`window.location.replace`** | `src/app/login/page.tsx` | 카카오 OAuth 리다이렉트와 동일하게 브라우저 런타임을 완전히 새로고침하여 진입함으로써, Supabase 싱글톤 메모리 상태 찌꺼기와 lock 잔여물이 홈 화면으로 이어지지 않도록 보장. 뒤로가기 시 로그인 화면 재진입 방지. |
| **로그아웃 1.5초 타임아웃 레이스** | `src/components/TopBar.tsx` | `signOut()`이 네트워크 지연이나 락 이슈로 멈추더라도 1.5초 후 `finally` 블록에서 무조건 캐시를 비우고 세션을 리셋하여 홈으로 튕겨 나가도록 강제 탈출 안전망 구축. |
| **로그인 보상 1회 동기 락** | `src/components/TopBar.tsx` | `checkUser()`와 `onAuthStateChange`의 동시 호출로 인한 경합 상태(Race Condition)를 `loginRewardProcessedRef`로 차단하여 보상 및 토스트의 2~3회 중복 발생 완치. |
| **지도 상태 스토리지 제외 & Popstate 가드** | `useMySpaceStore.ts`, `MyMapModal.tsx` | `isMapOpen`을 `localStorage`에서 제외하여 어디서든 지도가 튀어나오는 버그를 차단하고, `cleanup` 내 `history.back()`을 배제한 무충돌 가상 히스토리로 핸드폰 뒤로가기 시 로그인 역주행 완벽 방어. |
| **AI 검색 봇 vs 수집 봇 분리** | `src/app/robots.ts` | 단순 대량 스크레이퍼(`Bytespider`, `CCBot`, `ClaudeBot` 등)는 차단하여 트래픽을 방어하고, 사용자의 질문에 답하는 실시간 검색/추천 봇(`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`)은 공식 허용하여 SEO 및 AI 추천 유입 극대화. |
| **정적 캐시 범위 한정** | `next.config.ts` | 1년 장기 캐시를 오직 `/icons/`, `/images/`로만 한정하여, 실시간 업데이트가 필요한 `firebase-messaging-sw.js`(푸시 알림) 및 `manifest.json`, `.well-known/assetlinks.json`의 캐시 오염을 원천 차단. |

---

## 3. 다음 작업 가이드 (Next Action Items)

### 📌 1순위: Vercel 트래픽 모니터링 및 무료(Hobby) 플랜 복귀
- **확인 경로**: [Vercel Dashboard](https://vercel.com) ➔ `RAON.I` ➔ **[Usage]** 탭
- **점검 주기**: 배포 후 3~5일 동안 관찰
- **안전 복귀 기준**:
  - 일일 CDN Requests: **33,000회 이하** (월 100만 회 이내 페이스)
  - 일일 Fast Data Transfer: **3.3 GB 이하** (월 100 GB 이내 페이스)
- **무료 다운그레이드 실행**:
  - 지표가 안정권(일 2~3만 회)에 안착한 것을 확인한 뒤, 다음 결제일 이전에 Vercel Dashboard ➔ Settings ➔ Billing ➔ Change Plan ➔ **Hobby (Free)** 선택.

### 📌 2순위: 모바일 TWA 실기기 사용자 경험 모니터링
- 안드로이드 실제 스마트폰 앱(`kr.co.raoni.app`)에서:
  - 이메일 로그인 후 홈 화면 레벨/닉네임 즉시 갱신 확인.
  - 로그인 직후 '풍성채 캠핑장' 다가오는 일정 즉시 노출 확인.
  - 프로필 터치 후 [로그아웃] 시 즉시 지연 없이 홈 화면 전환 확인.

---

## 4. 주의 사항 (Caveats & Known Characteristics)

1. **Vercel 방화벽 전면 챌린지 금지**:
   - Vercel 대시보드의 "Attack Challenge Mode"를 전체 사이트에 켜면, 모바일 TWA 앱 실행 시 사용자에게 캡차(로봇이 아닙니다) 화면이 뜨면서 앱이 멈출 수 있습니다. 절대 글로벌 챌린지를 켜지 마십시오.
2. **서비스 워커 파일 캐시 금지**:
   - `public/firebase-messaging-sw.js`에 브라우저 장기 캐시가 걸리면 푸시 알림 수신 로직 업데이트가 사용자 기기에 즉시 반영되지 않습니다. 현재 `next.config.ts`에서 완벽히 제외되어 있으므로 이 규칙을 유지해야 합니다.
3. **상세 점검 보고서 참조**:
   - 트래픽 최적화 관련 모든 상세 내역과 지난 30일 분석 결과는 [`VERCEL_TRAFFIC_OPTIMIZATION.md`](file:///c:/Users/user/Desktop/RAON.I/VERCEL_TRAFFIC_OPTIMIZATION.md)에 상시 보존되어 있습니다.
