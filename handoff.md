# 📌 세션 인수인계 문서 (Handoff Document)

**작성 일시**: 2026년 8월 16일 (KST)  
**작성 대상**: 장소 시계열 이력(place_history) 테이블/트리거 구축, 축제 정규화 & 연간 반복 이력 체계화, 폐업 조기경보(-50점) 감점 적용 완료 보고  

---

## 1. 💡 현재 상태 요약 (이번 세션 완료 사항)

1. **장소 변경 이력(`place_history`) 시계열 테이블 & AFTER UPDATE 트리거 구축 (Phase 1 완료)**:
   - `place_baseline_20260816`: 19.8만 건 장소 기준점 스냅샷 테이블 백업 완료.
   - `place_history`: 시계열 이력 테이블(id, place_id, event, before, after, source, occurred_at) 및 인덱스 2종 생성 완료.
   - `trg_place_history` & `log_place_change()`: `is_active` 변경(`DEACTIVATED`, `REACTIVATED`) 및 `miss_count` 증가(`STRIKE`) 시 자동 적재되는 PL/pgSQL 트리거 장착 완료.
   - `test_place_history_trigger.mjs` 실측 테스트 100% 무결 성공.

2. **축제(FESTIVAL) 데이터 정규화 및 연간 개최 이력 구축 (Phase 2 완료)**:
   - `scripts/normalize-festivals.mjs`:
     - 축제명에서 선행/후행 연도 4자리(`2024`, `2025`, `2026`) 정규식 자동 제거 및 `festival_key` 그룹화.
     - 대표 축제 384건 정규화 및 `years_held` 개최 연도 배열 누적 갱신 완료.
     - 중복 축제 37건 소프트 비활성화(`is_active = false`)로 노출 차단 및 데이터 보존 완료.
     - `place_history`에 `FESTIVAL_HELD` 이벤트 384건 적재 완료.

3. **스마트플랜 추천 엔진 폐업 조기경보 감점 적용 (Phase 3 완료)**:
   - [`src/lib/smartPlan.ts`](file:///c:/Users/user/Desktop/RAON.I/src/lib/smartPlan.ts) Track A, Track B, `fetchCategorySafely` 3개 영역 전수:
     - `miss_count >= 2`인 2스트라이크 폐업 위험 장소에 `-50점` 감점 부여하여 폐업 식당 추천 원천 차단.

4. **빌드 및 타입 무결성 통과**:
   - `npx tsc --noEmit`: 경고 및 타입 에러 0건 (Clean).
   - `npm run build`: 98개 전 페이지 프로덕션 빌드 100% 무결 성공.

---

## 2. 🛠️ 기술적 결정 사항 (Architectural Decisions)

1. **DB 트리거 기반 시계열 이력 적재**:
   - 앱 소스 코드를 수정하지 않고 DB의 `WHEN` 절 트리거로 처리하여 일반 사용자 조회 성능에 영향 0% 보장.
2. **축제 데이터 소프트 비활성화 원칙**:
   - 과거 축제는 영구 DELETE하지 않고 `is_active = false` 상태로 보존하여 '연간 반복 개최 신뢰도' 판단 근거로 영구 활용.

---

## 3. 🚀 다음 작업 가이드 (Next Action Items)

1. **스마트플랜 UI/UX 단일 CTA & 상태 안내 배너 최적화**:
   - 출발 당일/D+1 상황에서 안내 배너와 메인 버튼이 동시 노출되는 번잡함 해소.
2. **16개 시도 마스터 DB 로테이션 갱신 모니터링**.
