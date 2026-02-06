# Handoff: Phase 12.3 - 1분 기록 & 이미지 에디터 구현 완료

## 1. 현재 상태 요약 (Current Status)
- **Phase 12.3 (1-Minute Record)** 구현을 완료했습니다.
- 사용자는 자신의 캠핑 일정(`schedules`)에 기반하여 사진과 짧은 글을 남길 수 있습니다.
- **이미지 에디터(Image Editor)** 기능이 탑재되어, 사진 업로드 전 자르기/필터/텍스트 편집이 가능합니다.
- 작성된 기록은 **내 공간(My Space)**과 **커뮤니티(Review Board)**에 즉시 연동됩니다.

## 2. 주요 구현 내용 (Key Deliverables)
### A. 1분 기록 (MyAjiit Record)
- **DB**: `camping_records` 테이블 생성 및 RLS 정책 적용.
- **UI**: `QuickRecordForm` (작성/수정), `AjiitCard` (카드형 뷰).
- **Auto-fill**: 일정 선택 시 캠핑장 이름/주소 자동 입력 + 방문 횟수(N번째) 카운팅 로직.
- **연동**: `MyMapList` (지도) 마커 병합 및 커뮤니티(리뷰) 노출.

### B. 이미지 에디터 (Image Editor)
- **라이브러리**: `@toast-ui/react-image-editor` 사용.
- **트러블슈팅 및 해결**:
  1. **CSS 누락**: CDN(`uicdn.toast.com`) 링크 주입으로 스타일 복구.
  2. **Focus Trap**: Radix Sheet와 TUI Editor 간의 키보드 충돌 해결을 위해 **React Portal 기반 Custom Modal**로 교체.
  3. **SSR 에러**: `window` 객체 접근 방어 코드(`useEffect`) 추가.
  4. **Z-Index**: Portal을 사용하여 최상위 레이어(`document.body`)에서 렌더링.
  5. **React 19 호환성**: `react-image-editor` Wrapper 라이브러리의 호환성 문제로 인해, Wrapper를 제거하고 **Vanilla JS (`tui-image-editor`)**를 직접 연동하는 방식으로 재구축하여 안정성을 확보했습니다.

### C. 커뮤니티 (Review Board)
- **탭 분리**: 'RaonAI 후기' (예약 시스템 연동) vs '캠퍼 후기' (외부/1분 기록) 분리.
- **필터링**: `campground_type` (`raonai` | `external`) 컬럼 기준 조회 로직 분리.

## 3. 기술적 결정 사항 (Technical Decisions)
- **Portal & Custom Modal**: 기존 `Sheet` 컴포넌트는 접근성(Focus Trap) 제어가 강력하여, TUI Image Editor 같은 Canvas 기반 외부 라이브러리와 충돌이 발생했습니다. 이를 우회하기 위해 순수 React Portal과 Div Overlay를 사용하여 편집 모달을 독립적으로 구현했습니다.
- **Vanilla JS Rewrite**: `react-image-editor`가 React 최신 버전(Next.js 15) 환경에서 불안정한 동작을 보여, 의존성을 제거하고 useEffect 내에서 순수 JS 인스턴스를 관리하는 방식으로 전환했습니다.
- **CDN for CSS**: Next.js App Router와 TUI Editor의 Webpack 로더 충돌(이미지 경로)을 피하기 위해, CSS를 로컬 import 대신 CDN 링크로 로드하는 방식으로 변경했습니다.

## 4. 다음 작업 가이드 (Next Steps)
`RAON_MASTER_ROADMAP_v3.md`의 **Phase 12.3 잔여 항목**부터 진행하면됩니다.

1. **찜 기능 (Wishlist)**:
   - 외부 캠핑장(`camping_ajiit_db`) 및 내부 캠핑장 찜하기 기능 통합.
   - `bookmarks` 테이블 확장 또는 신규 매핑 테이블 필요.
2. **준비 알림 (Notifications)**:
   - 일정 기반 D-Day 알림 (D-4, D-1) 스케줄러 구현 (Cron).
   - 푸시 알림 연동.

## 5. 알려진 이슈 (Known Issues)
- **Image Editor Icons**: TUI Editor 기본 아이콘을 사용 중입니다. 더 나은 디자인을 위해 추후 커스텀 아이콘셋 적용을 고려할 수 있습니다.
- **Network Dependency**: 이미지 에디터 스타일이 CDN에 의존하므로, 오프라인 환경에서는 스타일이 깨질 수 있습니다. (현재 웹앱 특성상 큰 문제는 아님).
