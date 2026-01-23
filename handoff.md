# 세션 인수인계 문서 (Handoff)

**날짜**: 2026-01-23
**세션 목적**: 빈자리 알림 기능 검증 및 예약 시스템 안정화

---

## 📌 현재 상태 요약

### 완료된 작업
1. **빈자리 알림 기능 (WaitlistButton)**
   - 디자인 변경: 에메랄드 → 포레스트 그린(#1C4526), 컴팩트 UI 적용
   - 상태 유지 버그 수정: 페이지 이동 후에도 '알림 신청됨' 상태가 DB 조회로 유지됨
   - 푸시 알림 발송 검증 완료

2. **예약 날짜 Timezone 이슈 완전 해결**
   - `formatLocalDate()`: 예약 생성 시 날짜 문자열 정확성 보장
   - `parseSafeDate()`: DB에서 가져온 날짜를 브라우저 Timezone 왜곡 없이 파싱
   - 전체 Store(`useReservationStore.ts`) 적용 완료

3. **예약 마감 현황 동기화**
   - `get_public_reservations` RPC 함수 추가 (민감정보 제외한 공개 예약 조회)
   - `ReservationPage` 진입 시 서버 데이터로 예약 현황 갱신

4. **LocalStorage 캐시 문제 해결**
   - Zustand `persist`로 인해 오래된 예약 데이터가 캐싱되던 문제 수정
   - `fetchPublicReservations` 시 서버 데이터로 완전히 교체하도록 변경

---

## 🔧 기술적 결정 사항

### 1. 날짜 파싱 전략 (utils/date.ts)
- `new Date("YYYY-MM-DD")`는 브라우저에서 UTC 00:00으로 파싱됨
- 한국 시간(UTC+9) 기준으로 정확히 맵핑하기 위해 수동 파싱(`parseSafeDate`) 도입
- 모든 예약 관련 날짜 조회 함수에 적용

### 2. 예약 상태 관리 (useReservationStore.ts)
- `fetchPublicReservations`: 서버 데이터로 완전 교체 (merge → replace)
- 이유: `persist` 캐시로 인한 데이터 오염 방지

### 3. SQL 마이그레이션
- `supabase/migrations/20260124_get_public_reservations.sql` 실행 **필수**
- 이 RPC 없이는 예약 마감 현황이 표시되지 않음

---

## 📋 다음 작업 가이드

### 우선 순위 높음
1. **디버깅 스크립트 수동 삭제** (삭제 실패됨)
   - `scripts/test-rpc.ts`, `scripts/debug-db.ts` 수동 삭제 권장

2. **오래된 예약 데이터 정리**
   - Timezone 버그 시절 저장된 예약은 날짜가 하루 밀려있을 수 있음
   - 관리자 콘솔에서 과거 테스트 데이터 삭제 권장

### 우선 순위 낮음
3. **notifications 테이블 RLS 정책 재활성화**
   - 현재 비활성화 상태 (Push 알림 기능 위해)
   - 추후 올바른 정책으로 재활성화 필요

4. **ESLint 정리**
   - `eslint.ignoreDuringBuilds` 해제 전 경고 정리

---

## ⚠️ 주의 사항

### 알려진 제한
- 기존 예약 데이터 중 Timezone 버그 기간(~2026-01-23)에 생성된 건은 날짜가 부정확할 수 있음
- 배포 환경에서는 **반드시 SQL 마이그레이션 실행 후 테스트** 권장

### 환경 설정
- SQL 마이그레이션: `20260124_get_public_reservations.sql` Supabase SQL Editor에서 실행 필수

---

## 📁 주요 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/reservation/WaitlistButton.tsx` | 디자인 변경 및 상태 유지 로직 수정 |
| `src/store/useReservationStore.ts` | 날짜 파싱(parseSafeDate), 캐시 교체 로직 |
| `src/utils/date.ts` | `formatLocalDate`, `parseSafeDate` 함수 추가 |
| `src/app/(mobile)/reservation/page.tsx` | `fetchPublicReservations` 호출 추가 |
| `supabase/migrations/20260124_get_public_reservations.sql` | 공개 예약 조회 RPC |
