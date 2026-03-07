# 🔔 알림 시스템 구축 및 운영 핸드북 (v2.3 - 2026-03-03 업데이트)

본 문서는 RAON.I의 알림 시스템(푸시/인앱 배지)의 아키텍처, 작동 원리, 그리고 새로운 알림을 추가하는 표준 절차를 정의합니다.

---

## 1. 아키텍처 철학: "DB 중심 설계 (Option A)"

모든 알림의 시작점은 **데이터베이스(`notifications` 테이블)**입니다.
애플리케이션(Front/Back)은 알림을 "발송"하지 않고, 단지 "기록"만 합니다. 실제 발송은 데이터베이스의 트리거가 담당합니다.

### 🔄 데이터 흐름도
1. **Trigger (발생)**: 예약 확정, 댓글 작성 등 이벤트 발생
2. **Record (기록)**: `notifications` 테이블에 `INSERT`. 이때 `related_id`를 필수로 넣어야 중복 발송이 차단됩니다. (Status: `queued`)
3. **Direct Dispatch (직접 발송)**: 
   - **1:1 알림 (예약 등)**: 애플리케이션 코드가 직접 Edge Function(`push-notification`)을 호출하여 1~2초 내 즉각 도달을 보장합니다.
   - **대량 알림 (리마인더)**: `camping-reminder` 함수가 직접 FCM 서버로 **병렬 덩어리(Parallel Chunking)** 발송을 수행합니다.
4. **Delivery (전송)**: Edge Function이 사용자의 **모든 살아있는 토큰(통로)으로 동시에 발송**합니다. (Broadcast Strategy)
5. **Pruning (청소)**: 발송 중 FCM에서 `UNREGISTERED` 또는 `NOT_FOUND` 에러를 반환하면, 서버는 해당 토큰을 DB에서 **즉시 삭제**하여 유령 토큰을 박멸합니다.
6. **Result (결과)**: 최소 하나 이상의 전송이 성공하면 `status='sent'`, 모든 전송이 실패하거나 토큰이 없으면 `status='failed'`로 기록합니다.

---

## 2. 알림 유형 및 정책
알림은 중요도에 따라 두 가지 경로로 나뉩니다. 이는 `src/types/notificationEvents.ts`에서 관리합니다.

| 유형 | 설명 | 예시 | 푸시 발송 | 배지 생성 |
| :--- | :--- | :--- | :---: | :---: |
| **즉시 알림** | 사용자가 즉각 알아야 하는 중요 정보 | 예약 확정, 입금 요청, 재난 문자 | ✅ (필수) | ✅ |
| **조용 알림** | 급하지 않지만 확인이 필요한 정보 | 커뮤니티 댓글, 좋아요, 미션 달성 | ❌ (금지) | ✅ |

> **🌙 조용 시간 (Quiet Hours)**
> - 시간: 22:00 ~ 08:00 (KST)
> - 정책: '긴급(Safety)' 또는 '예약 관련'을 제외한 모든 푸시는 이 시간대에 **자동으로 배지로 전환**됩니다.

---

## 3. 새로운 알림 추가 가이드 (Standard Procedure)

새로운 알림(예: "이벤트 당첨")을 추가하려면 아래 3단계만 따르면 됩니다.

### Step 1. 이벤트 타입 정의
`src/types/notificationEvents.ts` 파일의 `NotificationEventType` Enum에 새 타입을 추가합니다.

```typescript
export enum NotificationEventType {
    // ... 기존 항목들
    EVENT_WON = 'event_won', // [NEW] 이벤트 당첨
}
```

### Step 2. 정책 및 템플릿 설정
같은 파일의 `NOTIFICATION_EVENT_CONFIGS` 객체에 설정을 추가합니다.

```typescript
[NotificationEventType.EVENT_WON]: {
    type: NotificationEventType.EVENT_WON,
    requires_push: true,          // 푸시를 보낼 것인가?
    quiet_hours_override: false,  // 밤에도 울릴 것인가? (보통 false)
    fallback_badge: true,         // 푸시 실패/차단 시 배지로 남길 것인가?
    badge_target: 'myspace',      // 탭 아이콘 배지 위치 ('home' | 'reservation' | 'community' | 'myspace')
    title_template: '🎉 이벤트 당첨!',
    body_template: '{{eventName}} 이벤트에 당첨되셨습니다! 보상을 확인하세요.',
},
```

### Step 3. 알림 발생 (코드 구현)
비즈니스 로직(Server Action 등)에서 `notificationService`를 호출하지 않고, **DB에 직접 Insert** 하거나 래퍼 함수를 사용합니다.

```typescript
// 예시: Server Action 내부
import { notificationService } from '@/services/notificationService';

// ... 당첨 로직 처리 ...

// 알림 "기록" (발송은 아님!)
await notificationService.dispatchNotification(
    NotificationEventType.EVENT_WON,
    userId,
    { eventName: '겨울 캠핑 사진전' } // 템플릿 변수 채우기
);
```

---

## 4. 트러블슈팅 (Troubleshooting)

### Q. 알림이 안 와요!
1. **DB 확인**: `notifications` 테이블에 데이터가 들어갔나요?
    - **No**: 비즈니스 로직(Step 3)이 실행되지 않았습니다. (트랜잭션 롤백 등 확인)
    - **Yes (status='queued')**: 발송 엔진이 호출되지 않았거나 지연 중입니다. (Direct Invocation 코드 확인)
    - **Yes (status='failed')**: `error_message` 컬럼의 에러 메시지를 확인하세요. (토큰 만료 등)
    - **Yes (status='sent')**: 발송은 성공했습니다. 사용자 기기의 알림 설정이나 네트워크 문제입니다.

### Q. 알림이 두 번 와요! (중복 발송 문제 해결책)
1. **DB 레코드 중복**: `notifications` 테이블에 같은 `related_id`를 가진 레코드가 2개인지 확인하세요.
    - **해결**: `idx_notifications_unique_related` 유니크 인덱스가 이를 물리적으로 막습니다.
2. **기기 핑 중복**: DB 레코드는 1개인데 폰이 2번 울릴 때.
    - **원인**: 사용자가 여러 브라우저/기기를 사용 중이거나, 토큰이 중복 등록된 경우입니다.
    - **대응**: 현재 **'Broadcast Policy'**에 따라 모든 기기에 알림이 가는 것이 정상이지만, 같은 기기에서 중복을 피하기 위해 `collapse_key`를 사용합니다.

### Q. 알림이 간헐적으로 안 와요! (2026-02-28 해결)
1. **문제**: 한 사용자에게 여러 개의 토큰이 중복 등록되어 있고, 서버가 그 중 "죽은 통로"에만 보냈을 때 발생했습니다.
2. **해결 (Broadcast & Prune)**:
    - **전방위 발송**: 이제 서버는 사용자에게 할당된 모든 토큰으로 동시에 쏩니다.
    - **자동 청소**: 발송 실패 시 해당 토큰을 즉시 DB에서 삭제하여 다음 발송의 정확도를 높입니다.

---

## 5. 정기 자동 알림 (Camping Reminders - 🏕️ 2026-02-22 업데이트)

기존의 불안정했던 DB 내부 스케줄러(`pg_cron`)를 폐기하고, 비용이 발생하지 않으면서도 100% 신뢰성을 보장하는 **GitHub Actions Cron + API Proxy 라우트** 아키텍처로 개편되었습니다.
또한, Serverless Edge Function 특유의 무거운 외부 API 통신 시 10초 타임아웃(Timeout) 한계를 극복하기 위해 작업을 두 단계로 분리(Prefetch / Dispatch)하여 운영합니다.

### ⏳ 스케줄링 및 무거운 작업 극복 구조
- **크론(Cron) 작업**: `camping-reminder` Edge Function을 정기적으로 실행하여 발송 조건을 평가합니다.
  - GitHub Actions의 내장된 Cron 기능을 사용하여 매일 **08:15 (Prefetch)** 및 **08:30 (Dispatch)**에 스크립트를 실행합니다. 정각 트래픽 과부하를 피하기 위해 스케줄을 분산했습니다.
  - GitHub Actions가 Supabase Edge Function API를 HTTP POST 방식으로 호출합니다.
  - Vercel과 같은 Serverless 호스팅의 짧은 타임아웃(10~30초) 병목을 원천적으로 회피하기 위해, **GitHub Actions 서버에서 Supabase Edge Function을 직접 호출(Direct Call)**하는 구조를 채택했습니다.
  - GitHub 환경변수(Variables)에 등록된 프론트엔드 공개용 키(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)만을 사용하여 안전하게 통신하며, GitHub Actions 자체의 타임아웃은 6시간이므로 외부 날씨 API 연동과 같은 장기 대기 쓰레드도 100% 안정적으로 완료됩니다.

#### 🔄 고성능 발송 프로세스 (Grid-First & Chunking)
1. **[단계 1] 격자 기반 프리페치 (08:15 AM KST)**: 
   - 개별 사용자 위치가 아닌, 전국을 5km 격자(`nx`, `ny`) 단위로 그룹화하여 날씨를 수집합니다.
   - 중복 호출을 90% 이상 제거하여 수천 명의 알림 대상자도 단 몇 초 만에 캐싱을 완료합니다.
2. **[단계 2] 초고속 병렬 발송 (08:30 AM KST)**:
   - **Force Cache**: 외부 API 연동 없이 오직 DB 캐시만 사용하여 메시지를 조립합니다. 캐시가 없을 경우 지연을 방지하기 위해 즉시 기본값(Fallback)을 사용합니다.
   - **Direct FCM**: `push-notification` 함수를 거치지 않고 직접 FCM 서버와 통신하여 오버헤드를 최소화합니다.
   - **Parallel Chunking**: 5~10건씩 묶어 병렬로 발송하여 대량 발송의 병목을 제거합니다.

### 🧠 향상된 날씨 및 주변 정보 로직 (2026-03-05 업데이트)

- **일정 기반 동적 기상청 API 스위칭 (Dynamic Weather Provisioning by D-Day)**:
  알림 발송 시점의 날씨가 아닌, **실제 캠핑 기간(예: 2박 3일)**의 날씨를 시점별로 최신화하여 제공하는 것이 설계의 핵심입니다.
  - **D-4 (4일 전 리마인드)**: 기상청 **중기예보 API**를 활용하여, 실제 캠핑 일정(현재 기준 4~6일 후)의 날씨를 미리 예측하여 안내합니다.
  - **D-1 (하루 전 리마인드)**: 실제 캠핑 일정(현재 기준 1~3일 후)이 **단기예보 API** 영역에 들어왔으므로, 한층 정밀해진 단기 모델 데이터로 정정/업데이트하여 제공합니다.
  - **D-0 (당일 리마인드)**: 체크인 시점에 맞춘 최신 기상(현재~모레) 데이터를 실시간으로 반영하여 최종 날씨를 안내합니다.

- **타캠핑장 맞춤형 동적 지역코드 오토 맵핑 (Geo-to-RegId Auto Mapping)**:
  사용자가 추가한 '타 캠핑장' 일정의 다양한 위치(제주, 강원 등)에도 완벽한 중기예보를 제공하기 위해, 좌표(lat/lng)를 기상청 전용 **행정구역 코드(예: 11C20000) 및 기온 관측소 코드(예: 11C20401)**로 자동 치환하는 내부 맵핑표를 엣지 펑션 레벨에서 동작시켜 모든 지역의 캠핑장 날씨를 완벽하게 커버합니다.

- **시간대별 정밀 날씨 (Time-Specific Weather)**:
  - 단일 날씨 추출 방식을 고도화하여 기상청 데이터에서 **오전(06~09시)**과 **오후(12~15시)** 기상을 분리 파싱합니다.
  - **첫째 날(체크인)**: 입실 시간에 맞춘 **오후** 표기 (예: `금 오후: ☀️`)
  - **중간 날짜**: 온종일 야외 활동을 위한 **전체** 대표 날씨 표기 (예: `토: 🌧️`)
  - **마지막 날(체크아웃)**: 퇴실 시간에 맞춘 **오전** 표기 (예: `일 오전: 🌤️`)

- **모든 리마인드 날씨 통합**: 기존 누락되었던 D-1 예약 알림 본문에도 다일 날씨 요약 파트를 동일하게 명시하여 모든 사용자 경험의 통일성을 맞췄습니다.
- **D-0 행사 알림 예비(Fallback) 데이터 개선**: 과거 시스템의 오류로 라온아이 주소/좌표가 누락된 채 생성된 일정의 경우, 엣지 펑션 자체 예외 처리 기준을 '서울'에서 '예산'(36.6269 / 126.7647)으로 대체하여 향후 지리적 오류 발생을 원천 차단했습니다.

### 🛡️ 장애 대응 및 보안 (Robustness)
- **타임아웃 제어**: 외부 API 호출 시 최대 6초의 엄격한 타임아웃을 적용하여 전체 발송 프로세스가 멈추는 것을 방지합니다.
- **권한 관리**: GitHub Actions 호출 시 `SERVICE_ROLE_KEY`를 필수 사용하여 RLS 제약을 우회하고 관리자 권한으로 안정적인 데이터 처리를 수행합니다.
- **지연 감지**: GitHub 서버 지연 시에도 `github.event.schedule` 정보를 기반으로 작업 모드를 정확히 판별하여 누락 없는 발송을 보장합니다.

### 🛠️ 점검 및 수동 복구 방법
- **로그인/권한 문제**: Github Actions 콘솔(`Actions` 탭 -> `Camping Reminder Cron`)에서 에러 로그를 가장 빠르고 직관적으로 확인할 수 있습니다.
- **수동 지연 발송(Catch-up)**: 시스템 다운 등으로 아침 알림이 누락되었다면, 아래 명령어로 터미널에서 즉시 강제 발송이 가능합니다.
  ```bash
  curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/camping-reminder?mode=prefetch"
  sleep 10
  curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/camping-reminder?mode=dispatch"
  ```

---

## 6. 시스템 안정성 유지 수칙
1. **Never Click-Send**: 클라이언트(브라우저)에서 알림 요청을 보내지 마세요. 해킹의 위험이 있고 신뢰할 수 없습니다.
2. **Idempotency**: 알림 생성 시 반드시 `related_id`(예: 주문번호)를 포함하여 DB 유니크 제약 조건이 작동하게 하세요.
3. **Registration Guard (SW)**: `ServiceWorkerRegister.tsx`에서 서비스 워커를 매번 재등록하지 마세요. 이미 활성화된 워커가 있다면 재등록을 건너뛰어 토큰 변동성(Churn)을 최소화해야 합니다.
4. **Token Sync Guard**: 클라이언트에서 토큰 동기화 시 `localStorage`를 활용하여 서버로의 무분별한 `upsert` 요청을 차단하세요.

---

## 7. 알림 브랜딩 및 가시성 고도화 (Branding)
알림의 신뢰도와 브랜딩을 강화하기 위해 다음 필드를 활용할 수 있습니다.

1.  **`icon`**: 알림 본문에 표시되는 앱 로고 (192x192 권장).
2.  **`badge`**: 안드로이드 상태바에 뜨는 작은 단색 아이콘. 로고의 형태(Shape)만 추출하여 사용.
3.  **`image`**: 알림 하단에 크게 노출되는 이미지. 캠핑장 전경이나 미션 성공 사진 등에 활용 가능.
4.  **관련 인프라**:
    - **PWA**: 홈 화면 설치 시 알림 제목 옆에 브라우저 이름 대신 웹앱 이름이 표시됨.
    - **TWA (Google Play Store)**: 완전한 앱 자격을 갖게 되어 알림 영역에서 '삼성 인터넷' 등의 흔적을 완전히 제거 가능.

---

## 8. 에지 함수 배포 가이드 (Deployment)

로컬 환경에 Docker가 설치되어 있지 않거나, 빌드 오류가 발생할 경우 Supabase 서버의 리소스를 사용하는 **서버사이드 빌드** 방식을 권장합니다.

```bash
# Docker 없이 서버사이드 빌드로 배포하는 표준 명령어
npx supabase functions deploy push-notification --use-api
npx supabase functions deploy camping-reminder --use-api
```

> [!TIP]
> **성능 최적화**: 대량 발송 로직이 포함된 `camping-reminder` 함수는 배포 시 반드시 `--use-api` 플래그를 사용하여 의존성 관계가 깨지지 않도록 주의하십시오.
