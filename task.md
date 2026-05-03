# Task Checklist: v11.9.25 Gemini 2.5 Flash-Lite & 5-Stage Timeline

- [x] **Phase 10: 5단계 감성 서사 엔진 구축 및 Gemini 2.5 전환**
    - [x] **[Model Upgrade]** Gemini 1.5 Flash -> Gemini 2.5 Flash-Lite 전환 및 API Route 안정화
    - [x] **[Prompt Engineering]** 100+ 후보지 일괄 Reasoning 생성을 위한 모듈형 프롬프트 설계
    - [x] **[Timeline UI]** (출발-경유-준비-힐링-귀가) 5단계 감성 타임라인 프론트엔드 실장
    - [x] **[Stage 5]** Track B 대안 리스트 기반 "귀갓길 추천" 섹션 자동화
    - [x] **[Security]** 클라이언트 사이드 환경 변수 접근 문제 해결을 위한 `/api/smart-plan` 구현
    - [x] **[Fix]** 예약 ID 조회 로직 개선 (KST 이중 변환 제거 및 Blocked Dates Fallback)
- [ ] **Phase 11: UI/UX 디테일 완성 및 내비게이션 연동 (다음 세션 예정)**
    - [ ] **[UI Fix]** 장소 카드 내 '인증 마크' 및 '한 줄 추천 문구' 렌더링 누락 해결
    - [ ] **[Navigation]** 카카오맵, Tmap, 카카오내비 다이렉트 연동 버튼 구현
    - [ ] **[Persona]** 사용자의 구체적인 상황(아이 동반 등)에 따른 한 줄 문구 개인화 품질 점검
    - [ ] **[Polishing]** 장소 교체(Swap) 시 AI 문구가 즉각적으로 매칭되는지 최종 검증
    - [ ] **[Verification]** 실제 예약 데이터를 통한 5단계 서사 흐름의 자연스러움 최종 테스트
