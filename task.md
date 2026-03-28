# Task Checklist: v11.0 Smart Camping Plan Pipeline Restoration

- [x] **RPC Function 정밀 수술 (Critical Infrastructure)**
    - [x] `p_category` 패치를 통한 매뉴얼 v11.0 규격 동기화
    - [x] DB 내 중복(Ghost) RPC 함수 전량 제거 (`DROP FUNCTION ... CASCADE`)
    - [x] `NUMERIC` 타입 기반 단일 표준 함수 재정의
- [x] **Pipeline Code Sync**
    - [x] `scripts/caching-smart-plan.mjs` RPC 호출부 수지 (Casting `Number()`, `p_category`)
    - [x] 로컬 SQL 마이그레이션 파일(`supabase/20260308...`) 동기화
- [x] **Precision Audit (D-3 Caching Phase 2)**
    - [x] 3/31 예산군 타겟 정밀 감사 수행
    - [x] **Quota 300** 확장 정상 작동 실측 (RESTAURANT 286개 수집 성공)
    - [x] 최종 적재 리스트(`spot_final_audit.md`) 생성 및 검증
- [x] **Standardization & Automation Patch**
    - [x] **[SOP 수립]** `precision_audit_sop_v11.md` 작성 및 배포
    - [x] **[스케줄 패치]** 내일 새벽(3/29) 일요일 04:00 AM(주간), 06:00 AM(D-3) 자동 실행 설정
- [ ] **Next Session: Post-Execution Audit**
    - [ ] 3/29 새벽 자동화 실행 로그(`automation_logs`) 및 지표 대조
    - [ ] 문제 없을 시 4축 점수화(Personalization Score) 고도화 진입
