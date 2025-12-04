# Handoff Document

## 1. 현재 상태 요약 (Session Summary)
- **예약 규칙 검증 완료**:
  - `src/utils/reservationRules.ts` 유틸리티 분리 및 `scripts/verifyRules.ts` 스크립트를 통한 로직 검증 완료.
  - 브라우저 서브에이전트를 통해 실제 화면에서의 예약 차단(주말 2박) 및 허용(D-N 예외) 동작 검증 완료.
- **실시간 가격 연동 완료**:
  - `src/utils/pricing.ts` 모듈화 및 `useReservationStore` 연동.
  - 예약 폼에서 가족 수, 방문객 수 변경 시 총 결제 금액 실시간 반영 확인.
- **사이트 이미지 적용 완료**:
  - 기존 고품질 에셋(`tent_view_hero.png` 등)을 플레이스홀더로 적용하여 깨진 이미지 문제 해결.

## 2. 기술적 결정 사항 (Technical Decisions)
- **로직 모듈화 (Centralized Logic)**:
  - 예약 규칙(`reservationRules.ts`)과 가격 계산(`pricing.ts`) 로직을 컴포넌트에서 분리하여 순수 함수로 관리.
  - 이를 통해 브라우저 없이도 스크립트로 로직 검증이 가능해졌으며, 유지보수성이 향상됨.
- **이미지 전략**:
  - 디스크 공간 부족으로 인해 신규 이미지 생성 대신 기존 에셋을 재활용하는 전략 선택.

## 3. 다음 작업 가이드 (Next Steps)
1.  **결제 시스템 연동 (Priority High)**:
    - 현재 계산된 `totalPrice`를 바탕으로 실제 PG사 결제 모듈 연동 필요.
2.  **관리자 페이지 구축**:
    - 예약 현황 확인, D-N 기간 설정, 사이트 관리 기능 필요.
3.  **반응형 UI 개선**:
    - 모바일 화면에서의 예약 폼 및 달력 UI 최적화 검토.

## 4. 주의 사항 (Caveats)
- **개발 서버**: `npm run dev`가 실행 중이어야 브라우저 테스트가 가능합니다.
