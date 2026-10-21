# RAON.I 프로젝트 인수인계 문서 (Handoff Document)

**작성 일시**: 2026-10-21T18:45:00+09:00  
**기준 브랜치**: `main` (운영 라이브) / `staging` (`test.raon-i.co.kr` - 피칭 시뮬레이터 개발용)  
**빌드 상태**: Next.js 16.1.1 (TypeScript 0에러, Production Build 104/104 전체 라우트 100% 통과)  
**실서버 배포**: 
- 운영 프로덕션: `https://raon-i.co.kr` (Vercel 자동 배포 연동)
- 스테이징 프리뷰: `https://test.raon-i.co.kr` (`origin/staging` 브랜치 연동, 보안 차단)

---

## 1. 현재 상태 요약 (Current State & Completed Work)

### 🟢 마일스톤 9.95: 예약 화면 백그라운드 복귀 언락 패치, 스마트플랜 경로선택기 뷰포트 최적화, 독립 스테이징 환경(`test.raon-i.co.kr`) 구축 및 3D 가상 피칭 시뮬레이터 P0 아키텍처/최종 구현계획서 확립 완결 (2026-10-20 ~ 2026-10-21)

1. **예약 화면 백그라운드 복귀 가용성 언락 및 무결성 패치 (`6753a5d`)**:
   - **대상 파일**: [`src/store/useReservationStore.ts`](file:///c:/Users/user/Desktop/RAON.I/src/store/useReservationStore.ts), [`src/components/reservation/SiteList.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/reservation/SiteList.tsx), [`src/app/(mobile)/reservation/page.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/app/%28mobile%29/reservation/page.tsx)
   - `fetchPublicReservations`, `fetchSites`, `fetchSiteConfig`, `fetchOpenDayRule`를 사용자 세션 만료 간섭이 없는 순수 `anon` REST 직통 호출(5초 타임아웃)로 전환.
   - `SiteList.tsx`에 `isSitesLoaded` 및 `isPublicReservationsLoaded` 스켈레톤 가드를 장착하여 데이터 로딩 중 빈 화면 깜빡임 차단.
   - `/reservation/page.tsx`에 15초 쓰로틀링 날짜 재검증 가드를 탑재하여 백그라운드 복귀 시 안정적인 실시간 동기화 보장.

2. **스마트플랜 경로선택기(`RouteSelector.tsx`) 뷰포트 레이아웃 최적화 (`75a1797`)**:
   - **대상 파일**: [`src/components/plan/RouteSelector.tsx`](file:///c:/Users/user/Desktop/RAON.I/src/components/plan/RouteSelector.tsx)
   - 카카오 지도 높이를 `350px`에서 `210px`로 컴팩트화하고 상하 패딩/마진을 최적화하여, 모바일 전 기종에서 스크롤 없이 `[이 경로로 스마트플랜 생성]` CTA 버튼이 첫 화면(Above the Fold)에 100% 노출되도록 개선.

3. **독립 스테이징 환경(`test.raon-i.co.kr`) 구축 및 Vercel 배포 연결**:
   - 가비아 DNS CNAME(`test` ➔ `cname.vercel-dns.com.`) 설정 및 Vercel Domains에 `test.raon-i.co.kr` 연동 완료.
   - Git 독립 `staging` 브랜치(`origin/staging`) 생성 및 푸시 완료, 스테이징 실서버 정상 응답(200 OK) 확인.

4. **Vercel 트래픽 점검 및 방화벽 감사**:
   - `robots.ts` 적용 이후 무단 스크래핑 봇 차단율 100% 및 정적 이미지 캐시 쓰기 95% 절감(64k ➔ 3.45k) 확인 ($0 베이스라인 유지).
   - 10월 초 봇 공격 누적치로 인한 일시 초과 해소 후 11월 1일 주기 리셋에 맞춘 Hobby(무료) 플랜 안전 다운그레이드 가이드 수립.

5. **신규 기능 "가상 피칭 & 캠핑 시뮬레이터(Pitching Simulator)" P0 아키텍처 및 구현계획서 최종 확정**:
   - 기획 AI(Claude)와의 1~2차 기술 검토 및 대표님 피드백 반영: 8개 사이트 전원 텐트 사이트 확정, 절차적(Procedural) 파라메트릭 텐트 메시, 4대 3D 시각 품질 체크포인트(Directional Light Soft PCF 실그림자 + 접지 ContactShadows + 감성 색온도 조명 + 3/4 부감 구도) 확립.
   - 기존 앱 영향 0%의 완전 모듈 독립 구조(`src/features/pitching/`, `/admin/pitching-preview`), 순수 기하학적 일사량 계산 분리, 기상학 $\sin/\cos$ 풍향 벡터 보간, Open-Meteo DEM 90m 기반 16방위 능선 고도각(`horizon_profile`) 1회성 자동 산출 파이프라인 수립.
   - 프로젝트 문서 [`docs/PITCHING_SIMULATOR_P0_PLAN.md`](file:///c:/Users/user/Desktop/RAON.I/docs/PITCHING_SIMULATOR_P0_PLAN.md) 작성 완료.

---

### 🟢 마일스톤 9.94: 예약 마감 표시 유지(`publicReservations` 상태 분리·백그라운드 복귀 동기화), 사이트 예약가능/마감 시인성 및 빈자리 알림 버튼 선명도 개선, 10초 기록 지도 미니 장소카드 전환 완결 (2026-10-19)
- `useReservationStore`의 개인 예약(`reservations`)과 전체 마감 현황(`publicReservations`) 상태 분리 (`26bd56d`).
- `SiteList.tsx`의 마감 배지 원색 복원, `예약가능` 배지 신설, `빈자리 알림` 버튼 화이트 활성 박스 분리 (`d1e341c`, `492d7c9`).
- `MyMapModal.tsx`의 10초 기록 핀 꽂기 직후 하단 플로팅 미니 장소카드 전환 (`f659188`).

---

## 2. 기술적 결정 사항 (Technical Decisions)

| 결정 사항 | 적용 위치 | 채택 이유 |
| :--- | :--- | :--- |
| **피칭 시뮬레이터 단일 독립 모듈 격리** | `src/features/pitching/` | 기존 예약, 결제, 소셜 로그인 코드에 단 한 줄의 부작용도 미치지 않도록 물리적·논리적으로 100% 캡슐화. 외부 노출은 뷰 1개와 계산함수 1개로 제한. |
| **Three.js 지연 로딩 (`ssr: false`)** | `next/dynamic` | 3D 라이브러리 번들(500KB~1MB)을 피칭 시뮬레이터 화면 진입 시에만 로드하여 기존 홈/예약 사용자에게 로딩 부하 0% 보장. |
| **절차적(Procedural) 텐트 3D 메시** | R3F 메시 코드 | 수백 개 브랜드의 고용량 3D 캐드/glTF 파일 대신, 사용자가 입력한 치수(가로x세로x높이)대로 즉시 만들어지는 초경량(수 KB) 3D 형상 구현. |
| **방향성 실그림자(Directional Soft PCF) + ContactShadows 보조** | 3D 씬 라이팅 | 접지 그림자(`ContactShadows`)만으로는 시간대별 늘어지는 그늘을 볼 수 없으므로, 태양 방위/고도각에 연동되는 실그림자를 켜서 실제 그늘 위치를 정확히 시각화. |
| **순수 기하학적 일사량 계산 분리** | 계산 엔진 | 일사/그늘 계산을 3D 화면(픽셀)에 의존하지 않고 순수 수학적 Ray-casting으로 계산하여, 3D 뷰와 2D 탑뷰 폴백(Konva)에서 100% 동일한 점수 산출 보장. |
| **Open-Meteo DEM 16방위 능선 각도 자동 산출** | 1회성 배치 스크립트 | 캠장이 현장에서 16방위 산봉우리 각도를 일일이 측정할 필요 없이, 캠핑장 위경도(36.6354349, 126.7638091) 기반으로 무료 90m DEM API를 통해 1초 만에 자동 산출 및 DB 영구 저장. |
| **특허 보호 보안 격리 (스테이징)** | `test.raon-i.co.kr` (`staging`) | 특허 출원 전 외부 유출을 차단하기 위해 `main` 병합을 금지하고, `noindex, nofollow` 및 `/admin/pitching-preview` 관리자 인증(미인증 시 404)으로 보호. |

---

## 3. 다음 작업 가이드 (Next Action Items for Next Session)

다음 세션에서는 대표님의 현장 실측치를 전달받아 **P0 프로토타입 구현(총 1~1.5주 로드맵)**에 즉시 착수합니다.

### 📌 1순위: 대표님 현장 실측치 수령 및 확인
- **철수네(`site-1`) 실측 항목**:
  1. 가로 x 세로 크기 (m)
  2. 진입로 정면 방위각 (나침반 앱, 진북 기준 각도)
  3. 주요 장애물(나무, 배전함) 위치 (사이트 앞쪽 좌측 모서리 (0,0) 기준 오른쪽 x m, 안쪽 y m)
  4. 대략의 바닥 경사 및 배수 방향

### 📌 2순위: WBS 1 & WBS 2 착수 (`staging` 브랜치)
- **WBS 1 (독립 환경 구축)**:
  - `src/features/pitching/` 폴더 구조 생성
  - `/admin/pitching-preview` 라우트 생성 (관리자 세션 검증 가드 + 404 차단)
  - 스테이징 메타태그 `noindex, nofollow` 적용
- **WBS 2 (지형 자동 산출 & DB 초기화)**:
  - Open-Meteo Elevation API를 호출하는 16방위 능선 고도각 자동 산출 스크립트 작성 및 실행
  - `site_geometry` 테이블 마이그레이션 및 철수네 데이터 적재

### 📌 3순위: WBS 3 착수 (3D 디오라마 & 절차적 텐트)
- R3F 파쇄석 바닥 텍스처 + 주변 나무 배치
- 입력 치수 비례 터널형 아치 절차적 3D 메시 + Directional Soft PCF 실그림자 + 접지 그림자 + 버텍스 바람 연출

---

## 4. 주의 사항 (Caveats & Known Characteristics)

1. **특허 보호 및 브랜치 격리 원칙 절대 준수**:
   - 가상 피칭 시뮬레이터 관련 코드는 **특허 출원 전까지 절대 `main` 브랜치에 커밋하거나 병합하지 않습니다.**
   - 모든 신규 작업은 **`staging` 브랜치(`test.raon-i.co.kr`)**에서만 진행하며, 관리자 전용 비공개 경로(`/admin/pitching-preview`) 뒤에 은닉합니다.
2. **코드 무결성 검증 원칙**:
   - 코드 작업 후에는 항상 **`npx.cmd tsc --noEmit` (타입 검증 0에러)**와 **`npm.cmd run build` (프로덕션 빌드 100% 통과)**를 수행하여 전체 시스템 무결성을 확인합니다.
3. **Vercel 플랜 다운그레이드 일정**:
   - 10월 1~2일 악성 봇 트래픽으로 인한 누적 사용량 때문에 즉시 다운그레이드가 제한되었으므로, **11월 1일 사용량 주기 리셋 직후 Hobby(무료) 플랜으로 안전하게 전환**합니다.
