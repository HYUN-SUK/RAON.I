# 🔔 알림 시스템 구축 및 운영 매뉴얼 (Notification System Manual)

본 문서는 RAON.I의 알림 시스템(푸시/인앱 배지)의 아키텍처, 작동 원리, 그리고 새로운 알림을 추가하는 표준 절차를 정의합니다.

---

## 1. 아키텍처 철학: "DB 중심 설계 (Option A)"

모든 알림의 시작점은 **데이터베이스(`notifications` 테이블)**입니다.
애플리케이션(Front/Back)은 알림을 "발송"하지 않고, 단지 "기록"만 합니다. 실제 발송은 데이터베이스의 트리거가 담당합니다.

### 🔄 데이터 흐름도
1. **Trigger (발생)**: 예약 확정, 댓글 작성 등 이벤트 발생
2. **Record (기록)**: `notifications` 테이블에 `INSERT` (Status: `queued`)
3. **Dispatch (발송)**: DB Trigger(`trigger_push_notification`)가 Edge Function 호출
4. **Delivery (전송)**: Edge Function이 FCM을 통해 사용자 기기로 푸시 전송 + 결과 업데이트

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

### Q. 알림이 두 번 와요!
- 코드 어딘가에서 `dispatchNotification`을 두 번 호출했거나,
- **(중요)** 과거의 레거시 코드(`fetch` 로 직접 Edge Function 호출)가 남아있는지 확인하세요. 무조건 DB Insert로만 통일해야 합니다.

---

## 5. 시스템 안정성 유지 수칙
1. **Never Click-Send**: 클라이언트(브라우저)에서 알림 요청을 보내지 마세요. 해킹의 위험이 있고 신뢰할 수 없습니다.
2. **Idempotency**: 서버 로직 재시도 시 알림이 중복 생성되지 않도록, 가능한 경우 `related_id` 등을 활용해 중복 체크를 하세요.
3. **Log & Clean**: `notifications` 테이블은 계속 쌓입니다. 주기적인 백업/삭제 정책(예: 3개월 지난 로그 삭제)이 필요합니다.
