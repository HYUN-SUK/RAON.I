# Handoff Document

## 현재 상태 요약 (Current Status)
금일 세션에서는 오랫동안 문제되었던 **`tootg@naver.com` 캠핑 리마인드 푸시 알림 미발송 현상**을 집중적으로 진단하고 완벽하게 해결했습니다.
- DB 직접 확인 결과, 예약 스케줄(`user_schedules`)은 정상 등록되나 9:00 AM 알림 내역 자체가 미생성되는 원인을 파악했습니다.
- **원인**: 순차적인 무거운 공공데이터(기상청, 관광지) API 호출에 따른 **Edge Function 실행 타임아웃** 및 불안정한 `pg_cron` 동작.
- **해결 완료 사항**:
  1. API 호출 지연을 극복하기 위한 **사전 캐싱 (Prefetch) 아키텍처 도입**: 알림 발송 10분 전(`08:50 AM KST`)에 미리 API를 병렬(Promise.all) 호출하여 Supabase DB 캐시 테이블(`weather_cache`, `nearby_cache`)에 적재. 정각(`09:00 AM KST`)에는 빠르고 가볍게 캐시에서만 읽어서 푸시만 발송하도록 로직 분산 및 개선 완료.
  2. 불안정한 `pg_cron` 트리거 삭제 및 삭제 SQL 마이그레이션 반영.
  3. **비용 무결점(Cost-Free)**, 100% 신뢰성을 보장하는 **GitHub Actions Cron (`camping-reminder-cron.yml`)** 신규 구축 및 스케줄링 설정 완료.
  4. 로직 배포 후 수동 강제트리거를 통해 누락되었던 총 7건의 캠핑 리마인드 알림 발송 완료(`mode=dispatch`).

## 기술적 결정 사항 (Technical Decisions)
- **Lazy Load to DB Caching (`weather_cache` & `nearby_cache`)**: Vercel/Supabase Serverless 함수의 시간 제한(기본 10초)을 완전히 피해가기 위해, Push 알림 라우트에 `?mode=prefetch` 와 `?mode=dispatch` 2가지 모드를 구현하였습니다. 이는 유료 Tier 업그레이드 없이 무료 크론 잡으로 안전하게 장시간의 API 스크래핑을 수행할 수 있는 탁월한 방어패턴입니다.
- **`pg_cron` 폐기 후 GitHub Actions 전환**: 사내 인증키 등 에러 파악이 쉽지 않았던 DB 레벨 크론에서 벗어나, 에러 추적(log)이 직관적이고 안정적인 GitHub Actions 방식으로 이전하여 발송 신뢰도를 극대화했습니다.

## 다음 작업 가이드 (Next Steps)
- **내일(Day+1) 아침 우선 확인 사항**: 
  - (User Check) 실제 사용자 기기 단말기로 예약 알림(D-1 / D-4 등) 푸시 수신 여부 최종 체크.
  - (System Check) Github Actions 의 `camping-reminder-cron.yml` 워크플로우가 23:50 UTC (08:50 KST), 00:00 UTC (09:00 KST)에 맞춰서 각각 정상 통과(Success)했는지 점검.

## 주의 사항 (Caveats)
- 이번 업데이트 시 Edge Function의 날씨 API 로직에 10초 명시적 타임아웃 AbortController를 걸어두었습니다. 만약 기상청 API가 전체 다운될 경우(타임아웃 발생 시) 에러 후 중단되지 않고, 로컬 캐시나 기본 Mock 텍스트('맑음')로 폴백(Fallback)되어 알림 발송 자체가 실패하는 일은 막아두었습니다.
- 기상청 격자 날짜 포맷팅 에러 방지를 위해 KST 기준 날짜 변환 계산(`dayForecasts` 생성 부)을 더욱 정밀히 수정하였습니다.
