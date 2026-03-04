# 🌡️ Weather Data Scalability Analysis & Optimization

## 1. Problem Statement
The current notification system fetches weather data synchronously for each user during the dispatch phase. As the user base grows, the number of distinct camping locations increases, leading to:
- **Linear Increase in Latency**: Each new unique location adds ~5-10 seconds of KMA API wait time.
- **Timeout Risk**: Supabase Edge Functions and GitHub Actions have execution limits. Cumulative API delays frequently trigger these limits, crashing the entire notification batch.
- **Redundant Calls**: Multiple users at the same campground (or nearby) trigger duplicate API requests for the same weather data.

## 2. Technical Constraints (KMA API)
- **Rate Limits**: Standard keys allow ~1,000 to 10,000 calls per day. While sufficient for now, per-second concurrency is often limited.
- **Latency**: 3s to 15s per request depending on server load.
- **Data Granularity**: Weather is provided in 5km x 5km grids (`nx`, `ny`).

## 3. Proposed Solution: "Grid-First" Batch Prefetch

### 🔄 The New Process
1. **Identify Unique Grids**: 30 minutes before dispatch (08:30 AM), the system scans all active schedules for the next 7-14 days and extracts a `Set` of unique `(nx, ny)` coordinates.
2. **Batch Fetch**: The system iterates through the unique grids and fetches weather data, saving it to the `weather_cache` table.
3. **Dispatch Phase (09:00 AM)**: The notification engine reads *only* from the DB cache. If a grid is missing from the cache, it skips the weather line or uses a fallback rather than calling the API live.

### 📈 Scalability Projection
| User Count | Unique Locations (Est) | Current Latency (Live) | New Latency (Cache-Only) |
| :--- | :--- | :--- | :--- |
| 10 | 5 | ~50s | < 2s |
| 100 | 30 | ~300s (Timeout!) | < 5s |
| 1000 | 150 | Crash | < 15s |

## 4. Implementation Details
- **Location Grouping**: Use `dfs_xy_conv` to convert `lat/lng` to `nx/ny` before fetching.
- **Parallelization**: Fetch 3-5 grids in parallel during the prefetch phase to stay within KMA concurrency limits while reducing total time.
- **Persistence**: Ensure `weather_cache` has a 6-hour TTL to reuse data across different features (Home, Smart Plan).
