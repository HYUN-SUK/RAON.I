# 구현 계획서 (2026-02-14 세션) - 최종 확정안

## [목표 요약]
**캠핑 아지트 (Phase 12)**의 비용 효율성을 극대화하기 위해, 대표님이 제안하신 **'중앙 집필 캐싱(Pre-fetching) 및 하이브리드 전략'**을 적용합니다. 이와 함께 감성적 경험을 위한 콘텐츠(메뉴/알림)와 기록 보관함(내 수첩) 고도화를 진행합니다.

## 사용자 검토 필요 사항
> [!IMPORTANT]
> **하이브리드 캐싱 전략 (API 비용 0원 도전)**
> 1. **관광 (Tourism)**: **'전국 데이터 프리패칭(Pre-fetching)'**
>    - 매일 새벽(또는 1시간마다) 전국 축제 정보를 **단 1회 호출**로 가져와 우리 DB(`nearby_cache`)에 저장합니다.
>    - 유저는 외부 API 호출 없이 오직 DB에서 데이터를 조회합니다. (트래픽 0)
> 2. **날씨 (Weather)**: **'수요 기반 캐싱(On-demand Caching)'**
>    - 유저가 방문한 캠핑장의 좌표만 DB(`weather_cache`)에 저장하고, **1시간 TTL(유효기간)**을 둡니다.
>    - 유효기간 내에는 DB 데이터를 사용하여 API 호출을 0으로 만듭니다.

## 변경 예정 사항

### 🏗️ Phase 12.2.5: 인프라 최적화 (하이브리드 캐싱)
#### [NEW] [20260214_hybrid_caching.sql](file:///c:/Users/USER/Desktop/RAON.I/supabase/migrations/20260214_hybrid_caching.sql)
- `nearby_cache` 테이블 생성 (JSONB data, region_code/date 복합 키).
- `weather_cache` 테이블 최적화 (lat/lng 소수점 2자리 반올림 인덱스).

#### [MODIFY] [nearby-events/route.ts](file:///c:/Users/USER/Desktop/RAON.I/src/app/api/nearby-events/route.ts)
- **로직 변경**: DB(`nearby_cache`) 우선 조회.
- **백그라운드 갱신**: 데이터 부재 시, 전국 데이터 Fetch 후 DB 저장 로직 (Edge Function 타임아웃 고려하여 지역별 분할 Fetch 가능성 열어둠).

#### [MODIFY] [weather/route.ts](file:///c:/Users/USER/Desktop/RAON.I/src/app/api/weather/route.ts)
- **Lazy Caching**: 요청 좌표 반올림(약 1km) -> DB 조회 -> (없으면/만료되면) API 호출 -> DB 갱신.

### 🍱 Phase 12.3: 감성 콘텐츠 (로직)
#### [NEW] [meal-recommendation.ts](file:///c:/Users/USER/Desktop/RAON.I/src/lib/meal-recommendation.ts)
- `getMealRecommendation(날씨, 인원, 관계)` 함수 구현.
- AI 없이 규칙 기반(Rule-based)으로 "따뜻한 국물", "간단한 핑거푸드" 등 상황별 메뉴 추천.

#### [MODIFY] [camping-reminder/index.ts](file:///c:/Users/USER/Desktop/RAON.I/supabase/functions/camping-reminder/index.ts)
- 알림 메시지를 **"다정하고 인간적인 말투"**로 전면 수정.
- 기상청 데이터 기반 문구 생성 로직(L0) 강화.

### 📚 Phase 12.4: 복합 편집 (내 수첩)
#### [NEW] [Seasonal View (계절별 보기)](file:///c:/Users/USER/Desktop/RAON.I/src/app/(mobile)/myspace/records/seasonal/page.tsx)
- 봄(3-5월)/여름(6-8월)/가을(9-11월)/겨울(12-2월) 탭 UI.
- 기존 기록(`camping_records`)을 날짜 기반으로 자동 분류 표시.

#### [NEW] [Timeline View (타임라인 보기)](file:///c:/Users/USER/Desktop/RAON.I/src/app/(mobile)/myspace/records/timeline/page.tsx)
- 수직형 타임라인 UI (최신순).
- 캠핑의 흐름을 보여주는 연결선(Path) 디자인 적용.

## 검증 계획

### 수동 검증 (라이브 브라우저)
1.  **관광 캐싱**: `nearby-events` 호출 시 DB에서 전국 데이터(예: 축제 리스트)가 로드되는지 확인.
2.  **날씨 캐싱**: 동일 좌표 재호출 시 API 요청 없이 DB 데이터가 반환되는지 확인 (속도 비교).
3.  **메뉴/알림**: 추천 결과 및 알림 문구가 "따뜻한 톤앤매너"인지 확인.
4.  **복합 뷰**: 내 수첩에서 계절별/타임라인 탭 전환 및 데이터 표시 확인.
