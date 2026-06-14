# [v4] 라온아이 스마트플랜 MCP 서버 구현 계획서

라온아이의 신뢰도 높은 정제 데이터를 외부 AI 에이전트(Claude, GPT, Gemini 등)에게 제공하고, 자체 AI 연산 비용(Gemini API 비용)을 **0원**으로 최적화하기 위한 MCP(Model Context Protocol) 서버 구현 계획서입니다.

---

## 1. 핵심 아키텍처 및 철학

```
┌─────────────────────────┐               ┌─────────────────────────┐
│ 외부 AI 에이전트        │               │   라온아이 MCP 서버     │
│ (Claude, ChatGPT 등)    │               │ (Express + MCP SDK)     │
└───────────┬─────────────┘               └───────────┬─────────────┘
            │                                         │
            │ 1. get_travel_plan_template(ResId)      │
            ├────────────────────────────────────────>│
            │                                         │ 2. DB 조회 (후보군,
            │ 3. 데이터 + 프롬프트 템플릿 반환         │    날씨, 페르소나)
            │<────────────────────────────────────────┤
            │                                         │
            │ 4. 전달받은 데이터로                        │
            │    자체 뇌(LLM)에서 일정 조립               │
            ▼                                         ▼
```

### 💡 비용 최적화 설계 (Zero-Cost AI)
- **기존 방식**: 서버 내에서 Gemini API를 호출하여 일정 계획을 생성해 클라이언트에게 전달 (호출당 AI 비용 발생).
- **개선 방식 (MCP)**: 외부 AI 에이전트에게 **정제된 장소 후보군 데이터**, **여행자 페르소나/날씨**, 그리고 **"일정을 생성하도록 가이드하는 고정된 프롬프트 템플릿"**만 반환합니다. 계획의 생성과 조립(추론 연산)은 사용자가 사용하는 AI가 수행하게 함으로써 라온아이의 AI 비용 부담을 **0원**으로 만듭니다.

### 🔌 플랫폼 독립적인 독립 패키지 (`mcp-server`)
- 프로젝트 루트 하위에 `mcp-server` 폴더를 신설하여 독립적인 Node.js 패키지로 관리합니다.
- `@modelcontextprotocol/sdk`를 사용하여 **stdio** (로컬 CLI 개발/테스트용) 및 **SSE (Server-Sent Events)** (Vercel/Render 등 배포형 서비스용) 방식을 모두 지원하도록 구현합니다.

---

## 2. 데이터 최신화 및 고도화 파이프라인 (Data Enrichment)

12만 개가 넘는 방대한 장소 마스터 데이터의 신선도를 무료 쿼터 범위 내에서 유지하고 상세 페이지를 점진적으로 채워나가기 위한 하이브리드 파이프라인입니다.

### ① 일반 장소 온디맨드 캐싱 (Lazy Load)
- **대상**: 외부 AI나 사용자가 `get_place_details`를 호출한 시점.
- **로직**:
  1. 조회 요청이 들어왔을 때, 해당 장소의 상세 데이터(영업시간, 리뷰 키워드 요약 등)가 누락되어 있거나 업데이트일(`updated_at`)이 7일 이상 경과했는지 판단합니다.
  2. 만료되었을 경우, 백그라운드에서 Kakao/Naver 로컬 API 및 우회 크롤러를 통해 상세 데이터를 즉시 긁어와 `smart_plan_facts.raw_data`를 업데이트(Upsert)한 후 최종 응답합니다.
- **효과**: 실제 활성 트래픽이 있는 장소부터 안전하고 효율적으로 풍부해집니다.

### ② 주유소: 2단계 온디맨드 지리적 캐싱 (2-Tier On-Demand Geo-Caching)
- **배경**: 전국의 모든 주유소를 매일 실시간으로 수집하는 것은 불가능하며, 유가는 시시때때로 변경되므로 실시간성이 필요합니다.
- **로직**:
  - **1단계 (캐시 검증)**: 호출 위치 주변 반경 5km 내의 주유소 캐시(`smart_plan_facts` 카테고리 `GAS_STATION`)를 확인하고, 최종 업데이트 시간(`updated_at`)이 **24시간 이내**인지 체크합니다. 유효하다면 DB 데이터를 **0.01초** 만에 즉시 반환합니다.
  - **2단계 (실시간 동적 갱신)**: 캐시가 없거나 24시간을 초과한 경우, 카카오 좌표계 변환 API로 WTM 좌표를 획득 후 오피넷 API(`aroundAll.do`)를 직접 실시간 호출하여 반경 5km 주유소 가격 정보를 Upsert 한 뒤 최신 가격을 반환합니다.
- **효과**: 사용자가 실제로 방문할 캠핑장/여행지 반경 버킷만 온디맨드로 리프레시하여 호출 효율과 정확성을 동시에 제고합니다.

### ③ 축제: 주간 전체 적재 자동화 및 어드민 연동
- **주기**: **매주 월요일 새벽 04:00**에 주간 축제 자동화 스케줄러(`WEEKLY_FESTIVAL_SYNC`)를 실행합니다.
- **중복 방지 ID 생성 로직**:
  - `uuidv5` 기반의 기존 생성 로직을 사용하여 중복 적재를 차단합니다.
  - `generateFactId('TOUR_FSTVL', item.title, item.addr1 || '주소정보없음')`로 ID를 고유 해싱하여 Upsert 함으로써, 동일 축제 재수집 시 덮어쓰기 처리됩니다.
- **어드민 노출 및 모니터링**:
  - `automation_logs` 테이블에 `job_name: 'WEEKLY_FESTIVAL_SYNC'`로 로그를 생성하고 `api_status` 컬럼에 시도별 갱신 통계(기존 데이터 수, API 수신 수, 신규 삽입, 변경 갱신, 최종 총계)를 기록합니다.
  - 관리자 자동화 현황 화면([logs/page.tsx](file:///c:/Users/USER/Desktop/RAON.I/src/app/admin/automation/logs/page.tsx))에 기존 `DAILY_REGION_SYNC` 리포트 양식과 동일한 표(Table) 형태로 매주 월요일 축제 갱신 현황이 표기되도록 뷰 컴포넌트를 연동합니다.

---

## 3. 데이터베이스 스키마 추가

외부 사용자에게 API 서비스를 안전하게 제공하고 호출 횟수를 로깅하기 위해 다음 테이블들을 추가합니다.

### 1) [NEW] `mcp_api_keys` (API Key 관리)
```sql
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- 키를 소유한 라온아이 회원 ID (또는 파트너사 ID)
    api_key_hash TEXT NOT NULL UNIQUE, -- SHA-256 해싱된 API 키
    key_hint TEXT, -- 키 식별용 힌트 (예: "My Claude Desktop App")
    tier TEXT DEFAULT 'FREE', -- 'FREE' (일 100회), 'PRO' (일 1만회), 'ENTERPRISE' (무제한)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mcp_api_key_hash ON public.mcp_api_keys(api_key_hash);
```

### 2) [NEW] `mcp_usage_logs` (호출 미터링 및 감사용)
```sql
CREATE TABLE IF NOT EXISTS public.mcp_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES public.mcp_api_keys(id),
    tool_name TEXT NOT NULL, -- 호출된 MCP Tool 이름 (예: search_places)
    request_ip TEXT,
    success BOOLEAN DEFAULT TRUE,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mcp_logs_created_at ON public.mcp_usage_logs(created_at);
```

---

## 4. MCP Tools 명세서

MCP 규격에 따라 노출할 4가지 핵심 도구(Tools)의 사양입니다. 범용성을 확보하기 위해 예약 ID 유무에 관계없이 동작하는 이중 인터페이스(Dual Interface)로 구성합니다.

### ① `search_places` (주변 정제 장소 검색)
- **설명**: 라온아이가 수집 및 신뢰 검증(백년가게, LX맛집, 모범음식점 등)을 완료한 관광지/식당/카페 목록을 반경 기반 거리순으로 조회합니다.
- **입력 스키마 (`zod`)**:
  - `lat` (number, 필수): 위도
  - `lng` (number, 필수): 경도
  - `radius_meters` (number, 기본값 `10000`): 반경 (최대 50,000m)
  - `category` (string, 선택): `'RESTAURANT'`, `'SPOT'`, `'ROUTE_CAFE'` 등 필터링
- **동작**: Supabase RPC `get_smart_plan_facts_in_radius`를 호출하여 정렬된 `smart_plan_facts` 결과 반환.

### ② `get_place_details` (장소 상세 정보 조회)
- **설명**: 특정 장소의 ID를 기반으로 영업시간, 상세 설명, 크롤링된 사용자 평점/리뷰 요약 힌트 등 디테일한 정보를 조회합니다. (온디맨드 캐싱 적용 대상)
- **입력 스키마 (`zod`)**:
  - `place_id` (string/UUID, 필수): 장소의 고유 UUID (`smart_plan_facts.id`)
- **동작**: `smart_plan_facts` 테이블에서 해당 ID 단일 행을 조회하여 반환하되, 만료 시 실시간으로 크롤러가 작동해 최신 정보를 수집한 후 DB를 갱신하여 반환합니다.

### ③ `get_nearby_facilities` (주변 인프라 및 편의시설 거리순 조회)
- **설명**: 위급/긴급 상황이나 차량 관리에 필요한 주변 NMC 병원, OPINET 주유소, 대형 마트 등의 실시간/정제 데이터를 거리순으로 조회합니다. (주유소 2단계 캐싱 적용 대상)
- **입력 스키마 (`zod`)**:
  - `lat` (number, 필수)
  - `lng` (number, 필수)
  - `facility_type` (string, 필수): `'HOSPITAL'` (NMC 병원), `'GAS_STATION'` (OPINET 주유소), `'MART'` (대형마트)
- **동작**: 
  - `HOSPITAL` 및 `MART`는 기존 DB에서 반경 지리 검색 수행.
  - `GAS_STATION`은 2단계 온디맨드 지리적 캐싱 로직(24시간 유효성 체크 및 실시간 오피넷 조회 갱신)에 따라 작동하여 가격 정보를 리턴.

### ④ `get_travel_plan_template` [핵심]
- **설명**: 예약자 맞춤형(1st Party) 또는 비회원 범용(3rd Party) 여행 정보 템플릿과 고품질 일정을 스스로 세울 수 있는 프롬프트 가이드라인(Template)을 반환합니다.
- **입력 스키마 (`zod`)**:
  - `reservation_id` (string/UUID, 선택): 예약 ID (전달 시 1st Party 맞춤형 우선)
  - `lat` (number, 선택): 예약 ID가 없을 때 지정할 중심 위도
  - `lng` (number, 선택): 예약 ID가 없을 때 지정할 중심 경도
  - `duration_days` (number, 선택): 여행 기간 (예: 2일, 3일)
  - `companions` (array of string, 선택): 동반객 특성 (어르신, 어린이, 반려동물 등)
- **동작**:
  1. `reservation_id`가 입력된 경우, DB에서 해당 예약 정보 및 기존 D-3 캐싱된 개인화 후보군(`smart_plan_candidates`)을 0.01초 내에 리트리브합니다.
  2. `reservation_id`가 없고 위경도 및 조건들이 들어온 경우, 해당 좌표 반경을 기준으로 실시간 임시 후보군 및 날씨를 탐색/가공해 템플릿을 생성합니다.
  3. LLM이 시간대별 타임라인 JSON 스케줄을 뽑아내도록 명령하는 시스템 지침서 텍스트(`system_prompt_guide`)와 결합해 응답합니다.

---

## 5. 구현 절차 (Implementation Roadmap)

### Step 1: `mcp-server` 프로젝트 구조 신설 및 설정
- `mcp-server` 폴더 생성 및 `@modelcontextprotocol/sdk`, `@supabase/supabase-js`, `zod`, `dotenv` 등 패키지 셋업.
- `tsconfig.json` 설정 및 TypeScript 빌드 환경 구성.

### Step 2: Supabase 마이그레이션 적용
- `mcp_api_keys` 및 `mcp_usage_logs` 테이블 생성을 위한 SQL 마이그레이션 파일 작성 및 DB 배포.

### Step 3: MCP Tools 로직 구현
- `search_places`, `get_place_details` (상세 정보 크롤러 연동), `get_nearby_facilities` (주유소 2단계 캐싱 포함) 구현.
- `get_travel_plan_template` 구현 (이중 인터페이스 및 프롬프트 템플릿 포함).
- API Key 헤더 검증 로직 및 Usage 로깅 미들웨어 탑재.

### Step 4: 주간 축제 자동화 및 어드민 연동 개발
- 매주 월요일 새벽 자동화 스케줄러 `/api/cron/sync-festivals` 구현 (중복 방지 ID 로직 포함).
- 어드민 자동화 현황 페이지에 주간 축제 갱신 리포트 표 UI 컴포넌트 연동.

### Step 5: Stdio 및 SSE 동시 서비스 인터페이스 구축
- 로컬 실행 시 stdio 채널 연결 지원 (`npx src/index.ts`).
- 웹 서버 구동 시 SSE 엔드포인트 개방 (`Express` 통합).

---

## 6. 검증 계획 (Verification Plan)

### 1단계: 로컬 stdio 연동 테스트
- `Claude Desktop`의 설정 파일(`config.json`)에 로컬 `mcp-server`를 등록합니다.
- Claude 앱을 재부팅한 뒤, 우측 하단 도구(Hammer 아이콘) 리스트에 라온아이 도구 4개가 노출되는지 확인합니다.
- AI에게 `"라온아이 데이터에서 강원도 춘천 근처 맛집 5개 검색해줘"` 또는 `"내 예약 번호 XXX 기반으로 여행 계획 템플릿 만들어줘"`라고 자연어로 물어보고 도구가 실제로 실행되며 올바른 값을 회신받는지 디버그 콘솔을 통해 확인합니다.

### 2단계: 온디맨드 캐싱 & 주유소 2단계 캐시 작동 검증
- 상세 데이터가 비어 있거나 만료된 주유소/장소를 요청하여 실시간 크롤러 및 오피넷 API가 핀포인트 작동하여 DB 가격 데이터를 정상 갱신하는지 확인합니다.
- 동일 장소를 재차 요청했을 때 오피넷 호출 없이 DB 캐시가 즉각(Fast Response) 반환되는지 확인하여 속도를 비교합니다.

### 3단계: 주간 축제 크론 및 어드민 갱신 검증
- 월요일 축제 자동화 동기화를 수동 트리거하여 DB에 중복 없이 upsert 처리되는지 확인합니다.
- 어드민 자동화 현황 리포트 테이블에 축제 정보가 누락 및 깨짐 없이 렌더링되는지 육안 확인합니다.

### 4단계: API Key & 미터링 정책 검증
- 잘못되거나 만료된 API Key를 헤더로 전송 시 `401 Unauthorized` 에러를 정상적으로 던지는지 테스트합니다.
- 성공적인 Tool Call 수행 후 Supabase의 `mcp_usage_logs` 테이블에 호출 이력이 올바르게 로깅되는지 행 수와 실행 시간을 확인합니다.

### 5단계: 빌드 무결성 검증
- `mcp-server` 및 Next.js 프로젝트 전체의 TypeScript 컴파일 오류 여부(`npm run build` 및 tsc 체크)를 전반적으로 점검합니다.
