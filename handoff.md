# Handoff Document - SSOT 6.3 & Auto-Cancellation Implementation

## 1. Session Summary
This session focused on implementing the **SSOT 6.3 Payment Rules**, specifically the deposit deadline, grace period logic, and automatic cancellation of overdue reservations.

**Key Accomplishments:**
-   **SSOT 6.3 Payment Rules Implementation:**
    -   **Configurable Deadlines:** Added ability to set deposit deadlines (3h, 6h, 9h, 12h) in the Admin Dashboard.
    -   **Grace Period Logic:** Implemented logic where cancellation is deferred until the next 9 AM or 6 PM even after the deadline passes.
    -   **Visual Warnings:** Added "Grace Period" (Orange Blinking) and "Overdue" (Red) cards to the Admin Dashboard.
-   **Auto-Cancellation:**
    -   Implemented **"Auto-cancel on Admin Load"**: Overdue reservations are automatically cancelled when the Admin Dashboard is accessed, with an alert notification.
-   **Fixed Reservation Persistence:** Resolved a crash caused by `Date` objects becoming strings in `localStorage`. Implemented a custom `PersistStorage` adapter.
-   **My Space Integration:** Connected TopBar, SummaryGrid, and UpcomingReservation to real data.

## 2. Technical Decisions
-   **Grace Period Calculation:** Implemented in `useReservationStore`'s `getOverdueReservations`. It calculates the deadline and then extends it to the next 9 AM or 6 PM.
-   **Auto-Cancellation Trigger:** Due to the lack of a backend server, auto-cancellation is triggered **client-side** when the Admin Dashboard (`OverdueReservations` component) mounts. This ensures the data stays consistent whenever an admin checks the system.
-   **Custom Date Persistence:** Used `JSON.parse` with a reviver function in `useReservationStore` to ensure dates are always hydrated as `Date` objects.

## 3. Next Steps
-   **My Space Features:** Implement the "Album" and "My Map" features (currently placeholders).
-   **Responsive UI:** Optimize `ReservationForm` and Calendar for smaller mobile screens.
-   **Admin Expansion:** Build out remaining admin pages (Payments, Rate/Season management).

## 4. Known Issues / Caveats
-   **Auto-Cancellation Timing:** Cancellation only happens when an admin visits the dashboard. If no admin visits, the status remains "PENDING" (though effectively treated as overdue).
-   **Data Persistence:** Data is stored in `localStorage`. Clearing browser cache will reset all data.

