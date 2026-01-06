# Handoff Document
**작성일**: 2026-01-06
**작업자**: Antigravity (Google Deepmind)

## 📝 세션 요약 (Session Summary)
이번 세션에서는 SSOT 기반 **상황별 푸시 알림 시스템**을 구현했습니다.

### 1. 알림 이벤트 시스템 구축
- **15개 알림 이벤트 정의**: 예약/커뮤니티/미션/시스템 카테고리
- **정책 기반 분기**: 푸시 허용/금지, 조용시간 예외 여부
- **템플릿 시스템**: 동적 데이터 바인딩 지원

### 2. 인앱 배지 시스템 (In-App Badge)
- **BottomNav 통합**: 탭별 빨간 dot 배지 표시
- **자동 해제**: 탭 클릭 시 배지 읽음 처리
- **실시간 구독**: Supabase Realtime으로 변경 감지

### 3. 관리자 테스트 UI
- **이벤트 기반 테스트**: `/admin/push`에서 다양한 이벤트 테스트 가능
- **푸시/배지 분기 확인**: 정책에 따른 동작 검증

### 4. 빈자리 알림 (Waitlist)
- **대기 신청 버튼**: `WaitlistButton.tsx` 컴포넌트
- **DB 스키마**: waitlist 테이블 및 RPC 함수

---

## 🏗️ 기술적 결정 사항 (Technical Decisions)
- **조용시간 로직**: 22:00~08:00 KST 기준, 예약 관련 이벤트는 예외 허용
- **배지 우선 전략**: 푸시 발송 여부와 관계없이 항상 배지도 생성 (fallback)
- **sites.id 타입**: text 타입 유지 (waitlist FK 호환)

---

## 🚦 다음 작업 가이드 (Next Steps)

### 우선순위 HIGH
1. **실제 푸시 발송 연동**: Firebase Cloud Functions로 `notifications` 테이블 INSERT 트리거 구현
2. **예약 서비스 통합**: 예약 확정/취소 시 `notificationService.dispatchNotification()` 호출

### 우선순위 MEDIUM
3. **커뮤니티 이벤트 연동**: 좋아요/댓글 작성 시 작성자에게 배지 알림
4. **미션 보상 연동**: 미션 완료 시 보상 알림
5. **빈자리 알림 트리거**: 예약 취소 시 waitlist 대기자에게 알림

### 우선순위 LOW
6. **알림 히스토리 UI**: 사용자가 받은 알림 목록 조회 페이지
7. **알림 설정 UI**: 사용자별 알림 수신 설정

---

## ⚠️ 주의 사항 (Notes)
- **DB 스키마 적용 필수**: `20260106_in_app_badges.sql`, `20260106_waitlist.sql` 실행 (완료됨)
- **Firebase 환경변수**: 실제 푸시 발송을 위해 `.env.local`에 Firebase 설정 필요
- **Lint 경고**: `exhaustive-deps` 2개는 의도적인 구현 (무한 루프 방지)

---

## 📁 생성된 파일
| 파일 | 설명 |
|------|------|
| `src/types/notificationEvents.ts` | 15개 알림 이벤트 타입 및 정책 정의 |
| `src/services/notificationService.ts` | 조용시간 + 푸시/배지 분기 서비스 |
| `src/hooks/useInAppBadge.ts` | 탭별 배지 관리 훅 |
| `src/components/reservation/WaitlistButton.tsx` | 빈자리 알림 신청 버튼 |
| `supabase/migrations/20260106_in_app_badges.sql` | 인앱 배지 DB 스키마 |
| `supabase/migrations/20260106_waitlist.sql` | 빈자리 대기 DB 스키마 |
