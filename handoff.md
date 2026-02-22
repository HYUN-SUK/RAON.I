# Handoff Document

## 현재 상태 요약 (Current Status)
금일 세션에서는 최우선 과제인 **"스마트 캠핑 플랜 (Guided Journey)"** 기능의 핵심 아키텍처 및 데이터 파이프라인 설계를 완벽하게 마무리지었습니다. 
단순한 프롬프트 엔지니어링을 넘어, 장기적인 데이터 비즈니스(B2B/MCP)로 확장될 수 있는 **'비용 제로 + 고품질 데이터 추출(Zero-Cost High-Fidelity)'** 전략과 **'하이브리드 캐싱'** 모델을 확립했습니다.

설계된 모든 철학, 시나리오, 5대 신뢰 지표 추출 로직은 단일 진실 공급원(SSOT) 문서로 영구 승격되었습니다.

## 핵심 산출물 (Core Deliverable)
- **`docs/smart_camping_plan_manual.md` 생성 완료**
  - 이 문서는 향후 스마트 캠핑 플랜 기능 구현을 위한 유일한 기준점(SSOT)입니다.
  - 다음 세션이나 다른 작업자가 개발에 착수하기 전, 반드시 이 매뉴얼을 최우선으로 숙지(Context Loading)해야 합니다.

## 기술적 결정 사항 (Technical Decisions)
1. **Headless Engine**: 추천 로직(`smartPlan.ts`)을 UI 영역과 완벽히 분리하여 미래의 MCP/B2B 스펙에 대비.
2. **Hybrid Caching**: 종속적인 외부 API(카카오 등)의 순수 데이터를 그대로 캐싱하는 대신, 공공데이터와 결합한 2차 가공 지표(`라온 신뢰도 지수`)로 변환 후 DB에 저장하여 비용 방어 및 자산화 도모.
3. **Circular Curated Pool**: 무자본으로 정교하게 필터링된 15개의 최상위 팩트 풀에서 3~5개를 랜덤 순환 노출시켜, 단 1회의 LLM 호출(비용 최적화)만으로도 매번 신선한 감성 서사를 생성.

## 다음 작업 가이드 (Next Steps)
- **실제 구현(Execution) 착수**:
  - `docs/smart_camping_plan_manual.md`을 기반으로 `reservation.ts` 타입 확장 및 `persona.ts` (페르소나 추출 로직) 작성 시작.
  - 외부 API 연동을 위한 캐시 테이블 `cached_facilities.sql` DDL 작성 및 Supabase 적용.
  - `smartPlan.ts` 엔진 코어 스켈레톤 구축.
