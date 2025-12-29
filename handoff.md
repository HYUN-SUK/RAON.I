# Handoff Document - XP & Token System Implementation

## ✅ 이번 세션 요약 (Activities Completed)
- **XP/Token/Gold 3단계 화폐 시스템 구축**:
  - `raon_token` (구 point) 및 `gold_point` 컬럼 추가 및 마이그레이션 (`profiles` 테이블).
  - `pointService` 확장: 지갑 조회(`getWallet`), 보상 지급(`grantReward`), 사용(`usePoint`), 내역 조회(`getHistory`).
- **'나의 탐험 지수' (My Exploration Index) 구현**:
  - `/myspace/wallet` 페이지 신설.
  - 레벨, 경험치(XP), 라온토큰을 동등하게 보여주는 **균형 잡힌 상태 카드** 디자인 적용.
  - 획득/사용 내역(History) 탭 기능 구현.
- **Premium Forest UI 디자인**:
  - 내 기록, 앨범, 히스토리 페이지에 **보기/편집 도구(Unlockable Options)** 섹션 추가.
  - Lucide 아이콘, 유리 질감, 금색 잠금 배지를 활용한 프리미엄 디자인 적용.
  - **접기/펼치기(Collapsible)** 기능으로 페이지 깔끔함 유지.

## 🏗️ 기술적 결정 사항 (Technical Decisions)
- **화폐 분리 전략**:
  - **XP (Experience)**: 오직 레벨업 및 칭호 획득용 (누적형).
  - **Raon Token**: 실질적인 서비스 내 재화 (소모형). 기록 꾸미기, 옵션 해금 등에 사용.
  - **Gold Point**: 향후 유료/현금성 재화를 위해 구조만 선점 (현재 미사용).
- **재사용 컴포넌트 (`UnlockableFeatureSection`)**:
  - 기록, 앨범, 히스토리 등 여러 페이지에서 동일한 '잠금 해제' 경험을 제공하기 위해 단일 컴포넌트로 모듈화했습니다.
  - 중앙에서 디자인을 수정하면 모든 페이지에 반영됩니다.

## 🚀 다음 작업 가이드 (Next Steps)
1.  **미션 포인트 → 라온토큰 대체**:
    - 기존 `missionService`나 관련 로직에 남아있는 '포인트' 개념을 모두 `raon_token`으로 명확히 교체하고, 보상 지급 로직을 연결해야 합니다.
2.  **획득/차감 로직 검증**:
    - 글쓰기, 좋아요 받기 등 구체적인 토큰 획득 시나리오 구현.
    - 실제 옵션 해금 시 토큰 차감(`usePoint`) 및 DB 반영 확인.

## ⚠️ 주의 사항 (Caveats)
- **마이그레이션**: `20251228_create_profiles_xp.sql` 파일이 최신 상태입니다. 로컬 DB 리셋 시 반드시 이 파일을 실행해야 `raon_token` 컬럼이 생성됩니다.
- **임시 데이터**: 현재 UI에 표시되는 획득/사용 내역은 DB에 데이터가 없으면 "내역이 없습니다"로 뜹니다. 테스트 시 `pointService.grantReward`를 통해 데이터를 임의로 넣어 확인하세요.
