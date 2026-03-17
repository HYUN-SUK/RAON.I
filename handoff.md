# Handoff Document - 2026-03-17

## 📋 세션 요약 (Session Summary)
이번 세션에서는 사용자의 편의성을 극대화하기 위해 **'통합 캠핑 프로필(Unified Camping Profile)'** 시스템을 구축하고, 앱 내 4대 주요 플로우(예약, 일정등록, 추천, 스마트플랜)에 완벽하게 통합했습니다.

### 1. 완료 사항 (Accomplishments)
- **통합 프로필 DB 구축**: `user_camping_profiles` 테이블을 신설하여 출발지(Origin)와 상세 인원 구성을 통합 관리.
- **공용 `CampingProfileGate` 구현**: 카카오맵 API를 연동한 주소 검색 및 경위도 자동 추출, 기존 정보 확인/수정 UI 완성.
- **4대 엔진 통합**: 
    - **예약**: 프로필 기반 자동 입력 및 예약 성공 시 역방향 동기화.
    - **외부 일정**: 일정 등록 전 프로필 확인 단계를 추가하여 데이터 정합성 확보.
    - **PlanLock (추천)**: 매번 GPS를 켜야 했던 불편함을 제거하고 저장된 프로필 주소 기반 거리 계산 적용.
    - **스마트캠핑플랜**: 출발지(Origin) 정보를 프로필에서 가져와 '가는 길' 추천 품질 향상.
- **빌드 및 타입 안정성**: `SmartPlanProposal` 타입 수정 및 미사용 훅(`useLBS`) 정리로 `npx tsc` 통과.

### 2. 기술적 결정 사항 (Technical Decisions)
- **SSOT(Single Source of Truth)**: 사용자 정보의 파편화를 막기 위해 `reservations` 테이블의 `guest_details`와 연동하되, `user_camping_profiles`를 최상위 기준으로 설정했습니다.
- **Kakao Maps Geocoding**: 좌표 전달만으로는 부족한 '출발지 명칭(라벨)'을 함께 저장하여 사용자 경험을 개선했습니다.
- **Fire-and-Forget Sync**: 예약 완료 시 프로필 업데이트는 메인 트랜잭션에 영향을 주지 않도록 독립적으로 실행(catch 처리)합니다.

### 3. 다음 작업 가이드 (Next Steps)
- **행동-태그 매핑 고도화 (Phase 2)**: 사용자님이 논의 중인 최신 태깅 정의서가 확정되면 `persona.ts`에 해당 엔진을 코딩하고 프로필 데이터와 결합할 예정입니다.
- **스마트플랜 로직 심화**: 수집된 인원 구성(아이 동반 여부 등)에 따른 맞춤형 팩트 카드 가중치 정교화.

### 4. 주의 사항 (Warnings)
- **Kakao API Key**: `NEXT_PUBLIC_KAKAO_JS_KEY`가 환경 변수에 정상 등록되어 있어야 지도 검색 기능이 동작합니다.

---
**Lead Developer: Antigravity**
**Status: SSOT v9 Stable**
