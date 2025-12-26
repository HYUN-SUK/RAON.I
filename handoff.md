# Handoff Document (Session: Personalization V2 & LBS MVP)
**Date**: 2025-12-26

## 📝 Summary
Successfully implemented the **Frontend Rendering** for Personalization V2 and the **LBS (Location-Based Services)** feature.
- **Frontend**: Updated `RecommendationGrid` and created `NearbyDetailSheet` to display location-based content.
- **Logic**: Applied consistent LBS logic to both **BeginnerHome** and **ReturningHome**.
- **Data**: Created `populate_lbs_data.sql` for initial data seeding.

## 🤖 Technical Feasibility & API Strategy (Future Roadmap)
The current UI is designed to be **100% compatible** with real external APIs.

### 1. Nearby Events (문화/축제)
- **Target API**: **Korea Tourism Organization TourAPI (한국관광공사)**
- **Method**: `locationBasedList` endpoint.
- **Feasibility**:
  - The API allows querying by GPS coordinates (mapX, mapY) and radius (radius=10000 for 10km).
  - It returns `title`, `addr1` (location), `firstimage` (image), and event dates.
  - **Match**: Exactly matches our `nearby_events` table structure.

### 2. Nearby Facilities (편의시설)
- **Target API**: **Kakao Maps Local API** (Category Search)
- **Method**: Keyword/Category search (MT1=Mart, OL7=Gas Station, PM9=Pharmacy).
- **Feasibility**:
  - The API returns `place_name`, `phone`, `distance`, `y/x` (lat/lng).
  - **Match**: Exactly matches our `site_config.nearby_places` JSON structure.
- **Automation**: We can create a Server Action that fetches this data once per week (or on admin request) and updates the `site_config` JSON automatically, removing the need for manual entry.

## 🚀 Next Steps
1.  **Integration (Critical Change)**: 
    - **Requirement**: Use **User's Real-time Device Location (GPS)**, NOT the fixed Campsite location.
    - **Action**: In the hook, replace the current DB fetch with `navigator.geolocation.getCurrentPosition()`, then pass those coordinates to the TourAPI/Kakao API.
    - **Data Strategy**: The `nearby_events` table may become an "Event Cache" rather than a hardcoded list.
2.  **Map Deep Linking**: Ensure "Navigation" buttons correctly open the user's installed map app (Naver/Kakao) using URL schemes.

## ⚠️ Caveats
- **Data Source**: Currently, the SQL script populates static data representing the *Campsite's* vicinity for MVP demo purposes.
- **Privacy**: Future implementation must handle "Permission Denied" states for GPS gracefully (e.g., fallback to Campsite location).
