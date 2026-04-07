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
    *   **이중 쿼터 시스템 (Dual-Quota System v11.5)**: 서버 부하 방지와 고품질 데이터 선별을 위해 이중 쿼터 체계를 적용합니다.
        1. **1번 쿼터 (DB 추출)**: 마스터 DB(SQL RPC)에서 반경 30km의 데이터를 넉넉하게 확보하는 안전 그물망.
        2. **2번 쿼터 (정예 선별)**: 확보된 데이터를 점수순(Trust Score DESC, Distance ASC)으로 자른 후 카카오 정밀 검증 및 스마트플랜 DB에 적재하는 최종 후보수.
    *   **전이중 지역 로테이션 및 통합 CSV 다이렉트 스트리밍 (v11.8 vNext)**: 잦은 500 에러 및 WAF 차단을 유발하던 과거의 OpenAPI(1741000)를 전면 폐기하고, **LocalData(행정안전부)의 지역별 공식 파일(CSV) 다운로드 엔드포인트**를 `Referer` 우회 기법으로 다이렉트 스트리밍하여 인메모리 파싱하는 무손실 파이프라인으로 전면 개방(Gold Standard)했습니다.
        - **Target Categories**: 대규모점포, 기타식품판매업, 모범음식점. (순수 CSV 포맷 연동)
        - **DB 레벨 카테고리 Quota 상한 (1번 쿼터)**: 전교 석차를 매기듯이 상위권 데이터를 DB 레벨에서 1차 차단합니다:
          | 카테고리 | 1번 쿼터(DB) | 2번 쿼터(정예) | 비고 |
          |---------|------------|------------|------|
          | RESTAURANT | 1000 | 300 | 1차 석차 1,000위 내외 선별 |
          | SPOT | 500 | 300 | 인지도 기반 500개 추출 |
          | MART | 100 | 20|SSM/대형마트 포함 |
          | HOSPITAL | 100 | 15 | 긴급 의료시설 우선 |
          | GAS_STATION | 100 | 10 | 최저가 및 거리 기준 |
          | FESTIVAL | 100 | 15 | 일정 중복 축제 우선 |
        - 이후 Step 5.5의 v2 4축 점수 계산을 거쳐 최종 Top 15(Top 3 Priority)를 선별합니다.
*   **Step 4. Phase 12: Real-time Verification (Track B - 가는 길 팩트)**: 중간지점(Midpoint) 반경 내에서 [식당], [카페], [명소]를 조회합니다. 
    *   **기술 사양 (Anti-Bot)**: 카카오맵의 CSR 렌더링 및 봇 차단을 우회하기 위해 `User-Agent`, `Referer` 헤더를 위조하고, `place-api.map.kakao.com`의 비공개 JSON 엔드포인트(`/places/panel3/`, `/places/reviews/kakaomap/meta/`)를 직접 호출하여 별점/리뷰 수를 JSON 형태로 추출합니다. (**cheerio HTML 파싱이 아닌 JSON API 직접 호출 방식**)
    *   **카페 데이터**: 식당 API 데이터 중 업종 분류가 '카페'인 항목과 카카오 검색을 결합하여 추출합니다.
    *   **2차 정제 (v2.1 Fail-soft 정책)**: 선별된 후보군에 대해 카카오 스크래퍼(`scraper.ts`)를 가동하여 **실시간 별점 및 리뷰 수**를 획득합니다. **실시간 검증 성공 여부와 관계없이 후보 자체는 유지**하며, 검증 결과는 `FactCard.evidence`와 `verificationStatus`에 기록합니다.
        - 검증 성공: `verificationStatus = VERIFIED`, `api_source = MASTER_ENRICHED`. **1차 선별 점수를 그대로 유지하되 100점 상한(Cap)을 적용하지 않음.**
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

    **최종 공식 (v3.2 개정):**
    ```
    finalScore = round(Existence×W1 + Quality×W2 + ContextFit×W3 + Logistics×W4) - riskPenalty + diversityBonus
    ```
    `FactCard.trustScore`에는 하위 호환을 위해 `finalScore`가 채워지며, **100점 상한제(Cap)를 전면 폐지**하여 우수한 장소가 100점 이상의 높은 변별력을 갖도록 합니다. (카카오 검증 자체에 대한 일괄 가산점은 부여하지 않으며, 실시간 별점/리뷰 데이터는 Phase 3 엔진에서 반영합니다.)
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

### 4.1 국립중앙의료원 병원 / 의원 - `[HOSPITAL]` (v10.6 고도화)
- **데이터 소스**: (1순위) 국립중앙의료원 응급의료기관 API (실시간), (2순위) **카카오 로컬 HP8 (종합병원 등급)**, (3순위) 마스터 DB.
- **중복 제거 및 정예화 (v10.6)**: 상호명 및 주소(앞 15자) 기반 그룹화를 통해 동일 시설의 중복 노출을 원천 차단합니다.
- **계층형(Hierarchy) 스코어링 및 가중치 (v10.6)**: 
    1. **Tier 1 (100점)**: NMC 인증 응급의료기관, 권역센터, 종합병원, 의료원.
    2. **Tier 2 (70점)**: 일반 의원 (내과, 소아과, 외과, 가정의학 등 실제 캠핑 중 이용 가능 과목).
    3. **Tier 3 (50점)**: 공공 보건소 및 보건지소.
- **응급 / 야간 특별 가점 (+40점)**: '응급', '야간', '24시', '응급실' 키워드 감지 시 가산점을 부여하여 긴급 상황 시 최상단에 노출되도록 강제합니다.
- **Safety Filter (노이즈 필터 확대)**: 정신병원, 동물병원, 보건행정관 외에도 **성형외과, 피부과, 요양, 뷰티, 비만, 디톡스, 안과, 산후조리, 한의원, 치과** 등 캠핑 중 긴급 의료와 무관한 시설을 정밀 필터링합니다.
- **거리 가중치**: 반경 30km 확장 검색 결과를 이 계층별 점수와 합산하여 최종 상위 10~15개를 선별합니다.

### 4.2 대형마트 및 지역 거점 마트 - `[MART]`
- **데이터 소스 (v11.8 vNext Gold Standard)**:
    1. **LOCALDATA_MART_LARGE**: 행안부 대규모점포 (매일 지역별 CSV 파일 다이렉트 다운로드 및 스트림 파싱).
    2. **LOCALDATA_MART_OTHER**: 행안부 기타식품판매업(슈퍼) (매일 지역별 CSV 파일 다이렉트 다운로드 및 스트림 파싱).
- **브랜드 우선순위 스코어링 (v10.0 고도화)**:
    1. **🥇 하나로마트/NH (90점)**: 지역 농지 거점 및 식재료 구비 강점.
    2. **🥈 대협 3사 (80점)**: 이마트, 롯데마트, 홈플러스, 노브랜드, 트레이더스.
    3. **🥉 SSM/기타 (65점)**: 식자재마트, 이마트에브리데이, 홈플러스익스프레스.
- **Noise Filter**: 캠핑 식재료와 무관한 '패션아울렛', '의류타운', '슈즈/가전/가구 전문점' 원천 제외.
- **Supper Logic (v10.4)**: 일요일 포함 일정에 대형마트 휴무 위험(Risk Penalty -15)을 적용하며, 하나로마트에는 Diversity Bonus(+5) 및 브랜드 로열티 점수를 부여하여 지역 거점 활성화를 우선합니다.
- **편의점 폴백 (Mart Fallback v10.4)**:
    - **발동 조건**: 30km 반경 내 마트(대규모/준대규모/중형) 검색 결과가 3개 미만일 경우.
    - **보충 로직**: 카카오 로컬 API(`CS2` 카테고리)를 실시간 호출하여 부족분만큼(최종 3개 보장) 가장 가까운 편의점을 `MART` 후보군에 강제 편입합니다.
    - **데이터 식별**: 설명(Description)에 `[편의점 폴백]` 접두어를 추가하고, `isFallback: true` 플래그를 부여하여 AI가 "대형 마트 대신 가까운 편의점"으로 안내하게 합니다.
- **점수(Score)**: 가중치 `[E:0.30, Q:0.10, CF:0.20, L:0.40]`. 존재 확실성(Existence) 최우선. 영유아 동반 시 '소아/아동' 키워드가 `persona_match=45`로 반영.

### 4.3 우수 식당 (인증별 가중치 합산 및 중복 제거) - `[RESTAURANT]`
- **데이터 소스**: (1순위) 소진공 백년가게(SMBA_BAEK - ODCloud Swagger API UDDI 직접 탐색 탑재), (2순위) **행안부 모범음식점(LOCALDATA_RESTAURANT_GOOD - 지역별 CSV 다이렉트 다운로드 및 스트리밍 파싱)**, (3순위) 농림축산부 안심식당(SAFE_RESTAURANT - 실시간 API).
- **인증별 가중치 합산 (v10.4 고도화)**: 
    - **병합(Deduplication)**: 상호명과 주소가 동일한 업소는 하나로 통합하여 인증 점수를 누적 합산합니다.
    - **가중치 부여**: `Base 10 + 백년가게(50) + 모범음식점(30) + 안심식당(20)`
    - **예시**: 백년가게이자 안심식당인 경우 **80점**(10+50+20)의 고득점 획득 (변별력 극대화).
- **Noise Filter (v10.4 강화)**: 백년가게/안심식당 데이터 중 비음식점 업종인 '안경원', '의상실', '장례식장', '보청기', '수선/공방' 등 12종 키워드 원천 제외.
- **1차 선별 (v11.0 쿼터 확대)**: 위 합산 점수를 기준으로 정렬하되, 동일 점수 시 거리(Logistics) 점수를 합산하여 최종 **300개**를 선별하여 카카오 정밀 검증(Step C)에 진입시킵니다.
- **점수(Score)**: 가중치 `[E:0.20, Q:0.30, CF:0.30, L:0.20]`. 품질(Quality)과 적합성(ContextFit) 균형. 비 날 '탕/찌개/국밥'의 `weather_match=45`, 맑은 날 '막국수/냉면'의 `weather_match=40`, 아이동반 시 '돈까스/어린이'의 `persona_match=40`.

### 4.4 주유소 (v10.7 고도화)
- **데이터 소스**: 오피넷(OPINET) 실시간 API (실내등유 전용 코드 **`C004`** 연동)
- **수집 전략 (30km Spiral Search)**: 주간 배치(정적)에서 제외하고, 캠핑 3일 전(D-3) 캠핑장 중심 **5km부터 최대 30km까지 5km 단위로 나선형 확장 검색**을 수행합니다. **동절기(11월~3월)**에는 실내등유 수급이 가능한 주유소 5곳이 확보될 때까지 API를 재귀적으로 호출하는 집요한 탐색망을 가동합니다.
- **좌표계 및 필드 표준화**: 오피넷 API의 특수 좌표계(**TM128/네이버 KATEC**)를 위경도로 정밀 변환하여 위치 오차를 제거합니다. 
- **주소 보강(Reverse Geocoding) 폴백 체인**: 오피넷 API에서 주소가 누락(`VAN_ADR` 빈값)될 경우를 대비해 다음과 같은 3중 보강 체계를 가동합니다:
    1. **1순위**: `VAN_ADR` (API 기본 주소)
    2. **2순위**: `NEW_ADR` (도로명 주소)
    3. **3순위 (최종 보루)**: 변환 완료된 **WGS84 좌표를 카카오 로컬 API (`coord2address`)로 역지오코딩**하여 실제 주소를 강제 확보합니다.
- **검증**: 응급 상황에 대비해 `PRICE`와 `K_PRICE` 필드를 교차 검증하여 등유 판매 여부를 2중 확인합니다.
- **1차 선별 (v10.7)**: 30km 나선형 수집본 중, 최저가순(PRICE)을 1순위로, 최단거리를 2순위로 정렬하여 10~20개를 선별합니다.
- **점수(Score)**: 가중치 `[E:0.30, Q:0.10, CF:0.20, L:0.40]`. **동절기(11월~3월)** 시 `weather_match=50`으로 ContextFit 축이 만점 근접하여 최상위 배치.

### 4.5 관광 기관 API (현지 명소/관광지) - `[SPOT]` (v11.8 고도화)
- **TourAPI v2 아키텍처 이관**: 잦은 에러 충돌을 유발했던 구형 파라미터(`listYN` 등)를 폐기하고, 한국관광공사의 차세대 `KorService2/areaBasedList2`로 엔드포인트 세대 교체를 완료하여 200 OK 소통 신뢰성을 완전히 복구했습니다.
- **1차 선별 및 스코어링 로직 (v10.5)**: 
    1. **S-Tier 키워드 가점 (+45점)**: 국립, 수목원, 휴양림, 관광지, 출렁다리, 모노레일, 케이블카, 해수욕장, 테마파크, 사찰, 읍성 등 상징성이 높은 키워드에 가산점을 부여합니다.
    2. **A-Tier 키워드 가점 (+30점)**: 박물관, 미술관, 천문대, 역사, 향교, 전통가옥 등 문화·교육적 명소에 가산점을 부여합니다.
    3. **인기도 지표 (ReadCount)**: TourAPI에서 제공하는 통계 기반 조회수(`readcount`) 필드를 연동하여 실제 인기도에 따라 차등 가점(최대 +40)을 부여합니다.
    4. **디지털 자산 가점**: 선명한 대표 이미지(`firstimage`) 및 상세 설명(100자 이상) 보유 시 최대 +40점의 가점을 통해 정보 신뢰도가 높은 곳을 우선 노출합니다.
- **1차 선별 (v11.0 쿼터 확대)**: 위 스코어링을 통해 산출된 상위 **300개**를 선별하여 카카오 정밀 검증(Step C)에 진입시킵니다.
- **점수(Score)**: 가중치 `[E:0.20, Q:0.20, CF:0.35, L:0.25]`. ContextFit 최우선. 비 날 실내/박물관 `weather_match=45`, 맑은 날 수목원/야외 `weather_match=45`. 비 날 야외 명소는 `weather_match=10`으로 자연 감점.

### 4.6 지역 축제 / 오일장 - `[FESTIVAL]` (v10.7 고도화)
- **일정 연동 필터링 (v10.7)**: 사용자의 실제 캠핑 일정(`startDate`~`endDate`)과 축제 개최 기간(`eventstartdate`~`eventenddate`)이 1일이라도 겹치는 항목만 노출하도록 지능형 기간 필터링을 적용합니다.
- **스코어링 로직**: 명소(`SPOT`)의 인기도 및 상징성 가중치 체계를 그대로 상속받으며, 축제 카테고리 기본 가점(+40)을 추가하여 다른 관광지보다 우선 추천되도록 설계되었습니다.
- **v2.1 featured 슬롯 운영**: 축제는 일반 카테고리와 별도로 **`FEATURED` 슬롯**으로 우선 배치되어 지역 특색을 극대화합니다.

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
3. **API Endpoint Resilience (v11.8 Post-Mortem & Architecture Shift)**: 
    - **OpenAPI 1741000 WAF 차단 이슈**: 행안부 1741000 계열 API는 지속적으로 HTTP 500 에러와 WAF(방화벽) 차단을 유발했습니다.
    - **LocalData Direct CSV Streaming**: API를 강제로 찌르는 대신, 사람이 직접 다운받는 URL(`file.localdata.go.kr/...`)에 `Referer` 헤더를 위장 전송하여, **매일 해당 시도(SIDO)의 CSV 파일만을 다운받아 `csv-parser`와 `iconv-lite`로 메모리 상에서 실시간 스트리밍 파싱**하는 기법(Gold Standard)을 전격 도입하여 방화벽 장애와 메모리 폭발을 원천 봉쇄했습니다.
    - **동적 백년가게 UDDI 경로 복구기**: 소상공인시장진흥공단의 백년가게 API 경로(UDDI)가 임의 수정으로 수시 파괴되던 현상을 탐지하고, `getLatestOdcloudPath`(Swagger 문서 실시간 파싱) 모듈을 통해 어떤 환경에서도 최신의 접근 경로를 자동 복원하는 자가수복(Self-Healing) 로직을 이식했습니다.
4. **Timezone-Aware Cron Job**:
     - **KST (UTC+9) 고정**: 서버 시간(UTC) 오차로 인한 매칭 실패를 방지하기 위해, 모든 스케줄링 로직은 **한국 시간(KST)으로 보정된 날짜**를 기준으로 '3일 전' 예약자를 정확히 타겟팅합니다.
    - **Safe Restaurant API**: 농식품부 API(`211.237.50.150`)를 유지하되, 일일 쿼터 및 키 오류 발생 시 즉시 `debug_safe_rest.mjs`에서 검증된 키로 복구하는 체계를 유지합니다.
    - **MART Coordinate Correction**: 행안부 대규모점포 데이터의 중부원점(`EPSG:5174`) 좌표를 `proj4` 라이브러리를 통해 위경도(`WGS84`)로 변환하여 저장함으로써 위치 정보의 정확성을 확보합니다.
    - **Gemini 1.5 Flash**: 모델 및 엔드포인트 규격(`v1beta`)을 지속적으로 점검하여 AI 서사 생성의 연속성을 유지합니다.
4. **PostGIS Radius Search & Parameter Standardization**: 
    - 모든 데이터 질의는 Vercel 배포 시 `get_master_places_in_radius` SQL 함수 1회 호출로 묶여 실행됩니다. 
    - **RPC 파라미터 표준화**: 카테고리 필터링이 누락되거나 잘못된 값이 전달되지 않도록 모든 호출은 **`p_category`** 파라미터를 명시적으로 사용하여 카테고리별 쿼터(Quota)를 엄격히 준수합니다. (2026-03-25 수정보완)
    - 이후 Vercel Node 컴파일 서버에서 분류/가중치 로직이 10 밀리초 단위로 수행됩니다.
5. **Upsert Conflict Guard & Coordinate Preservation**: 
    - **UUID 충돌 선제 방어**: 수집된 배열 내부에 동일한 ID(`UUID v5`)가 2개 이상 존재할 경우 Supabase 삽입 거부를 막기 위해 자바스크립트 레벨에서 사전 병합(Grouping)합니다.
    - **좌표(lat/lng) 무결성 보상 로직 (v11.8 vNext)**: 로테이션 작업 시 기존 팩트들이 텍스트(주소) 단위로 무자비하게 덮어쓰여질 때 `lat`/`lng` 가 NULL 값으로 변질되어 `not-null` DB 제약 조건이 터지는 치명적인 사고를 막기 위해 **1) 기존 데이터의 좌표는 무조건 보존(상속)** 하며, **2) 완전 신규 데이터는 기초 좌표를 `(0.0, 0.0)`으로 바인딩 보호**하는 2중 안전 장치를 구동합니다.
6. **Audit & Telemetry (파이프라인 모니터링)**:
    - **로그 기록**: `automation_logs` 테이블의 `api_status` 필드를 통해 각 소스별 `fetched`, `existing`, `new` 건수를 대조 모니터링합니다. 
    - **장애 진단**: 파이프라인 응답은 정상이지만 결과 데이터가 없는 경우, `automation_logs`의 `message` 필드(JSON)를 분석하여 단계별 유실 지점을 즉시 파악합니다.
7. **Prompt Resiliency**: LLM 호출 에러 시, `narration` 문장만 "캠퍼님을 위한 특별한 여정이 준비되었습니다."라는 Fallback 문구로 대체되며, Top 15 리스트를 프론트 화면상에서 그대로 렌더링되도록 보호됩니다.

---

## 🛡️ 6. 대규모 확장을 위한 예약 기반 동적 권역 파이프라인 (Phase 10 Scale-Up)
전국 3,500여 개 캠핑장을 목적지로 두는 대규모 트래픽 발생 시 API 한도 초과(Rate Limit) 및 서버 부하를 완벽히 막아내는 **"D-3 Geo-Clustering (지리적 병합)"** 아키텍처가 적용되어 있습니다.

1. **예약 기반 동적 타겟팅 (D-3 Focus)**
   - 매일 새벽 6시 Cron Job은 무의미하게 전국 데이터를 긁어오지 않습니다. 오직 **캠핑일 기준 정확히 3일 전(D-3)** 에 해당하는 예약건들만 색인(Index)하여 타겟 목적지(캠핑장) 좌표를 추출합니다.
    - **실시간 API 수집 & 하이브리드 폴백(v10.4)**: 추출된 좌표를 기반으로 국립중앙의료원(`HOSPITAL`) 및 한국관광공사(`FESTIVAL`) API를 실시간 호출합니다. 특히 **마트 데이터 부족 시 실시간 카카오 `CS2` API를 즉각 호출**하여 정적 데이터와 실시간 데이터를 병합해 `smart_plan_facts`에 캐싱합니다.
2. **Geo-Clustering 병합 (20km 반경)**
   - 추출된 예약자 좌표들 중 임의의 좌표간 거리가 20km 이내로 겹칠 경우, 하나의 거점(Cluster Node)으로 강제 병합합니다. (예: 예약자가 10만 명이라도 거점은 50개 이내로 압축됨)
3. **API 스로틀링 딜레이 (Throttling)**
   - 병합된 각 거점을 순회하며 공공데이터 API를 호출할 때, `setTimeout`을 통해 3초(3000ms)의 비동기 지연을 발생시켜 관공서 서버의 DDoS 및 HTTP 429 차단을 원천 회피합니다.
4. **듀얼 DB 통합 영구 보존 및 쿼터 정책 (Dual-Persistence & Quota)**
   - **`master_places` 유기적 증식**: D-3 크론잡이 실시간 수집한 병원, 주유소, 축제 API 원문 데이터를 `master_places`에 업서트합니다. 
   - **카테고리별 병렬 쿼터(Parallel Fetch)**: 대규모 트래픽 하에서도 데이터가 잘리지 않도록 **식당(1000개), 마트(100개), 명소(100개)** 등 카테고리별로 독립적인 수집 쿼터를 보장하는 병렬 조회 파이프라인(SQL RPC 기반)을 운영합니다.
   - **`smart_plan_facts` 정예화 누적 (TTL 폐기)**: 1차 선별과 카카오 품질 검증까지 무사히 마친 15~20개의 고급 데이터들은 `smart_plan_facts`에 Upsert되어 최고급 에셋으로 영구 누적됩니다.
   - **결정론적 ID (UUID v5)**: 두 테이블 모두 `api_source + 상호 + 주소` 기반의 고유 ID를 생성하여 하이브리드 동기화 체계를 완성했습니다.
5. **프런트엔드 접근 차단 및 Deduplication (Date & Sync Guard)**
   - **Date Guard**: 확정성 높은 **초정밀 기상청 단기예보(강수량/풍속)** 와 현지 팩트들이 완전히 캐싱되는 시점인 **캠핑 3일 전(D-3) 오전 9시** 전까지, 프런트엔드의 `[스마트 플랜 생성]` 버튼을 비활성화하여 AI의 환각을 차단합니다. 
   - **Deduplication Logic**: 수집과 적재 사이 단계에서 `uniqueFacts` 필터를 통해 데이터의 무결성을 보장하며, DB 적재 실패 시 텔레메트리 로그를 통해 즉시 원인을 진단합니다.

---

## 🏗️ 7. 하이브리드 마스터 DB 동기화 시스템 (Phase 12: Persistent Hybrid Engine)

### 7.1.1 데이터 원천 및 저장소 정밀 명세 (Standard Mapping)

모든 정적 데이터는 `master_places` 테이블에 저장되며, 다음의 표준 매핑을 엄격히 준수합니다.

| 분류 | 공식 API 명칭 (외부) | 코드 식별자 (`api_source`) | 내부 카테고리 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **마트** | 행정안전부_생활_대규모점포 | `LOCALDATA_MART_LARGE` | `MART` | **LocalData 지역별 CSV 다이렉트 스트리밍 (17일 순환)** |
| | 행정안전부_식품_식료품판매업(기타) | `LOCALDATA_MART_OTHER` | `MART` | **LocalData 지역별 CSV 다이렉트 스트리밍 (17일 순환)** |
| **식당** | 행정안전부_모범음식점정보 | `LOCALDATA_RESTAURANT_GOOD` | `RESTAURANT` | **LocalData 지역별 CSV 다이렉트 스트리밍 (17일 순환)** |
| | 소상공인_전국 백년가게 | `SMBA_BAEK` | `RESTAURANT` | ODCloud Swagger 자가탐색 `getLatestOdcloudPath` |
| | 농림축산부 안심식당 | `SAFE_RESTAURANT` | `RESTAURANT` | 농식품부 API (211.237.50.150) 유지 |
| **명소** | 관광공사_명소정보 | `TOUR_SPOT` | `SPOT` | **TourAPI v2.0 (KorService2) 이관 완료** |

- **Storage**: `public.master_places` 테이블 (PostgreSQL/PostGIS)
- **ID Strategy**: `UUID v5 (Namespace: 6ba7b810...)` 기반 `id = uuidv5(api_source + name + address)`
- **Coordinate**: `EPSG:5174` -> `WGS84` (Proj4 변환 후 `location` 필드 저장)

과거의 주간 전국 단위 배치(Weekly Batch)와 CSV 기반 마트 관리는 폐기되었습니다. 현재 모든 정적 마스터 데이터는 **행안부 OpenAPI(1741000)**를 기반으로 전국 17개 시도를 매일 1곳씩 순환하며 정밀 동기화합니다.

### 7.1 데이터 원천 및 저장소 정밀 명세 (Standard Mapping)

모든 데이터는 `master_places` 테이블에 저장되며, `is_active` 필드를 통해 사업장 상태를 실시간(17일 주기)으로 관리합니다.

| 분류 | 공식 API 명칭 (외부) | 코드 식별자 (`api_source`) | 내부 카테고리 | 동기화 주기 |
| :--- | :--- | :--- | :--- | :--- |
| **마트** | 행안부_대규모점포 (CSV) | `LOCALDATA_MART_LARGE` | `MART` | 17일 지역 로테이션 (CSV 스트리밍) |
| | 행안부_기타식품판매업 (CSV) | `LOCALDATA_MART_OTHER` | `MART` | 17일 지역 로테이션 (CSV 스트리밍) |
| **식당** | 행안부_모범음식점 (CSV) | `LOCALDATA_RESTAURANT_GOOD` | `RESTAURANT` | 17일 지역 로테이션 (CSV 스트리밍) |
| | 소상공인_백년가게 (API) | `SMBA_BAEK` | `RESTAURANT` | 17일 지역 로테이션 (UDDI 자동탐색) |
| | 농식품부_안심식당 (API) | `SAFE_RESTAURANT` | `RESTAURANT` | 17일 지역 로테이션 |
| **명소** | 관광공사_명소정보 (API) | `TOUR_SPOT` | `SPOT` | 17일 지역 로테이션 (TourAPI v2.0) |

### 7.1.1 D-3 동적 수집 데이터 상세 명세 (Dynamic Data)

예약 기준 3일 전(D-3)에 실시간으로 수집되어 `master_places`에 업서트되는 동적 데이터 규격입니다.

| 분류 | 공식 API 명칭 (외부) | 코드 식별자 (`api_source`) | 내부 카테고리 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **병원** | 국립중앙의료원_전국 응급의료기관 정보 | `NMC_HOSPITAL` | `HOSPITAL` | 실시간 응급의료정보 (D-3) |
| | 카카오 로컬 API (HP8) | `KAKAO_HP8` | `HOSPITAL` | 종합병원/의원 보완 데이터 |
| **주유소** | 한국석유공사_오피넷(Opinet) | `OPINET_GAS` | `GAS_STATION` | 실내등유(C004) 전용 (D-3) |
| **축제** | 관광공사_국문 관광정보 서비스_GW | `TOUR_FESTIVAL` | `FESTIVAL` | 지역 축제 및 행사 (D-3) |

### 7.1.2 17개 시도 API 표준화 매핑 (Region Standardization)

지역별로 서로 다른 API 파라미터 기준을 다음과 같이 일치화하여 통합 동기화 엔진에 적용합니다.

| 표준 시도명 (SIDO_ROTATION) | LocalData 시도 코드 (`orgCode`) | 농식품부(MAFRA) 필터링 | NMC(병원) STAGE1 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **서울특별시** | `6110000_ALL` | 서울특별시 | 서울 | 1:1 지역 스트리밍 |
| **부산광역시** | `6260000_ALL` | 부산광역시 | 부산 | 1:1 지역 스트리밍 |
| **대구광역시** | `6270000_ALL` | 대구광역시 | 대구 | 1:1 지역 스트리밍 |
| **인천광역시** | `6280000_ALL` | 인천광역시 | 인천 | 1:1 지역 스트리밍 |
| **광주광역시** | `6290000_ALL` | 광주광역시 | 광주 | 1:1 지역 스트리밍 |
| **대전광역시** | `6300000_ALL` | 대전광역시 | 대전 | 1:1 지역 스트리밍 |
| **울산광역시** | `6310000_ALL` | 울산광역시 | 울산 | 1:1 지역 스트리밍 |
| **세종특별자치시** | `5690000_ALL` | 세종특별자치시 | 세종시 | 1:1 지역 스트리밍 |
| **경기도** | `6410000_ALL` | 경기도 | 경기 | 1:1 지역 스트리밍 |
| **강원특별자치도** | `6530000_ALL` | 강원특별자치도 | 강원도 | 구 강원도 |
| **충청북도** | `6430000_ALL` | 충청북도 | 충북 | 1:1 지역 스트리밍 |
| **충청남도** | `6440000_ALL` | 충청남도 | 충남 | 1:1 지역 스트리밍 |
| **전북특별자치도** | `6540000_ALL` | 전북특별자치도 | 전북 | 구 전라북도 |
| **전라남도** | `6460000_ALL` | 전라남도 | 전남 | 1:1 지역 스트리밍 |
| **경상북도** | `6470000_ALL` | 경상북도 | 경북 | 1:1 지역 스트리밍 |
| **경상남도** | `6480000_ALL` | 경상남도 | 경남 | 1:1 지역 스트리밍 |
| **제주특별자치도** | `6500000_ALL` | 제주특별자치도 | 제주 | 1:1 지역 스트리밍 |

- **Storage**: `public.master_places` 테이블 (PostgreSQL/PostGIS)
- **Soft-Delete (is_active)**: 지역 순환 시 API 응답에 더 이상 존재하지 않는 데이터는 자동으로 `is_active = false` 처리됩니다.

### 7.2 명소 인기도 점진적 정밀화 (Popularity Rotation)
- 전국 1만여 개의 명소 중 매일 가장 오래된 **800건**의 `readcount`를 실시간 API로 갱신하여 인기도 지형도를 정교하게 유지합니다.

### 7.3 실행 엔진 및 스케줄링
- **실행 환경**: `scripts/daily-region-sync.mjs` (Vercel Cron / GitHub Actions)
- **실행 시각**: 매일 04:00 KST
- **모니터링**: 관리자 페이지(Admin Dashboard) 내 'Automation Logs'에서 7대 핵심 지표(신규, 갱신, 총계 등)를 실시간 확인 가능합니다.

---
**라온아이 프로젝트 SSOT 기준 문서 - 9 카테고리 8단계 개편 및 Phase 11/12 하이브리드 엔진 통합 사양**
