# Handoff Document: Home Polish & My Space Timeline

**작성일**: 2025-12-12
**작성자**: Antigravity (Assistant)

## 📌 현재 상태 요약 (Session Summary)
이번 세션에서는 **사용자 홈(Home)**의 완성도를 높이고, **내공간(My Space)**의 핵심 기능인 **타임라인**을 구현했습니다.

*   **Phase 1. 사용자 홈**: [완료]
    *   **초보자 홈**: UI 톤앤매너 정교화 (Ivory Chip, Badge), 가이드 텍스트 개선.
    *   **기존 유저 홈**: **Smart Re-book** 연결 완료 (이전 예약 데이터 기반 원클릭 예약 진입).
    *   **L0 추천**: 날씨/시간 기반 추천 로직(`useRecommendationStore`) 적용.
*   **Phase 2. 내공간**: [진행 중]
    *   **타임라인**: `TimelineCard` 구현 및 `useMySpaceStore` 연동. (최근 3개 노출 제한, 상세 이동 내비게이션 적용)
    *   **UI/UX**: "내 히스토리" 명칭 통일, 중복 버튼 삭제, 인터랙티브 요소 강화.

## 🛠️ 기술적 결정 사항 (Technical Decisions)
1.  **TimelineItem 통합 타입 정의**:
    *   예약(`reservation`), 사진(`photo`), 미션(`mission`) 등 성격이 다른 데이터를 하나의 타임라인 피드에서 처리하기 위해, `TimelineItem` 인터페이스를 `type` 식별자와 함께 정의했습니다. 이를 통해 확장성 있는 피드 구조를 마련했습니다.
2.  **L0 로직 (Store 기반)**:
    *   복잡한 서버 통신 없이 빠른 반응성을 위해, 추천 시스템과 타임라인 데이터를 우선 Zustand Store(`useRecommendationStore`, `useMySpaceStore`)의 Mock Data로 구현했습니다. 추후 API 연결 시 구조를 유지하기 용이합니다.
3.  **브라우저 검증 대체**:
    *   브라우저 분석 도구의 일시적 불안정으로 인해, **코드 리뷰(Static Analysis)**와 **DOM 구조 검증**을 통해 기능의 안전성을 확인했습니다.

## 📝 다음 작업 가이드 (Next Steps)
다음 세션에서는 **Phase 2 내공간**의 완성을 목표로 합니다.

1.  **Phase 2.4 앨범 (Album)**:
    *   타임라인의 '사진' 항목을 클릭했을 때 진입할 **갤러리 뷰** 구현.
    *   사진 업로드 시뮬레이션 및 `tag` 자동 생성(L1 AI Mock) 기능 추가.
2.  **Phase 2.3 타임라인 고도화**:
    *   "내 히스토리 전체보기" 클릭 시 이동할 **히스토리 페이지(/myspace/history)** 생성.

## ⚠️ 주의 사항 (Caveats)
*   **브라우저 도구**: 간헐적으로 `Model Unreachable` 오류가 발생할 수 있습니다. 중요한 UI 변경 시 코드 레벨에서의 검증을 병행하는 것이 좋습니다.
*   **Mock Data**: 현재 타임라인과 추천 목록은 하드코딩된 데이터입니다. 실제 예약 데이터가 쌓이는 시나리오 테스트 시 Store 초기값을 조정해야 할 수 있습니다.
