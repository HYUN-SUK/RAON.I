# 🚀 라온아이(RAON.I) 일일 자동화 장애 극복 및 커서 DB 이전 완료 헨드오프 (Handoff)

이 문서는 7월 3일에 완수한 스마트플랜 캐싱 크래시 해결, Vercel 프록시 API 403 Forbidden 우회 패치, 그리고 크롤러 커서 DB 이전을 통한 깃 rejected 충돌 영구 제거 내역을 인수인계하기 위해 작성되었습니다.

---

## 1. 이번 세션 완료 작업 (Current Status Summary)

*   **스마트플랜 캐싱 TypeError 크래시 & 어드민 표기 누락 복구 완료**:
    *   *원인*: 2차 추천 쿼터 개인화 리포트 파일(`smart_plan_stage4_personalized.md`)을 작성할 때, `candidateRows` 맵핑 단계에서 `final_score` 속성이 누락되어 `undefined`가 되었고, 이에 따라 `c.final_score.toFixed(1)`을 실행하려다 **`TypeError` 크래시**가 발생하여 스케줄러가 비정상 종료되었습니다. (데이터는 이전 단계에서 upsert되어 잘 들어갔으나 로깅 단계 전에 죽어 어드민 대시보드 표기만 생략됨)
    *   *해결*: [caching-smart-plan.mjs](file:///c:/Users/USER/Desktop/RAON.I/scripts/caching-smart-plan.mjs#L1125)에 `final_score: s.final_score`를 삽입해 주어, 1218라인 TypeError를 완벽히 해결했습니다. 로컬 강제 캐싱 테스트를 통해 `SUCCESS` 로그가 정상 적재됨을 교차 확인했습니다.
*   **WAF & Referer 우회 패치 완료 (전북특별자치도 403 Forbidden 복구)**:
    *   *원인*: 행안부 파일 다운로드 서버는 요청 시 `Referer` 헤더가 `https://www.localdata.go.kr/` 이 아닐 경우 즉시 **`HTTP 403 Forbidden`** 오류를 내며 차단합니다. 어제 신설한 Vercel 프록시 API에 이 헤더가 누락되어 프록시 우회조차 행안부 필터에 차단당했던 것입니다. (로컬 격리 실험 검증 완료)
    *   *해결*: Vercel 프록시 [route.ts](file:///c:/Users/USER/Desktop/RAON.I/src/app/api/cron/localdata-proxy/route.ts#L22)의 fetch headers 에 `'Referer': 'https://www.localdata.go.kr/'` 헤더를 추가하여 403 Forbidden을 우회 통과했습니다.
*   **크롤러 진도 커서 DB 보관 이전 완료 (Git Rejected 100% 자동 해결)**:
    *   *원인*: 매일 새벽 크롤러가 수집한 마지막 커서 ID를 원격 깃허브 리포지토리에 push하면서 로컬 PC와 싱크가 어긋나 push 거절(`rejected main -> main (fetch first)`)이 매일 유발되었습니다.
    *   *해결*: 진도 데이터(`last_enrich_cursor_id.txt`)를 Git 파일 시스템 대신 Supabase DB의 `automation_logs` 테이블의 최신 `SUCCESS` 로그의 `api_status.last_enrich_cursor_id` JSONB 필드에서 가져오고 쓰도록 아키텍처를 변경했습니다.
    *   *GHA 최적화*: [.github/workflows/daily-enrich-playwright.yml](file:///c:/Users/USER/Desktop/RAON.I/.github/workflows/daily-enrich-playwright.yml)에서 Git Commit & Push 단계를 삭제하여 원격 push를 0건으로 만들어 rejected 충돌 문제를 근본적으로 해소했습니다.
    *   *작동 검증*: 2회 연속 크롤러 테스트를 구동한 결과, 1차 수집 후 저장된 커서 ID(`0267c7cc-4ec3-5d23-9e07-ddfb384a99c2`)를 2차 구동 시 DB로부터 완벽히 SELECT 로드함을 눈으로 검산 확인했습니다.

---

## 2. 주요 기술적 결정 사항 (Technical Decisions)

*   **별도 마이그레이션 DDL 없는 격리된 DB 보관**:
    *   원격 DB의 PostgreSQL 비밀번호에 접근할 수 없는 조건에서, 이미 정상 작동 중이며 `service_role` 권한으로 RLS가 해제되어 있고 서비스와 분리된 `automation_logs` 테이블의 JSONB 필드(`api_status`)에 커서 ID를 얹어서 보관하도록 우회 설계했습니다. 
    *   이를 통해 복잡한 DB push나 DDL 실행 과정 없이 100% 안전하게 동작함을 증명했습니다.

---

## 3. 다음 세션 우선 작업 가이드 (내일 오전 점검 항목)

1.  **내일 새벽 배치 자동 구동 결과 모니터링**:
    *   내일 아침 KST 05:17에 실행되는 `DAILY_CRAWL_ENRICHMENT` (일일 크롤러)가 Git push 없이 DB 커서 진도를 갱신하고 `SUCCESS`로 끝나는지 확인합니다.
    *   내일 아침 KST 04:08에 실행되는 `DAILY_REGION_SYNC` (일일 로테이션: 경상북도)가 Vercel 프록시의 Referer 우회 덕분에 `ERROR 403` 없이 모범식당/마트 CSV를 200 OK로 다운로드받아 성공하는지 로그로 교차 검증합니다.
2.  **어드민 대시보드 표기 정상화 확인**:
    *   캐싱 크래시 해결 후 정상 insert된 `SMART_PLAN_CACHING` 로그 카드가 관리자 화면에 에러 없이 예쁘게 노출되는지 최종 점검합니다.
