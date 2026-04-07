# RAONAI v11.0 스마트 캠핑 플랜 정밀 감사 표준 SOP 템플릿

본 문서는 세션 간 데이터 정합성 혼선을 방지하고, 모든 AI 어시스턴트가 사용자에게 일관된 감사 결과를 보고하기 위한 **표준 점검 가이드**입니다.

---

## 🛡️ 핵심 점검 원칙 (Core Principles)

> [!IMPORTANT]
> **실질적 작동 중심 (No Workarounds)**:
> 모든 점검은 **주간 배치(Weekly Master Sync)**와 **D-3 캐싱(1부/2부)** 파이프라인이 실제 원본 코드대로 원활하게 작동하는지 확인하는 것에 핵심을 둡니다. 데이터 수집이 어렵거나 오류가 발생한다고 해서 임의로 데이터를 수동 주입하거나 **상황에 따른 우회 방법(Workaround)을 선택하지 마십시오.** 원인을 파악하여 시스템 자체를 복구하는 것이 본 SOP의 철저한 준수 방향입니다.

---

## 🛡️ 점검 오류 재발 방지 가이드 (Audit Reliability Guide)

AI 어시스턴트는 세션 시작 시 다음 **4대 원칙**을 반드시 준수하여 데이터 오판을 방지해야 합니다.

1. **상시 전수 조사 (Exact Count Check)**:
   - Supabase 클라이언트의 `.select()`는 기본 1,000건 제한이 있습니다.
   - 대규모 테이블(master_places 등) 조회 시 반드시 `{ count: 'exact', head: true }` 옵션을 사용하거나 개별 카운트 쿼리를 실행하여 실제 전체 건수를 먼저 파악하십시오.
   
2. **시간 필터링 주의 (Timezone Awareness)**:
   - "오늘" 또는 "새벽"이라는 표현은 KST(UTC+9) 기준임을 명심하십시오.
   - 배치 실행 로그(`.automation_logs`)의 `created_at` 시간을 확인하여 필터링 범위를 정확히 설정하십시오. (예: 3/31 새벽 배치는 3/30 19:00 UTC 이후 로그 확인)

3. **명칭 불일치 및 규격 가변성 검증 (Schema Drift Awareness)**:
   - 데이터가 0건으로 보일 경우, 삭제된 것이 아니라 `api_source` 명칭이나 **외부 API 응답 키값(Key)**이 변경되었을 가능성을 조사하십시오.
   - **실전 쿼리 (Key 변경 감지)**:
     ```sql
     -- 특정 필드(예: BSNSSP_NM)가 존재하지만 매핑되지 않은 데이터가 있는지 확인
     SELECT count(*) FROM master_places WHERE raw_data->>'BSNSSP_NM' IS NOT NULL AND api_source = 'LOCALDATA_RESTAURANT_GOOD';
     ```
   - `SELECT DISTINCT api_source` 쿼리를 통해 현재 DB에 저장된 실제 소스명을 대조하십시오.

4. **표준 감사 도구 활용 (Standardized Tooling)**:
   - 매번 일회성 코드를 작성하지 말고, 다음 표준 도구를 실행하여 일관된 지표를 도출하십시오.
   - **일일 지역 로테이션 감사 (Daily Sync)**: `node scripts/daily-region-sync.mjs` (CSV 및 API 즉석 순환 검증용)
   - **D-3 캐싱 감사**: `node scripts/audit-caching-standard.mjs` (v11.9.2 정밀 감사 지표 도출)

---

## 📅 1. 일일 지역 로테이션 (Daily Region Sync) 정밀 점검
 
 **목적**: 전국 17개 시도를 순환하며 정적 데이터(식당, 마트, 명소)의 최신성 및 활성 상태(`is_active`)를 매순간 점검.
 
 ### 7대 핵심 지표 점검 (Daily Rotation Audit)
 `node scripts/daily-region-sync.mjs` 스크립트를 직접 구동하거나 관리자 서버 구동 후 다음 양식에 맞춰 지표가 도출되었는지 검사해야 합니다:
 
 | 갱신 지역 | 카테고리 (세부 소스) | 기존 데이터 수 | 원천 수신 수 | 신규 삽입(New) | 변경 갱신(Upd) | 최종 총계 | 비고 |
 | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
 | (예: 충청남도) | RESTAURANT (안심식당) | | | | | | MAFRA API |
 | | RESTAURANT (모범음식점) | | | | | | LocalData CSV |
 | | RESTAURANT (백년가게) | | | | | | ODCloud API |
 | | MART (대형마트) | | | | | | LocalData CSV |
 | | MART (준대규모점포 - SSM) | | | | | | 대규모 데이터셋 내 식별 |
 | | MART (기타식품판매업) | | | | | | LocalData CSV |
 | | SPOT (관광명소) | | | | | | TourAPI v2 |
 
 ### 🛠️ 상시 운영 표준 감사 SQL
 관리자 페이지 장애 시 다음 쿼리로 지표를 확인하십시오.
 
 ```sql
 -- 1. 최근 지역 순환 로그 및 7대 지표 확인
 SELECT created_at, message, api_status 
 FROM automation_logs 
 WHERE job_name = 'DAILY_REGION_SYNC' 
 ORDER BY created_at DESC LIMIT 1;
 ```

---

## 🎯 2. D-3 캐싱 1부 (Cluster & Raw Extraction) 점검

**목적**: 사용자의 예약 지역을 타겟팅하여 동적 데이터(병원, 주유소, 축제)가 최신 API 원천에서 수집되었는지 확인.

### API별 지표 대조 (Dynamic Data)

| 카테고리 | 기존 데이터 수 | API 수신 수 | 신규 삽입(New) | 변경 갱신(Upd) | 최종 총계 | 비고 |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **HOSPITAL** | | | | | | |
| **GAS_STATION** | | | | | | |
| **FESTIVAL** | | | | | | |

### 🛠️ D-3 캐싱 표준 감사 SQL (Standard Audit SQL)
동적 캐싱 데이터의 무결성을 다음 쿼리로 검증하십시오.

```sql
-- 1. 타겟 날짜(D-3) 기반 캐싱 데이터 추출 현황
-- job_name = 'SMART_PLAN_CACHING' 로그 확인
SELECT * 
FROM automation_logs 
WHERE job_name = 'SMART_PLAN_CACHING' 
ORDER BY created_at DESC LIMIT 3;

-- 2. 특정 예약 지역(Cluster)별 데이터 분포 확인
SELECT category, count(*) 
FROM smart_plan_facts 
GROUP BY category;

-- 3. 주유소(GAS_STATION) 주소 보정(Geocoding) 실패 사례 확인
-- 주소가 누락된 데이터가 있는지 점검
SELECT name, address, lat, lng 
FROM master_places 
WHERE category = 'GAS_STATION' AND (address IS NULL OR address = '');
```
| | `KAKAO_HP8` (종합병원) | | | | | | |

### 클러스터링 지표 (Template)
- **타겟 예약 수**: (예: 3/31 타겟 예약 건수)
- **지리적 클러스터 수**: (예: 예산군 연합 1개 노드)
- **마스터 DB 원시 로드(Raw Pool)**: 권역 내 텍스트 검색(`address LIKE '%OO%'`) 결과 수.

---

## 🔍 3. D-3 캐싱 2부 (Quota & Verification) 점밀 점검

**목적**: 1차 선별(Quota 300)과 카카오 정밀 검증을 거쳐 최종 `smart_plan_facts`에 고품질 데이터가 적재되었는지 확인.

### 점검 지표 (Simulation Result)
신규 AI 어시스턴트는 다음 표준 도구를 실행하여 즉시 통계 지표를 도출하십시오.
*   **실행 명령어**: `node scripts/audit-caching-standard.mjs`

| 카테고리 | 1번 쿼터 (Raw) | 2번 쿼터 (Top 300) | 카카오 정밀검증 | 최종 적재 | 비고 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| RESTAURANT | | | | | 1차 1000개 추출 대조 |
| SPOT | | | | | 1차 500개 추출 대조 |
| MART | | | | | 1차 100개/최종 20개
| HOSPITAL | | | | | 1차 100개/최종 15개 |
| GAS_STATION | | | | | 1차 100개/최종 10개 |
| FESTIVAL | | | | | 1차 100개/최종 15개 |

### 시뮬레이션 리포트 양식 (Simulation Report)
| 단계 | 데이터 수 | 검증 성공률 | 오류 코드 | 조치 사항 |
| :--- | :---: | :---: | :---: | :--- |
| 1차 쿼터 | | | | |
| 2차 쿼터 | | | | |
| 최종 적재 | | | | |

> [!WARNING]
> **RPC 호출 주의**: 파라미터명은 반드시 **`p_category`**를 사용하며, 좌표/반경 데이터는 **`NUMERIC`** 타입으로 전달해야 에러를 방지할 수 있습니다. (Postgres Overloading 방어)

---

## 📄 4. 보고서 양식 (Standard Report)
 
 모든 리스트 출력 요청 시 반드시 다음 경로에 **1차 선별 로직을 통과한 1차 쿼터(Raw) 적용 리스트 전체**를 생성합니다.
 *   **파일 경로**: `C:\Users\USER\Desktop\RAON.I\spot_final_audit.md`
 *   **포함 항목**: `[번호], [카테고리], [이름], [신뢰점수], [주소], [거리(m)]`
 
 ---
*Last Updated: 2026-04-02 (v11.9.2 Precision Audit SOP)*
