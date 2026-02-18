# 구현 계획서 (2026-02-16 세션)

## [Goal Description]
이번 세션의 목표는 **Phase 12.4 복합 편집(Complex Editing)** 기능을 완벽하게 마무리하고, **Phase 12.5 프라이빗 커뮤니티(Private Community)**의 기초를 닦는 것입니다.
특히 타임라인 뷰의 미완성 부분(이미지 연동)을 해결하고, 라이브 브라우저 검증을 통해 완성도를 높입니다. 이후 프라이빗 커뮤니티를 위한 DB 스키마와 기본 UI를 구현합니다.

## User Review Required
> [!IMPORTANT]
> **Private Group Policy**: 프라이빗 그룹은 '초대' 또는 '승인' 기반으로만 가입이 가능하도록 `is_private` 플래그와 `join_method`를 `groups` 테이블에 추가합니다.

## Proposed Changes

### Phase 12.4: Timeline View Polish
#### [MODIFY] [page.tsx](file:///c:/Users/USER/Desktop/RAON.I/src/app/(mobile)/myspace/records/timeline/page.tsx)
- `CampingRecord` 타입과 이미지 데이터 구조(`images` JSONB) 확인.
- 플레이스홀더 제거 및 `Next/Image` 기반 실제 이미지 렌더링.
- 이미지가 없을 경우 폴백 UI 디자인 개선 (SSOT v9 감성 적용: 폴라로이드 느낌).
- **감성 터치**: 타임라인 연결선 디자인 개선 (점선 및 숲 색상).

### Phase 12.5: Private Community Foundation
#### [NEW] [20260216_private_community.sql](file:///c:/Users/USER/Desktop/RAON.I/supabase/migrations/20260216_private_community.sql)
- `groups` 테이블에 `type` ('public', 'private') 컬럼 추가.
- `join_condition` ('auto', 'approval') 컬럼 추가.
- 프라이빗 그룹용 RLS 정책 업데이트.

#### [NEW] [PrivateGroupNote.tsx](file:///c:/Users/USER/Desktop/RAON.I/src/components/groups/PrivateGroupNote.tsx)
- 실시간 채팅 대신 '느린 소통'을 지향하는 게시판형 노트 UI.
- 댓글 및 이모지 반응형 인터페이스.

## Verification Plan

### Automated Tests
- `npm run build`를 통해 타입 안정성 검증.

### Manual Verification (Live Browser)
1. **/myspace/records/timeline**: 타임라인 뷰에서 이미지가 정상적으로 로딩되는지 확인.
2. **Seasonal View**: 계절별 분류가 정확한지 확인.
3. **DB Migration**: Supabase 마이그레이션 스크립트 실행 확인.
