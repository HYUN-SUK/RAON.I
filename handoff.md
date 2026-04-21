# RAONAI Session Handoff (2026-04-18)

## 1. 현재 상태 요약
본 세션에서는 **전국 랜드마크 마스터 데이터(Master List v1.7)** 구축 작업을 완료했습니다.
- **데이터 통합**: 블로그(Hub)의 [전국 시군구 8경] 데이터와 공공데이터포털의 [전국관광지정보표준데이터 API]를 병합했습니다.
- **주요 해결 이슈**: 
  - 특정 지자체(예산군, 아산시, 천안시 등)의 데이터가 행정구역 명칭 불일치로 누락되던 문제를 **수동 매핑 테이블(`stdMap`)** 도입으로 해결했습니다.
  - '예당호' 등 명칭 잘림 현상을 보정했습니다.
- **최종 산출물**: `korea_prestige_landmark_master_v1.md` (3,085행, 약 1,500개 이상의 랜드마크 데이터 확보)

## 2. 기술적 결정 사항
- **지자체 표준화 (Normalization)**: 블로그 데이터의 비표준 지역명(예: '예산', '천안')을 API 표준 형식('충청남도 > 예산군', '충청남도 > 천안시')으로 강제 매핑하여 데이터 분산을 방지했습니다.
- **Tier 시스템**: 블로그 8경은 `Tier 2`, API 관광지는 `Tier 3`로 분류하여 향후 인기도 엔진 가산점 차등 적용의 기반을 마련했습니다.
- **UTF-8 명시**: 파워쉘 환경에서의 한글 깨짐 방지를 위해 `fs.writeFileSync` 시 `utf8` 인코딩을 명시했습니다.

## 3. 다음 작업 가이드 (Next Session)
1. **DB 시딩 (Step 2)**: 생성된 마스터 리스트를 Supabase `master_prestige_landmarks` 테이블에 업서트(Upsert)해야 합니다.
2. **명칭 정밀화**: `진안 > 진안시`와 같이 휴리스틱 로직(`getStdKey`)으로 인해 잘못 붙은 접미사('시')를 한 번 더 정제할 필요가 있습니다.
3. **인기도 엔진 이식**: `caching-smart-plan.mjs` 내에서 위 DB를 JOIN 하여 `Point of Interest` 선정 로직에 가산점을 부여하도록 수정해야 합니다.

## 4. 주의 사항
- `scratch/std_data_full.json` 파일이 API 원천 데이터 캐시이므로 삭제하지 않도록 주의하십시오.
- `sync_prestige_landmarks_v7.mjs` 스크립트가 현시점 가장 안정적인 병합 엔진입니다.

---
*Status: Ready for Database Ingestion (Step 2)*
