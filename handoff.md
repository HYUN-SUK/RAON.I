# Handoff: Market System MVP & Premium UX

## 1. 현재 상태 요약 (Current State)
이번 세션에서는 **마켓 시스템의 MVP(최소 기능 제품)**를 구현하고, 사용자 경험을 위해 **상품 상세 페이지 UX를 고도화**했습니다.

*   **Market System MVP**:
    *   **DB**: `products`, `cart_items`, `orders` 테이블 및 RLS 정책 적용.
    *   **Features**: 상품 목록, 장바구니(동기화), 주문 생성(카드 결제 정책).
    *   **Architecture**: `marketService`와 `useCartStore`를 통한 데이터/상태 관리.
*   **Premium UX Refinement**:
    *   **Home & Layout**: 마켓 페이지를 `(mobile)` 레이아웃 그룹으로 이동하여 모바일 뷰 최적화.
    *   **Product Detail**: Immersive Header(스크롤 투명도), Image Slider, **Sticky Tabs**, Bottom Sheet 구매창 구현.
    *   **Checkout**: 카드 결제 전용 정책 반영 및 안내 문구 추가.

## 2. 기술적 결정 사항 (Technical Decisions)
*   **Sticky Tabs & Mobile Layout**: `MobileLayout`의 `overflow-hidden` 속성이 `sticky` 포지셔닝을 방해하여 제거했습니다. 이는 모바일 뷰포트 내에서 자연스러운 스크롤 동작을 보장합니다.
*   **Client Component Params**: Next.js 15의 `params` 비동기 변경에 대응하기 위해 `ProductDetailPage`에서 `useParams()` 훅을 사용하여 ID를 안전하게 가져오도록 변경했습니다.
*   **Bottom Sheet (Drawer)**: 구매 옵션 선택 시 페이지 이동 없이 바로 선택할 수 있도록 Shadcn `Sheet`(Bottom Drawer)를 도입하여 UX Depths를 줄였습니다.

## 3. 다음 작업 가이드 (Next Steps)
다음 세션에서는 마켓 시스템의 완성도를 높이기 위해 아래 작업들을 우선적으로 수행해야 합니다.

1.  **구매 후기 (Reviews) 개발** (⭐️ Priority):
    *   `reviews` 테이블 생성 (post_id와 별도 혹은 통합 고려).
    *   Sticky Tab의 '후기' 섹션에 실제 데이터 연동.
    *   포토 후기 업로드 및 별점 로직 구현.
2.  **주문 내역 (My Orders)**:
    *   사용자 마이페이지 또는 마켓 홈에서 본인의 과거 주문 내역 확인.
3.  **장바구니/주문 오류 처리**:
    *   재고 부족, 결제 실패 등 예외 케이스에 대한 UI/UX 강화.

## 4. 주의 사항 (Known Issues & Notes)
*   **PG 결제 연동**: 현재 결제는 'PG 연동 예정' 알림으로 처리되어 있습니다. 실제 서비스 런칭 전 Toss Payments 등의 연동이 필요합니다.
*   **서버 재시작 필요**: 폴더 구조 변경(`(mobile)` 이동)이 있었으므로, 혹시라도 404 에러가 발생하면 개발 서버를 재시작해야 합니다.
