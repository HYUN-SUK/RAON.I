# Task Checklist: v11.8.8 Stable Data Pipeline Restoration

- [x] **Ground Zero: 전국 단위 기초 데이터 적재 (SSOT Baseline)**
    - [x] **[식당]** 행안부 모범음식점 + 농식품부 안심식당(4만 건 복구) + 백년가게 전국 통합
    - [x] **[마트]** 기타식품판매업(1.3만 ZIP) + 대형마트/SSM 전국 통합 적재
    - [x] **[명소]** 관광공사 1.2만 건 무결성 검증 및 전수 적재
    - [x] **[ID]** UUID v5 기반 소스별 독립 ID 체계(7.1.1 명세) 전수 적용
- [x] **Stabilization & Verification**
    - [x] 전국 단위 12.4만 건 실물 전수 조사 (Pagination 오류 극복)
    - [x] `scripts/sync-master-places.mjs` 인코딩 및 필드 매핑 로직 고도화
    - [x] Production Build (`npm run build`) 무결성 통과
    - [x] Git Commit (`Ground Zero sync complete`) 수행 (Push 대기)
- [x] **Next Phase: Daily Rotation & Admin Monitoring**
    - [x] **[복구]** 캐싱 스크립트 내 캠핑장 조회 테이블 오타 수정 (Location Fallback 정상화)
    - [ ] **[상시 운영]** 17개 시도별 지역 순환 동기화(Daily Rotation) 정적 데이터 점검
    - [ ] **[자동 캐싱]** 4일 후 예약 건에 대한 3일 전 캐싱 자동 작동 여부 점검
    - [ ] **[선별 감사]** 1차 쿼터 전체 리스트 및 1차 선별 로직 실효성 정밀 감사
    - [ ] **[갱신]** 전국 캠핑장 데이터(campgrounds) 상시 최신화 방안 논의 및 자동 갱신 로직 구현
    - [ ] **[점수화]** 4축 점수화(기상, 페르소나, 동선, 편의) 가중치 로직 고도화 및 검증


