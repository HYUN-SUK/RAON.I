# RAON.I 마스터 개발 로드맵 v3 (Final Integrated Version)

**버전**: v3.0 (Trend & AI Enhanced)
**기반**: RAONAI SSOT MASTER v9 + SSOT 0.6 (Trend) + SSOT 21.9 (AI Strategy)
**작성일**: 2025-12-06

이 문서는 라온아이 프로젝트의 **최종 확정형 개발 가이드**입니다.
기존의 견고한 프레임워크 위에 **트렌드(감성·초개인화)**와 **현실적인 AI 전략(L0/L1)**을 결합하여, 사용자에게 가장 가치 있는 경험을 우선적으로 전달합니다.

---

## 📅 전체 진행률 요약 (Progress Summary)

| 단계 | 구분 | 상태 | 진행률 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **코어 플랫폼 기반 (Foundation)** | ✅ **완료** | 100% | 필코노미 감성 톤, UI 프레임, 데이터 레이어 |
| **Phase 1** | **사용자 홈 (User Home)** | ✅ **완료** | 100% | Beginner/Returning UI, Smart Re-book, L0 Logic 완료 |
| **Phase 2** | **내공간 (My Space)** | 🔄 **진행 중** | 70% | 대시보드/지도/타임라인(기초) 완료. 앨범/히스토리 남음 |
| **Phase 3** | **예약 시스템 (Reservation)** | ✅ **완료** | 90% | Logic/Validation/Admin Core 완료. PG/오픈일 남음. |
| **Phase 4** | **커뮤니티 (Community)** | ✅ **완료 (Enhanced)** | 100% | RLS 보안 적용, 관리자 공지 관리 완료, 그룹(소모임) 설계 완료 |
| **Phase 5** | **마켓 & 결제 (Market)** | ⬜ **대기** | 0% | 굿즈샵, 장바구니, PG 연동 |
| **Phase 6** | **확장 모듈 (Expansion)** | ⬜ **대기** | 0% | 미션(AI 난이도), 크리에이터, 확장 지도 |
| **Phase 7** | **보안 및 운영 (Security & Ops)** | 🔄 **진행 중** | 40% | RLS(보안) 완료, 코드 클린업 완료, 관리자 인증(Auth) 예정 |

---

## 🚀 상세 로드맵 (Detailed Roadmap)

### Phase 0: 코어 플랫폼 기반 (Foundation) - ✅ 완료
*   **0.1 글로벌 UI 프레임**: TopBar, BottomNav, 390px 레이아웃
*   **0.2 공통 라이브러리**: Shadcn UI, Tailwind, Lucide Icons
*   **0.3 라우팅**: Next.js App Router (`(mobile)`, `admin`)

### Phase 1: 사용자 홈 (User Home) - ✅ 완료
**"감성, 안내, 그리고 초개인화된 첫인상"**
*   **1.1 분기 엔진 (L0)**: 사용자 상태 판별 완료
*   **1.2 초보자 홈 (Beginner)**: 히어로, 가이드, 프라이스 디코딩 완료
*   **1.3 기존 사용자 홈 (Returning)**: 스마트 리북, 예약 패널, 감성 배경 완료

### Phase 2: 내공간 (My Space) - 🔄 Ongoing
**"픽셀라이프 - 기록과 힐링의 아카이브"**
*   **2.1 대시보드**: POV 뷰, 위젯 완료
*   **2.2 나만의 지도**: 핀 저장, 상세 시트 완료
*   **2.3 타임라인**: 통합 피드 완료. (AI 요약 남음)
*   **2.4 앨범/감성**: 아직 구현 전

### Phase 3: 예약 시스템 (Reservation) - ✅ Core Logic Done
**"레디코어 - 투명하고 쉬운 예약 & 강력한 관리"**

*   **3.1 예약 UI (Refinement)** ✅
    *   [x] 스마트 리북, Validation(주말 2박/엔드캡), 가격 로직
    *   [x] 임박 예약(D-N), 연박 할인 로직 적용
*   **3.2 관리자 콘솔 (Admin Core)** ✅ (New)
    *   [x] **차단일 관리 (`BlockDateScheduler`)**: 달력 기반 제어
    *   [x] **가격/시즌 관리 (`PricingConfigEditor`)**: 실시간 가격 정책 수정
    *   [x] **입금 확인 (`ReservationList`)**: 대기 목록 및 확정 처리
*   **3.3 오픈일/PG** ⬜
    *   [ ] 실제 PG 연동 (현재 무통장 입금만 구현)


### Phase 4: 커뮤니티 (Community) - 🔄 Ongoing (90%)
**"캠퍼들의 소통 공간 (User-First + Backend)"**
*   **4.1 메인/게시판** ✅: 6개 탭(공지/후기/이야기 등) 구현, Supabase 연동 완료
*   **4.2 기능 고도화 (Rounds 1-5)** ✅ (New): 
    *   [x] 모바일 최적화 (하단 바/키보드), 검색(Search), 하이브리드 페이지네이션
    *   [x] 내 공간 연동 (기록 페이지), 비공개 로직(Private)
*   **4.3 상호작용** ✅: 좋아요(공감), 댓글 구현 완료.
*   **4.4 보안 & 관리 (Security & Admin)** ✅ (New): 
    *   [x] **RLS(Row Level Security)**: DB 보안 정책 적용 (작성자만 수정/삭제)
    *   [x] **관리자 공지(Admin Notice)**: 공지 작성/수정/삭제 및 공개 설정 완료
    *   [x] **코드 최적화**: 콘솔 로그 제거, Lint 에러 수정, 빌드 안정화
*   *Note: 소모임(Group) 설계 완료, 구현 예정*

---

## 📝 다음 세션 가이드 (Next Session Guide)
1.  **Priority**: **관리자 인증(Auth Integration)** 및 **소모임(Group) 기능 구현**.
2.  **Strategy**: 실제 어드민 로그인을 통해 RLS/관리 기능을 완전 검증하고, 설계된 소모임 로직(가입/탈퇴/전용글)을 구현.
3.  **Security**: 관리자 권한 세분화 및 인증 토큰 연동.

