# Smart Camping Plan (Guided Journey) Core Engine Manual

라온아이의 핵심 가치인 '감성'과 '편안함'을 전달하기 위해, 사용자의 캠핑 일정을 기반으로 한 맞춤형 추천 여정(Guided Journey)을 구현하는 시스템의 개발 및 유지보수 매뉴얼입니다.

이 문서는 라온아이의 스마트 캠핑 플랜 기능 개발의 **단일 진실 공급원(SSOT)** 역할을 합니다. 다른 세션이나 개발자가 이 기능을 수정/확장할 때 반드시 이 문서를 기준으로 작업해야 합니다.

---

## 🏗️ 1. 아키텍처 철학 (Architecture Philosophy)

스마트 캠핑 플랜은 단순한 앱 기능이 아닌, 향후 B2B API 및 MCP(Model Context Protocol) 서버로 독립 가능한 **"헤드리스 지능형 엔진(Headless Intelligent Engine)"**으로 설계되었습니다.

1.  **UI/Logic Separation**: 추천 로직(`smartPlan.ts`)은 UI 컴포넌트와 완전히 분리되어 순수 데이터(JSON)만 반환합니다.
2.  **API Monetization Ready**: 생성된 데이터는 향후 외부 에이전트(LLM)가 즉시 이해하고 구매할 수 있도록 표준 스키마(Schema.org)와 출처(Provenance) 메타데이터를 포함합니다.
3.  **Zero-Cost High-Fidelity**: 유료 데이터(내비게이션 트래픽 등)와 LLM 다중 호출을 지양하고, 무료 공공데이터와 무료 API의 '볼륨 데이터'를 융합하여 비용 0원의 초정밀 팩트를 추출합니다.

---

## ⚙️ 2. 핵심 로직 파이프라인 (The 5-Step Pipeline)

사용자가 기기에서 "스마트 플랜 만들기"를 요청할 때부터 화면이 렌더링되기까지의 완벽한 흐름입니다.

### Step 1: Context Gathering (상황 수집)
- **위치/환경**: 사용자 기기의 GPS 위치(LBS), 선택된 캠핑장의 위치, 날짜, 해당 날짜의 날씨 및 온도.
- **캠퍼 페르소나**: 예약 정보(성인/미취학/초등/청소년 세분화) 및 DB 활동 로그(Record, 좋아요 등)에서 추출된 '태그 가중치(Tag Weight)'를 통해 동적 페르소나 문자열 생성 (예: "초등학생 자녀와 함께 조용한 자연 속 요리를 즐기는 캠퍼").

### Step 2: Zero-Cost High-Fidelity Filtering (0원 고품질 추출)
- 하단에 정의된 [3. High-Trust Indicators] 카테고리별 로직에 따라, 내부 DB에 사전 캐싱된 데이터를 1차 필터링하고 카카오 로컬 API(무료 쿼터)의 리뷰/블로그 '볼륨(개수)'으로 2차 교차 검증하여 최고의 팩트 후보군을 15개 내외로 생성합니다.

### Step 3: Circular Curated Pool (순환 풀링)
- Step 2에서 생성된 15개 내외의 최적 후보군 중, 매 요청 시 3~5개를 무작위(순환) 추출하여 화면의 식상함을 방지합니다.

### Step 4: AI Narration (단 1회 호출)
- Step 3에서 뽑힌 '완벽한 팩트 리스트 5개'와 Step 1의 '유저 Context'를 LLM(Gemini 1.5 Flash 등) 프롬프트에 단 1회 주입합니다.
- LLM은 이 팩트들을 바탕으로 "이 사람의 감성을 자극하는 스토리"를 작성합니다. (Stateless 방식)

### Step 5: Interactive UI Rendering (Citational UI)
- 화면 상단: LLM이 작성한 감성적인 가이드 서사.
- 화면 하단: 유저가 직접 상세 정보를 확인하고 다른 옵션으로 교체(슬롯 체인지)할 수 있는 팩트 카드 노출.

---

## 📌 3. High-Trust Indicators (카테고리별 신뢰 지표)

각 시설을 필터링할 때 반드시 지켜야 하는 '안전과 편의 우선'의 팩트 기준입니다.

1.  **병원**: (3단계 폴백 로직) 권역/지역응급의료센터 -> 지역응급의료기관 -> 119 안내. (소아과 전문의 상주 여부 우선)
2.  **마트 & 편의점**: 대형마트/하나로마트 우선 노출 (휴무일, 장작/얼음 등 필수 취급 품목 중심) + 인근 24시 편의점 병기.
3.  **주유소 (등유)**: 오피넷 API 연동 실내등유 판매 여부 확인.
4.  **식당**: (신뢰 등급제 + 카카오 볼륨) 백년가게/안심식당 등 Grade A/B/C 인증 시설을 1차 필터링한 후, 카카오 API 리뷰 볼륨 기준으로 정렬.
5.  **주변 행사/축제**: 한국관광공사(TourAPI) 및 지자체 데이터 활용, 일정과 겹치는 로컬 축제/오일장 연계.
6.  **지역 유명 관광지**: TourAPI 관광/문화 데이터를 가져온 후, 카카오 무료 API로 리뷰/블로그 볼륨을 교차 조회하여 '진짜 유명한 곳'만 선별. 날씨(실내외) 및 페르소나에 따라 가중치 조정.

---

## 💾 4. 데이터 인프라스트럭처 (Hybrid Caching)

- **`cached_facilities.sql`**: 병원, 마트, 식당, 관광지 등 외부 정보를 담는 통합 DB 테이블.
- **Hybrid Caching (Derived Data) 원칙**: 카카오 API 등의 타사 종속적 데이터를 그대로 저장하여 재판매하는 것을 방지합니다. 공공 데이터(정부 인증)와 카카오 수치 데이터를 결합하여 **`라온 신뢰도 지수(Raon Trust Score)`** 형태의 2차 가공 지표로 변환한 후 캐싱합니다. (API 약관 위반 방지 및 연쇄 비용 상승 차단)
- 하루 1회 배치 작업(`sync-facilities` Edge Function 등)을 통해 공공데이터 API 동기화 및 캐시를 갱신합니다. 실시간 날씨는 1시간 온디맨드로 처리합니다.

---

## 📝 5. 핵심 파일 변경/생성 지침 (Code Implementation Guide)

- **`reservation.ts`**: `Reservation` 인터페이스의 `guestDetails` 필드는 `{ adults: number, kids: { preschool: number, elementary: number, teen: number } }` 형태로 유지합니다.
- **`ReservationForm.tsx`**: 인원수 입력 폼은 반드시 위 세분화된 스키마를 수집할 수 있는 UI 컴포넌트로 구현되어야 합니다.
- **`persona.ts`**: 사용자의 과거 활동 기반으로 캠퍼 페르소나를 추출하고 태그 가중치(Decay) 로직을 관리하는 유틸리티 파일입니다.
- **`smartPlan.ts`**: UI 의존성이 없는 순수 함수 기반의 Headless Engine 파일입니다. 위 5단계 파이프라인의 핵심 로직을 담당합니다.
- **`SmartPlanProposal.tsx`**: AI 서사와 팩트 카드를 결합하여 렌더링하는 UI 컴포넌트입니다.

> **작업자 주의사항**: 이 문서는 라온아이의 '데이터 수익화' 비전과 직결된 핵심 아키텍처 문서입니다. 추가 기능을 결합할 때에도 **Zero-Cost High-Fidelity** 원칙과 **API 독립성(Hybrid Caching)** 원칙을 절대 훼손하지 마십시오.
