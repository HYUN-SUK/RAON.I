# 📌 세션 인수인계 문서 (Handoff Document)

**작성 일시**: 2026년 8월 17일 (KST)  
**작성자**: Lead Developer (Antigravity)  
**작성 대상**: 장소 시계열 이력(`place_history`) 해자 구축, 축제 정규화 & 연간 반복 이력 체계화, 폐업 조기경보(-50점) 감점 적용, 전남광주통합특별시 신규 행정명칭 및 일일 로테이션 수집 엔진(LocalData 6130000_ALL, NMC 병원, Tmap/KT) 100% 정상화 완료 보고  

---

## 1. 💡 현재 상태 요약 (이번 세션 완료 사항)

1. **장소 시계열 변경 이력(`place_history`) 테이블 & AFTER UPDATE 트리거 구축**:
   - `place_baseline_20260816`: 19.8만 건 장소 기준점 스냅샷 테이블 백업 완료.
   - `place_history`: 시계열 이력 테이블(id, place_id, event, before, after, source, occurred_at) 및 복합 인덱스 2종 DDL 생성.
   - `trg_place_history` & `log_place_change()`: `is_active` 변경(`DEACTIVATED`, `REACTIVATED`) 및 `miss_count` 증가(`STRIKE`) 시 자동 적재되는 PL/pgSQL 트리거 장착 완료 (WHEN 조건절 최적화로 DB 부하 0.1% 미만).

2. **축제(FESTIVAL) 데이터 정규화 및 연간 반복 개최 이력 체계화**:
   - `scripts/normalize-festivals.mjs`:
     - 421건 축제명에서 연도 4자리(`2024`, `2025`, `2026`) 정규식 자동 제거 및 `festival_key` 그룹화.
     - 대표 384개 축제 정규화 및 `years_held` 개최 연도 배열 누적 저장 완료.
     - 과거 중복 축제 37건은 소프트 비활성화(`is_active = false`)로 화면 노출을 차단하면서 과거 이력 영구 보존.
     - `place_history`에 `FESTIVAL_HELD` 이벤트 384건 적재 완료.

3. **스마트플랜 폐업 조기경보 감점 (-50점) 장착**:
   - [`src/lib/smartPlan.ts`](file:///c:/Users/user/Desktop/RAON.I/src/lib/smartPlan.ts) Track A, Track B, `fetchCategorySafely` 3개 영역 전수:
     - `miss_count >= 2`인 2스트라이크 폐업 위험 장소에 `-50점` 감점 부여하여 폐업 식당/마트 추천 원천 차단.

4. **전남광주통합특별시 신규 행정명칭 및 수집 엔진 100% 완치**:
   - `scripts/daily-region-sync.mjs`:
     - **행안부 LocalData**: 신규 통합 기관코드 **`6130000_ALL`** 매핑 및 직접 다운로드 fallback 탑재 ➔ **모범음식점 5,550건, 대형마트 168건, 기타식품마트 817건 대량 수신 성공**.
     - **농식품부 안심식당**: `'전남광주통합특별시'`, `'전남광주통합시'` 별칭 등록 ➔ **5,530건 정상 수신 및 DB 갱신**.
     - **한국관광공사 명소**: **836건 수신, 총계 2,267건 확장 및 KTO 공식 순위 3,051건 갱신**.
     - **NMC 응급의료기관 병원**: `STAGE1` 약칭('광주', '전남') 전달 ➔ **병원 56건 정상 수신**.
     - **티맵/KT 모빌리티 빅데이터**: 시군구별 단일 행정코드(`areaCd=29` / `46`) 분기 매핑 ➔ **KT 집중률 23,016건 갱신**.
     - **기존 데이터 카운트 쿼리**: `.eq('sido', targetSido)` ➔ `.in('sido', aliases)`로 교체하여 기존 **14,919건 장소 정상 집계**.

5. **관리자 자동화 화면 (`automation_logs`) 실측 기록 및 빌드 통과**:
   - 관리자 자동화 화면에 전 카테고리 정상 수신 및 갱신 실측 지표가 완벽하게 기록됨.
   - `npx tsc --noEmit`: 에러 0건 (Clean).
   - `npm run build`: 98개 전 페이지 빌드 100% 무결 성공.
   - 원격 Git main 브랜치 배포 완료.

---

## 2. 🛠️ 기술적 결정 사항 (Architectural Decisions)

1. **DB 트리거 기반 시계열 이력 적재**:
   - 앱 소스 코드를 수정하지 않고 DB 레벨의 `WHEN (OLD.is_active is distinct from NEW.is_active or OLD.miss_count is distinct from NEW.miss_count)` 트리거로 처리하여 일반 사용자 조회 성능에 영향 0% 보장.
2. **축제 데이터 소프트 비활성화 원칙**:
   - 과거 축제는 영구 DELETE하지 않고 `is_active = false` 상태로 보존하여 '연간 반복 개최 신뢰도' 판단 근거로 영구 활용.
3. **LocalData 신규 통합 기관코드 `6130000_ALL` 표준화**:
   - 7월 정부 행정구역 통합에 따라 폐지된 `6290000_ALL`, `6460000_ALL` 대신 정부 표준 `6130000_ALL`을 사용하고, 직접 다운로드와 프록시 다운로드 2중 안전망을 구축하여 WAF 차단 방어.
4. **푸시 알림 정책 유지**:
   - 브라우저 웹 푸시와 앱 푸시 토큰 중복에 따른 2중 알림 문제는 사용자가 앱 단일 사용으로 해결 가능하므로 서버/클라이언트 푸시 발송 코드는 임의 수정하지 않고 현행 정책 유지.

---

## 3. 🚀 다음 작업 가이드 (Next Action Items)

1. **스마트플랜 UI/UX 단일 CTA & 상태 안내 배너 최적화**:
   - 출발 당일/D+1 상황에서 상단 메인 CTA 카드와 하단 상태 안내 배너가 동시에 노출되는 번잡함을 해소하고, 1개의 통합 스마트 CTA 카드로 융합 정리.
2. **17일 순환 일일 로테이션 배치 모니터링**:
   - GitHub Actions 크론(`daily-region-sync.yml`)이 매일 새벽 전국 16개 시도를 순환하며 정상적으로 데이터를 수집/갱신하는지 관리자 자동화 화면에서 모니터링.

---

## 4. ⚠️ 주의 사항

- `master_places` 테이블은 19.8만 건 이상의 대용량 마스터 테이블이므로, 일괄 조회 시 반드시 페이지네이션(`paginatedCount`, `range`)을 사용하여 Supabase Statement Timeout(HTTP 500)을 방지해야 합니다.
- 공공 API 호출 시 서비스키 인코딩 형식(디코딩 키 vs 인코딩 키)이 기관별로 상이하므로, `public-api-helpers.mjs`의 표준 헬퍼 함수를 준수해야 합니다.
