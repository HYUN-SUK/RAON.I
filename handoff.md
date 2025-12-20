# Handoff: Market System MVP & UX Improvements

**Date**: 2025-12-20
**Session Focus**: Market System (Cart, Order, Reviews), "Buy Now" Optimization, Redirect Debugging.

## 1. Summary of Completed Work
- **Feature Completion**:
    - **Reviews**: Database schema setup, Review UI (List/Write), Integration with Product Detail.
    - **Order History**: Order listing page (`/market/orders`), DB schema for orders.
    - **Market Logic**: Cart persistence (authenticated), Checkout flow (validation/creation).
- **Bug Fixes**:
    - **Checkout Redirect**: Fixed issue where clearing cart on success triggered redirect to home (Race condition). Added `isOrderComplete` state.
    - **Buy Now UX**: Fixed "Buy Now" redirecting to home. Implemented dedicated `handleBuyNow` to await cart update before navigation.
- **Verification**:
    - Validated Login -> Add to Cart -> Checkout -> Order History flow manually.
    - Validated "Buy Now" direct flow manually.

## 2. Technical Decisions
- **Authenticated Cart Only**: Decided to enforce login for Cart/Checkout for MVP stability. Guest cart logic is deferred.
- **Immediate Navigation**: "Buy Now" skips the confirmation dialog to reduce friction, matching standard e-commerce patterns.
- **Optimistic UI**: Temporarily removed optimistic UI for Cart to ensure data consistency with Supabase before navigation.

## 3. Next Steps (Priority)
- **Payment Gateway (PG) Integration**: Currently mocks payment. Need real PortOne/Toss Payments integration.
- **My Space Integration**: Show recent orders or "My Gear" in My Space dashboard.
- **Admin Order Management**: Admin panel to view/update order status (e.g., Shipping, Delivered).
- **Review Polish**: Add image upload for reviews.

## 4. Known Issues / Caveats
- **Guest Access**: Guest users cannot add to cart. Currently relies on a simple `alert` redirect or error. Needs a proactive login prompt.
- **Test User**: Used script `scripts/create_test_user.js` to generate test accounts.
