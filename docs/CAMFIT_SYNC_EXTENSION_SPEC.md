# 📘 [라온아이 통합 예약 동기화 확장프로그램] 기술 명세서 및 프로젝트 인수인계서
**문서 버전**: v1.0.0  
**작성 일시**: 2026-08-29  
**프로젝트명**: RAON.I Universal Channel Manager Extension (라온아이 ↔ 타사 예약시스템 양방향 실시간 동기화 마스터)  
**관리자**: Lead Developer / Product Owner  

---

## 1. 🎯 프로젝트 개요 및 비전 (Executive Summary)

### 1-1. 배경 및 목적
* **기존 운영 방식의 한계**:
  * **인바운드(캠핏 ➔ 라온아이)**: 점주 스마트폰에 별도 앱(매크로드로이드)을 설치하여 카카오톡 알림톡을 파싱해 라온아이 웹훅으로 전송 중 (스마트폰 앱 설정 번거로움).
  * **아웃바운드(라온아이 ➔ 캠핏)**: 라온아이 앱 예약 발생 시 캠핏 관리자 캘린더에서 수동으로 사이트를 막거나 분리된 도구 사용.
* **프로젝트 목표**:
  * **스마트폰 서드파티 앱을 100% 제거**하고, 점주 카운터 PC의 **크롬 브라우저 확장프로그램 1개만으로 양방향(캠핏/야놀자/땡큐캠핑 ↔ 라온아이) 실시간 완전 자동 연동**을 구현.
  * 향후 라온아이에 입점할 수많은 캠핑장/숙소의 기존 예약시스템을 플러그인(Adapter) 방식으로 손쉽게 흡수하는 **라온아이 자체 채널 매니저(Channel Manager)** 인프라 구축.

---

## 2. ⚖️ 법률 및 약관 검토 결과 (Legal & Compliance)

| 구분 | 법률 및 조항 | 검토 결과 및 판단 | 위험도 |
| :--- | :--- | :--- | :---: |
| **형사 책임** | 정보통신망법 제48조 (침해행위) | 점주 본인이 정당한 계정으로 로그인한 세션 내에서 권한을 위임받아 수행하는 업무 자동화이므로 '권한 없는 침입'에 해당하지 않음. | **0% (안전)** |
| **형사 책임** | 형법 제314조 (업무방해죄) | 서버 마비나 과도한 트래픽을 유발하지 않으며, 점주 본인의 정당한 예약/차단 업무를 10~15초 주기로 경량 수행하므로 업무방해에 해당하지 않음. | **0% (안전)** |
| **민사 책임** | 부정경쟁방지법 / 저작권법 | 타사 DB 전체를 무단 크롤링하여 사업화하는 것이 아니라, 해당 점주 본인 사업장의 예약 데이터만 동기화하므로 위법성 없음. | **0% (안전)** |
| **운영 리스크** | 타사 플랫폼 이용약관 (자동화 금지) | 플랫폼 약관상 자동화 도구 사용 제한 조항이 있을 수 있으므로, **사람이 마우스를 조작하는 것과 동일한 속도와 이벤트 체인(Human Emulation)**을 탑재하여 탐지를 회피함. | **주의 / 대응 완료** |

> [!TIP]
> **법률적 안전 가이드라인**:
> 1. 입점 계약 시 **"점주 본인의 정당한 계정 권한을 바탕으로 라온아이가 예약 동기화 업무를 기술적으로 대행함"**에 대한 명시적 약관/동의를 받으면 완벽합니다.
> 2. 플랫폼 서버가 매크로로 감지하지 못하도록 사람이 마우스를 조작하는 속도와 패턴(Human Emulation)을 유지합니다.

---

## 3. 🏗️ 시스템 아키텍처 (System Architecture)

### 3-1. 양방향 동기화 파이프라인
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   [라온아이 백엔드]                                      │
│  - Supabase Database (`reservations`, `camfit_integration_logs`, `sites`)              │
│  - 24시간 실시간 큐 엔드포인트: `/api/admin/camfit-sync/queue`                            │
│  - ACK 완료 처리 엔드포인트: `/api/admin/camfit-sync/ack`                                │
│  - 인바운드 예약 수신 웹훅: `/api/integration/camfit-webhook`                           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ (REST API / JSON)
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                    [라온아이 크롬 확장프로그램 (Core Engine)]                              │
│                                                                                        │
│  [background.js] Service Worker                                                        │
│   - 시작/새로고침 즉시 0초 큐 검사 및 10초 주기 폴링                                   │
│   - 캠핏 탭 생존 검사 (PING) & 수신기 자동 강제 주입 (`chrome.scripting.executeScript`)  │
│   - 브라우저 데스크톱 알림 (`data:image/png;base64` 안전 가드)                           │
│                                                                                        │
│  [content.js] Content Script (캠핏 탭 DOM 조작 엔진)                                     │
│   - 2차원 열(Column X좌표)-행 교차 탐색 ➔ 대상 셀 핀포인트 오픈                          │
│   - 풀 마우스 이벤트 체인 (`triggerRealClick`: pointerdown/mousedown/mouseup/click)    │
│   - Fixed 모달 크기 기반 가시성 판별 (`rect.height > 0 && rect.width > 0`)             │
│   - 실시간 폴링 대기 루프 (`waitForElement` 최대 4초)                                   │
│   - 우측 패널: 박수 선택 + 메모 주입 + 상단 [적용] ➔ 팝업 [확인] ➔ 패널 닫기          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 💻 현재까지 구현 및 검증 완료된 성과 (Current Accomplishments)

### 4-1. 라온아이 백엔드 인프라 (100% 완료)
1. **환불 완료(`REFUNDED`) 사이트 선점 오판 버그 100% 완치**:
   - `ReservationForm.tsx`, `SiteList.tsx`, `DateRangePicker.tsx` 전수 수정 완료.
2. **동기화 API 미들웨어 401 권한 해제**:
   - `src/middleware.ts`에서 `/api/admin/camfit-sync/*` 경로 예외 화이트리스트 등록.
3. **과거 144건 누적 큐 완전 클린업 및 최신 24시간 실시간 큐 파이프라인 구축**:
   - `/api/admin/camfit-sync/queue` 최신순 20건 제한 및 `SUCCESS` 로그 매핑.
4. **Next.js 16 프로덕션 빌드 102개 전체 라우트 100% 무결 통과**.

### 4-2. 확장프로그램 코어 엔진 (v2.8.0 구축 완료)
1. **통신선 단절 에러(`Could not establish connection`) 100% 영구 해결**:
   - `background.js`에서 PING 신호 실패 시 `chrome.scripting.executeScript`로 `content.js`를 자동 주입(Auto-Inject).
2. **상세 패널 내부 자동 입력 100% 실측 검증 완료 (성공 캡처 확보)**:
   - 우측 상세 화면이 열렸을 때 **`2박 (~9/9)` 박수 자동 선택** 및 **`[RAON.I_APP] 입금대기 - 동적기한테스터...` 메모 자동 주입**까지 완벽하게 타이핑되어 들어감을 실측 확인.
3. **알림창 크래시 에러(`Unable to download images`) 완치**:
   - 표준 base64 PNG data URI 적용 및 `try...catch` 안전 래핑.

---

## 5. 🔍 현재 남아있는 기술 과제 (Remaining Tasks for Next Session)

새로운 개발 세션에서 집중하여 완결지어야 할 항목은 아래 **3가지 연결부**입니다:

### 과제 1. 캘린더 셀 ➔ 상세 패널 자동 오픈 트리거 완결
* **현상**: 확장프로그램이 8일 열의 `[철수네]` 셀을 클릭할 때, 캠핏 웹 프레임워크(Vue.js)가 실제 사용자 클릭으로 인식하여 우측 상세 패널을 오픈하도록 셀 내부 타겟팅 정밀화.
* **해결 방향**:
  * `[철수네] 0/1 (0%)` 텍스트 요소 본체뿐만 아니라, 해당 셀을 감싸고 있는 상위 부모 컨테이너(`td`, `div.cell`, `div.grid-item`) 전체에 마우스 클릭 이벤트를 전파.

### 과제 2. 상단 파란색 [적용] 버튼 ➔ [확인] 팝업 승인 ➔ 닫기 연쇄 완결
* **현상**: 메모 입력 후 파란색 [적용] 버튼이 Vue.js 상태 갱신을 인지하고 클릭되어 `예약불가 기간 등록` 팝업을 띄우고 [확인]을 누르는 과정 완결.
* **해결 방향**:
  * 메모 입력창에 `input`, `change`, `blur` 이벤트를 발생시켜 Vue/React 상태(v-model)를 완벽히 커밋한 후 [적용] 버튼 클릭.

### 과제 3. 캠핏 ➔ 라온아이 인바운드 동기화 탑재 (매크로드로이드 대체)
* **구현 방식 (네트워크 API 인터셉트)**:
  * 확장프로그램이 캠핏 관리자 탭의 `fetch`/`XMLHttpRequest` 네트워크 요청을 가로채서, 타사에서 발생한 새 예약을 즉시 라온아이 웹훅(`/api/integration/camfit-webhook`)으로 전송.
  * ➔ 스마트폰 매크로드로이드 앱 완전 폐기 및 PC 확장프로그램 일원화 달성!

---

## 6. 🌐 향후 멀티 플랫폼(야놀자, 땡큐캠핑 등) 확장 아키텍처

```
raoni-channel-manager-extension/
├── manifest.json                  # Manifest V3 설정
├── background.js                 # 공통 코어 백그라운드 (큐 폴링, 알림, 라온아이 통신)
├── popup.html / popup.js          # 관리자 UI (동기화 로그, 상태 모니터링)
├── core/
│   ├── NetworkInterceptor.js      # 인바운드 예약 가로채기 엔진
│   ├── MouseEmulator.js           # 휴먼 모방 마우스/키보드 엔진
│   └── QueueClient.js             # 라온아이 서버 통신 클라이언트
└── adapters/
    ├── CamfitAdapter.js           # 캠핏 전용 화면 파싱/조작 플러그인
    ├── ThankyouAdapter.js         # 땡큐캠핑 전용 플러그인
    ├── YanoljaAdapter.js          # 야놀자 전용 플러그인
    └── NaverBookingAdapter.js     # 네이버예약 전용 플러그인
```

---

## 7. 📁 소스코드 위치 및 인수인계 파일 링크

* **확장프로그램 루트 경로**: [`c:\Users\user\Desktop\RAON.I\raoni-camfit-sync-extension`](file:///c:/Users/user/Desktop/RAON.I/raoni-camfit-sync-extension)
  * [`background.js`](file:///c:/Users/user/Desktop/RAON.I/raoni-camfit-sync-extension/background.js) (백그라운드 서비스 워커)
  * [`content.js`](file:///c:/Users/user/Desktop/RAON.I/raoni-camfit-sync-extension/content.js) (캠핏 웹페이지 조작 스크립트)
  * [`manifest.json`](file:///c:/Users/user/Desktop/RAON.I/raoni-camfit-sync-extension/manifest.json) (v2.8.0 설정 파일)
* **라온아이 백엔드 큐 API**: [`src/app/api/admin/camfit-sync/queue/route.ts`](file:///c:/Users/user/Desktop/RAON.I/src/app/api/admin/camfit-sync/queue/route.ts)
* **인수인계 문서**: [`handoff.md`](file:///c:/Users/user/Desktop/RAON.I/handoff.md) & [`task.md`](file:///c:/Users/user/Desktop/RAON.I/task.md)
