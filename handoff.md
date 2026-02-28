# Session Handoff Document (Session v10 -> v11)

**작성일**: 2026-02-27
**목적**: 스마트 캠핑 플랜(Guided Journey) 엔진 감사를 완료하고, 대규모 수정 세션을 앞두고 안전하게 인수인계하기 위함.

---

## 📌 현재 상태 요약 (What We Did)
이번 세션에서는 `smart_camping_plan_manual.md`에 명시된 15-Fact 추출 기반 머신러닝/규칙 기반 복합 추천 엔진의 현재 구현 상태를 **다른 AI와의 Cross-Checking을 포함하여 완전히 전수 감사(Audit) 완료**했습니다.

1. **감사 완료**: 
   - `smartPlan.ts`, `route.ts`, `weather.ts`, `persona.ts`, `SmartPlanProposal.tsx` 5종의 코드와 매뉴얼 대조.
   - 이전/현재 AI의 통합 점검 보고서(`audit_report_step1.md`, `audit_report_independent.md`) 두 건 발행.
2. **코드 클린업**: 
   - 불필요한 콘솔 로그 제거 (`SmartPlanProposal.tsx:55`).
3. **태스크 및 로드맵 업데이트**:
   - `task.md` 및 `RAON_MASTER_ROADMAP_v3.md`에 새롭게 도출된 파이프라인 수술 3-Phase Plan 반영 완료.

---

## 🛠 주요 구조적 결함 및 기술적 결정 (Technical Decisions)
감사 결과, 현재 코드는 기본 ETL 뼈대와 AI 내러티브 생성은 잘 되어 있으나 **데이터의 질 및 동적 가중치 알고리즘**이 모두 누락되거나 Mock 처리된 상태입니다. 

1. **Mock 날씨 문제 (`weather.ts`)**: 실제 기상청 연동 코드가 없이 무조건 맑음/15도를 반환하도록 Mocking 되어 있어 매뉴얼의 모든 날씨 로직(등유, 비오는날 메뉴 등)이 무력화됨.
2. **페르소나 헛스윙 (`persona.ts` -> `smartPlan.ts`)**: 사용자 취향 태그를 잘 추출해오고도, 실제 카드 랭킹 점수(trustScore) 계산에는 안 쓰고 AI 프롬프트에 텍스트로만 밀어넣고 있음.
3. **ETL 불일치 (`route.ts`)**: 매뉴얼상 `SPOT`(관광지) 카테고리가 존재해야 하나 TourAPI에서 축제(`FESTIVAL`)만 끌어오고 있음. 전국 축제가 위치 필터 없이 들어오는 중.

*결정 사항*: 한 번에 모든 것을 고치다 깨질 위험이 크므로, 다음 세션에서 **3단계(Phase 1~3)**로 분리하여 점진적 주입(Incremental Injection) 방식으로 수술을 진행하기로 결정됨.

---

## 🚀 다음 세션 작업 가이드 (Next Steps)
다음 AI 세션이 시작되면, 아래 가이드에 따라 가장 시급한 코어 기반 공사부터 시작해야 합니다:

1. **Phase 1 (Mock 제거 및 파이프라인 보강)**:
   - `weather.ts`의 Mock을 제거하고, 기상청 단기/중기 예보 API 구현 로직 복원 (없다면 Open-Meteo 등 대체).
   - `route.ts`에 TourAPI의 12(관광지) 카테고리 호출 블록을 신설하여 `SPOT` 파이프라인 추가 (예산 지역코드 필수 적용).
2. **Phase 2 (페르소나 점수 연동)**:
   - `smartPlan.ts`의 `fetchHighTrustCandidates()` 부분 또는 내부 정렬 로직에서 `context.guestDetails` (아이 동반) 및 `context.topTags` 배열을 순회하며 메타데이터 필드와 일치하면 `trustScore`를 런타임에 +10~+50 증가시키는 알고리즘 작성.
3. **Phase 3 (날씨 연동 고도화)**:
   - 날씨 결과에 따라 특정 식당(국물류) 및 등유(5도 이하)를 조건부로 점수 부스팅하는 로직 완성.

---

## ⚠️ 주의 사항 (Warnings & Quirks)
- 현재 Vercel의 Vercel Edge/Serverless Timeout 이슈 방지를 위해 `route.ts`의 Cron 런타임이 한정되어 있습니다 (`maxDuration = 300`). API 연동부를 quá 콜라보레이션 하지 않도록 성능에 유의하세요.
- `smartPlan.ts` 상의 Gemini 직접 호출(`fetch`)은 SDK 충돌 회피를 위한 것으로 절대 SDK 래퍼로 롤백하지 마십시오.
- 파일 경로 이동을 자제하고 현재 디렉토리 구조(`c:\Users\USER\Desktop\RAON.I\src\lib\` 등)를 준수하세요.
