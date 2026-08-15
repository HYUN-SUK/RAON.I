# 📌 세션 인수인계 문서 (Handoff Document)

**작성 일시**: 2026년 8월 15일 (KST)  
**작성 대상**: 스마트플랜 데이터 무결성 검증, Master DB 전체 메타데이터 동기화 및 2중 자동 청소 파이프라인 완치 보고  

---

## 1. 💡 현재 상태 요약 (이번 세션 완료 사항)

1. **스마트플랜 UI 및 뱃지 렌더링 정제 완치**:
   - `SmartPlanProposal.tsx` 및 `SmartPlanTimelinePro.tsx` 내 거리 뱃지 조건식을 `!!(card.distanceKm && card.distanceKm > 0)`로 안전화하여 **단독 숫자 `"0"` 노출 버그 원천 소멸**.
   - 장소 교체(스와프) 모달 내 추천 점수를 `Score {Math.round(opt.trustScore)}`로 **정수 반올림 정제**.
   - 스와프 모달 대안 장소 카드 뱃지에 메인 카드와 동기화된 이모지 뱃지(`🎖️안심식당`, `🎖️모범음식점`, `🎖️백년가게`) 100% 노출.

2. **2단계 무결성 검증 & 0원 DB 미시적 자동 보수 파이프라인 구축**:
   - [`scripts/caching-smart-plan.mjs`](file:///c:/Users/user/Desktop/RAON.I/scripts/caching-smart-plan.mjs)에 `runPostCachingAuditAndMicroRepair()` 구축.
   - 캐싱 직후 결함 후보 데이터를 0.05초 만에 감지하고, 외부 API 추가 비용 0원으로 `master_places` DB 데이터를 읽어와 0.1초 만에 100% 자가 보정.
   - 강릉바다내음캠핑장의 53개 후보군 데이터에 대해 좌표, 거리, 메타데이터 100% 자가 보정 완치.

3. **Master DB 전체 메타데이터 100% 1:1 동기화 & 인증 뱃지 복원**:
   - 보수 실행 시 `master_places` DB의 원본 `raw_data`(안심식당/모범음식점/백년가게/LX인증 뱃지, 주차, 영업시간, 대표메뉴, 전화번호 등) 및 `api_source`를 1:1로 읽어와 `smart_plan_candidates`에 무결하게 적재.
   - `정동진해물탕` 및 강릉 일정 내 모든 인증 맛집의 **`🎖️안심식당` 이모지 뱃지 100% 복원 완료**.

4. **2중 DB 자동 청소(Auto-Purge) 파이프라인 구축 & 1차 슬림화**:
   - **실시간 청소**: 사용자가 예약을 취소(`status = 'cancelled'`)하면 연동된 54개 후보 행을 **0.05초 만에 즉시 DB 삭제** (`src/actions/schedule.ts`).
   - **일일 배치 청소**: 퇴실 후 7일이 지난 옛날 일정 및 취소 일정 후보 행을 매일 자동 삭제 (`runCandidatesCleanup()`).
   - **1차 슬림화 성과**: DB 레코드 수 **4,808행 ➔ 3,140행으로 1,668행(약 35%) 즉시 일괄 청소 완료**.

5. **빌드 및 타입 무결성 통과**:
   - `npx tsc --noEmit`: 경고 및 타입 에러 0건 (Clean).
   - `npm run build`: 98개 전 페이지 프로덕션 빌드 무결 통과.
   - Git 푸시 완료 ([`9b83280`](https://github.com/HYUN-SUK/RAON.I/commit/9b83280)).

---

## 2. 🛠️ 기술적 결정 사항 (Architectural Decisions)

1. **`master_places` vs `smart_plan_candidates` 데이터 역할 명확화**:
   - **`master_places`**: 전국 130만 개 원본 DB. 특정 캠핑장 위치가 없으므로 `penalty_score`(거리 감점)가 0점이며, 장소 자체 본연의 인기도/위계 점수(`trust_score`)만 유지. 16개 시도 일일 순환 수집 시 수집 갱신됨.
   - **`smart_plan_candidates`**: 사용자의 예약 일정(`user_schedules`)이 100% 확정된 상태에서 캐싱되는 예약건별 후보 DB. 캠핑장 좌표 기준으로 실제 거리를 계산하여 `quality_score - penalty_score = final_score`로 적재.

2. **안심식당 뱃지 2중 안전망 수식 적용**:
   - `api_source === 'LOCALDATA_RESTAURANT_SAFE'` 및 `raw_data.RELAX_SEQ != null` 조건 추가로, 데이터 출처에 관계없이 안심식당 장소에는 `🎖️안심식당` 이모지 뱃지가 100% 렌더링되도록 파서 보완.

---

## 3. 🚀 다음 작업 가이드 (Next Action Items)

1. **스마트플랜 UI/UX 단일 CTA & 상태 안내 배너 최적화**:
   - 출발 당일/D+1 상황에서 안내 배너와 메인 버튼이 동시 노출되는 번잡함 해소.
   - 1개의 명확한 단일 메인 CTA 버튼과 1개의 상태 안내 배너로 통합 설계.
2. **16개 시도 마스터 DB 로테이션 갱신 모니터링**:
   - 새벽 마스터 DB 순환 수집 시 `trust_score` 갱신이 안정적으로 수행되는지 주기적 점검.
3. **스마트플랜 LIVE 타임라인 UI (Phase 1) 착수 준비**.

---

## 4. ⚠️ 주의 사항 & 특이사항

- `smart_plan_candidates` 테이블에는 top-level `api_source` 컬럼이 없으며, `raw_data.api_source` JSONB 속성에 데이터 소스명이 저장됩니다.
- DB 미시적 보수(`runPostCachingAuditAndMicroRepair`)와 자동 청소(`runCandidatesCleanup`)는 새벽 캐싱 배치 완료 직후 자동으로 가동됩니다.
