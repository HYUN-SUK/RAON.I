# RAONAI v11.0 스마트 캠핑 플랜 정밀 감사 표준 지침 (SOP)

본 문서는 세션 간 데이터 필터링 방식의 혼선을 방지하고, 쿼터(Quota 300) 확장 등 주요 로직의 무결성을 검증하기 위한 **공식 감사 프로토콜**입니다. 차후 모든 세션에서는 이 절차를 따라 점검을 수행합니다.

---

## 1. 감사 대상 및 환경 (Target Environment)

*   **마스터 DB**: `master_places` 테이블 (전국 14.1만 건)
*   **1차 선별 RPC**: `public.get_master_places_in_radius` (Signatures 필독)
*   **스마트플랜 DB**: `smart_plan_facts` 테이블 (최종 적재처)
*   **핵심 좌표 기준**: 예약 타겟의 `campground_lat/lng` (NULL 여부 반드시 확인)

---

## 2. 단계별 정밀 감사 절차 (Audit Levels)

### Level 1: 마스터 데이터 풀(Pool) 존재 여부 검증
특정 권역(예: 예산군)의 데이터를 불러오기 전, 원천 데이터가 존재하는지 먼저 확인합니다.
```sql
-- 예산군 권역 텍스트 기반 샘플링 Check
SELECT name, category, address, lat, lng, trust_score 
FROM public.master_places 
WHERE address LIKE '%예산군%' 
ORDER BY trust_score DESC 
LIMIT 10;
```
> [!IMPORTANT]
> **카테고리 매칭 주의**: 마스터 DB 내부 명칭은 **'RESTAURANT', 'SPOT', 'MART'** 등 영어 대문자가 기본입니다. 싱크 스크립트에 따라 '음식점' 등 한국어가 혼재될 수 있으므로 전수 조사가 필요합니다.

### Level 2: 1차 선별(Quota 300) 추출 무결성 검증
`get_master_places_in_radius` RPC를 호출할 때의 파라미터 규격을 준수해야 합니다.
*   **함수 명세**: `target_lat`, `target_lng`, `radius_meters`, `target_category`, `limit_count` 순서 권장.
*   **파라미터명**: 반드시 **`target_category`** (p_category 아님)를 사용해야 에러가 발생하지 않습니다.

```javascript
// Node.js 검증 스니펫
const { data, error } = await supabase.rpc('get_master_places_in_radius', {
  target_lat: 36.6269,
  target_lng: 126.7647,
  radius_meters: 30000,
  target_category: 'RESTAURANT',
  limit_count: 300
});
```

### Level 3: 최종 적재 및 카카오 검증 생존율 확인
`smart_plan_facts` 테이블에 적재된 최종 데이터와 1차 후보군 수치를 대조합니다.
*   **생존 수식**: `최종 적재 수 / 1차 선별 수 (최대 300)`
*   **누락 원인**: 카카오 맵 별점 부재, 주소 불명확, 중복 데이터 제거 등.

---

## 3. 세션 재개 시 체크리스트 (Checkpoint)

1.  `handoff.md`에서 **현재 DB 스키마/RPC 명칭** 변경 사항이 있는지 확인하였는가?
2.  사용자 예약(`user_schedules`)의 **좌표가 정상(Non-null)**으로 입력되어 있는가?
3.  마스터 동기화(`MASTER_SYNC`)가 최신 상태이며, **Category 컬럼 값의 특징**(영어/한국어)은 무엇인가?
4.  보고 시 **'1차 후보군 수'**와 **'최종 적재 수'**를 명확히 분리하여 보고하였는가?

---
*Last Updated: 2026-03-28 (v11.0 Precision Audit Protocol)*
