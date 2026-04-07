# Handoff Document — 2026-04-07 (Session: Pipeline Stabilization)

## 현재 상태 요약

이번 세션에서 **Daily Region Sync 엔진(`scripts/daily-region-sync.mjs`)의 전면 안정화**를 완료했습니다.

### 완료된 작업
1. **API Throttling 적용**: LocalData CSV 다운로드 3초, TourAPI 상세조회 1초 지연으로 WAF/TPS 차단 근본 해결
2. **안심식당 지역 필터링**: `RELAX_SI_NM` 파라미터로 전국 5만건 → 지역별 수천건으로 호출량 90% 절감
3. **Soft-Delete Failsafe**: API 응답 0건 시 기존 데이터 삭제 방지 (데이터 무결성 보전)
4. **SIDO_ROTATION 정규화**: 중복 정의 제거, 17개 시도 순서를 표준 행정구역 코드 기반으로 정렬
5. **충남 시뮬레이션 검증**: 좌표 보존 로직, Upsert 정상 동작 확인
6. **코드 정리**: 임시 테스트 파일 삭제, ESLint 통과, 빌드 통과

### 최종 커밋
- `feat: stabilize daily region sync with throttling and failsafes` (Push 대기 중)

---

## 기술적 결정 사항

| 결정 | 이유 |
|------|------|
| LocalData 3초 딜레이 | WAF(Web Application Firewall)가 빠른 연속 다운로드를 DDoS로 오인, 403 차단 |
| TourAPI 1초 딜레이 | 공공데이터포털 TPS(초당 처리량) 제한 초과 방지 |
| 안심식당 지역 필터 | 전국 데이터 전수 조회 → 지역 필터링으로 API 호출량 절감 |
| Soft-Delete 조건부 실행 | API 장애 시 fetched=0이면 삭제 스킵 (기존 데이터 보호) |
| SIDO_ROTATION 순서 변경 | 서울→부산→대구→인천 순 (행정구역 코드 기준, 기존 혼재 정리) |

---

## 다음 작업 가이드 (4/8 세션 우선순위)

### 🔴 P0: 즉시 확인
1. **전북특별자치도 갱신 결과 확인** — 새벽 4시 배치 후 `automation_logs` 조회
   - 7개 카테고리(SAFE, GOOD, BAEK, LARGE_MART, SSM_MART, OTHER_MART, SPOT) 각각 fetched > 0 확인
   - Throttling이 WAF/TPS 차단을 성공적으로 회피했는지 에러 로그 확인
2. **Git Push** — 사용자가 직접 진행 (현재 origin/main 대비 커밋 수 ahead 상태)

### 🟡 P1: D-3 캐싱 검증
3. **D-3 캐싱 1부/2부 자동 작동** — 방금 예약한 4일 후 예약건이 내일 D-3 캐싱에 잡히는지 확인
4. **1차 선별 로직 점검** — 캐싱된 후보군의 카테고리별 쿼터(300건) 충족 여부

### 🟢 P2: 중기 과제
5. 캠핑장 데이터 자동 갱신 로직 설계
6. 4축 점수화 가중치 고도화

---

## 주의 사항

- **API 키 일시 정지**: 이전 세션의 과부하 테스트로 일부 API 키가 일시 정지되었으나, 24시간 자동 해제되므로 내일 새벽 배치에는 정상 작동 예상
- **빌드 경고**: `baseline-browser-mapping` 관련 경고가 출력되나 기능에 영향 없음 (npm 패키지 내부 deprecation)
- **ESLint 경고**: `.eslintignore` 파일이 ESLint 9에서 더 이상 지원되지 않는다는 경고 → 기능 이슈 아님
- **SIDO_ROTATION은 단일 정의**: `scripts/daily-region-sync.mjs` L107-110에만 존재. 절대 하단에 중복 정의 금지

---

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `scripts/daily-region-sync.mjs` | 17일 주기 지역별 동기화 엔진 (SSOT) |
| `precision_audit_sop_v11.md` | 7점 감사 프레임워크 표준 운영 절차 |
| `docs/smart_camping_plan_manual.md` | 스마트 캠핑 플랜 기술 매뉴얼 |
| `.github/workflows/daily-region-sync.yml` | GitHub Actions 스케줄러 (04:00 KST) |
