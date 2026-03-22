# Smart Camping Plan (Guided Journey) Core Engine Manual

라온아이의 핵심 가치인 '감성'과 '편안함'을 전달하기 위해, 사용자의 캠핑 일정을 기반으로 한 맞춤형 추천 여정(Guided Journey)을 구현하는 시스템의 개발 및 유지보수 매뉴얼입니다.

이 문서는 라온아이의 스마트 캠핑 플랜 기능 개발의 **단일 진실 공급원(SSOT)** 역할을 합니다. 다른 세션이나 개발자가 이 기능을 수정/확장할 때 반드시 이 문서를 기준으로 작업해야 합니다.

---

## 🏗️ 1. 아키텍처 철학 (Architecture Philosophy)

스마트 캠핑 플랜은 단순한 앱 기능이 아닌, 향후 B2B API 및 MCP(Model Context Protocol) 서버로 독립 가능한 **"헤드리스 지능형 엔진(Headless Intelligent Engine)"**으로 설계되었습니다.

1.  **UI/Logic Separation**: 추천 로직(`smartPlan.ts`)은 UI 컴포넌트와 완전히 분리되어 순수 데이터(JSON)만 반환합니다.
2.  **API Monetization Ready**: 생성된 데이터는 외부 에이전트(LLM)가 즉시 이해할 수 있도록 구조화된 JSON 포맷 및 메타데이터를 포함합니다.
3.  **Zero-Cost High-Fidelity**: 유료 데이터(내비게이션 트래픽 등)와 LLM 다중 호출을 지양하고, 공공데이터와 무료 API를 사용하여 비용 0원의 초정밀 팩트를 추출합니다.

---

## ⚙️ 2. 핵심 로직 파이프라인 (The 8-Step Pipeline)

사용자가 '캠핑 여정 계획 세우기' 버튼을 누른 순간부터 데이터를 수집, 정제하여 최종적으로 AI에게 프롬프트로 넘기기 직전까지의 8단계 흐름입니다.

### [ Phase 1: Context Gathering (유저 상황 수집) ]
*   **Step 1. Weather & Persona Context (일자별 날씨 및 페르소나 파악)**: 사용자가 버튼을 누르면, 캠핑 예정일의 일자별 날씨(Day 1~3)를 수집하고 유저의 활동 성향(아이 동반, 미식가 등) 페르소나를 식별합니다. 이 때 `user_camping_profiles`의 최신 데이터(인원 구성, 반려견 유무 등)를 동시 참조합니다.
*   **Step 2. Journey Sampling (여정 중간지점 좌표 추출)**: 카카오 내비 API를 활용해 실제 출발지-캠핑장 주행 경로상의 50% 지점(Midpoint)을 추출하여 '가는 길' 추천의 기준점으로 삼습니다.

### [ Phase 2: Hybrid Data Gathering & Enrichment (하이브리드 데이터 수집) ]
*   **Step 3. Phase 11: Hybrid Master DB Scan (Track A - 현지 팩트)**: 캠핑장 반경 내 [식당], [마트], [명소], [주유소] 등은 Supabase 내부 `master_places`에서 PostGIS로 고속 선별합니다. 
    *   **병원/축제/주유소 예외**: `HOSPITAL`, `FESTIVAL`, `GAS_STATION`(오피넷) 카테고리는 실시간성 및 가격 정보의 정확성이 중요하므로, Phase 11 마스터 DB가 아닌 **Phase 10 동적 권역 파이프라인**을 통해 예약 3일 전(D-3) 실시간 수집된 `smart_plan_facts`에서 가져옵니다.
    *   **기술 사양**: `GIST` 인덱스가 적용된 공간 쿼리를 통해 **10ms 이하**의 검색 속도를 보장합니다.
    *   **1차 선별 및 중복 전략**: 동일 장소가 여러 공공 API(모범음식점, 안심식당, 백년가게 등)에서 중복 수집된 경우, **`api_source`를 포함한 결정론적 ID(UUID v5)**를 통해 각각 별도 레코드로 저장됩니다. 이는 향후 다중 인증 장소에 대한 신뢰 가중치 부여의 근거가 되며, **신뢰도 엔진(`reliability.ts`)에서 다음과 같은 중복 인증 보너스가 합산**됩니다:
        - **1개 인증**: 보너스 없음 (Standard)
        - **2개 인증 중복**: **+15점** 보너스
        - **3개 이상 인증 중복**: **+30점** 보너스 (최고 신뢰 등급)
    *   **1차 선별 로직 (v9.5 고도화)**: `get_master_places_in_radius` 호출 시 **카테고리별 병렬 쿼터제(Quota)**를 적용하여 특정 카테고리의 과다 수집으로 인한 타 데이터 누락을 원천 차단합니다. 이후 날씨/성향 등 미래 변수는 일절 개입하지 않고, 오직 오프라인 팩트 지표(마트: 면적/브랜드+거리, 병원/명소/축제: 거리 우선, 주유소: 가격우선+거리, 식당: 신뢰도우선+거리)만으로 정렬하여 누합 방지형 정예 후보군을 확보(recall)합니다.
        - **DB 레벨 카테고리 Quota 상한**: 도시 근처 캠핑장에서 식당이 후보를 독점하는 것을 방지하기 위해, SQL RPC 레벨에서 카테고리별 100~1000개 단위의 독립적인 쿼터를 할당합니다:
          | 카테고리 | 쿼터(Quota) | 카테고리 | 쿼터(Quota) |
          |---------|------|---------|------|
          | RESTAURANT | 1000 | HOSPITAL | 100 |
          | MART | 100 | GAS_STATION | 100 |
          | SPOT | 100 | FESTIVAL | 100 |
          | ROUTE_* | 각 50 | | |
        - 이후 Step 5.5의 v2 4축 점수 계산을 거쳐 최종 Top 15(Top 3 Priority)를 선별합니다.
*   **Step 4. Phase 12: Real-time Verification (Track B - 가는 길 팩트)**: 중간지점(Midpoint) 반경 내에서 [식당], [카페], [명소]를 조회합니다. 
    *   **기술 사양 (Anti-Bot)**: 카카오맵의 CSR 렌더링 및 봇 차단을 우회하기 위해 `User-Agent`, `Referer` 헤더를 위조하고, `place-api.map.kakao.com`의 비공개 JSON 엔드포인트(`/places/panel3/`, `/places/reviews/kakaomap/meta/`)를 직접 호출하여 별점/리뷰 수를 JSON 형태로 추출합니다. (**cheerio HTML 파싱이 아닌 JSON API 직접 호출 방식**)
    *   **카페 데이터**: 식당 API 데이터 중 업종 분류가 '카페'인 항목과 카카오 검색을 결합하여 추출합니다.
    *   **2차 정제 (v2.1 Fail-soft 정책)**: 선별된 후보군에 대해 카카오 스크래퍼(`scraper.ts`)를 가동하여 **실시간 별점 및 리뷰 수**를 획득합니다. **실시간 검증 성공 여부와 관계없이 후보 자체는 유지**하며, 검증 결과는 `FactCard.evidence`와 `verificationStatus`에 기록합니다.
        - 검증 성공: `verificationStatus = VERIFIED`, `api_source = MASTER_ENRICHED`
        - 카카오 매칭 실패/스크래핑 에러: `verificationStatus = UNVERIFIED`, 원본 `api_source` 유지
        - 즉, **실시간 검증 실패가 후보 탈락으로 직접 이어지지 않습니다.**
    *   **특수 항목(HOSPITAL) 실시간 갱신 & 계층형 선별**: 국립중앙의료원(NMC) API + **카카오 HP8(종합병원 등급)** API를 결합 수집합니다. 행정구역 경계선 문제를 피하기 위해 **PostGIS 반경 20km~30km 확장 검색**을 수행하며, 응급실 유무와 병원 등급에 따른 **계층형 가중치 스코어링**으로 정예 후보를 추출합니다.
    *   **동적 데이터 PostGIS 색인 지연 우회(Bypass)**: D-3 수집 직후 DB에 적합된 데이터가 인덱싱 시간차로 인해 즉시 조회되지 않는 현상을 방지하기 위해, **동적 수집본을 백엔드 메모리 배열에 직접 주입(Direct Merge)**하여 단 1건의 누락도 허용하지 않습니다.


### [ Phase 3: Filtering & Day-by-day Weight Logic (가중치 부여) ]
*   **Step 5. Category Segregation (9카테고리 분류)**: 정제된 데이터를 `HOSPITAL`, `MART`, `RESTAURANT`, `GAS_STATION`, `SPOT`, `FESTIVAL`(현지 6종) 및 `ROUTE_RESTAURANT`, `ROUTE_CAFE`, `ROUTE_SPOT`(경로 3종)의 **총 9개 카테고리**로 엄격히 분류합니다. 

*   **Step 5.5. v2 4축 점수 체계 (Multi-Axis Scoring v2)**:
    기존 `trust_score` 단일값 가감 방식을 폐기하고, **4개 축의 가중합 - Risk Penalty** 공식으로 `finalScore`를 산출합니다.

    **4축 구성:**
    | 축 | 의미 | 하위 지표 | 범위 |
    |---|---|---|---|
    | **Existence** | 실제 존재/출처 신뢰도 | `source_confidence` + `geo_confidence` | 0~100 |
    | **Quality** | 장소 품질 | `official_cert` + `live_rating` | 0~100 |
    | **ContextFit** | 이번 캠핑 적합도 | `weather_match` + `persona_match` | 0~100 |
    | **Logistics** | 접근 편의성 | `distance` | 0~100 |

    **카테고리별 가중치 (W1:Existence, W2:Quality, W3:ContextFit, W4:Logistics):**
    | 카테고리 | W1 | W2 | W3 | W4 | 설계 의도 |
    |---|---|---|---|---|---|
    | HOSPITAL | 0.40 | 0.10 | 0.25 | 0.25 | 존재 확실성 최우선 |
    | MART | 0.30 | 0.10 | 0.20 | 0.40 | 가까운 곳 우선 |
    | GAS_STATION | 0.30 | 0.10 | 0.20 | 0.40 | 가까운 곳 우선 |
    | RESTAURANT | 0.20 | 0.30 | 0.30 | 0.20 | 품질+적합성 균형 |
    | SPOT | 0.20 | 0.20 | 0.35 | 0.25 | 적합성 최우선 |
    | FESTIVAL | 0.25 | 0.10 | 0.40 | 0.25 | 적합성 최우선 |
    | ROUTE_* | 0.20 | 0.20~0.25 | 0.20~0.25 | 0.35 | 동선 접근성 우선 |

    **Risk Penalty (v2.1 세분화, 최대 -40점):**
    | 조건 | 감점 | 비고 |
    |------|------|------|
    | 일요일 포함 일정 + 대형마트(이마트/홈플러스/롯데마트) | **-15** | `SUNDAY_BIG_MART` |
    | 공공 인증 출처이나 실시간 미검증 (OPINET, MOIS, TOUR_* 등) | **-2** | `SEMI_PUBLIC_UNVERIFIED` |
    | 일반 출처 + 미검증 (LARGE_STORE, 기타) | **-5** | `UNVERIFIED` |
    | 필수 필드 2개 이상 누락 (이름/좌표/카테고리/출처) | **-5** | `MISSING_FIELDS` |
    | 필수 필드 3개 이상 누락 | **-10** | `SEVERE_MISSING_FIELDS` |
    | 설명 없음 또는 매우 빈약 (3자 미만) | **-2** | `WEAK_DESC` |

    감점 사유는 `FactCard.riskFlags` 배열에 기록되어 AI 서사 작성 시 부드러운 권유형 문장 변환에 활용됩니다.

    **최종 공식:**
    ```
    finalScore = round(Existence×W1 + Quality×W2 + ContextFit×W3 + Logistics×W4) - riskPenalty + diversityBonus
    ```
    `FactCard.trustScore`에는 하위 호환을 위해 `finalScore`가 채워지며, `scoreBreakdown` 필드에 4축 상세 점수가 함께 저장됩니다.
    - **v2.1 Evidence Extractor**: `FactCard.evidence` 필드에 별점(`stars`), 리뷰 수(`reviews`), 공공 인증 항목(`badges`), 출처 라벨(`sourceLabel`), 검증 시각(`verifiedAt`), 개별 `verificationStatus`를 구조화하여 저장합니다.
    - **v2.1 Quality.live_rating 별점 세분화**: `calcQuality()`의 `live_rating` 하위지표가 출처 기반 일괄 점수에서 **실제 별점 기반 세분화**로 개선되었습니다:
      | 별점 | live_rating 점수 |
      |------|------------------|
      | 4.5 이상 | 50 |
      | 4.2 ~ 4.49 | 40 |
      | 4.0 ~ 4.19 | 30 |
      | 3.8 ~ 3.99 | 20 |
      | 확인 불가 | 10 |
      | 데이터 없음 | 0 |
      - `MASTER_ENRICHED` 출처이나 별점 파싱 실패 시 기존값(40) 유지 (하위 호환).
    - **v2.1 FactCard 확장 필드**: `riskFlags` (감점 사유 배열), `selectionTier` (`PRIMARY`/`ALTERNATIVE`/`FEATURED`/`HIDDEN`), `evidence.badges` (배지 배열), `evidence.sourceLabel` (출처 라벨)이 추가되었습니다.

*   **Step 6. Day-by-Day Weather & Persona Weighting (일자별 기상/성향 가중치)**: 
    *   v2 4축 체계에서 **ContextFit 축**의 `weather_match`와 `persona_match`로 반영됩니다.
    *   **Day 1 (가는 길)**: 비 예보 시 국물 요리/실내 명소의 `weather_match`가 45/50으로 상승, 맑음 시 야외 40~45.
    *   **Day 2~3 (현지)**: **최저 기온 5도 이하** 또는 11월~3월인 경우 '겨울 모드'가 활성화되어 주유소는 `weather_match=50`으로 최상위 배치. 아이 동반 시 소아과/어린이 식당의 `persona_match`가 40~45로 상승.
*   **Step 7. Exception Guard (휴무일 및 장기 숙박 방어)**: v2 체계에서 **Risk Penalty**로 통합. 일요일 포함 + 대형마트일 때 -15점 감점, 하나로마트에는 Diversity Bonus +5점 부여.

### [ Phase 4: Final Selection & AI Assembly (최종 선별) ]
*   **Step 8. Final Selection & AI Assembly (정예 선별 및 서사 조립)**: 
    *   **Top 3 선별**: 4축 `finalScore` 기준으로 카테고리별 **Top 3 (1개 메인 `PRIMARY`, 2개 대안 `ALTERNATIVE`)**을 최종 선별합니다.
    *   **v2.1 FESTIVAL featured 슬롯 분리**: FESTIVAL은 일반 카테고리 경쟁 랭킹과 별도로 **`FEATURED` 슬롯**으로 우선 배치됩니다. 즉, FESTIVAL은 RESTAURANT/MART/SPOT과 같은 일반 Top 3 경쟁군이 아니라, 지역성 강조용 별도 추천 카드(`featuredFestival`)로 노출됩니다.
    *   **AI Narration & Reasoning (v3.0 고도화)**: Gemini LLM에 전달하는 프롬프트에 **`evidence` 기반 정보(별점, 리뷰 수, 배지, 검증상태)를 직접 포함**하여, 더 정확한 팩트를 인용한 감성적 **3파트 타임라인(가는 길, 현지, 오는 길)**을 전체 여정 서사뿐만 아니라 각 카드별 **"왜 이 장소를 추천했는지(Reasoning)"** 1문장 핵심 사유를 동적으로 생성하여 AI에게 전달합니다.
    *   **오는 길 추천**: 가는 길 추천 중 선택되지 않은 대안이나 근처의 명소를 '귀갓길의 따뜻한 제안'으로 서사에 포함하도록 가이드합니다.
    *   **AI Guardrails (환각 방지)**: 데이터에 존재하지 않는 **영업시간, 메뉴 가격, 실시간 잔여석** 정보를 임의로 지어내지 않도록 엄격한 프롬프트 지침을 준수합니다.
    *   **v2.1 verificationStatus 규칙**: `VERIFIED` 장소만 "검증된" 표현을 사용하며, `UNVERIFIED` 장소는 "방문 전 확인 권장" 수준으로만 표현합니다.
    *   **Tone Guide**: 휴무 위험 등 리스크 언급 시 "방문 전 확인 권장"과 같은 따뜻한 권유형 문장을 사용하며, 장소 이름 언급 시 `||ID|이름||` 규격을 엄수합니다. **서사는 사용자의 편안함과 동선 부담 감소를 먼저 말합니다.**
    *   **Emergency Guide**: 추천 리스트에 병원이 포함되지 않은 경우, 119 이용 및 시내 이동 안내를 서사에 자동 포함합니다.

---

## 📁 3. 사용자 프로필 및 컨텍스트 시스템 (User Profile & Context)

엔진이 구동되기 위한 최종 입력을 관리하는 계층입니다.

### 3.1 `user_camping_profiles` (SSOT)
- 유저의 위경도, 주소, 인원 구성(성인/아이), 반려견 유무를 저장하는 단일 진실 공급원입니다.
- **Upsert 정책**: 예약 성공 시 또는 프로필 설정 시 최신 정보로 갱신되어, 다음 예약이나 플랜 생성 시 자동으로 불러와집니다.

### 3.2 `CampingProfileGate` & 주소 검색
- 사용자의 출발지(Origin)를 설정하고 카카오 API를 통해 유효한 좌표로 변환하는 관문입니다.
- 보안 및 CORS 해결을 위해 `searchAddressAction`(Server Action)을 통해 안전하게 처리됩니다.

### 3.3 4대 주요 플로우 연동 (Flow Interconnectivity)
- **Reservation (예약)**: 예약 시 입력된 상세 인원 및 반려견 정보를 프로필에 영구 저장합니다.
- **Schedule (일정등록)**: 외부 캠핑장 일정을 통해 유저의 선호 지역 및 스타일 시그널을 수집합니다.
- **PlanLock (추천)**: 저장된 프로필(특히 아이/반려견 유무)을 기반으로 맞춤형 장소를 1차 큐레이션합니다.
- **Proposal (스마트플랜)**: 최종 페르소나와 프로필 데이터를 LLM에 전달하여 개인화된 서사와 추천 사유를 생성합니다.

---

## 🔍 4. 9개 카테고리별 세부 정제 명세 (Data Transformation Spec)

모든 팩트는 v2 4축 점수 체계의 `finalScore`(= `trustScore`) 기준으로 카테고리 내 순위(1위~3위)가 결정됩니다. 각 카테고리별 가중치가 다르므로, 같은 원시 데이터라도 카테고리에 따라 최종 점수가 달라집니다.

### 4.1 국립중앙의료원 병원 / 의원 - `[HOSPITAL]`
- **데이터 소스**: (1순위) 국립중앙의료원 응급의료기관 API (실시간), (2순위) **카카오 로컬 HP8 (종합병원 등급)**, (3순위) 마스터 DB.
- **1차 선별 (v9.5 고도화)**: NMC 응급실 데이터와 카카오 HP8 조회를 병합하여, 행정구역을 무시한 반경 20km~30km 내의 모든 의료기관 후보군을 확보합니다.
- **계층형(Hierarchy) 스코어링 로직**: 
    1. **응급센터 최우선 (100점)**: NMC 인증 응급의료기관 및 권역센터.
    2. **종합병원 가점 (50/20점)**: 카카오 HP8 기준 '종합병원' 이상인 경우 거리와 별개로 품질 가점 부여.
    3. **거리 및 접근성**: 위 점수들에 거리 기반 Logistics 점수를 합산하여 최종 상위 15개를 선별합니다.
    4. **AI 119 안내**: 의료 시설 부재 시 AI가 자동으로 119 및 최단 시내 이동 안내를 생성합니다.
- **점수(Score)**: 가중치 `[E:0.40, Q:0.10, CF:0.25, L:0.25]`. 존재 확실성(Existence) 최우선. 영유아 동반 시 '소아/아동' 키워드가 `persona_match=45`로 반영.

### 4.2 일반 점포 및 마트 - `[MART]`
- **연결 API**: 카카오맵 Local API + 행정안전부_생활_대규모점포 조회서비스
- **기준**: `HOSPITAL`과 `GAS_STATION`을 제외한 상점. 이마트, 홈플러스, 롯데마트, 하나로마트, 주요 24시 편의점 등.
- **1차 선별 (v9.3)**: 거리가 아닌 `sortScore`(100점 만점) 공식 적용. 브랜드 체급(50점: 대형3사 50, 하나로 등 40) + 면적 가점(10점: 3천㎡ 이상 10) + 거리 점수(40점: 반비례 역산)를 합산하여 상위 15개 선별.
- **점수(Score)**: 가중치 `[E:0.30, Q:0.10, CF:0.20, L:0.40]`. 접근성(Logistics) 최우선. 일요일 포함 시 대형마트 Risk Penalty -15점, 하나로마트 Diversity Bonus +5점.

### 4.3 우수 식당 (백년가게, 카카오 높은평점) - `[RESTAURANT]`
- **연결 API**: 카카오맵 Local API + 소상공인시장진흥공단 상가정보 API (백년가게) + 행정안전부_모범음식점정보 조회서비스 + 농림축산부 안심식당
- **1차 선별 (v9.3)**: 공공기관 다중 인증 보너스로 획득한 순수 신뢰도(`trust_score`)를 1순위로, 동일 신뢰도 시 거리 2순위로 정렬하여 넉넉히 20개를 선별.
- **점수(Score)**: 가중치 `[E:0.20, Q:0.30, CF:0.30, L:0.20]`. 품질(Quality)과 적합성(ContextFit) 균형. 비 날 '탕/찌개/국밥'의 `weather_match=45`, 맑은 날 '막국수/냉면'의 `weather_match=40`, 아이동반 시 '돈까스/어린이'의 `persona_match=40`.

### 4.4 오피넷 실내등유 취급 주유소 - `[GAS_STATION]`
- **데이터 소스**: 오피넷(OPINET) 실시간 API
- **수집 전략 (30km Spiral Search)**: 주간 배치(정적)에서 제외하고, 캠핑 3일 전(D-3) 캠핑장 중심 **5km부터 최대 30km까지 5km 단위로 나선형 확장 검색**을 수행합니다. 등유 취급 주유소 5곳이 확보될 때까지 API를 재귀적으로 호출하는 집요한 탐색망을 가동합니다.
- **좌표계 및 필드 표준화**: 오피넷 API의 특수 좌표계(**TM128/네이버 KATEC**)를 위경도로 정밀 변환하여 위치 오차를 제거하며, 응급 상황에 대비해 `PRICE`와 `K_PRICE` 필드를 교차 검증하여 등유 판매 여부를 2중 확인합니다.
- **1차 선별 (v9.5)**: 30km 나선형 수집본 중, 최저가순(PRICE)을 1순위로, 최단거리를 2순위로 정렬하여 10개를 선별합니다.
- **점수(Score)**: 가중치 `[E:0.30, Q:0.10, CF:0.20, L:0.40]`. 겨울철(`isWinterOrCold`) 시 `weather_match=50`으로 ContextFit 축이 만점 근접하여 최상위 배치.

### 4.5 관광 기관 API (현지 명소/관광지) - `[SPOT]`
- **1차 선별 (v9.3)**: 실시간 인기도 식별이 불가하므로 반경 내 최단거리순으로 15개를 뽑아 카카오 검증 진입. 검증 결과(리뷰 수)가 최종 점수의 핵심.
- **점수(Score)**: 가중치 `[E:0.20, Q:0.20, CF:0.35, L:0.25]`. ContextFit 최우선. 비 날 실내/박물관 `weather_match=45`, 맑은 날 수목원/야외 `weather_match=45`. 비 날 야외 명소는 `weather_match=10`으로 자연 감점.

### 4.6 지역 축제 / 오일장 - `[FESTIVAL]`
- **1차 선별 (v9.3)**: 반경 내 최단거리순으로 15개를 뽑아 카카오 검증 진입(인기도 파악).
- **점수(Score)**: 가중치 `[E:0.25, Q:0.10, CF:0.40, L:0.25]`. ContextFit 최우선.
- **8. 한국관광공사(TourAPI) 연계**: 캠핑 예정일 전후 3일간의 지역 축제 정보를 수집합니다. 수집된 축제 장소는 **카카오 로컬 API로 정확한 좌표와 인기도(리뷰 수)를 보강**하여 정제합니다.
- **v2.1 featured 슬롯 운영**: 캠핑 일정 중 축제 날짜가 겹치는 경우, FESTIVAL은 일반 카테고리 경쟁 랭킹과 별도로 **`FEATURED` 슬롯**으로 우선 배치됩니다. `StandardizedPlanJSON.featuredFestival` 필드를 통해 별도 전달되며, `selectionTier = 'FEATURED'`, `roleName = '투데이 로컬 축제'`가 부여됩니다.

### 4.7 경로 기반 식당 / 카페 / 명소 - `[ROUTE_RESTAURANT, ROUTE_CAFE, ROUTE_SPOT]`
- **기준**: Phase 12에서 수집된 현지 밖(주행 경로상)의 팩트.
- **특징**: 카카오 별점 4.0 이상인 경우 '가는 길의 묘미'로 강조하여 서사에 반영.

### 4.8 Fact Verification UI & Card - `[UI/UX Enhancement]`
- **Fact Chips**: 장소 카드 상단에 별점(⭐), 리뷰 수(💬), 공공 인증(🏆) 배지를 노출하여 데이터의 출처와 신뢰도를 사용자에게 시각적으로 즉시 증명합니다.
- **Verified Badge**: 4축 점수 및 `verificationStatus`가 임계치 이상인 장소에는 'Verified' 마크를 부여하여 추천의 근거를 명확히 합니다.
- **Role Display**: 여정 내 각 장소의 역할(가는 길, 현지 추천 등)을 카테고리 칩으로 표시하여 동선 이해를 돕습니다.

---

## 💾 5. 인프라 및 데이터 파이프라인 안정성 (Data Resiliency)
스마트 캠핑 플랜은 공공데이터의 불안정성을 극점으로 고려하여 설계되었습니다.

1. **ETL 에러 조기 경보 및 우회**:
   - **SMBA (403 Forbidden)**: API 권한 승인 지연 시 카카오 로컬 API로 즉시 Fail-over.
   - **NMC (Empty Response)**: 법정동 코드 인코딩 오류 발생 시 반경 기반 공간 쿼리(`get_master_places_in_radius`)로 대체.
   - **TourAPI (XML Data)**: JSON 응답 강제 및 XML 찌꺼기 감지 시 `try-catch`로 파이프라인 중단 방지.
2. **Open-Meteo 전일 기상 조회 (Fallback)**: KMA 기상청 중기/단기 API가 일 처리량을 초과할 경우 즉각 Open-Meteo로 우회하여 여행 전체의 일자별 `Day 1, Day 2, Day 3` 날씨 요약을 추출합니다. **Open-Meteo는 비상업적 용도의 경우 별도의 인증키(API Key) 없이 작동하므로**, 추가 환경 변수 설정 없이 즉각적인 장애 대응이 가능합니다.
3. **API Endpoint Resilience (2026-03-14 Post-Mortem)**: 
    - **MOIS API Issue**: `B552061` 및 `1741000` 일부 엔드포인트는 주기적으로 HTTP 500 에러를 반환하거나 JSON 타입을 지원하지 않는 불안정성을 보입니다.
     - **Gold Standard (LocalData)**: 이 문제를 해결하기 위해 **`localdata.go.kr`의 CSV/XLSX 원본 파일 직접 동기화**를 상시 동기화의 **Gold Standard(표준)**로 확정했습니다. `scripts/sync-master-places.mjs`(구 `master-sync-reliability.mjs` 로직 통합)를 통해 API 장애 시에도 전국 데이터 동기화의 연속성을 보장합니다.
     - **Memory-Safe Chunking**: 전국 단위(10만 건+) 대용량 데이터 처리 시 타임아웃을 방지하기 위해 **100건 단위 청크 처리 및 1,000건당 3초의 GC 지연 시간**을 강제 적용하여 인프라 안정성을 확보했습니다.
4. **Timezone-Aware Cron Job**:
     - **KST (UTC+9) 고정**: 서버 시간(UTC) 오차로 인한 매칭 실패를 방지하기 위해, 모든 스케줄링 로직은 **한국 시간(KST)으로 보정된 날짜**를 기준으로 '3일 전' 예약자를 정확히 타겟팅합니다.
    - **Safe Restaurant API**: 농식품부 API(`211.237.50.150`)를 유지하되, 일일 쿼터 및 키 오류 발생 시 즉시 `debug_safe_rest.mjs`에서 검증된 키로 복구하는 체계를 유지합니다.
    - **MART Coordinate Correction**: 행안부 대규모점포 데이터의 중부원점(`EPSG:5174`) 좌표를 `proj4` 라이브러리를 통해 위경도(`WGS84`)로 변환하여 저장함으로써 위치 정보의 정확성을 확보합니다.
    - **Gemini 1.5 Flash**: 모델 및 엔드포인트 규격(`v1beta`)을 지속적으로 점검하여 AI 서사 생성의 연속성을 유지합니다.
4. **PostGIS Radius Search**: 모든 데이터 질의는 Vercel 배포 시 `get_master_places_in_radius` SQL 함수 1회 호출로 묶여 실행됩니다. 이후 Vercel Node 컴파일 서버에서 분류/가중치 로직이 10 밀리초 단위로 수행됩니다.
5. **Prompt Resiliency**: LLM 호출 에러 시, `narration` 문장만 "캠퍼님을 위한 특별한 여정이 준비되었습니다."라는 Fallback 문구로 대체되며, Top 15 리스트를 프론트 화면상에서 그대로 렌더링되도록 보호됩니다.

---

## 🛡️ 6. 대규모 확장을 위한 예약 기반 동적 권역 파이프라인 (Phase 10 Scale-Up)
전국 3,500여 개 캠핑장을 목적지로 두는 대규모 트래픽 발생 시 API 한도 초과(Rate Limit) 및 서버 부하를 완벽히 막아내는 **"D-3 Geo-Clustering (지리적 병합)"** 아키텍처가 적용되어 있습니다.

1. **예약 기반 동적 타겟팅 (D-3 Focus)**
   - 매일 새벽 6시 Cron Job은 무의미하게 전국 데이터를 긁어오지 않습니다. 오직 **캠핑일 기준 정확히 3일 전(D-3)** 에 해당하는 예약건들만 색인(Index)하여 타겟 목적지(캠핑장) 좌표를 추출합니다.
   - **실시간 API 수집**: 추출된 좌표를 기반으로 국립중앙의료원(`HOSPITAL`) 및 한국관광공사(`FESTIVAL`) API를 실시간 호출하여 가장 최신의 정보를 `smart_plan_facts` 테이블에 캐싱합니다.
2. **Geo-Clustering 병합 (20km 반경)**
   - 추출된 예약자 좌표들 중 임의의 좌표간 거리가 20km 이내로 겹칠 경우, 하나의 거점(Cluster Node)으로 강제 병합합니다. (예: 예약자가 10만 명이라도 거점은 50개 이내로 압축됨)
3. **API 스로틀링 딜레이 (Throttling)**
   - 병합된 각 거점을 순회하며 공공데이터 API를 호출할 때, `setTimeout`을 통해 3초(3000ms)의 비동기 지연을 발생시켜 관공서 서버의 DDoS 및 HTTP 429 차단을 원천 회피합니다.
4. **듀얼 DB 통합 영구 보존 및 쿼터 정책 (Dual-Persistence & Quota)**
   - **`master_places` 유기적 증식**: D-3 크론잡이 실시간 수집한 병원, 주유소, 축제 API 원문 데이터를 `master_places`에 업서트합니다. 
   - **카테고리별 병렬 쿼터(Parallel Fetch)**: 대규모 트래픽 하에서도 데이터가 잘리지 않도록 **식당(1000개), 마트(100개), 명소(100개)** 등 카테고리별로 독립적인 수집 쿼터를 보장하는 병렬 조회 파이프라인(SQL RPC 기반)을 운영합니다.
   - **`smart_plan_facts` 정예화 누적 (TTL 폐기)**: 1차 선별과 카카오 품질 검증까지 무사히 마친 15~20개의 고급 데이터들은 `smart_plan_facts`에 Upsert되어 최고급 에셋으로 영구 누적됩니다.
   - **결정론적 ID (UUID v5)**: 두 테이블 모두 `api_source + 상호 + 주소` 기반의 고유 ID를 생성하여 하이브리드 동기화 체계를 완성했습니다.
5. **프런트엔드 접근 차단 (Date Guard)**
   - 확정성 높은 **초정밀 기상청 단기예보(강수량/풍속)** 와 위에서 수집된 현지 팩트들이 완전히 캐싱되는 시점인 **캠핑 3일 전(D-3) 오전 9시** 정각이 되기 전까지, 프런트엔드의 `[스마트 플랜 생성]` 버튼을 강제 비활성화하여 AI의 환각(Hallucination) 및 엉뚱한 동선 제안을 차단합니다. 

---

## 🏗️ 7. 하이브리드 마스터 DB 동기화 시스템 (Phase 12: Persistent Hybrid Engine)
전국 10만 건 이상의 정적 마스터 데이터와 매주 새롭게 유입되는 동적 데이터를 단일한 영구 데이터베이스(Single Source of Truth)로 관리하여, 고속(10ms) 추천과 데이터 자산화를 동시에 달성하는 하이브리드 엔진입니다.

1. **데이터 스토리지 구조 (Dual-Table)**:
   - `master_places`: 식당, 마트, 명소, 카페 등 일반 장소를 위한 `GIST(geometry)` 인덱스 적용 테이블.
   - `master_places_gas`: 겨울철 등유 수급이 핵심인 주유소 전용 테이블 (`trust_score` 90점 이상 고정 관리).
2. **주간 풀-페이지네이션 동기화 (Weekly Batch)**:
   - 매주 월요일 06:00 KST, 공공 API 및 **LocalData 전체 파일**을 전수 조사하여 최신 데이터를 업데이트합니다.
   - **실행 환경**: `scripts/sync-master-places.mjs` (Reliability Engine v5.2 통합 버전).
   - **핵심 로직**: UUID v5 결정론적 ID(Pipe 구분자), 동적 컬럼 탐색, Name+Address 메모리 인덱스 기반 고속 병합.
   - **결정론적 ID (UUID v5)**: `api_source + 상호 + 주소`를 조합한 고유 ID를 생성합니다. (단일 장소가 여러 인증을 받은 경우 각각 수집하여 신뢰도 지표로 활용 가능)
   - **지오코딩 중복 스킵**: 배치 시작 시 DB의 기존 주소를 메모리에 캐싱하여, 이미 좌표가 있는 주소는 카카오 API를 호출하지 않습니다. 첫 주에만 수만 건 호출하며 이후에는 신규 항목만 지오코딩을 수행합니다.
   - **좌표계 표준화 (Proj4)**: 행안부 TM 좌표(`EPSG:5174`)를 위경도(`WGS84`)로 변환하여 적재 실패를 해결합니다.
   - **Upsert 패턴**: 생성된 고유 ID를 Primary Key로 삼아 `onConflict: id` 전략으로 중복 없이 정보를 업데이트합니다.
   - **Throttling**: 관공서 서버 부하를 방지하기 위해 0.5~1초의 의도적 지연을 삽입합니다.
3. **출처 신뢰 계층 (Existence Score의 source_confidence 기반)**:
   - `55~60점`: 백년가게(SMBA_BAEK), 안심식당(SAFE_RESTAURANT), 병원(NMC_HOSPITAL), 오피넷(OPINET), 카카오 검증(MASTER_ENRICHED)
   - `45~50점`: 한국관광공사 등록 명소(TOUR_SPOT/TOUR_CAFE), 모범음식점(MOIS_GOOD_RESTAURANT), 대규모점포(MART)
   - `30~40점`: 일반 상권 정보(LARGE_STORE) 및 기타 데이터
   - 이 점수는 v2 4축 체계의 **Existence 축**에 반영되며, 카테고리별 가중치와 결합해 `finalScore`를 결정합니다. 공공기관 인증 장소가 자연스럽게 상위에 배치됩니다.
4. **공간 인덱싱 (GIST Index)**:
   - 위경도 좌표를 PostGIS의 `geometry(Point, 4326)` 타입으로 변환 저장하여, 반경 20km 검색 시 수십만 건의 레코드 중에서도 10ms 이내에 결과를 반환합니다.

---
**라온아이 프로젝트 SSOT 기준 문서 - 9 카테고리 8단계 개편 및 Phase 11/12 하이브리드 엔진 통합 사양**
