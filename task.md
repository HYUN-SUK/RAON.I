# Task Management

## Current Task: 일일지역로테이션 관광명소(SPOT) 및 병원(HOSPITAL) 수신 카운터 및 3대 메트릭 집계 정상화 완결
- [x] `scripts/daily-region-sync.mjs`: `syncTourSpots` 및 `syncHospitals`에서 API 목록 수신 즉시 `stat.fetched.active` 가산 및 3대 지표(`modified/rolling/cached`) 집계 스코프 정규화
- [x] 대구광역시 재실행 검증: 관광명소(SPOT) 195건, 병원(HOSPITAL) 21건 실시간 정상 수신 및 DB 로그 반영 확인
- [x] Next.js 16 Production Build 무결성 검증 (103/103 라우트 100% 통과)