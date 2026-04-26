# Smart Camping Plan (Guided Journey) Core Engine Manual

라온아이의 핵심 가치인 '감성'과 '편안함'을 전달하기 위해, 사용자의 캠핑 일정을 기반으로 한 맞춤형 추천 여정(Guided Journey)을 구현하는 시스템의 개발 및 유지보수 매뉴얼입니다.

이 문서는 라온아이의 스마트 캠핑 플랜 기능 개발의 **단일 진실 공급원(SSOT)** 역할을 합니다. 다른 세션이나 개발자가 이 기능을 수정/확장할 때 반드시 이 문서를 기준으로 작업해야 합니다.

---

## 🏗️ 1. 아키텍처 철학 (Architecture Philosophy)

스마트 캠핑 플랜은 단순한 앱 기능이 아닌, 향후 B2B API 및 MCP(Model Context Protocol) 서버로 독립 가능한 **"헤드리스 지능형 엔진(Headless Intelligent Engine)"**으로 설계되었습니다.

1.  **UI/Logic Separation**: 추천 로직(`smartPlan.ts`)은 UI 컴포넌트와 완전히 분리되어 순수 데이터(JSON)만 반환합니다.
2.  **API Monetization Ready**: 생성된 데이터는 외부 에이전트(LLM)가 즉시 이해할 수 있도록 구조화된 JSON 포맷 및 메타데이터를 포함합니다.
3.  **Zero-Cost High-Fidelity**: 유료 데이터(내비게이션 트래픽 등)와 LLM 다중 호출을 지양하고, 공공데이터와 무료 API를 사용하여 비용 0원의 초정밀 팩트를 추출합니다.
4.  **Idempotent Data Standardization (SOP v11.3)**: 데이터 원천이 달라도 동일 장소라면 항상 같은 ID를 부여하는 '마스터 키' 전략을 통해 중복을 원천 차단하고 데이터 힐링(Healing)을 자동화합니다.

---

## 🛡️ 1.1 SOP v11.3 글로벌 ID 표준 규격 (Master Key Strategy)

데이터의 노이즈(공백, 괄호, 지역명 약어 등)에 관계없이 **동일한 실제 장소**라면 반드시 **동일한 UUID v5**를 생성해야 합니다. 모든 AI 어시스턴트와 엔진(`daily-sync`, `caching-plan`)은 반드시 아래의 정규화 로직을 따라야 합니다.

### [표준 정규화 코드 스니펫]

```javascript
// 1. 주소 표준화 (SIDO Unification)
function getNormalizedAddr(addr) {
  if (!addr) return '';
  let normalized = addr.trim();
  const hashSidoMap = {
    '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시',
    '광주': '광주광역시', '대전': '대전광역시', '울산': '울산광역시', '세종': '세종특별자치시',
    '경기': '경기도', '강원': '강원특별자치도', '충북': '충청북도', '충남': '충청남도',
    '전북': '전북특별자치도', '전남': '전라남도', '경북': '경상북도', '경남': '경상남도', '제주': '제주특별자치도'
  };
  for (const [short, full] of Object.entries(hashSidoMap)) {
    if (normalized.startsWith(short) && !normalized.startsWith(full)) {
      normalized = normalized.replace(short, full);
      break;
    }
  }
  return normalized;
}

// 2. 문자열 공격적 정제 (Aggressive Cleaning)
function getCleanString(str) {
  if (!str) return '';
  return String(str)
    .replace(/\(.+?\)/g, '') // 괄호와 그 안의 내용 제거
    .replace(/\s+/g, '')     // 모든 공백 제거
    .toLowerCase();          // 소문자 통일
}

// 3. ID 생성 (UUID v5)
// MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const expectedId = uuidv5(`${source}|${getCleanString(name)}|${getCleanString(getNormalizedAddr(addr))}`, MY_NAMESPACE);
```

---

## ⚙️ 2. 핵심 로직 파이프라인 (The Dual-Track Pipeline)

스마트 캠핑 플랜은 **[Track A: 목적지 중심 캐싱]**과 **[Track B: 여정 중심 실시간 엔진]**이 결합된 하이브리드 구조입니다.

### [ Phase 1: D-3 Strategic Caching (사전 캐싱) ]
사용자가 버튼을 누르기 3일 전, 시스템은 미리 목적지 주변의 데이터를 확보합니다.
*   **파일**: `scripts/caching-smart-plan.mjs` (GitHub Actions 정기 실행)
*   **동작**:
    *   **Step 1. Geo-Clustering**: 3일 후 예약자들의 위치를 20km 단위로 클러스터링합니다.
    *   **Step 2. Multi-Source Fetch**: `master_places` DB에서 6대 카테고리(식당, 마트, 명소 등) 데이터를 수집합니다.
    *   **Step 3. Base Scoring**: 장소의 기본 품질(`quality_score`)과 캠핑장으로부터의 거리를 계산하여 `smart_plan_candidates` 테이블에 미리 적재합니다.
    *   **주의**: 이 단계에서는 사용자 개인의 페르소나나 실시간 날씨는 반영되지 않은 '정제된 원석' 상태의 데이터입니다.

### [ Phase 2: On-Demand Live Generation (실시간 엔진 가동) ]
사용자가 '캠핑 여정 계획 세우기' 버튼을 누른 순간, 최신 환경 정보와 개인화 로직이 결합됩니다.
*   **파일**: `src/lib/smartPlan.ts` (API 호출 시 실행)
*   **동작**:
    *   **Step 4. Context Gathering**: 현재 시점의 **실시간 날씨**와 유저의 **페르소나**를 수집합니다.
    *   **Step 5. Track A (Destination) Activation**: DB에 저장된 후보군을 불러와 실시간 날씨/페르소나 점수(`ContextFit`)를 즉시 합산하여 랭킹을 재정렬합니다.
    *   **Step 6. Track B (Midpoint) Engine**: 
        *   카카오 내비 API로 출발지-목적지 사이의 **중간지점(Midpoint)**을 산출합니다.
        *   중간지점 5~30km 반경의 검증된 명소/식당을 실시간으로 검색 및 병합(Merge)합니다.
    *   **Step 7. Deep Scoring & Emoji**: 인증 합산, 명소 티어 가점, **8경 이모지 추출** 로직이 작동하여 최종 팩트를 완성합니다.
    *   **Step 8. AI Timeline Assembly**: 정제된 팩트들을 **5단계 감성 서사(가는길-장보기-도착식사-현지힐링-귀갓길)** 프롬프트로 변환하여 AI(Gemini)에게 전달합니다.

---

## 📊 3. 통합 스코어링 엔진 (Deep Scoring Engine v12.0)

모든 장소는 다음의 공식에 따라 최종 점수(`trustScore`)가 결정됩니다.

### [ 기본 공식 ]
`Final Score = Base(50) + ContextFit(0~100) + Bonus(인증/티어) + Logistics(거리) - Penalty`

#### **1. ContextFit (실시간 개인화/날씨 - 최대 100점)**
*   **날씨**: 비/눈 시 실내 명소 및 국물 요리 가점(+20), 맑음 시 야외 활동 가점(+15).
*   **페르소나**: 아이 동반 시 체험형 명소(+30), 반려견 동반 시 테라스/운동장(+30), 시니어 동반 시 보양식/온천(+30).

#### **2. Bonus (검증 및 명성 가점)**
*   **음식점 인증 합산 (Cumulative)**: 
    *   백년가게(+50) + LX공사맛집(+50) + 모범음식점(+30) + 안심식당(+20) 중복 시 모두 합산.
*   **명소 티어 가점 (Fixed Tier)**: 
    *   **1티어 (100점)**: 한국관광 100선 등 국가 대표 명소.
    *   **2티어 (80점)**: 지자체 공식 8경/10경 및 우수 명소.

#### **3. Smart Labeling (이모지 자동 부여)**
*   **👑 [지역] 8경!**: 장소 이름이나 설명글에서 `[지역명] 8경/팔경/구경` 패턴을 감지하여 자동 부여.
*   **👑 지역명소**: 티어 점수가 70점 이상인 검증된 명소에 자동 부여.
*   **🎖️ 인증마크**: 백년가게, LX인증, 모범음식점, 안심식당 배지 자동 부여.

---

## 📁 4. 사용자 페르소나 및 5단계 서사 시스템

### 4.1 개인화 센서 연동
*   `UserPersona`: `guestDetails`의 성인/아이/시니어/반려견 유무를 정밀 분석하여 `ContextFit` 점수에 반영합니다.

### 4.2 5단계 감성 서사 구조 (AI Prompt)
AI는 다음 5단계의 타임라인에 맞춰 나레이션을 작성합니다.
1.  **[가는 길]**: 여정의 시작, 중간지점의 가벼운 나들이와 식사.
2.  **[장보기]**: 캠핑장 도착 전 신선한 식재료 보급 (하나로마트 우선).
3.  **[도착 식사]**: 텐트 설치 전후 즐기는 현지 맛집.
4.  **[현지 힐링]**: 캠핑 중 즐기는 주변 명소와 로컬 축제.
5.  **[귀갓길]**: 여정의 여운을 달래는 마지막 추천과 인사.

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
- **인증별 가중치 합산 (v11.9.13)**: 
    - **병합(Deduplication)**: 상호명과 주소가 동일한 업소는 하나로 통합하여 인증 점수를 누적 합산합니다.
    - **가중치 부여**: `Base 10 + 백년가게(50) + LX공사맛집(50) + 모범음식점(30) + 안심식당(20)`
    - **품질 필터링**: 위 4대 인증이 하나도 없는 일반 식당(10점)은 최종 리브랜딩 및 선별 대상에서 **즉시 제외**합니다. 
- **Noise Filter (v11.9.13)**: 
    - 식당 카테고리로 분류되었으나 실제로는 음식점이 아닌 12종 키워드 원천 제외.
    - (키워드: 안경원, 의상실, 장례식장, 보청기, 수선, 공방, 세탁, 사진관, 약국, 학원, 미용, 목공)
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

### 4.5 관광 기관 API 및 명성 시스템 - `[SPOT]` (v12.0 하이브리드 개편)
- **데이터 소스**: (1순위) `prestige_landmarks` (정부 100선 및 지역 8경), (2순위) TourAPI v2.0 (KorService2).
- **Hybrid v2.6 스코어링 아키텍처**: 
    1. **Prestige Score (60%)**: 
        - **Tier 1 (100점)**: 한국관광 100선 등 국가급 명소.
        - **Tier 2 (80점)**: 지역 8경/10경 및 지자체 공식 숨은 명소.
        - **General (15점)**: 일반 공공데이터 명소.
    2. **Popularity Index (40%)**: 
        - **KTO Official (60%)**: 한국관광공사 기초지자체 중심 인기도 랭킹 (TarRlteTarService1).
        - **TMAP Centrality (20%)**: 실시간 차량 이동 중심성 데이터.
        - **KT Concentration (20%)**: 통신사 유동인구 집중도.
- **최종 공식**: `Score = (Prestige * 0.6) + (Popularity * 0.4) - (Distance_km * 0.5)`
- **데이터 보호막 (Protection Shield)**: 명성 데이터는 `is_protected: true` 속성을 부여받아 자동 동기화 시 유실되지 않도록 SSOT로 관리됩니다.
- **Legacy Cleanup**: 과거의 온라인 조회수(`readcount`) 지표는 완전히 폐기되었으며 더 이상 가점에 반영되지 않습니다.



### 4.6 지역 축제 / 오일장 - `[FESTIVAL]` (v10.7 고도화)
- **일정 연동 필터링 (v10.7)**: 사용자의 실제 캠핑 일정(`startDate`~`endDate`)과 축제 개최 기간(`eventstartdate`~`eventenddate`)이 1일이라도 겹치는 항목만 노출하도록 지능형 기간 필터링을 적용합니다.
- **스코어링 로직**: 명소(`SPOT`)의 인기도 및 상징성 가중치 체계를 그대로 상속받으며, 축제 카테고리 기본 가점(+40)을 추가하여 다른 관광지보다 우선 추천되도록 설계되었습니다.
- **v2.1 featured 슬롯 운영**: 축제는 일반 카테고리와 별도로 **`FEATURED` 슬롯**으로 우선 배치되어 지역 특색을 극대화합니다.

### 4.7 경로 기반 식당 / 카페 / 명소 - `[ROUTE_RESTAURANT, ROUTE_CAFE, ROUTE_SPOT]`
- **기준**: Phase 12에서 수집된 현지 밖(주행 경로상)의 팩트.
- **특징**: 카카오 별점 4.0 이상인 경우 '가는 길의 묘미'로 강조하여 서사에 반영.

### 4.8 Fact Verification UI & Card - `[UI/UX Enhancement]`
- **Fact Chips**: 장소 카드 상단에 별점(⭐), 리뷰 수(💬), 공공 인증(🏆) 배지를 노출하여 데이터의 출처와 신뢰도를 사용자에게 시각적으로 즉시 증명합니다.
    - **LX공사 연동**: `공사추천맛집`, `LX공사 추천맛집` 배지를 추가하여 공공 큐레이션 신뢰도를 강조합니다.
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
8. **Data Lifecycle & Resiliency (3-Strike Out Policy)**:
    - **Soft Delete**: `daily-region-sync` 도중 API/CSV 원천에서 데이터가 더 이상 발견되지 않으면 즉시 삭제하지 않고 `miss_count`를 1 증가시킵니다.
    - **3진 아웃**: `miss_count`가 3에 도달하면 `is_active = false`로 변경하여 추천 목록에서 제외합니다.
    - **Auto-Healing (Instant Recovery)**: 비활성화 상태거나 `miss_count`가 있는 장소가 API에서 다시 발견되면 즉시 `is_active = true`, `miss_count = 0`으로 초기화하여 복구합니다.

---

## 🛡️ 6. 대규모 확장을 위한 예약 기반 동적 권역 파이프라인 (Phase 10 Scale-Up)
전국 3,500여 개 캠핑장을 목적지로 두는 대규모 트래픽 발생 시 API 한도 초과(Rate Limit) 및 서버 부하를 완벽히 막아내는 **"D-3 Geo-Clustering (지리적 병합)"** 아키텍처가 적용되어 있습니다.

1. **예약 기반 동적 타겟팅 (D-3 Focus)**
   - 매일 새벽 6시 Cron Job은 무의미하게 전국 데이터를 긁어오지 않습니다. 오직 **캠핑일 기준 정확히 3일 전(D-3)** 에 해당하는 예약건들만 색인(Index)하여 타겟 목적지(캠핑장) 좌표를 추출합니다.
    - **실시간 API 수집 & 하이브리드 폴백(v10.4)**: 추출된 좌표를 기반으로 국립중앙의료원(`HOSPITAL`) 및 한국관광공사(`FESTIVAL`) API를 실시간 호출합니다. 특히 **마트 데이터 부족 시 실시간 카카오 `CS2` API를 즉각 호출**하여 정적 데이터와 실시간 데이터를 병합해 `smart_plan_facts`에 캐싱합니다.
2. **Geo-Clustering 병합 및 다중 대표 지점 (v11.9.13)**
   - 추출된 예약자 좌표들 중 임의의 좌표간 거리가 20km 이내인 경우 하나의 클러스터로 병합합니다.
   - **대표 지점 선별(Representative Points)**: 클러스터 내부에서 **상호 5km 이상 이격된 캠핑장**들을 독립적인 수집 기점으로 선정합니다. 이를 통해 한 권역 내 캠핑장이 넓게 분포되어 있더라도 특정 한 지점에 데이터가 편중되지 않고 권역 전반의 우수 데이터를 확보할 수 있습니다.
3. **API 스로틀링 딜레이 (Throttling)**
   - 수집된 대표 지점들을 순회하며 공공데이터 API를 호출할 때, `setTimeout`을 통해 3초(3000ms)의 비동기 지연을 발생시켜 관공서 서버의 DDoS 및 HTTP 429 차단을 원천 회피합니다.
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
| | 한국국토정보공사_공사맛집 | `LX_RESTAURANT` | `RESTAURANT` | **17일 지역 로테이션 (로컬 CSV 스트리밍)** |
| | 농림축산부 안심식당 | `SAFE_RESTAURANT` | `RESTAURANT` | 농식품부 API (211.237.50.150) 유지 |
| **명소** | 관광공사_명소정보 | `TOUR_SPOT` | `SPOT` | **TourAPI v2.0 (KorService2) 이관 완료** |

- **Storage**: `public.master_places` 테이블 (PostgreSQL/PostGIS)
- **ID Strategy**: `UUID v5` (SOP v11.3 Master Key 표준 준수)
- **Lifecycle Control**: `is_active` (활성 여부), `miss_count` (미발견 횟수) 필드로 관리.
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

지역별로 서로 다른 API 파라미터 기준을 다음과 같이 일치화하여 통합 동동 동기화 엔진에 적용합니다.

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
- **Admin Code Mapping (v11.5)**: 전국 17개 시도 및 250여 개 시군구의 5자리 행정코드를 `scripts/utils/admin-code-mapping.mjs`에 내장하여 TMAP/KT API 연동의 정합성을 보장합니다.

### 7.2 명소 실질 인기도 엔진 v5 (Hybrid Popularity Engine)
단순한 온라인 조회수(`readcount`)를 영구 폐기하고, 정부 공인/모빌리티/통신 데이터를 결합한 **6:2:2 하이브리드 지표(Standardized Popularity Index)** 체계를 운영합니다.

1. **KTO 기초지자체 인기 관광지 (60%)**: 
    - **자동 가용 월 스캔 (`getLatestValidBaseYm`)**: 공공데이터 포털의 시차(Lag)를 고려하여, 고정된 날짜가 아닌 최근 4개월을 역순으로 자동 스캔하여 데이터가 존재하는 최신 월(현재 2024.12)을 타겟팅합니다.
    - **리전 코드 정규화**: `master_places`에 복구된 `areaCode` 및 `sigunguCode`를 기반으로 전국 189개 표준 권역의 랭킹 데이터를 무결하게 매칭합니다.
    - 한국관광공사의 `TarRlteTarService1`을 통해 수집된 해당 시군구 내의 공식 인기도 랭킹을 반영합니다.
2. **TMAP 이동성 데이터 (20%)**: 
    - SK TMAP의 차량 이동 중심성 데이터를 정규화하여 실시간 '핫플레이스' 시그널을 추출합니다.
3. **KT 방문자 집중률 (20%)**: 
    - 통신사 유동인구 격자 데이터를 분석하여 명소 내 인구 밀집도를 인기도에 반영합니다.
4. **통합 스코어링 (Integrated Score)**: 
    - `(KTO Score × 0.6) + (TMAP Score × 0.2) + (KT Score × 0.2)`
    - **데이터 부재 시 Fallback**: 특정 월 데이터가 0건인 경우 시스템은 자동으로 최하점(10점)을 부여하여 품질 하락을 방지합니다.
5. **저장 및 연동**:
    - 산출된 메트릭은 개별 장소의 `raw_data.popularity_v2` 필드에 저장되어 `SPOT` 하이브리드 엔진의 기초 인자로 활용됩니다.

### 7.3 명성 데이터 보호 및 동기화 (Prestige Protection Shield)
고가치 랜드마크(Tier 1, 2)의 신뢰성을 유지하기 위한 특수 보호 정책입니다.

1. **단일 진실 공급원 (SSOT)**: `prestige_landmarks` 테이블에 수동 검증된 데이터만 적재합니다.
2. **무손실 적재 (is_protected)**: `master_places` 테이블의 `is_protected` 필드가 `true`인 경우, 일일 지역 로테이션(`daily-region-sync`) 시 어떠한 경우에도 삭제되거나 정보가 훼손되지 않습니다.
3. **고속 동기화**: `sync-prestige-data.mjs`를 통해 마스터 데이터와 명성 리스트를 UUID v5 기준으로 항상 일치시킵니다.

### 7.4 실행 엔진 및 스케줄링
- **실행 환경**: `scripts/daily-region-sync.mjs` (Vercel Cron / GitHub Actions)
- **실행 시각**: 매일 04:00 KST
- **모니터링**: 관리자 페이지(Admin Dashboard) 내 'Automation Logs'에서 아래 **3단계 Funnel 지표**를 실시간 확인 가능합니다.
    - **Step 1 (수집량)**: API 원천 수신 데이터 총합
    - **Step 2 (1차 쿼터)**: 지점별 선별 및 병합이 완료된 공용 풀 (Union Pool)
    - **Step 3 (2차 쿼터)**: 개인화(Stage 4)가 적용되어 예약자별로 최종 적재된 수량

### 7.5 3단계 쿼터 Funnel 시스템 (The 3-Step Quota Funnel)
초정밀 개인화 추천을 위해 데이터의 양을 단계별로 압축하고 검증하는 체계입니다.

1.  **Step 1. 수집량 (Raw Collection Pool)**: 
    - 클러스터링된 캠핑장 주변에서 API를 통해 가져온 순수 원천 데이터입니다. (약 1,000~3,000건)
2.  **Step 2. 1차 쿼터 (Union Pool)**: 
    - `master_places` 및 `caching-smart-plan` 엔진이 지점별 쿼터(식당 300개 등)에 맞춰 중복을 제거하고 통합한 공용 데이터셋입니다. 
    - 이 단계에서 카카오 별점 및 리뷰 수 등 **품질 검증**이 완료됩니다.
3.  **Step 3. 2차 쿼터 (Personalized Delivery)**: 
    - **Stage 4 개인화 레이어**가 가동되어, 각 예약자의 출발지 및 페르소나에 맞춘 거리 감점과 필터링이 적용된 최종 추천 후보군입니다.
    - 예약자 1인당 카테고리별 최대 15개(식당/명소 기준) 등 엄격한 쿼터를 준수하여 `smart_plan_candidates` 테이블에 최종 적재됩니다.

---

## 10. 랜드마크(프리스티지) 데이터 유지보수 가이드

전국 랜드마크(Tier 1/2) 리스트가 변경되거나 추가되었을 때, 마스터 DB에 이를 반영하는 방법입니다.

### 10.1 리스트 파일 업데이트
다음 두 파일을 최신 내용으로 수정합니다.
- `korea_tourism_100_official.md` (한국관광 100선 - Tier 1)
- `regional_8_sceneries_FULL.md` (전국 지자체 8경 - Tier 2)

### 10.2 DB 동기화 실행
터미널에서 아래 명령어를 실행하면, 수정된 리스트를 기반으로 마스터 DB의 명칭이 정제되고 등급 표식(`prestige_tier`)이 일괄 갱신됩니다.

```bash
# 1. DB 명칭 정제 (필요 시 실행)
node scratch/national-name-cleaner.mjs

# 2. 프리스티지 등급 동기화 (필수 실행)
node scripts/sync-prestige-metadata.mjs
```

### 10.3 확인 방법
마스터 DB(`master_places`)의 `raw_data` 필드 내에 `prestige_tier` 값이 정상적으로 주입되었는지 확인합니다. 이후 실행되는 모든 스마트 캠핑 캐싱 로직은 이 값을 기준으로 자동 점수(100/80)를 부여합니다.

---
**라온아이 프로젝트 SSOT 기준 문서 - 10 랜드마크 통합 및 Phase 12 하이브리드 엔진 동기화 사양**
