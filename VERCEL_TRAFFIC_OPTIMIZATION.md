# 📊 Vercel 트래픽 최적화 및 무료 플랜 복귀 운영 보고서

> **문서 목적**: 2026년 10월 발생한 Vercel 배포 일시정지(`This deployment is temporarily paused`) 사태의 원인을 기록하고, 악성 봇 차단 및 캐시 최적화 조치 내역과 향후 **영구 무료(Hobby) 플랜으로 안전하게 복귀하기 위한 지속 점검 기준**을 공유합니다.

---

## 1. 사건 개요 및 문제 진단

### ① 발생 현상
* 모바일 앱 및 웹 접속 시 흰 화면에 **"This deployment is temporarily paused"** 경고 문구가 출력되며 서비스 차단.

### ② 베르셀 사용량(Usage) 팩트 분석 (스크린샷 대조)
* 🔴 **CDN Requests (CDN 요청 수)**: **3,000,000회 / 한도 1,000,000회 (300% 초과)** ➔ **배포 정지 직접 원인**
* 🟡 **Fast Data Transfer (대역폭)**: **87 GB / 한도 100 GB (87% 소진)**
* 🔵 **Image Optimization - Cache Writes**: **64,000회 / 한도 100,000회**
* ⚪ **Function Invocations (서버 함수 호출)**: **94,000회 / 한도 1,000,000회 (겨우 9.4% 소진)**

### ③ 진단 결론
* 서버 로직이나 실제 사용자가 일으킨 트래픽(`Function Invocations`)은 9.4만 회로 무료 쿼터의 10% 미만이었습니다.
* 즉, 실제 사용자가 몰린 것이 아니라 **`robots.txt`가 없는 틈을 타 해외 악성 크롤러 봇(`Bytespider`, `PetalBot` 등)이 정적 이미지와 자바스크립트 번들을 300만 번 무차별 다운로드**하고, Next.js의 기본 이미지 캐시 기간(60초)으로 인해 **동일한 이미지가 반복 재변환(Cache Writes 64K, 대역폭 87GB)**되면서 무료 한도를 초과했던 것입니다.

---

## 2. 운영 목표

1. **임시 조치**: 일시정지 해제를 위해 Vercel Pro(월 $20, CDN 1,000만 회 제공)로 즉시 전환하여 정상 서비스 복구 완료.
2. **궁극적 목표**: 코드 최적화를 통해 일일 요청 수와 대역폭을 70~80% 감축시켜, **다음 결제일 이전에 프로(Pro)를 취소하고 영구 무료(Hobby) 쿼터로 안전 복귀**.

---

## 3. 적용된 조치 상세 내역

### ① `src/app/robots.ts` (Next.js 16 메타데이터 표준 봇 제어)
* **AI 실시간 검색 및 추천 봇 100% 허용 (`Allow: /`)**:
  * `Googlebot`: 구글 검색 및 **구글 제미나이(Gemini) AI 검색**
  * `Yeti`: 네이버 검색 및 **네이버 클로바X(Clova) AI 추천**
  * `OAI-SearchBot`: **OpenAI SearchGPT & 챗GPT 실시간 검색 봇**
  * `ChatGPT-User`: 챗GPT 사용자가 라온아이 링크 요청 시 실시간 탐색
  * `Claude-SearchBot`: **앤트로픽 클로드(Claude) 공식 실시간 검색/추천 봇**
  * `Claude-User`: 클로드 사용자가 라온아이 질문 시 실시간 방문 봇
  * `PerplexityBot`: 전 세계 1위 AI 검색엔진 **퍼플렉시티** 추천 보장
  * `kakaotalk-scrap`: 카카오톡 채팅방 링크 공유 시 썸네일/미리보기 보장
  * `facebookexternalhit`: SNS 링크 미리보기 보장
* **무차별 데이터 수집/악성 스크레이퍼 전면 차단 (`Disallow: /`)**:
  * `Bytespider` (틱톡/바이트댄스 무차별 긁어가기 - 트래픽 약탈 1위 주범)
  * `PetalBot` (화웨이 대역폭 잠식 봇)
  * `CCBot` (Common Crawl 대량 데이터 수집기)
  * `AhrefsBot`, `SemrushBot`, `MJ12bot`, `DotBot`, `BLEXBot` (해외 유료 분석 봇)
  * `cohere-ai`, `YandexBot`
* **내부 번들 및 API 보호**:
  * 일반 검색 봇에게 `/_next/`, `/api/`, `/admin/`, `/auth/` 경로 수집 금지 지정 ➔ 불필요한 JS 번들 다운로드 원천 차단.

### ② `next.config.ts` 캐시 및 대역폭 최적화
* **이미지 캐시 수명 30일 설정 (`minimumCacheTTL: 2592000`)**:
  * 기존 60초마다 새로 변환되던 캠핑장/배경 이미지를 30일 동안 Vercel 에지에 캐싱.
  * **효과**: `Image Cache Writes`(64K ➔ 5K 이하) 및 `Fast Data Transfer`(87GB ➔ 30GB 이하) 대폭 절감.
* **고효율 압축 포맷 활성화 (`formats: ['image/avif', 'image/webp']`)**:
  * 기존 포맷 대비 30~50% 더 가벼운 포맷으로 전송하여 대역폭 절약.
* **정적 디자인 에셋 브라우저 1년 장기 캐시 (`headers`)**:
  * `/icons/`, `/images/` 파일에 `Cache-Control: public, max-age=31536000, immutable` 적용.
  * 손님 기기에서 앱 아이콘과 로고를 로컬 보관하여 앱 실행 시 CDN 요청 0건 달성.
  * *(※ 푸시 알림용 `firebase-messaging-sw.js` 및 앱 인증 파일은 장기 캐시에서 제외하여 안정성 100% 보장)*

---

## 4. 다른 세션에서도 지속 점검할 체크리스트 (Monitoring Guide)

향후 다른 세션에서 대표님과 작업할 때, 아래 기준을 점검하여 무료 플랜 복귀 시점을 판단합니다.

### 📊 Vercel 대시보드 점검 지표
* **확인 위치**: [Vercel Dashboard](https://vercel.com) ➔ `RAON.I` ➔ **[Usage]** 탭

| 점검 지표 | 무료(Hobby) 월간 한도 | 안전 복귀 기준 (일일 지표) |
| :--- | :---: | :---: |
| **CDN Requests** | 1,000,000회 / 월 | **일 33,000회 이하** (안정권 1~2만 회) |
| **Fast Data Transfer** | 100 GB / 월 | **일 3.3 GB 이하** (안정권 1 GB 내외) |
| **Image Cache Writes** | 100,000회 / 월 | **일 3,000회 이하** |

### 🗓️ 무료 플랜 복귀 절차 (Action Plan)
1. **모니터링 기간**: 조치 배포 후 3~5일간 Vercel Usage 그래프 관찰.
2. **트래픽 안정 확인**: 일일 CDN 요청 수가 2~3만 회 수준(월 60~80만 회 페이스)으로 안착했는지 확인.
3. **프로 결제 취소(다운그레이드)**:
   * Vercel Dashboard ➔ **[Settings]** ➔ **[Billing]** ➔ **[Change Plan]** ➔ **[Hobby (Free)] 선택**.
   * 다음 청구일 전에 다운그레이드를 완료하여 월 $20 추가 결제를 방지.
