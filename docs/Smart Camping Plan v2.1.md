Smart Camping Plan v2.1 보강 설계안
안티그래비티 검토/구현용
1. 이번 보강의 핵심 목적

현재 구조는 이미 작동 가능하다.
다만 아래 4개를 보강해야 추천 품질이 흔들리지 않는다.

초기 후보를 너무 빨리 잘라버리는 문제 수정

실시간 검증 실패 시 후보가 사라지는 구조 방지

4축 점수 세부 기준을 SSOT에 고정

최종 출력이 카테고리 중심이 아니라 역할 중심으로 보이게 정리

2. 이번 보강에서 반드시 구현할 항목

이번 수정은 아래 6개를 기준으로 진행 권장.

P0. 꼭 반영

Step 3 후보 선별 방식 수정

Step 4 저장/검증 정책 수정

Step 5.5 점수 매핑표 추가

Primary / Alternative 게이트 규칙 추가

FESTIVAL 별도 featured 슬롯 분리

Step 8 출력 재배열 규칙 추가

P1. 같이 반영하면 좋음

FactCard 필드 확장

Risk Penalty 세분화

Role 기반 슬롯명 고정

프론트 배지/칩 출력 규칙 고정

3. 매뉴얼 문구 직접 수정안

아래는 SSOT 문서에 직접 붙여넣기 가능한 수정안이다.

[수정안 1] Step 3 문구 교체
기존 문구

날씨 예보를 상호 참조하여 비가 오면 실내/국물요리 위주로, 맑으면 야외/시원한 메뉴 위주로 가중치를 부여해 상위 20개 후보군을 우선 선별합니다. 정렬 기준은 1순위 trust_score 내림차순, 2순위 distance 오름차순입니다.

교체 문구

날씨 예보와 기본 출처 신뢰도를 상호 참조하여 카테고리별 1차 후보군(shortlist) 을 넉넉히 회수합니다.
이 단계의 목적은 최종 선별이 아니라 누락 방지형 후보 확보(recall) 이며, 기본 정렬 기준은 source_confidence 내림차순, distance 오름차순입니다.
카테고리별 권장 1차 회수량은 다음과 같습니다.

RESTAURANT: 40개

MART: 20개

SPOT: 20개

GAS_STATION: 15개

ROUTE_RESTAURANT / ROUTE_CAFE / ROUTE_SPOT: 각 20개
이후 Step 5.5의 v2 4축 점수 계산을 거쳐 최종 Top 3를 선별합니다.
즉, 이 단계의 shortlist는 확정 후보가 아니라 1차 후보군 입니다.

설계 의도

이걸 안 바꾸면 Step 5.5가 들어가도 실제로는 기존 trust_score 컷이 우선권을 가져간다.

[수정안 2] Step 4 문구 교체
기존 문구

선별된 후보군에 대해 카카오 스크래퍼(scraper.ts)를 가동하여 실시간 별점 및 리뷰 수를 획득, 검증된 데이터만 smart_plan_facts에 저장합니다.

교체 문구

선별된 후보군에 대해 카카오 스크래퍼(scraper.ts)를 가동하여 실시간 별점 및 리뷰 수를 획득합니다.
실시간 검증 성공 여부와 관계없이 후보 자체는 유지 하며, 검증 결과는 FactCard.evidence와 verificationStatus에 기록합니다.

검증 성공: verificationStatus = VERIFIED

검증 실패/미확인: verificationStatus = UNVERIFIED

UNVERIFIED 후보도 기본 추천 또는 대안 후보로 유지할 수 있으며,
실시간 검증은 추천 품질 상승용 보강 단계 로 취급합니다.
즉, 실시간 검증 실패가 후보 탈락으로 직접 이어지지 않습니다.

설계 의도

이게 핵심 fail-soft 보강이다.

[수정안 3] Step 5.5 아래에 세부 점수 기준표 추가

지금 4축 개념은 있는데, 수치 매핑이 약하다.
아래 표를 그대로 붙이는 걸 권장한다.

5.5.1 Existence 축 세부 기준
source_confidence
출처	점수
SMBA_BAEK, SAFE_RESTAURANT, NMC_HOSPITAL, OPINET, MASTER_ENRICHED	60
TOUR_SPOT, TOUR_CAFE, MOIS_GOOD_RESTAURANT	50
LARGE_STORE	40
기타 일반 데이터	30
geo_confidence
조건	점수
좌표 + 주소 모두 명확	40
좌표 있음, 주소 일부 불완전	30
좌표는 있으나 정확도 낮음	20
좌표 누락/불확실	0
Existence = source_confidence + geo_confidence

최대 100

5.5.2 Quality 축 세부 기준
official_cert
조건	점수
공공 인증 2개 이상	50
공공 인증 1개	35
일반 등록 정보만 있음	15
없음	0
live_rating
조건	점수
4.5 이상	50
4.2 ~ 4.49	40
4.0 ~ 4.19	30
3.8 ~ 3.99	20
확인 불가	10
데이터 없음	0
Quality = official_cert + live_rating

최대 100

5.5.3 ContextFit 축 세부 기준
weather_match
조건	점수
현재 날씨/계절과 매우 잘 맞음	45~50
적합	30~40
중립	15~25
날씨와 충돌	0~10
persona_match
조건	점수
아이동반/미식/안전 등 핵심 페르소나와 강하게 맞음	40~50
일반 적합	20~35
관련 약함	5~15
부적합	0
ContextFit = weather_match + persona_match

최대 100

5.5.4 Logistics 축 세부 기준
distance_score

현지 추천 기준:

거리	점수
0~3km	100
3~7km	80
7~12km	60
12~20km	40
20km 초과	20

경로 추천 기준:

Midpoint 반경 기준 거리	점수
0~2km	100
2~5km	80
5~8km	60
8~12km	40
12km 초과	20
Logistics = distance_score

최대 100

[수정안 4] Risk Penalty 문구 교체
기존

일요일 포함 일정 + 대형마트: -15점

설명 5자 미만: -5점

미검증 데이터: -5점

교체 권장
Risk Penalty 세부 규칙
조건	감점
일요일 포함 일정 + 대형마트	-15
공식 공공출처이나 실시간 미검증	-2
일반 출처 + 미검증	-5
필수 필드 2개 이상 누락(이름/좌표/카테고리/출처)	-5
필수 필드 3개 이상 누락	-10
설명 없음 또는 매우 빈약	-2
동일 체인 과다 중복 후보	-3
설계 의도

description 5자 미만 = -5 는 너무 거칠다.
필수 필드 누락 중심으로 바꾸는 게 더 실전적이다.

[수정안 5] Step 7 FESTIVAL 문구 교체
기존

캠핑 일정 중 축제 날짜가 겹치면 기본 1순위로 강제 보장하여 지역 로컬리티 확보

교체 권장

캠핑 일정 중 축제 날짜가 겹치는 경우, FESTIVAL은 일반 카테고리 경쟁 랭킹과 별도로 featured slot 으로 우선 배치합니다.
즉, FESTIVAL은 RESTAURANT / MART / SPOT과 같은 일반 Top 3 경쟁군이 아니라, 지역성 강조용 별도 추천 카드 로 노출합니다.

설계 의도

이걸 분리하지 않으면 finalScore 체계와 “무조건 1순위”가 충돌한다.

[수정안 6] Step 8 문구 보강
기존

Top 3 선별: 4축 finalScore 기준으로 카테고리별 Top 3 (1개 메인, 2개 대안)

교체 권장

Top 3 선별은 4축 finalScore 기준으로 카테고리별 1개 메인 + 2개 대안 을 구성합니다.
단, 프론트 최종 노출은 카테고리 중심이 아니라 여정 역할 중심으로 재배열 합니다.

역할 그룹은 아래를 기본으로 합니다.

가는 길 추천 (ROUTE_*)

현지 편의 추천 (MART, HOSPITAL, GAS_STATION)

현지 체험 추천 (SPOT, FESTIVAL)

즉, 엔진 내부 선별은 카테고리 기반, 사용자 출력은 역할 기반 입니다.

4. FactCard 확장 설계안

지금 구조를 유지하면서 최소 확장만 하는 방향이다.
새 객체를 6단계로 쪼개지 않고, FactCard만 확장한다.

추가 필드 제안
type VerificationStatus = 'VERIFIED' | 'UNVERIFIED'
type SelectionTier = 'PRIMARY' | 'ALTERNATIVE' | 'FEATURED' | 'HIDDEN'

interface FactCard {
  id: string
  name: string
  category: string
  trustScore: number // 하위호환용 = finalScore
  distanceKm?: number
  description?: string

  scoreBreakdown?: {
    existence: number
    quality: number
    contextFit: number
    logistics: number
    riskPenalty: number
    diversityBonus: number
    finalScore: number
  }

  evidence?: {
    stars?: number
    reviews?: number
    badges?: string[]          // ["백년가게", "모범음식점"]
    sourceLabel?: string       // "SMBA_BAEK", "MASTER_ENRICHED"
    verifiedAt?: string | null
    verificationStatus?: VerificationStatus
  }

  riskFlags?: string[]         // ["SUNDAY_BIG_MART", "UNVERIFIED", "MISSING_DESC"]
  journeyRole?: string         // "가는 길 점심", "현지 마트", "비 오는 날 실내 명소"
  selectionTier?: SelectionTier
}
5. Primary / Alternative 게이트 규칙

이건 꼭 구현하는 걸 추천한다.
점수만으로 다 해결하려고 하면 이상한 메인 후보가 생길 수 있다.

게이트 규칙
PRIMARY 조건

아래 조건을 만족해야 메인 후보 가능

Existence >= 45
AND finalScore >= 70
AND NOT major_risk

major_risk 예:

필수 필드 3개 이상 누락

거리 과도

HOSPITAL인데 좌표 불명확

FESTIVAL인데 일정 불일치

VERIFIED 우대 규칙
verificationStatus = VERIFIED 이면 PRIMARY 우선권
verificationStatus = UNVERIFIED 이면 ALTERNATIVE는 가능

단, 병원/주유소/마트 같은 실용 카테고리는
공식 공공출처가 강하면 UNVERIFIED라도 PRIMARY 가능하게 해도 된다.

ALTERNATIVE 조건
finalScore >= 55
HIDDEN 조건
finalScore < 55
6. Step 3~8 실제 처리 순서 제안

아래 순서로 구현하면 현재 구조와 충돌이 적다.

처리 순서
1단계. 후보 회수

master_places / master_places_gas / smart_plan_facts / midpoint route source

카테고리별로 넉넉히 회수

2단계. 기본 정규화

이름 trim

괄호 제거

중복 공백 제거

좌표/카테고리/출처 정리

3단계. 1차 거르기

좌표 없음 제거

카테고리 완전 불일치 제거

지나치게 먼 후보 제거

4단계. Evidence 주입

stars

reviews

badges

sourceLabel

verificationStatus

verifiedAt

5단계. 4축 계산

Existence

Quality

ContextFit

Logistics

RiskPenalty

DiversityBonus

6단계. 게이트 판정

PRIMARY / ALTERNATIVE / HIDDEN / FEATURED

7단계. 카테고리별 Top 3 선별

PRIMARY 우선

부족하면 ALTERNATIVE 보강

8단계. 역할 중심 재배열

가는 길

현지 편의

현지 체험

featured festival

9단계. AI용 패키지 생성

메인/대안만 넘김

riskFlags는 문장 변환용으로만 사용

10단계. 프론트용 패키지 생성

chips, badges, role, tier 정리

7. 점수 계산 의사코드

안티그래비티가 바로 구현 검토할 수 있게 최대한 단순하게 적을게.

function calculateFinalScore(card: FactCard, context: PlanContext): FactCard {
  const existence =
    getSourceConfidence(card.evidence?.sourceLabel) +
    getGeoConfidence(card)

  const quality =
    getOfficialCertScore(card.evidence?.badges ?? []) +
    getLiveRatingScore(card.evidence?.stars)

  const contextFit =
    getWeatherMatchScore(card, context) +
    getPersonaMatchScore(card, context)

  const logistics =
    getDistanceScore(card, context)

  const riskPenalty =
    getSundayBigMartPenalty(card, context) +
    getVerificationPenalty(card) +
    getMissingFieldPenalty(card) +
    getWeakDescriptionPenalty(card)

  const diversityBonus =
    getHanaroBonus(card, context) +
    getDiversityBonus(card, context)

  const weights = getCategoryWeights(card.category)

  const finalScore = Math.round(
    existence * weights.w1 +
    quality * weights.w2 +
    contextFit * weights.w3 +
    logistics * weights.w4
  ) - riskPenalty + diversityBonus

  card.scoreBreakdown = {
    existence,
    quality,
    contextFit,
    logistics,
    riskPenalty,
    diversityBonus,
    finalScore,
  }

  card.trustScore = finalScore
  card.selectionTier = decideSelectionTier(card, context)

  return card
}
8. Selection Tier 판정 의사코드
function decideSelectionTier(card: FactCard, context: PlanContext): SelectionTier {
  const s = card.scoreBreakdown
  if (!s) return 'HIDDEN'

  const isFeaturedFestival =
    card.category === 'FESTIVAL' && isDateOverlapping(card, context)

  if (isFeaturedFestival) return 'FEATURED'

  const majorRisk =
    hasSevereMissingFields(card) ||
    isFarOutlier(card, context)

  if (s.existence >= 45 && s.finalScore >= 70 && !majorRisk) {
    return 'PRIMARY'
  }

  if (s.finalScore >= 55) {
    return 'ALTERNATIVE'
  }

  return 'HIDDEN'
}
9. verificationStatus 운영 규칙

지금 문서에 VERIFIED/UNVERIFIED가 들어갔으니, 이것도 기준을 고정하는 게 좋다.

VERIFIED 부여 조건

아래 중 1개 이상 충족 시 VERIFIED

stars와 reviews 모두 확보

MASTER_ENRICHED 출처

실시간 스크래퍼 검증 성공

최근 검증 시각 존재

UNVERIFIED 부여 조건

실시간 검증 실패

별점/리뷰 없음

공공출처는 있으나 최근 검증 기록 없음

주의

UNVERIFIED는 “나쁜 데이터”가 아니라
“실시간 확인이 덜 된 데이터” 로 해석해야 한다.

10. 프론트 카드 출력 구조 고정안

안티그래비티가 렌더링 쪽도 바로 볼 수 있게 최소 규칙을 같이 제안한다.

역할 그룹

프론트는 아래 4그룹으로 나눠 보여준다.

1. 가는 길 추천

ROUTE_RESTAURANT

ROUTE_CAFE

ROUTE_SPOT

2. 현지 편의 추천

MART

HOSPITAL

GAS_STATION

3. 현지 체험 추천

SPOT

4. 지역성 추천

FESTIVAL(featured)

카드 표시 규칙
메인 카드

selectionTier = PRIMARY

칩 최대 3개

배지 최대 2개

risk 문구 1줄

대안 카드

selectionTier = ALTERNATIVE

칩 최대 2개

배지 최대 1개

축제 카드

selectionTier = FEATURED

별도 강조 영역

Fact Chips 생성 규칙
function buildFactChips(card: FactCard): string[] {
  const chips: string[] = []

  if (card.evidence?.stars) chips.push(`별점 ${card.evidence.stars}`)
  if (card.evidence?.reviews) chips.push(`리뷰 ${card.evidence.reviews}`)
  if (card.evidence?.badges?.length) chips.push(card.evidence.badges[0])

  if (!chips.length && card.distanceKm != null) {
    chips.push(`차로 인근`)
  }

  return chips.slice(0, 3)
}
Badge 생성 규칙
function buildBadges(card: FactCard): string[] {
  const badges: string[] = []

  if (card.evidence?.verificationStatus === 'VERIFIED') badges.push('검증완료')
  if (card.journeyRole?.includes('가는 길')) badges.push('가는길추천')
  if (card.journeyRole?.includes('아이')) badges.push('아이동반')

  return badges.slice(0, 2)
}
11. AI 프롬프트 보강 규칙

이미 guardrail이 들어갔으니, 아래 5줄은 꼭 프롬프트에 고정하는 걸 추천한다.

- 카드에 없는 영업시간, 메뉴 가격, 잔여석, 주차 가능 여부를 임의로 만들지 말 것
- verifiedStatus가 VERIFIED인 경우에만 "검증된" 표현 사용
- UNVERIFIED 후보는 "방문 전 확인 권장" 수준으로만 표현할 것
- riskFlags는 부드러운 권유형 문장으로만 표현할 것
- 최종 서사는 사용자 편안함과 동선 부담 감소를 먼저 말할 것
12. 구현 완료 기준

안티그래비티가 구현 후 검토할 체크리스트도 같이 둔다.

완료 기준

아래가 만족되면 이번 보강은 성공으로 본다.

A. 추천 누락 방지

Step 3에서 기존보다 후보 풀이 넓어짐

ContextFit 높은 후보가 초기 컷에서 덜 탈락함

B. Fail-soft 보장

실시간 검증 실패해도 후보가 남음

VERIFIED/UNVERIFIED가 구분 저장됨

C. 점수 체계 고정

scoreBreakdown이 실제 카드 객체에 저장됨

finalScore 계산 기준이 코드와 SSOT에서 일치함

D. 출력 일관성

AI가 evidence 기준으로만 서사 작성

프론트가 카테고리보다 역할 중심으로 보임

점수 숫자보다 칩/배지 중심으로 신뢰 표시

13. 안티그래비티에게 전달할 한 줄 요약

아래처럼 전달하면 돼.

이번 보강안의 핵심은 새 기능을 크게 늘리는 것이 아니라, 현재 Smart Camping Plan 구조에서
Step 3 후보 선별을 느슨하게 바꾸고, Step 4를 fail-soft로 고치고, 4축 점수 기준표를 SSOT에 고정하고, 최종 노출을 역할 중심으로 재배열하는 것 입니다.
즉, 추천 엔진의 방향은 유지하되 후보 누락, 검증 실패, 점수 해석 불일치 를 막는 안정화 작업입니다.