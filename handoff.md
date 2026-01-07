# Handoff Document - Type System Cleanup

## 📅 Session Summary
**Date:** 2026-01-07
**Objective:** Phase 8.4 Type System Cleanup & Build Stabilization

이번 세션에서 Production Build 안정화를 완료했습니다. Supabase Edge Functions (Deno 런타임)를 Next.js 빌드에서 분리하여 타입 충돌 없이 클린 빌드를 달성했습니다.

## ✅ Completed Tasks
1.  **Build Configuration Fix**:
    *   `tsconfig.json`에 `"supabase"` 폴더를 exclude에 추가하여 Deno Edge Functions 분리.
    *   `npm run build` **Exit code: 0** (클린 빌드 성공).

2.  **Live Verification**:
    *   홈 히어로 섹션: "상쾌한 아침" 인사말, 날씨 배지 정상 출력.
    *   추천 그리드: 오늘의 셰프(김치찌개), 오늘의 놀이(마라톤), 주변 행사(별빛 수목원) 표시.
    *   Level/Token 시스템: Level 3, Raon Token 24개 정상 표시.

## 🛠️ Technical Decisions
*   **Edge Functions 분리**: `supabase/functions/` 폴더는 Deno 런타임용이므로 Next.js 빌드에서 제외. 해당 함수들은 Supabase 대시보드에서 별도 배포.
*   **eslint ignoreDuringBuilds 유지**: ESLint 경고는 빌드를 막지 않도록 설정 유지 (필요시 점진적 정리).

## 🚧 Next Steps
1.  **Supabase Edge Function 배포**:
    *   `supabase/functions/push-notification/` → Supabase 대시보드에서 수동 배포 필요.
    *   환경 변수 설정: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
2.  **DB Schema 동기화 (선택)**:
    *   Supabase CLI 인증 후 `npx supabase gen types typescript` 실행.
    *   현재 빌드는 기존 타입 파일로 정상 동작 중.
3.  **점진적 Lint 정리**:
    *   `eslint ignoreDuringBuilds` 해제 전 경고 정리.

## ⚠️ Known Issues / Caveats
*   **LBS 폴백**: 브라우저 위치 권한 거부 시 기본 위치(가평군)로 폴백 - 정상 동작.
*   **Supabase CLI 인증**: 로컬에서 `npx supabase gen types` 실행 시 인증 필요.

## 📝 Modified Files
*   `tsconfig.json` (supabase 폴더 제외)
