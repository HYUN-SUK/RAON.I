# Session Handoff: PWA Deployment & Stabilization

**Date:** 2026-01-13
**Author:** Antigravity (Assistant)
**Status:** ✅ **Production Deployed** (v4.1)

---

## 📝 Executive Summary
This session focused on **Deployment Readiness** and **Mobile Experience (PWA)**. 
We successfully deployed the application to Vercel, resolved build issues (Type Safety), and implemented a robust PWA installation flow.
The project is now live at `https://raon-i.vercel.app`, featuring a hybrid "Web + App" strategy.

---

## ✅ Completed Tasks

### 1. 🚀 Production Deployment
- **Platform**: Vercel
- **URL**: [https://raon-i.vercel.app](https://raon-i.vercel.app)
- **Status**: **Success** (Green Build)
- **Fixes**:
    - Resolved `npm run build` failures by fixing Type Mismatches in `TopBar` and Hooks.
    - Mitigated CVE-2025-66478 by updating Next.js.
    - Recovered Missing Environment Variables (`KMA_SERVICE_KEY`, `TOUR_API_KEY`).

### 2. 📲 PWA Implementation (Hybrid Strategy)
- **Manifest**: `manifest.json` configured (Name, Icons, Theme Colors).
- **Service Worker**: `firebase-messaging-sw.js` updated with `fetch` handler (PWA Criteria met).
- **Install Flow (Enhanced)**:
    - **Android/PC**: Attempts **Native Prompt** (One-click install) if available.
    - **iOS**: Shows **Manual Guide Modal** (Share -> Add to Home Screen).
    - **Fallback**: Platform-specific Visual Guide (images/icons) if native prompt fails.
- **Future Roadmap**: Designed to easily switch to **Play Store Link** (TWA) in the future.

### 3. 🛠️ Critical Troubleshooting
- **Git/Shell Error**: Fixed deployment failure caused by PowerShell `&&` operator syntax.
- **Service Worker Crash**: Resolved syntax error ("Something went wrong") in `firebase-messaging-sw.js`.
- **TypeScript Fix**: Synced `usePWAInstallPrompt` return types with `TopBar` usage.

---

## 🏗️ Technical Decisions & Architecture
- **TWA (Trusted Web Activity) Strategy**: 
    - Decided to maintain **Single Codebase (Web)**.
    - Updates to the website automatically propagate to the future Play Store App via TWA.
    - "**One Push, All Updated**" workflow established.
- **Platform Detection**: 
    - Used `window.navigator.userAgent` to detect iOS/Android/PC.
    - Conditional Logic: `Native Prompt` > `Manual Guide Modal`.

---

## 🔮 Next Steps (Operations & Scale)
1. **App Store Registration (Optional)**:
    - Wrap URL with **Bubblewrap** (TWA CLI) for Google Play Store.
    - Provides higher trust and easier installation.
2. **External API Sync**:
    - Currently using static/fallback data for "Nearby Events" (Yesan-gun).
    - Once domain is finalized, register JavaScript Keys for KaKaoMap/TourAPI.
3. **PG Integration**:
    - Switch Reservation Payment from "Deposit" to "PG (Card/Easy Pay)".

---

## ⚠️ Known Caveats
- **iOS Push**: Web Push on iOS requires **Home Screen Installation** first. (System Limitation)
- **Vercel Usage**: Free tier limitations apply (Serverless Function timeouts). Monitor `Usage` dashboard.
