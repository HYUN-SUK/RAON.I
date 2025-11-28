# Handoff Document

## 1. 현재 상태 요약 (Current Status)
- **Phase 1: 내 공간(My Space) MVP 완성**
    - 1인칭 텐트 뷰, 감성 모듈(불멍/별보기), 꾸미기 위젯, 기록/예약 카드 등 핵심 UI 구현 완료.
    - 사용자 피드백(히어로 이미지 중복 제거, 카드 인터랙션 강화) 반영 완료.
    - Git 커밋 완료: `Feat: Complete MySpace MVP with Final Polish`.
- **Phase 2: 예약(Reservation) 모듈 준비**
    - SSOT v9 기반으로 다음 개발 목표를 '예약 모듈'로 선정.
    - 구현 계획(`implementation_plan.md`) 및 태스크 리스트(`task.md`) 작성 완료.

## 2. 기술적 결정 사항 (Technical Decisions)
- **UI/UX**:
    - `Tailwind CSS` + `Glassmorphism`을 적극 활용하여 감성적이고 프리미엄한 느낌 구현.
    - 모바일 퍼스트(390px 기준) 레이아웃 준수.
    - 모든 인터랙티브 요소(카드, 버튼)에 `active:scale` 효과를 적용하여 터치감 강화.
- **상태 관리**:
    - `Zustand`를 사용하여 감성 모듈(불멍, 별보기 등)의 전역 상태 관리.
    - 예약 데이터도 `useReservationStore`를 통해 로컬 상태로 우선 구현 예정 (Mocking).
- **구조**:
    - `components/myspace` 폴더에 내 공간 관련 컴포넌트 모듈화.
    - `components/reservation` 폴더에 예약 관련 컴포넌트 생성 예정.

## 3. 다음 작업 가이드 (Next Steps)
다음 세션에서는 **Phase 2: 예약 모듈 구현**을 바로 시작하면 됩니다.

1.  **Step 1: 데이터 모델링**
    - `types/reservation.ts`, `constants/sites.ts`, `store/useReservationStore.ts` 작성.
2.  **Step 2: 예약 메인 화면**
    - 달력(`DateRangePicker`) 및 사이트 리스트(`SiteList`) 구현.
3.  **Step 3: 상세 및 폼**
    - 사이트 상세 페이지 및 예약 정보 입력 폼 구현.

## 4. 주의 사항 (Notes)
- **Git**: 현재 `master` 브랜치에 Phase 1 코드가 커밋되어 있습니다. 작업 시작 전 `git pull` 또는 상태 확인을 권장합니다.
- **이미지**: 히어로 섹션 배경 이미지는 `tent_view_wide_scenic.png` 하나만 사용 중입니다 (다리 실루엣 레이어 제거됨).
- **데이터**: 백엔드 없이 로컬 스토어(`Zustand`)와 상수 데이터(`constants`)로 동작하므로, 브라우저 새로고침 시 데이터가 초기화될 수 있습니다 (추후 `persist` 미들웨어 적용 고려).
