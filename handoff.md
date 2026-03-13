# Handoff - Smart Camping Plan ETL 5.0 & Weekly Batch Automation

## 📅 Session Summary (2026-03-13)
In this session, we focused on stabilizing the static data synchronization (ETL 5.0) and automating the weekly batch process. The primary challenge was the failure of "MART" (Large-scale stores) data import due to coordinate system mismatches and duplicate data issues.

### Key Accomplishments
1.  **MART Data Import Resolved**:
    - Fixed the issue where MART data from 행정안전부 was not importing due to the `EPSG:5174` (TM) coordinate system. Integrated `proj4` for conversion to `WGS84`.
    - Resolved unique constraint issues by implementing deterministic IDs (`UUID v5`) using `api_source + name + address` as a seed.
2.  **Weekly Batch Automation**:
    - Refactored `scripts/sync-master-places.mjs` to include the combined logic: deterministic IDs, coordinate transformation, and file-based synchronization for LocalData (MART/MOIS).
    - Removed Opinet from the weekly batch as it has been moved to a dynamic D-3 caching strategy for real-time accuracy.
3.  **API Standardization**:
    - Synchronized `src/app/api/cron/sync-master-places/route.ts` with the new deterministic ID logic to ensure consistency between manual scripts and automated CRON jobs.
4.  **SSOT Update**:
    - Updated `docs/smart_camping_plan_manual.md` to reflect the new hybrid collection strategy and the technical resolution for static data imports.

## 🛠️ Technical Decisions
-   **Deterministic IDs for Reliability**: We now include `api_source` in the UUID seed. This allows the same physical location listed in multiple APIs (e.g., Safe Restaurant + Good Restaurant) to be stored as separate records. This is critical for future "Trust Score" (신뢰도) calculations.
-   **File-Based Sync for Stability**: Due to the frequent 500 errors of the government REST APIs, we switched to direct ZIP/CSV/XLSX downloads from LocalData.go.kr for primary static datasets.

## 🚀 Next Steps (Next Session)
1.  **Monitor Weekly Batch**: Confirm that the GitHub Actions CRON job runs successfully on the coming Monday using the updated `sync-master-places.mjs`.
2.  **Reliability Logic Implementation**: Start developing the logic that aggregates multiple records of the same establishment (matching by name/address) to calculate a trustworthiness score.
3.  **Expansion**: Continue with Phase 12.3 (Camping spot bookmarking) and 12.5 (Private community features).

## ⚠️ Notes
-   **Dependencies**: Added `uuid` and `@types/uuid`, `@types/proj4` to `package.json`.
-   **Environment**: Ensure `PUBLIC_DATA_API_KEY` and `KAKAO_REST_API_KEY` are correctly set in the production environment (Vercel/GitHub Secrets).
