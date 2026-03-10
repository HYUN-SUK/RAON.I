Smart Camping Plan v2 설계 문서
원시데이터 → 정제 → 점수화 → AI 전달 → 사용자 출력 고도화 사양
목적

원시데이터를 단순 수집하는 수준을 넘어, 충분한 근거와 로직으로 정제된 정보만 AI에 전달하고, 그 결과를 사용자에게는 신뢰도 높은 간단·명료·감성적인 캠핑 여정 계획으로 보여주기 위한 구현 기준을 정의한다.

0. 이 문서의 핵심 원칙
0.1 한 줄 원칙

AI는 선택자가 아니라 해설자다.
후보 선별과 검증은 백엔드 엔진이 하고, AI는 그 근거를 바탕으로 사용자에게 이해하기 쉬운 여정 서사를 작성한다.

0.2 v2의 목표

기존 구조의 장점은 유지하면서 아래 4가지를 강화한다.

신뢰도 분리

“공공기관 인증이라 믿을 만하다”

“실시간 검증이 되어 최근 상태도 괜찮다”

“이번 사용자/날씨/일정에 잘 맞는다”

“실제로 들르기 편하다”

이 4개를 섞지 않고 분리해서 판단한다.

Fail-soft 구조

실시간 검증 실패 시 전체 추천이 멈추지 않게 한다.

최신 날씨/평점이 없어도 기본 추천은 계속 제공한다.

근거 기반 AI 전달

AI에는 장소 리스트가 아니라 선정 이유 + 근거 + 리스크 를 함께 전달한다.

사용자 출력 단순화

사용자에게는 복잡한 데이터가 아니라
짧은 감성 서사 + 근거가 보이는 카드형 추천 으로 보여준다.

0.3 기존 SSOT와의 관계

이 문서는 기존 Smart Camping Plan Manual의 다음 내용을 보강/구체화 한다.

8-Step Pipeline 유지

9 카테고리 유지

Phase 11/12 하이브리드 구조 유지

D-3 캐시 구조 유지

단, 아래 사항은 v2에서 보강된다.

trust_score 단일 의존 구조 → 다층 점수 구조

Midpoint 단일 지점 → 경로 다중 앵커 기반

실시간 검증 결과 → evidence trail 저장

AI 입력 → 후보 리스트 중심이 아닌 근거 패키지 중심

0.4 v2 엔진의 최종 산출물

엔진은 최종적으로 아래 두 가지를 만든다.

A. AI 전달용 패키지

LLM이 감성 서사를 안전하게 생성할 수 있도록 만든 구조화 JSON

B. 프론트 출력용 패키지

프론트가 카드 UI를 안정적으로 렌더링할 수 있도록 만든 구조화 JSON

즉, v2 엔진은 하나의 추천 결과를 아래 2개 형태로 동시에 만든다.

ai_plan_package

frontend_plan_package

0.5 핵심 데이터 객체 정의

구현 시 아래 개념을 분리해서 다루는 것을 권장한다.

1) RawPlace

원시 API/DB/스크래퍼에서 막 들어온 데이터

2) CanonicalPlace

정규화 + 중복 제거 + 좌표 정리 후의 표준 장소 레코드

3) EvidenceBundle

해당 장소를 추천해도 되는 이유와 검증 근거 묶음

4) RankedCandidate

점수 계산이 끝난 추천 후보

5) JourneySlot

여정상 한 자리. 예: “가는 길 점심”, “체크인 후 마트”, “Day2 비 오는 날 실내 명소”

6) SelectedPlan

최종 사용자에게 보여줄 카드 세트

1. 정제로직 v2 설계안
1.1 v2 전체 흐름 요약

원시데이터가 최종 추천이 되기까지의 흐름은 아래와 같다.

Phase A. 수집

유저/여행/날씨/경로 컨텍스트 수집

마스터 DB 후보 대량 회수

경로 기반 후보 회수

Phase B. 표준화

이름/주소/좌표/카테고리 정규화

동일 장소 병합

역할 태깅

Phase C. 근거 강화

공공 인증/내부 DB/실시간 검증 근거 결합

검증 상태와 리스크 플래그 생성

Phase D. 점수화

신뢰도/품질/적합도/동선성 점수 계산

제외/강등/대체 후보 정리

Phase E. 출력

Journey Slot별 메인/대안 선별

AI 패키지 + 프론트 패키지 생성

1.2 정제로직 v2 핵심 철학

정제로직 v2는 아래처럼 동작해야 한다.

기존 문제

원시데이터가 너무 빨리 “추천 데이터” 취급을 받음

v2 방향

원시데이터는 아래 단계를 통과해야만 추천 후보가 된다.

원시데이터 → 표준 장소 → 근거 보강 → 리스크 판정 → 점수화 → 슬롯 배치

즉, “있다”는 이유만으로 추천하면 안 되고
“왜 지금 이 사용자에게 적합한지 설명 가능한 상태” 가 되어야 한다.

1.3 정제로직 v2 상세 단계
Step A1. Context Assembly
입력

출발지 좌표

캠핑장 좌표

캠핑 일정

사용자 프로필

날씨 예보

이동 경로 정보

처리

사용자와 일정 컨텍스트를 아래처럼 정리한다.

{
  "trip_days": 3,
  "party_type": "family",
  "with_child": true,
  "trip_goal": ["rest", "food", "light_exploration"],
  "schedule_rigidity": "medium",
  "day1_weather": "light_rain",
  "day2_weather": "cloudy",
  "day3_weather": "clear"
}
출력

user_context

trip_context

weather_context

route_context

fallback

최신 날씨 실패 시 최근 캐시 사용

경로 상세 실패 시 직선거리 + 기본 경로 추정 사용

Step A2. Recall Candidate Retrieval
목적

이 단계의 목적은 “좋은 것만 뽑기”가 아니라
놓치지 않고 넓게 모으기 다.

입력 원천

master_places

master_places_gas

공공데이터

경로 기반 API

내부 캐시

규칙

카테고리별로 후보를 넉넉히 회수한다.

권장 회수량:

HOSPITAL: 10~20

MART: 20~40

RESTAURANT: 40~60

GAS_STATION: 10~20

SPOT: 20~40

FESTIVAL: 5~20

ROUTE_RESTAURANT: 20~40

ROUTE_CAFE: 20~30

ROUTE_SPOT: 10~20

출력

raw_candidates[]

주의

이 단계에서 너무 빨리 Top 20으로 자르지 않는다.
먼저 넓게 모으고, 나중에 정제한다.

Step B1. Canonical Normalization
목적

서로 다른 출처에서 같은 장소가 다른 이름/주소/형태로 들어오는 문제 해결

처리 규칙
이름 정규화

괄호 제거

지점명 패턴 정리

연속 공백 제거

특수문자 정리

브랜드명 표준화

예:

이마트 춘천점

이마트(춘천)

E-Mart 춘천

→ 이마트 춘천점

주소 정규화

도로명/지번 둘 다 저장

주소 파편문자 제거

시/군/구 표준화

좌표 역변환 시 보조 주소 저장

좌표 정규화

위도/경도 정밀도 통일

좌표 누락 시 지오코딩 시도

좌표 불확실 시 geo_confidence 낮춤

카테고리 정규화

원천 API 카테고리와 내부 카테고리가 다를 수 있으므로 내부 기준으로 재분류한다.

예:

카카오 “주유소” → GAS_STATION

SBA 상가정보 “카페/디저트” → ROUTE_CAFE 또는 MART 아님

병원/의원/보건소 패턴 → HOSPITAL

출력

canonical_places[]

Step B2. Duplicate Collapse
목적

동일 장소 중복 제거

중복 판정 우선순위

이름 + 주소 완전 일치

이름 유사도 높음 + 좌표 50m 이내

전화번호 동일

브랜드/지점명 일치 + 좌표 근접

병합 규칙

중복 발견 시 하나의 canonical_place로 병합하고 근거는 유지한다.

예:

source 목록은 모두 남김

평점/리뷰/공공인증/검증시각은 evidence로 병합

가장 신뢰도 높은 주소/좌표를 대표값으로 채택

출력

canonical_places_merged[]

Step B3. Category + Role Tagging
목적

카테고리와 실제 여정 역할을 분리한다.

카테고리

HOSPITAL

MART

RESTAURANT

GAS_STATION

SPOT

FESTIVAL

ROUTE_RESTAURANT

ROUTE_CAFE

ROUTE_SPOT

역할 태그

meal_before_checkin

coffee_break

rainy_day_backup

kid_friendly

late_arrival_safe

stock_up

emergency

local_signature

photo_stop

quick_stop

long_stay_resupply

indoor_safe

outdoor_clear_day

예시

같은 식당이라도

Day1에서는 meal_before_checkin

아이 동반이면 kid_friendly

비 예보면 indoor_safe

같은 역할 태그를 가질 수 있다.

출력

tagged_candidates[]

Step C1. Evidence Bundle 생성
목적

추천 근거를 하나의 묶음으로 관리한다.

각 장소마다 아래 근거를 조립한다.

공공 근거

백년가게

안심식당

모범음식점

관광공사 등록 명소

대규모 점포 등록

병원/보건소 등록

오피넷 등유 취급

실시간/최근 근거

최근 평점

최근 리뷰 수

최근 검증 성공 시각

운영 여부 힌트

최근 스크래핑 성공/실패 여부

내부 운영 근거

사용자 클릭률

저장률

최근 추천 성공률

사용자 신고/부정 피드백

출력 예시
{
  "evidence": {
    "public_certifications": ["MODEL_RESTAURANT", "SAFE_RESTAURANT"],
    "live_signals": {
      "rating": 4.4,
      "review_count": 182,
      "verified_at": "2026-03-10T07:20:00+09:00"
    },
    "internal_signals": {
      "save_rate": 0.18,
      "complaint_count": 0
    }
  }
}
Step C2. Real-time Verification Tiering
목적

실시간 검증을 “필수 통과문”이 아니라 “품질 상승 단계”로 설계

3단계 검증 티어
Tier 1. Official/Stable

공공데이터

내부 캐시

공식 API

최근 성공 검증 기록

Tier 2. Soft Live Signal

최신 평점

리뷰 수

최근 검색 결과 존재

운영 가능성 힌트

Tier 3. Hard Live Check

스크래퍼/비공개 엔드포인트

변동성 높은 실시간 정보

검증 상태 값

confirmed

probable

stale

uncertain

정책

confirmed: 적극 추천 가능

probable: 추천 가능, 과장 금지

stale: 추천 가능하나 방문 전 확인 문구 필요

uncertain: 메인 후보 불가, 대안 후보만 허용

출력

verification_status

verified_at

verified_by[]

verification_fail_reason

Step C3. Risk Flags 생성
목적

좋은 점수와 별개로 위험 요소를 따로 관리

리스크 플래그 예시

likely_closed

opening_hours_unknown

detour_too_long

stale_data

low_review_confidence

route_conflict

holiday_risk

duplicate_chain_overload

weather_mismatch

원칙

점수는 높아도 리스크가 크면 메인 후보에서 제외될 수 있다.

Step D1. Hard Exclusion / Soft Demotion
Hard Exclusion

아래는 추천 후보에서 제거한다.

좌표 없음 + 지오코딩 실패

카테고리 오분류 가능성 매우 높음

일정과 무관하게 지나치게 멀음

실사용 불가 수준의 정보 누락

동일 장소 중복

이미 폐업/휴업 확정

Soft Demotion

아래는 후보 유지하되 강등한다.

최신 검증 없음

휴무 가능성 있음

우회시간이 김

리뷰 수가 너무 적음

체인 중복 과다

날씨 적합성 낮음

Step D2. Journey Slot Assignment
목적

카테고리 중심이 아니라 실제 여정의 빈자리에 맞게 추천

권장 슬롯 구조
Day1

route_meal_primary

route_meal_alt_1

route_meal_alt_2

route_cafe_primary

route_cafe_alt_1

route_spot_primary

Day2~3

local_mart_primary

local_mart_alt

local_hospital_safe

local_gas_safe

local_spot_primary

local_spot_alt

festival_featured

원칙

최종 추천은 “카테고리 Top3”가 아니라
슬롯별 Top1 + 대안 1~2개 로 선별한다.

Step D3. Diversity Re-ranking
목적

추천이 비슷한 체인/비슷한 메뉴/비슷한 느낌으로 몰리지 않게 한다.

규칙

동일 체인 1개 초과 시 감점

동일 메뉴군 2개 초과 시 감점

Day1 추천은 빠른 식사형 / 휴식형 분리

Day2 명소는 실내/실외 대안 쌍 보유 권장

Step E1. AI Package 생성
목적

AI가 과장 없이 감성적인 서사를 쓰도록 근거 패키지화

원칙

AI에는 아래만 넘긴다.

최종 선별된 메인/대안 후보

각 후보의 선정 이유

팩트 근거

리스크

톤 가이드

금지 규칙

원시데이터 전체는 넘기지 않는다.

Step E2. Frontend Package 생성
목적

프론트가 점수 계산 없이 바로 안정적으로 렌더링 가능하도록 구성

원칙

프론트는 아래를 계산하지 않는다.

점수 공식

중복 병합

리스크 재판단

메인/대안 선별

프론트는 오직 렌더링한다.

2. 점수화 공식 명세
2.1 점수 체계 기본 원칙

v2는 단일 trust_score 중심이 아니라 아래 4개 축을 분리한다.

Existence Score

실제 존재/운영 가능성 신뢰도

Quality Score

장소 자체의 품질 신뢰도

Context Fit Score

이번 사용자/날씨/일정에 얼마나 맞는가

Logistics Score

실제 들르기 쉬운가

그리고 별도로

Risk Penalty

추천을 조심해야 할 이유

Diversity Bonus

추천 세트의 다양성 보정

2.2 기본 점수 범위

각 점수는 0~100 범위로 계산한다.

existence_score: 0~100

quality_score: 0~100

context_fit_score: 0~100

logistics_score: 0~100

risk_penalty: 0~40

diversity_bonus: 0~5

2.3 기본 최종 점수 공식
final_score =
  round(
    existence_score * W1 +
    quality_score * W2 +
    context_fit_score * W3 +
    logistics_score * W4
    - risk_penalty
    + diversity_bonus
  )

기본 가중치:

W1 = 0.30

W2 = 0.25

W3 = 0.25

W4 = 0.20

2.4 카테고리별 가중치 오버라이드

카테고리마다 중요도가 다르므로 가중치를 조금 다르게 둔다.

HOSPITAL

Existence 0.40

Quality 0.10

Context Fit 0.25

Logistics 0.25

MART

Existence 0.30

Quality 0.10

Context Fit 0.20

Logistics 0.40

GAS_STATION

Existence 0.30

Quality 0.10

Context Fit 0.20

Logistics 0.40

RESTAURANT

Existence 0.20

Quality 0.30

Context Fit 0.30

Logistics 0.20

SPOT

Existence 0.20

Quality 0.20

Context Fit 0.35

Logistics 0.25

FESTIVAL

Existence 0.25

Quality 0.10

Context Fit 0.40

Logistics 0.25

ROUTE_RESTAURANT

Existence 0.20

Quality 0.25

Context Fit 0.20

Logistics 0.35

ROUTE_CAFE

Existence 0.20

Quality 0.20

Context Fit 0.25

Logistics 0.35

ROUTE_SPOT

Existence 0.20

Quality 0.20

Context Fit 0.25

Logistics 0.35

2.5 Existence Score 세부 공식
목적

“이 장소가 실제로 추천 가능한 현실 장소인가?”

구성

source_confidence: 0~30

geo_confidence: 0~15

freshness_score: 0~20

verification_score: 0~20

identity_consistency: 0~15

계산 예시
existence_score =
  source_confidence +
  geo_confidence +
  freshness_score +
  verification_score +
  identity_consistency
세부 규칙
source_confidence

공공 인증 + 공식 API + 내부 DB 다수 일치: 26~30

공식 API/공공데이터 중 1개 확실: 20~25

일반 상권 정보만 존재: 10~19

스크래핑 단독: 5~12

geo_confidence

정확 좌표 + 주소 일치: 13~15

좌표 있음, 주소 일부 불명확: 8~12

좌표 추정: 3~7

좌표 불명확: 0~2

freshness_score

3일 이내 검증: 18~20

7일 이내: 14~17

30일 이내: 8~13

90일 초과: 0~7

verification_score

confirmed: 17~20

probable: 11~16

stale: 5~10

uncertain: 0~4

identity_consistency

이름/주소/전화 모두 정합: 13~15

이름/주소 정합: 8~12

일부 모호: 3~7

충돌 심함: 0~2

2.6 Quality Score 세부 공식
목적

“이 장소가 좋은 선택일 가능성이 얼마나 높은가?”

구성

official_cert_score: 0~25

live_rating_score: 0~25

review_volume_score: 0~20

local_significance_score: 0~15

user_signal_score: 0~15

quality_score =
  official_cert_score +
  live_rating_score +
  review_volume_score +
  local_significance_score +
  user_signal_score
세부 규칙
official_cert_score

복수 공공 인증: 18~25

단일 공공 인증: 10~17

일반 등록 정보만: 3~9

없음: 0

live_rating_score

4.6 이상: 22~25

4.3~4.5: 17~21

4.0~4.2: 12~16

3.7~3.9: 6~11

미확인: 0~5

review_volume_score

300+: 16~20

100~299: 11~15

30~99: 6~10

1~29: 1~5

없음: 0

local_significance_score

지역대표성 강함: 10~15

일반 수준: 4~9

특색 약함: 0~3

user_signal_score

초기에는 내부 데이터가 약할 수 있으므로 0 비중 허용
향후 저장률/클릭률/재추천 성공률 등 반영

2.7 Context Fit Score 세부 공식
목적

“이번 캠핑 일정에 맞는가?”

구성

day_match_score: 0~25

weather_match_score: 0~25

persona_match_score: 0~25

role_match_score: 0~15

time_window_match_score: 0~10

context_fit_score =
  day_match_score +
  weather_match_score +
  persona_match_score +
  role_match_score +
  time_window_match_score
예시 규칙
day_match_score

Day1 경유형 추천과 완벽히 일치: 20~25

Day2/3 현지 체험형과 일치: 15~25

일정과 약간 어긋남: 5~14

거의 안 맞음: 0~4

weather_match_score

비 오는 날 실내 명소/국물음식: +18~25

맑은 날 야외 명소/테라스형: +15~22

날씨 중립적: +5~14

날씨와 충돌: 0~4

persona_match_score

아이동반에 강함 / 미식가에 강함 / 조용한 일정에 적합: +15~25

일반 적합: +6~14

맞춤성 약함: 0~5

role_match_score

meal_before_checkin, stock_up, rainy_day_backup 등 현재 슬롯 역할과 강하게 맞으면 가점

time_window_match_score

체크인 전/후, 도착 예상 시각, 체류 가능 시간과 잘 맞으면 가점

2.8 Logistics Score 세부 공식
목적

“실제로 들르기 쉬운가?”

구성

distance_score: 0~20

detour_score: 0~30

access_score: 0~15

opening_likelihood_score: 0~15

schedule_harmony_score: 0~20

logistics_score =
  distance_score +
  detour_score +
  access_score +
  opening_likelihood_score +
  schedule_harmony_score
세부 규칙
distance_score

반경 내 가까울수록 가점

detour_score

경로 이탈 시간이 짧을수록 높은 점수
Day1의 핵심

권장 기준:

5분 이하: 26~30

6~10분: 20~25

11~15분: 12~19

16~20분: 5~11

20분 초과: 0~4

access_score

주차 가능/접근성 양호/가족 이동 편함: 가점

접근 불편/도보만 편함: 감점

opening_likelihood_score

오늘 운영 가능성 높음: 가점

휴무 위험/불명확: 낮음

schedule_harmony_score

체크인 시간과 무리 없음

도착 후 너무 늦지 않음

장기 숙박 재보급 동선으로 적합

2.9 Risk Penalty 규칙
목적

좋은 점수를 받아도 “조심해야 할 것”은 감점

구성 예시

closure_risk: 0~15

stale_risk: 0~10

sparse_info_risk: 0~5

route_conflict_risk: 0~10

holiday_risk: 0~5

risk_penalty =
  closure_risk +
  stale_risk +
  sparse_info_risk +
  route_conflict_risk +
  holiday_risk
규칙

likely_closed: 강한 감점

둘째/넷째 일요일 휴무 가능 대형마트: 감점

우회 너무 큼: 감점

정보 빈약: 감점

2.10 Diversity Bonus 규칙
목적

추천 세트가 너무 비슷해지는 것을 방지

보너스 규칙

같은 체인 반복 없음: +1

메뉴군 다양성 확보: +1

실내/실외 대안 쌍 확보: +1

빠른 옵션 + 감성 옵션 균형: +1

Day1/Day2 역할 중복 없음: +1

최대 +5

2.11 점수 등급 해석

85 이상: 메인 추천 가능

70~84: 강한 대안

55~69: 예비 후보

54 이하: 사용자 노출 비권장

2.12 필수 캡(cap) 규칙

특정 보너스가 전체 점수를 뒤엎지 못하게 한다.

날씨 가점 최대: +25

아이동반 가점 최대: +20

등유 안전 가점 최대: +35

공공 인증 가점 최대: +25

즉, 하나의 요인만으로 무조건 1위가 되지 않게 한다.

3. AI 입력 JSON 스키마
3.1 설계 목적

AI에는 원시 후보 전체 를 넘기지 않는다.
AI에는 정제 완료된 후보 + 선정 이유 + 리스크 + 표현 규칙 만 넘긴다.

이렇게 해야

환각 감소

과장 표현 방지

간결한 서사 가능

토큰 절감
이 가능하다.

3.2 AI 입력 패키지의 루트 구조
{
  "schema_version": "smart_plan_ai_v2",
  "request_meta": {},
  "trip_context": {},
  "user_context": {},
  "weather_context": {},
  "route_context": {},
  "selection_policy": {},
  "journey_slots": [],
  "narration_rules": {},
  "fallback_notes": []
}
3.3 필드 명세
schema_version

스키마 버전

request_meta

plan_id

generated_at

mode (preview | final)

confidence_level (high | medium | low)

trip_context

start_date

end_date

trip_days

campground_name

campground_lat

campground_lng

checkin_time

checkout_time

user_context

party_type

with_child

child_age_band

trip_goal

food_priority

convenience_priority

exploration_style

schedule_rigidity

weather_context

source

freshness

confidence

day_forecasts[]

route_context

drive_minutes

anchor_points[]

route_reliability

detour_policy

selection_policy

scoring_version

weight_profile

slot_selection_rules

risk_policy

journey_slots

AI가 서사를 조립할 실질 데이터

narration_rules

AI 문체/표현 제한

fallback_notes

실시간 검증 실패 등 예외 설명

3.4 Journey Slot 구조
{
  "slot_id": "route_meal_primary",
  "day": 1,
  "slot_type": "route_meal",
  "priority": "primary",
  "title_hint": "가는 길 점심",
  "selected_place": {},
  "alternatives": [],
  "slot_reason": [
    "체크인 전 무리 없는 식사",
    "비 예보에 맞는 실내/따뜻한 메뉴",
    "아이 동반 이동 부담이 적음"
  ]
}
3.5 Selected Place 구조
{
  "place_id": "route_restaurant_123",
  "name": "예시식당",
  "category": "ROUTE_RESTAURANT",
  "journey_role_tags": ["meal_before_checkin", "kid_friendly", "indoor_safe"],
  "final_score": 87,
  "score_breakdown": {
    "existence_score": 82,
    "quality_score": 84,
    "context_fit_score": 91,
    "logistics_score": 85,
    "risk_penalty": 5,
    "diversity_bonus": 2
  },
  "why_selected": [
    "비 오는 날 어울리는 따뜻한 메뉴",
    "경로 이탈이 적어 체크인 전 부담이 작음",
    "아이 동반 가족 식사에 무난한 구성"
  ],
  "fact_evidence": {
    "public_certifications": ["MODEL_RESTAURANT"],
    "live_rating": 4.4,
    "review_count": 182,
    "verified_at": "2026-03-10T07:20:00+09:00",
    "verification_status": "confirmed"
  },
  "risks": [
    "주말 대기 가능성"
  ],
  "frontend_badges": [
    "검증완료",
    "아이동반",
    "가는길추천"
  ]
}
3.6 Narration Rules 구조
{
  "tone": "warm_concise_emotional",
  "paragraph_count": 3,
  "must_cite_only_from_fact_evidence": true,
  "must_not_invent_opening_hours": true,
  "must_not_invent_prices": true,
  "must_not_guarantee_availability": true,
  "mention_risks_softly": true,
  "prefer_simple_korean": true,
  "max_sentence_length": "medium",
  "show_user_benefit_first": true
}
3.7 AI 출력 권장 형식

입력 스키마만으로도 되지만, 운영 안정성을 위해 출력 형식도 제한하는 것이 좋다.

{
  "title": "비 오는 날에도 무리 없는 가족 캠핑 여정",
  "summary_line": "가는 길은 따뜻한 점심으로 편하게, 현지에서는 비를 피할 수 있는 실내 대안을 함께 담았어요.",
  "paragraphs": [
    "첫날은 체크인 전 무리 없는 동선이 핵심입니다...",
    "둘째 날은 캠핑장 주변에서 편의와 안전을 먼저 챙기고...",
    "전체적으로 이번 여정은 아이와 함께 움직여도 부담이 적고..."
  ],
  "soft_caution": "운영 시간과 현장 상황은 방문 전 한 번 더 확인해 주세요."
}
3.8 AI 입력 전체 예시
{
  "schema_version": "smart_plan_ai_v2",
  "request_meta": {
    "plan_id": "plan_20260310_001",
    "generated_at": "2026-03-10T08:10:00+09:00",
    "mode": "final",
    "confidence_level": "high"
  },
  "trip_context": {
    "start_date": "2026-03-14",
    "end_date": "2026-03-16",
    "trip_days": 3,
    "campground_name": "라온아이 오토캠핑장",
    "campground_lat": 37.0,
    "campground_lng": 127.0,
    "checkin_time": "14:00",
    "checkout_time": "12:00"
  },
  "user_context": {
    "party_type": "family",
    "with_child": true,
    "child_age_band": "elementary",
    "trip_goal": ["rest", "food", "light_exploration"],
    "food_priority": "high",
    "convenience_priority": "high",
    "exploration_style": "moderate",
    "schedule_rigidity": "medium"
  },
  "weather_context": {
    "source": "KMA",
    "freshness": "fresh",
    "confidence": "high",
    "day_forecasts": [
      { "day": 1, "summary": "light_rain", "min_temp": 6, "max_temp": 12 },
      { "day": 2, "summary": "cloudy", "min_temp": 4, "max_temp": 11 },
      { "day": 3, "summary": "clear", "min_temp": 3, "max_temp": 13 }
    ]
  },
  "route_context": {
    "drive_minutes": 140,
    "anchor_points": ["25%", "50%", "75%"],
    "route_reliability": "high",
    "detour_policy": "prefer_under_12min"
  },
  "selection_policy": {
    "scoring_version": "v2",
    "weight_profile": "family_rain_safe",
    "slot_selection_rules": "1 primary + up to 2 alternatives",
    "risk_policy": "soft mention only"
  },
  "journey_slots": [
    {
      "slot_id": "route_meal_primary",
      "day": 1,
      "slot_type": "route_meal",
      "priority": "primary",
      "title_hint": "가는 길 점심",
      "selected_place": {
        "place_id": "route_restaurant_123",
        "name": "예시식당",
        "category": "ROUTE_RESTAURANT",
        "journey_role_tags": ["meal_before_checkin", "kid_friendly", "indoor_safe"],
        "final_score": 87,
        "score_breakdown": {
          "existence_score": 82,
          "quality_score": 84,
          "context_fit_score": 91,
          "logistics_score": 85,
          "risk_penalty": 5,
          "diversity_bonus": 2
        },
        "why_selected": [
          "비 오는 날에도 편하게 들르기 좋은 실내 식사 후보",
          "경로 이탈이 적어 체크인 전 부담이 작음",
          "아이와 함께 먹기 무난한 메뉴 구성"
        ],
        "fact_evidence": {
          "public_certifications": ["MODEL_RESTAURANT"],
          "live_rating": 4.4,
          "review_count": 182,
          "verified_at": "2026-03-10T07:20:00+09:00",
          "verification_status": "confirmed"
        },
        "risks": ["주말 대기 가능성"],
        "frontend_badges": ["검증완료", "아이동반", "가는길추천"]
      },
      "alternatives": []
    }
  ],
  "narration_rules": {
    "tone": "warm_concise_emotional",
    "paragraph_count": 3,
    "must_cite_only_from_fact_evidence": true,
    "must_not_invent_opening_hours": true,
    "must_not_invent_prices": true,
    "must_not_guarantee_availability": true,
    "mention_risks_softly": true,
    "prefer_simple_korean": true,
    "show_user_benefit_first": true
  },
  "fallback_notes": []
}
4. 프론트 출력 카드 구조
4.1 프론트 설계 원칙

사용자는 점수표를 보고 싶어 하지 않는다.
사용자가 원하는 것은 아래 순서다.

이번 여정이 어떤 느낌인지 한눈에 이해

어디를 왜 추천하는지 빠르게 확인

대안이 있는지 확인

주의할 점만 가볍게 인지

즉, 프론트는
감성 서사는 위쪽, 팩트 카드는 아래쪽 으로 나눠야 한다.

4.2 권장 화면 구조
Section 1. Hero Journey Summary

AI가 만든 제목

한 줄 요약

날씨 요약 칩

신뢰 배지

간단 주의 문구

Section 2. Day1 Route Picks

가는 길 점심

가는 길 카페

가는 길 짧은 들름 명소

Section 3. Local Support Picks

마트

병원/보건소

주유소/등유

비상 대안

Section 4. Experience Picks

현지 명소

축제/오일장

비 올 때 대안 / 맑을 때 추천

Section 5. Alternatives

대안 카드 1~2개씩 접기/펼치기

4.3 카드 종류 정의
A. HeroSummaryCard
목적

이번 캠핑 여정을 한 문장으로 설명

필드

title

summary_line

weather_chips[]

confidence_badge

soft_caution

예시

제목: 비 오는 날에도 무리 없는 가족 캠핑 여정

요약: 가는 길은 따뜻한 점심으로 편하게, 현지에서는 실내 대안을 함께 담았어요.

B. NarrativeCard
목적

AI가 만든 3문단 감성 서사 표시

필드

paragraphs[] (3개 권장)

원칙

길게 쓰지 않는다

한 문단당 2~4문장

팩트는 과장 없이

사용자 이득 중심

C. RecommendedStopCard
목적

메인 추천 장소 카드

필드

slot_title

place_name

category_label

reason_line

fact_chips[]

badges[]

risk_note

cta_actions[]

예시

slot_title: 가는 길 점심

place_name: 예시식당

reason_line: 비 오는 날에도 부담 없이 들르기 좋은 따뜻한 한 끼

fact_chips:

별점 4.4

리뷰 182

모범음식점

badges:

검증완료

아이동반

risk_note:

주말에는 대기가 있을 수 있어요.

CTA

길찾기

전화

저장

대안보기

D. SafeUtilityCard
목적

마트/병원/주유소처럼 실용·안전 중심 카드

필드

utility_type

place_name

why_needed

confidence_badge

distance_or_detour_label

risk_note

특징

감성보다 실용 우선

예:

아이와 함께라 가까운 병원 한 곳을 함께 챙겨두었어요.

기온이 낮아 등유 가능성이 높은 주유소를 먼저 넣었어요.

E. ExperienceCard
목적

현지 명소/축제/짧은 체험 카드

필드

place_name

experience_line

weather_fit_badge

visit_style

risk_note

예:

비가 그치면 가볍게 들르기 좋은 산책형 명소

맑은 오후에 잘 어울리는 짧은 들름 코스

F. AlternativeStackCard
목적

메인 후보 대신 쓸 수 있는 대안 카드

필드

main_slot_id

alternatives[]

각 대안은

이름

한 줄 이유

팩트 칩 2~3개

약한 주의 문구

원칙

대안은 최대 2개
정보 과다 방지

4.4 배지(Badge) 체계

프론트에 보여줄 배지는 점수 숫자보다 훨씬 중요하다.

권장 배지:

검증완료

최근확인

공공인증

아이동반

비오는날

가는길추천

실내대안

대안추천

방문전확인

원칙

점수는 숨기고, 의미는 보이게 한다.

4.5 Fact Chips 체계

사용자가 빠르게 믿을 수 있도록 카드마다 팩트 칩 2~3개만 노출한다.

예:

별점 4.4

리뷰 182

백년가게

등유 가능

실내 추천

대형마트

차로 8분

우회 6분

원칙

칩은 많을수록 좋은 것이 아니다.
최대 3개 권장.

4.6 Risk Note 표현 규칙

리스크는 겁주듯이 쓰지 않는다.
부드럽게, 짧게, 확인 중심으로 쓴다.

좋은 예:

운영 시간은 방문 전 한 번 더 확인해 주세요.

주말에는 대기가 있을 수 있어요.

날씨에 따라 실외 체류감이 달라질 수 있어요.

나쁜 예:

영업 안 할 수도 있음

신뢰도 낮음

데이터 부족

4.7 카드 카피 원칙
reason_line

장소를 설명하지 말고 사용자 이득 을 말한다.

좋은 예:

체크인 전에 무리 없이 들르기 좋아요.

비 오는 날에도 편하게 쉬기 좋습니다.

아이와 함께 움직일 때 부담이 적어요.

나쁜 예:

리뷰 수가 많고 평점이 높습니다.
이건 칩이나 근거로 내려야 한다.

4.8 프론트 출력 패키지 예시
{
  "hero_card": {
    "title": "비 오는 날에도 무리 없는 가족 캠핑 여정",
    "summary_line": "가는 길은 따뜻한 점심으로 편하게, 현지에서는 실내 대안을 함께 담았어요.",
    "weather_chips": ["Day1 비", "Day2 흐림", "Day3 맑음"],
    "confidence_badge": "검증 중심 추천",
    "soft_caution": "운영 시간과 현장 상황은 방문 전 한 번 더 확인해 주세요."
  },
  "narrative_card": {
    "paragraphs": [
      "첫날은 체크인 전 동선 부담을 줄이는 데 초점을 맞췄어요. 비 예보가 있어 따뜻하게 쉬어갈 수 있는 식사 후보를 먼저 담았습니다.",
      "현지에서는 가족 캠핑에 필요한 편의와 안전을 먼저 챙기고, 날씨 변화에 따라 실내와 실외 선택지를 함께 볼 수 있게 구성했어요.",
      "전체적으로 이번 여정은 무리하게 많이 들르기보다, 편안함과 안정감 속에서 작은 즐거움을 더하는 흐름으로 준비했습니다."
    ]
  },
  "sections": [
    {
      "section_type": "route_day1",
      "cards": [
        {
          "card_type": "recommended_stop",
          "slot_title": "가는 길 점심",
          "place_name": "예시식당",
          "category_label": "식당",
          "reason_line": "비 오는 날에도 부담 없이 들르기 좋은 따뜻한 한 끼",
          "fact_chips": ["별점 4.4", "리뷰 182", "모범음식점"],
          "badges": ["검증완료", "아이동반", "가는길추천"],
          "risk_note": "주말에는 대기가 있을 수 있어요.",
          "cta_actions": ["길찾기", "전화", "대안보기"]
        }
      ]
    }
  ]
}
5. 이 설계의 핵심 운영 규칙
5.1 AI에 넘기기 전 반드시 완료되어야 하는 것

중복 제거

카테고리 정규화

역할 태깅

검증 상태 부여

리스크 플래그 부여

점수 계산

슬롯별 메인/대안 선별

AI는 이 이후에만 호출한다.

5.2 프론트에 넘기기 전 반드시 완료되어야 하는 것

카드 타입 결정

배지 문구 결정

팩트 칩 2~3개 선택

risk_note 한 줄 정리

CTA 타입 결정

프론트는 가공하지 않는다.

5.3 실시간 검증 실패 시 규칙

후보 삭제 대신 상태 강등

confirmed → probable → stale → uncertain

uncertain은 메인 카드 금지, 대안 카드만 허용

narrative에는 “검증된” 표현 금지

fact chip에서도 실시간 점수 미노출 가능

5.4 날씨 실패 시 규칙

최신 예보 실패 → 최근 캐시 사용

캐시도 불가 → 계절 규칙 기반 기본형 추천

narrative는 단정 대신 완곡 표현 사용

예:

비가 예상되어 대신 비 가능성을 고려해

맑은 날에 좋습니다 대신 맑다면 더 잘 어울립니다

6. 권장 구현 순서
1차

정제로직 v2와 점수화 로직 먼저 구현

필수:

CanonicalPlace

EvidenceBundle

RiskFlags

final_score

2차

AI 입력 패키지 스키마 고정

필수:

journey_slots

narration_rules

fallback_notes

3차

프론트 출력 패키지 구조 고정

필수:

hero_card

narrative_card

recommended_stop

alternatives

4차

실시간 검증 고도화 및 내부 사용자 신호 반영

7. 최종 결론

이 v2 문서의 본질은 단순해.

기존에는
원시데이터를 빨리 추천으로 올리는 구조 였다면,

이제는
원시데이터를 근거 있는 후보로 정제하고, 그 후보를 설명 가능한 방식으로 점수화한 뒤, AI에는 그 근거를 넘기고, 사용자에게는 짧고 따뜻한 여정으로 보여주는 구조 로 바꾸자는 거야.

즉 최종 목표는 이것이야.

백엔드

“왜 이 장소가 뽑혔는지 설명 가능해야 한다.”

AI

“근거 밖의 말을 하지 않고, 근거 안에서 감성적으로 말해야 한다.”

프론트

“복잡한 데이터는 숨기고, 사용자에게는 믿을 만하고 편안한 여정처럼 보여야 한다.”