# RAON.I Session Handoff

## 1. 현재 세션 요약 (Completed)
- **스마트 캠핑 플랜 UI 연동 및 AI 프롬프트 완성**:
  - `myspace/schedule/[id]/page.tsx`에 '이번 캠핑계획 자동 완성하기' 버튼을 일정 정보 바로 밑으로 이동(Gap 1).
  - `SmartPlanProposal.tsx` 컴포넌트 시그니처 수정: `date` 단일 속성을 `startDate`, `endDate` 전체 일정으로 받아오도록 업데이트함.
  - `generateSmartPlan` (in `smartPlan.ts`) 로직 업데이트: 
    - AI 모델을 2026년 최신/저가 표준인 **`gemini-2.5-flash-lite`**로 전격 교체 완료 (비용 최적화 100만 입력 토큰당 $0.10).
    - 프롬프트 페르소나를 '20년차 전문 스마트 캠핑 플래너'로 강화하고, 날씨 및 일정 등의 컨텍스트 주입 완료.
    - AI 서사 내부에 `||팩트ID|장소이름||` 형식의 특수 태그를 생성하도록 지시하고, 컴포넌트 측에서 이를 파싱하여 클릭 가능한 버튼(바텀 시트 팝업 스왑 트리거)으로 렌더링하도록 뷰 연동 완료.

- **Phase 5 데이터 인프라스트럭처 (ETL) 설계 착수**:
  - 무거운 공공데이터(병원, 마트, 관광지, 식당 등) 외부 API 호출로 인한 속도 저하 및 CORS 방지를 위한 **Supabase DB 캐싱(ETL) 구조**로 로드맵 수립 완료. (자세한 내용은 `implementation_plan.md` 참조)

## 2. 다음 세션 진입 시 목표 (Next Steps)
- **[Phase 5] DB 캐싱 및 ETL 파이프라인 구축 시작**:
  1. Supabase SQL Migration: 캠핑장 주변 시설 정보를 담아둘 `smart_plan_facts` 테이블 및 반경 검색(PostGIS) 함수 스키마 작성.
  2. Edge Functions (또는 Vercel Cron): 국립의료원, 백년가게 등 주요 API를 주기적으로 당겨와(Extract) 정제해서(Transform) DB에 꽂아넣는(Load) 크론 스크립트 작성.
  3. `smartPlan.ts` 함수 교체: 15개의 Mock Data 대신, 구축된 Supabase RPC를 호출해 실제 반경 내 튜닝된 팩트들을 가져오도록 변경.
- **최종 E2E 테스트**: `.env.local`에 실제 Gemini 키를 넣고 앱 상에서 AI의 다이나믹 텍스트 교체가 완벽한지 최종 터치 테스트 진행.

## 3. 남은 이슈 / 주의점 (Caveats)
- 현재 `smartPlan.ts`의 `fetchHighTrustCandidates` 함수는 **고정된 Mock Data**를 뱉어내고 있습니다. UI 프레임과 인터랙션을 테스트하기 위한 것이며, DB 테이블이 구축되는 즉시 제거되어야 합니다.
- **API 비용 및 쿼터 정보**:
  - `gemini-2.5-flash-lite`는 무료 티어 기준 하루 1,000건, 분당 15건 사용 가능합니다. 상용화 트래픽 상승 시 반드시 Pay-as-you-go(유료 결제) 연결 필요.
- 안심식당 등 일부 공공 API는 호출 서버 IP를 당국에 사전 등록해야 하는 제약이 있습니다. 배포 시 해결책 논의 필요.

---
**다음 AI 어시스턴트에게:**
`task.md`의 **Phase 5** 항목부터 읽어보고 Supabase SQL 스키마 제안(PostGIS 활성화 필수)부터 시작하십시오.
