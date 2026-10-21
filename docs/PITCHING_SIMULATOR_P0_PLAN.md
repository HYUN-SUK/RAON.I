# RAON.I 가상 피칭 & 날씨 시뮬레이터 (P0 프로토타입 세부 구현 계획서)

- **작성일**: 2026-10-20
- **문서 버전**: v1.0 (최종 확정본)
- **적용 브랜치**: `staging` (`test.raon-i.co.kr`)
- **보안 등급**: 특허 출원 전 대외비 (관리자 전용 비공개 경로)

---

## 1. 프로젝트 개요 및 P0 목표

### 1-1. 프로젝트 개요
캠퍼가 캠핑장에 도착하기 전, 실제 사이트 3D 공간에 자신의 텐트/타프를 가상으로 배치하고, **체크인~체크아웃 기간(예: 2박 3일 72시간) 동안의 태양 이동, 산 그림자, 기온, 바람, 비를 약 30초 타임랩스로 시뮬레이션**한 뒤, **[추천 입구 방향, 주풍향 기준 보강 팩 위치, 시간대별 주의사항, 준비물]**을 1클릭으로 제공하는 원스톱 의사결정 지원 기능.

### 1-2. P0 프로토타입 핵심 목표
1. **대상**: 철수네(`site-1`) 1개 사이트 + 터널형 텐트 절차적 3D 메시 1종.
2. **시각 품질 검증**: 모바일 게임/건축 시각화 수준의 감성 3D 디오라마(미니어처) 스타일 달성 (대표님 실기기 만족도 확인).
3. **태양 & 그늘 정확도 검증**: 실제 맑은 날 15:00, 17:00 현장 그늘 사진과 시뮬레이션 화면 비교 검증 (오차 ±15분 이내 목표).
4. **성능 검증**: 보급형 안드로이드 웹뷰(Capacitor) 환경에서 30fps 유지 및 WebGL Context Lost 방지.

---

## 2. 5대 핵심 아키텍처 원칙 (기획 & 개발 AI 전원 합의)

### 원칙 1: 완전한 모듈 독립성 (Zero Side-Effects)
- 모든 시뮬레이터 코드는 `src/features/pitching/` 단일 디렉토리에 캡슐화.
- 기존 핵심 로직(소셜 로그인, 예약, 결제, 커뮤니티 등) 코드는 단 한 줄도 수정하지 않음.
- 외부에 노출되는 인터페이스는 단 2개로 극도로 제한:
  - 뷰 컴포넌트: `<PitchingSimulator ... />`
  - 순수 연산 함수: `calculatePitchingRecommendation(...)`
- 3D 라이브러리(`three`, `@react-three/fiber`, `@react-three/drei`)는 `next/dynamic(..., { ssr: false })`로 지연 로딩하여 메인 앱 로딩 속도 영향 0%.

### 원칙 2: 서버 및 운영 비용 $0 유지
- 유료 3D 지도 API(Google Photorealistic 3D Tiles 등) 일절 배제.
- 천문 계산(`suncalc`) + 16방위 능선 고도각 비교 + 기상청 예보 보간 + 24방향 채점(Scoring)을 **100% 사용자 스마트폰(클라이언트)에서 연산**.
- 결과 공유: 서버 렌더링 비용을 원천 차단하고 브라우저 Canvas 캡처(`MediaRecorder` / Web Share API / `@capacitor/share`) 활용.

### 원칙 3: 방향성 실그림자(Directional Light Soft PCF) + 보조 ContactShadows
- `ContactShadows`는 바닥 접지감(앰비언트 접촉) 보조용으로만 사용.
- 시간대별 태양 고도각/방위각에 연동되는 **`Directional Light` Soft PCF 그림자맵**을 활성화하여 텐트와 나무의 실제 방향성 그늘 구현.
- 텐트 원단은 은은한 반투명감(Translucency 근사)과 무광 패브릭 질감 적용.
- 버텍스 셰이더 기반 사인파 흔들림으로 풍속(`wsd`)에 비례한 타프/텐트 스커트 미세 진동 연출.
- 새벽/정오/노을/밤 시간에 맞춰 조명 색온도와 하늘 그라데이션 자동 변환.
- 첫 진입 구도는 모바일 세로 비율에 최적화된 3/4 부감(38° Axonometric) 앵글 고정.

### 원칙 4: 수학적 기하 계산과 3D 렌더링의 철저한 분리
- 일사량 및 그늘 계산을 3D 화면(픽셀)에 의존하지 않고, **순수 수학적 기하 계산(Sun ray vs Obstacle/Horizon Ray-casting)**으로 처리.
- 3D 뷰, 2D 탑뷰 폴백(Konva), 결과 카드에서 100% 동일한 정확한 추천 점수 산출 보장.
- 풍향 보간: 350°와 10°의 단순 평균 오류 방지를 위해 $\sin$, $\cos$ 벡터 성분 분해 후 합성 방식(기상학 표준) 적용.

### 원칙 5: 철저한 보안 격리 (특허 출원 보호)
- 운영 서버(`raon-ai.com`) 배포 금지, 독립 스테이징 환경 `test.raon-i.co.kr` (`staging` 브랜치)에서만 가동.
- 전 경로 `X-Robots-Tag: noindex, nofollow` 및 `robots.txt` 검색엔진 차단.
- 관리자 세션 검증 필수 경로(`/admin/pitching-preview`)로 개설 (미인증 시 404 반환으로 존재 자체 은닉).

---

## 3. 전체 시스템 데이터 흐름도

```text
[입력 데이터]
  ├─ 1. 사이트 데이터 (site_geometry): 규격(가로x세로), 전면 방위각, 장애물(m), 16방위 능선 고도각
  ├─ 2. 장비 데이터 (user_gear): 기본 3D 형태(터널/돔 등), 실측 치수(L/W/H/폴높이/스커트높이), 색상, 출입구 위치
  ├─ 3. 일정/좌표: 체크인~체크아웃 (1박 24h / 2박 72h), 사이트 정밀 위경도 (36.6354349, 126.7638091)
  └─ 4. 기상 데이터: 기존 격자 캐시 단기예보 타임라인 (/api/weather)

[클라이언트 연산 엔진 (서버 비용 $0)]
  ├─ [천문 계산]: SunCalc → 시간대별 태양 고도각·방위각 산출
  ├─ [산 그림자 마스킹]: 태양 고도각 vs 16방위 능선 고도각(지구곡률+1.5m 보정, 선형 보간) 비교
  ├─ [기상 보간]: 10~15분 단위 시간 보간 (풍향은 sin/cos 벡터 합성) + 캠장 노하우 지형 보정
  └─ [24방향 Scoring 엔진]: 회전각(15° 간격)별 일사·풍하중·강수 페널티 계산 → 최적 1·2위 각도 산출

[3D 디오라마 렌더링 & 출력]
  ├─ 3D 뷰: R3F 터널형 메시 + Directional Soft Shadow + ContactShadows + 색온도 조명 + 버텍스 바람
  ├─ 2D 뷰 (저사양 폴백): Konva 기반 2D 평면 탑뷰 (Context Lost 시 자동 전환)
  ├─ 30초 타임랩스 재생 바 & 시간대별 위험 경고 마커
  ├─ 1탭 결과 카드: 추천 입구 방향, 주풍향 기준 보강 팩(빨간 점), 시간대별 주의사항, 준비물
  └─ 클라이언트 캡처: Canvas 스크린샷 → Web Share API / @capacitor/share ($0 서버비)
```

---

## 4. 최종 확정 DB 스키마 (Supabase)

```sql
-- 1. 사이트 지오메트리 & 환경 데이터 (8개 사이트)
create table site_geometry (
  site_id text primary key references sites(id) on delete cascade, -- 'site-1' ~ 'site-8'
  lat double precision not null,
  lng double precision not null,
  width_m numeric not null,          -- 사이트 가로 폭 (m)
  depth_m numeric not null,          -- 사이트 세로 깊이 (m)
  bearing_deg numeric not null,      -- 진북(0°) 기준 진입로 정면 방위각 (0~360)
  ground_type text default 'gravel', -- gravel(파쇄석) | deck | grass | soil
  slope_deg numeric default 0,       -- 바닥 경사각 (도)
  slope_dir_deg numeric,             -- 배수 낮아지는 방향 (방위각)
  horizon_profile jsonb,             -- 16방위 능선 각도: [{"az": 0, "alt": 11.2}, ..., {"az": 337.5, "alt": 14.5}]
  horizon_metadata jsonb,            -- {"source": "open-meteo-dem-90m", "computed_at": "...", "observer_h": 1.5}
  obstacles jsonb default '[]'::jsonb,-- 사이트 앞쪽 좌측 모서리(0,0) 기준: [{"type":"tree","x":2.0,"y":1.0,"h":5.0,"crown_r":2.0}]
  local_wind_note text,              -- 예: '오후 15시 이후 계곡 방향(남서) 골바람 발생'
  owner_tips text,                   -- 캠장 추천 피칭 노하우
  updated_at timestamptz default now()
);

-- 2. 사용자 텐트/타프 장비 (영구 저장 및 수정 가능)
create table user_gear (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'tent', -- tent | tarp
  shape text not null,               -- tunnel | dome | livingshell | cabin | tipi | recta_tarp | hexa_tarp
  name text,                         -- 장비 별칭 (예: '우리집 터널형 텐트')
  length_m numeric not null,         -- 전체 길이 (m)
  width_m numeric not null,          -- 전체 폭 (m)
  height_m numeric not null,         -- 최고 높이 (m)
  pole_height_m numeric,             -- 타프 메인 폴 높이 (m, 타프인 경우)
  low_height_m numeric,              -- 타프 사이드 낮춤 높이 (m, 타프인 경우)
  color text default 'sand',         -- ivory | sand | khaki | olive | gray | charcoal
  door_positions text[] default array['front'], -- 'front', 'rear', 'left', 'right' 다중 지원
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 피칭 시뮬레이션 결과 스냅샷 & 사후 피드백 (핵심 데이터 자산)
create table pitch_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  reservation_id uuid references reservations(id) on delete set null,
  site_id text not null references sites(id) on delete cascade,
  gear_snapshot jsonb not null,      -- 시뮬레이션에 사용된 텐트 규격 스냅샷
  weather_snapshot jsonb not null,   -- 사용된 예보 데이터 타임라인 스냅샷
  forecast_base_time timestamptz not null, -- 예보 발표 기준 시각 (예보 오차 vs 알고리즘 오차 역추적용)
  mode text not null default 'sun_only',   -- 'sun_only' (D-3 이전) | 'full_weather' (D-3 이후)
  recommended_angle numeric not null,-- 추천된 텐트 방위각 (deg)
  score numeric not null,            -- 최종 점수 (100점 만점)
  caution_timeline jsonb,            -- 시간대별 주의사항 목록
  reinforced_pegs jsonb,             -- 보강 팩 위치 목록 (3D 좌표 및 설명)
  feedback jsonb,                    -- 체크아웃 후 피드백 (좋음 / 햇빛불편 / 바람불편 등)
  created_at timestamptz default now()
);

-- RLS 정책
alter table site_geometry enable row level security;
alter table user_gear enable row level security;
alter table pitch_simulations enable row level security;

create policy "site_geometry_select" on site_geometry for select using (true);
create policy "site_geometry_admin_all" on site_geometry for all using (auth.jwt()->>'role' = 'authenticated'); -- 관리자

create policy "user_gear_own" on user_gear for all using (auth.uid() = user_id);
create policy "pitch_simulations_own" on pitch_simulations for all using (auth.uid() = user_id);
```

---

## 5. 능선 고도각(Horizon Profile) 1회성 자동 산출 알고리즘

- **데이터 소스**: Open-Meteo Elevation API (Copernicus DEM 90m 기반, 무료)
- **실행 방식**: 사이트 등록/좌표 설정 시 단 1회 스크립트 실행 후 DB 저장.
- **산출 로직**:
  1. 사이트 정밀 좌표($36.6354349^\circ, 126.7638091^\circ$)에서 지면 고도 $h_0$ 취득.
  2. 16방위($az \in \{0^\circ, 22.5^\circ, \dots, 337.5^\circ\}$)로 각각 $50\text{m} \sim 5,000\text{m}$ 지점 좌표 샘플링.
  3. Open-Meteo API 호출 한도(1회 최대 100개)에 맞춰 Chunking 분할 쿼리.
  4. 관측 높이($+1.5\text{m}$) 및 지구 곡률 보정: $h_{eff} = h_{ridge} - \frac{d^2}{2 \times 6371000}$.
  5. 방위별 최대 앙각 $\alpha_{az} = \max\left(\arctan\left(\frac{h_{eff} - (h_0 + 1.5)}{d}\right)\right)$ 계산.
  6. 16개 배열로 압축하여 `site_geometry.horizon_profile`에 저장.

---

## 6. P0 프로토타입 세부 WBS 및 추진 일정 (총 1 ~ 1.5주)

| WBS | 작업 내용 | 세부 산출물 | 예상 일정 |
|---|---|---|---|
| **WBS 1** | **모듈 독립 환경 & 보안 격리 구축** | - `src/features/pitching/` 폴더 생성<br>- `/admin/pitching-preview` 라우트 개설 (관리자 검증 404 차단)<br>- `noindex, nofollow` 메타 및 헤더 설정 | 0.5일 |
| **WBS 2** | **철수네 DEM 자동 산출 & DB 초기화** | - Open-Meteo DEM 16방위 능선 각도 자동 계산 스크립트 실행<br>- 대표님 전달 실측치(크기, 방위, 나무 위치) DB/JSON 입력 | 0.5일 |
| **WBS 3** | **3D 디오라마 렌더러 & 절차적 터널형 텐트** | - R3F 기반 파쇄석 바닥 PBR 질감 + 주변 나무 배치<br>- 입력 치수 비례 터널형 아치 절차적 메시 + 폴대 라인 + 팩<br>- Directional Soft Shadow + ContactShadows + 3/4 부감 구도<br>- 버텍스 셰이더 바람 연출 | 1.5일 |
| **WBS 4** | **타임랩스 엔진 & 24방향 채점기 연동** | - SunCalc 태양 궤적 + 능선 그림자 마스킹 판정<br>- `/api/weather` 3일 예보 연동 + 풍향 $\sin/\cos$ 벡터 합성 보간<br>- 24방향 Scoring 계산기 (일사, 풍하중, 강수 페널티) | 1.5일 |
| **WBS 5** | **1탭 결과 카드 & Canvas 캡처 공유** | - 추천 입구 방향, 주풍향 보강 팩(빨간 점), 시간대별 주의사항 카드<br>- Canvas 스크린샷 1탭 공유 / Web Share API 연동 | 0.5일 |
| **WBS 6** | **특허 발명 메모 작성 (병행)** | - `docs/pitching_sim_invention_notes.md`에 입력 변수, 수학적 벡터 계산식, 능선 마스킹 알고리즘 명세화 | 병행 |
| **WBS 7** | **대표님 실기기 튜닝 & 현장 그늘 검증** | - 모바일 실기기(안드로이드 웹뷰) 프레임/시각 품질 점검 (1~2라운드 피드백 반영)<br>- 맑은 날 15:00 / 17:00 실제 현장 그늘 사진과 시뮬레이션 비교 검증 (오차 ±15분 이내) | 2~3일 |

---

## 7. 향후 로드맵 (P1 ~ P3)

- **P1 (MVP)**: 8개 사이트 전체 확장, 텐트 6종 + 타프 3종 파라메트릭 메시, 관리자 2D(Konva) 장애물 에디터, 예약 페이지 원클릭 연동.
- **P2 (고도화)**: D-3/D-1 푸시 알림 자동 갱신 트리거 연동, 2D 탑뷰 폴백 완성, 사후 피드백 수집 및 추천 가중치 자가 보정.
- **P3 (정식 출시)**: 특허 출원 완료 후 메인 브랜치 병합, 대외 마케팅 및 타 캠핑장 확장/외부 AI API 공개.
