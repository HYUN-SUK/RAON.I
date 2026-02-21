# 🔔 알림 시스템 구축 및 운영 핸드북 (v2.0)

본 문서는 RAON.I의 알림 시스템(푸시/인앱 배지)의 아키텍처, 작동 원리, 그리고 새로운 알림을 추가하는 표준 절차를 정의합니다.

---

## 1. 아키텍처 철학: "DB 중심 설계 (Option A)"

모든 알림의 시작점은 **데이터베이스(`notifications` 테이블)**입니다.
애플리케이션(Front/Back)은 알림을 "발송"하지 않고, 단지 "기록"만 합니다. 실제 발송은 데이터베이스의 트리거가 담당합니다.

### 🔄 데이터 흐름도
1. **Trigger (발생)**: 예약 확정, 댓글 작성 등 이벤트 발생
2. **Record (기록)**: `notifications` 테이블에 `INSERT`. 이때 `related_id`를 필수로 넣어야 중복 발송이 차단됩니다. (Status: `queued`)
3. **Dispatch (발송)**: DB Webhook/Trigger가 Edge Function(`push-notification`) 호출
4. **Delivery (전송)**: Edge Function이 사용자 기기로 전송. **중요: 가장 최근에 활성화된 토큰 1개로만 전송합니다.**
5. **Result (결과)**: `result` 컬럼에 FCM 응답 로그가 JSON 형식으로 기록됩니다.

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
    - **Yes (status='queued')**: Edge Function이 호출되지 않았거나 지연 중입니다.
    - **Yes (status='failed')**: `result` 컬럼의 에러 메시지를 확인하세요. (토큰 만료 등)
    - **Yes (status='sent')**: 발송은 성공했습니다. 사용자 기기의 알림 설정이나 네트워크 문제입니다.

### Q. 알림이 두 번 와요! (중복 발송 문제 해결책)
1. **DB 레코드 중복**: `notifications` 테이블에 같은 `related_id`를 가진 레코드가 2개인지 확인하세요.
    - **해결**: `idx_notifications_unique_related` 유니크 인덱스가 이를 물리적으로 막습니다.
2. **기기 핑 중복**: DB 레코드는 1개인데 폰이 2번 울릴 때.
    - **원인**: 사용자의 푸티 토큰(`push_tokens`)이 여러 개 등록되어 있기 때문입니다.
    - **해결**: Edge Function(`push-notification`)의 **'Single-Delivery Policy'**가 적용되어 있습니다. (`last_updated_at` 기준 가장 최근 토큰 1개만 선택)
    - **보완**: FCM 페이로드에 `collapse_key`와 `apns-collapse-id`를 적용하여 OS 수준에서 알림을 병합합니다.

---

## 5. 정기 자동 알림 (Camping Reminders)

사용자의 입실 1일 전(D-1), 4일 전(D-4)에 나가는 리마인드 알림은 `pg_cron` 시스템을 사용합니다.

- **스케줄러**: `invoke-camping-reminder` (매일 오전 09:00 KST 실행)
- **로직**: `camping-reminder` Edge Function이 실행되어 당일 기준 D-1/D-4 예약자를 찾아 `notifications`에 알림을 등록합니다.
- **점검 방법**: `cron.job_run_details` 테이블을 조회하여 실행 성공 여부를 확인하세요.

---

## 6. 시스템 안정성 유지 수칙
1. **Never Click-Send**: 클라이언트(브라우저)에서 알림 요청을 보내지 마세요. 해킹의 위험이 있고 신뢰할 수 없습니다.
2. **Idempotency**: 알림 생성 시 반드시 `related_id`(예: 주문번호)를 포함하여 DB 유니크 제약 조건이 작동하게 하세요.
3. **Token Management**: 사용자가 앱을 방문할 때마다 `push_tokens`의 `last_updated_at`을 갱신하여, 가장 "싱싱한" 토큰으로 알림이 가도록 유지해야 합니다.

---

## 7. 알림 브랜딩 및 가시성 고도화 (Branding)
알림의 신뢰도와 브랜딩을 강화하기 위해 다음 필드를 활용할 수 있습니다.

1.  **`icon`**: 알림 본문에 표시되는 앱 로고 (192x192 권장).
2.  **`badge`**: 안드로이드 상태바에 뜨는 작은 단색 아이콘. 로고의 형태(Shape)만 추출하여 사용.
3.  **`image`**: 알림 하단에 크게 노출되는 이미지. 캠핑장 전경이나 미션 성공 사진 등에 활용 가능.
4.  **관련 인프라**:
    - **PWA**: 홈 화면 설치 시 알림 제목 옆에 브라우저 이름 대신 웹앱 이름이 표시됨.
    - **TWA (Google Play Store)**: 완전한 앱 자격을 갖게 되어 알림 영역에서 '삼성 인터넷' 등의 흔적을 완전히 제거 가능.
