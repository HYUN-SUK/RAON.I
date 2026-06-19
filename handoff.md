# RAON.I SSOT 마스터 DB 상세정보 적재 개편 세션 인수인계 문서 (Handoff)

## 1. 현재 상태 요약
이번 세션에서는 마스터 DB 상세정보(영업시간, 휴무일, 주차, 메뉴 등)를 실효성 있게 수집하고 개편하기 위한 **핵심 개발 작업을 100% 완료 및 검증**했습니다.
* **Playwright 동적 스크래퍼 (`scripts/utils/scraper.mjs`)**: 카카오 맵 모바일 상세의 React SPA 화면을 로드하여 영업시간, 요일별 휴무일, 주차 정보, 대표 메뉴 및 가격 리스트를 파싱하는 고성능 스크래핑 모듈 개발 및 검증 완료 (도라지식당 대상 실데이터 수집 완료).
* **일일 상세 수집 배치 (`scripts/fast-enrich.mjs`)**: 식당/카페 275건, 마트 25건 등 일일 300건 제한 쿼터에 기반하여 스크래핑을 순환 동작시키는 수집 배치 엔진 구축 및 DB 최적화 완료.
* **공공 상세 API 연동 (`scripts/utils/public-api-helpers.mjs`)**: 관광공사 TourAPI 상세(공통/소개) 및 NMC 병원 상세(기관기본정보) 조회 API 연동 및 DB 매핑 모듈 개발 완료.
* **일일 지역 동기화 보정 (`scripts/daily-region-sync.mjs`)**: 지역 목록 동기화 단계(`syncTourSpots`, `syncHospitals`)에서 해당 공공 상세 API를 결합 호출하여 한 번에 상세 데이터를 머지 적재하도록 보정 완료 (배치 실행 시간 및 안정성 극대화).
* **공공 벌크 배치 (`scripts/bulk-enrich-public.mjs`)**: 기존에 누락되어 있던 수만 건의 명소/병원/축제 상세정보를 일괄 수집하는 벌크 실행 스크립트 작성 완료 (비스타리조트 등 5개 명소 대상 드라이런 성공 검증 완료).
* **어드민 모니터링 화면 (`src/app/admin/automation/logs/page.tsx`)**: 지역 동기화 내 상세 연동 성공 상태 배지 추가 및 일일 상세 정보 적재 카드에 식당/마트 개별 성공 통계 6칸 그리드 대시보드 시각화 연동 완료.
* **컴파일 무결성 검증**: `npm run build` 정적 컴파일 및 프로덕션 빌드 성공 확인 완료.

## 2. 기술적 결정 사항
* **JSONB 통합 구조 유지 (방안 A)**: 기존 API 및 프론트엔드 연동과의 호환성을 고려하여 별도의 관계형 테이블 신설 대신, `master_places.raw_data` JSONB 내부에 구조화된 `details` 필드를 병합 upsert 하는 방식을 유지하여 호환성 리스크를 차단했습니다.
* **서버리스 크롤링 분리**: Playwright 헤드리스 크롬은 Vercel Serverless Function(실행 한도 300초 및 메모리 부족)에서 구동이 불가능하므로, `daily-region-sync.mjs` 내의 카카오 크롤링 루프를 제거하여 배치의 안전성을 높이고, Playwright 상세 수집(`fast-enrich.mjs`)은 서버의 로컬 배치 데몬으로 완전히 이관 및 분리시켰습니다.

## 3. 다음 작업 가이드 (우선순위)
1. **명소/병원/축제 공공 API 상세정보 1회성 벌크 적재 실행**:
   - 1일 계정당 API 쿼터 한도(10,000건)를 준수하여 3일에 걸쳐 8,000건씩 분할 적재를 가동합니다.
   - **1일차**: `node scripts/bulk-enrich-public.mjs --limit 8000`
   - **2일차**: `node scripts/bulk-enrich-public.mjs --limit 8000`
   - **3일차**: `node scripts/bulk-enrich-public.mjs --limit 8000` (최종 완료)
2. **식당/카페 및 마트 상시 Playwright 수집 배치 가동**:
   - 로컬 크론 배치 데몬을 통해 `node scripts/fast-enrich.mjs` 가 매일 실행되도록 크론탭 또는 자동 스케줄러에 등록합니다.
3. **어드민 Live Monitor 동작 검증**:
   - 실제 배치가 동작하면서 생성하는 `automation_logs`가 어드민 자동화 화면 상에 깨짐 없이 정상 시각화되는지 관리자 브라우저로 육안 확인합니다.

## 4. 주의 사항 및 환경 설정
* `.env.local` 파일 내에 `PUBLIC_DATA_API_KEY` 및 `MOIS_API_KEY` (또는 둘 중 하나가 유효한 공공데이터포털 디코딩/인코딩 키)가 정상적으로 세팅되어 있어야 공공 벌크 적재가 작동합니다.
* Playwright 구동을 위해 로컬 환경에 `playwright` 패키지 및 `chromium` 브라우저 바이너리(Step 1에서 완료됨) 설치 상태가 유지되어야 합니다.
