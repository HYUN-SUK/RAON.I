# Handoff Document - Operation "Sparkling Forest" (Part 1)
**Date**: 2025-12-31
**Session Goal**: Codebase Sanitization & Cleanup (`src/components`, `src/hooks`)

## 📝 1. Session Summary (완료된 작업)
이번 세션에서는 `src/components`와 `src/hooks`의 코드 품질을 개선하는 데 집중했습니다.
*   **컴포넌트 안정화**: 
    *   `PostCard`, `RecommendationGrid` 등의 치명적인 `any` 타입 제거.
    *   `MyMapModal`의 클러스터링 로직을 `Cluster`, `RenderablePin` 타입으로 리팩토링.
    *   `ReturningHome` & `NearbyDetailSheet` 간의 `Facility` 타입 불일치 해결 (`distance` optional).
    *   레거시 `<img>` 태그를 `Next/Image`로 전면 교체하여 최적화 및 경고 제거.
*   **훅(Hook) 구조 개선**:
    *   `src/constants/location.ts` 도입: `useLBS`와 `useWeather`가 동일한 좌표 상수를 바라보도록 통일.
    *   `usePersonalizedRecommendation`: `useLBS`와 연동하여 실제 위치 기반 날씨 정보를 가져오도록 수정.
*   **Dead Code 정리**:
    *   `AdminLoginForm`의 보안 취약점(Dev Sign Up 버튼) 제거.
    *   `CommunityWriteForm`의 하드코딩된 데이터 제거.
    *   `public` 폴더의 미사용 Next.js 기본 에셋 삭제.

## 🏗️ 2. Technical Decisions (기술적 결정)
*   **LBS & Weather 연동**: 위치 정보가 로딩 중일 때 `useWeather`가 멈추지 않도록, `useLBS`의 상태에 따라 `undefined` 또는 실제 좌표를 넘기는 패턴을 확립함.
*   **Type Safety**: `any` 사용을 지양하고, Supabase의 `Database` 타입 정의와 로컬 인터페이스(`Cluster` 등)를 적극 활용함.
*   **Image Optimization**: 외부 URL 이미지를 사용하는 경우 `unoptimized` 속성을 사용하여 Next.js 이미지 최적화 비용을 절약하고 호환성을 확보함.

## 🚀 3. Next Steps (다음 세션 가이드)
**작전명: "Sparkling Forest" - Part 2 (Structure & Import)**
다음 세션에서는 코드의 **구조적 정리**에 집중해야 합니다.

1.  **전역 임포트 정리 (Global Import Cleanups)**
    *   모든 파일의 import 순서를 `React -> Next -> 3rd Party -> @/components -> @/hooks -> Styles` 순으로 통일.
    *   상대 경로(`../../`)를 절대 경로(`@/`)로 변환.
2.  **잔여 Lint 해결**
    *   `src/app` 및 `src/utils` 등 아직 건드리지 않은 폴더의 Lint 오류 해결.
3.  **UI 컴포넌트 정리**
    *   `src/components/ui` 중 사용되지 않는 컴포넌트(ex: `context-menu` 등) 식별 및 제거 (조심스럽게 접근).

## ⚠️ 4. Known Issues & Caveats (주의 사항)
*   **Hydration Warning**: `TopBar` 등에서 일부 Hydration Mismatch 경고가 발생할 수 있으나, 기능에는 지장이 없음.
*   **Supabase 406**: 로컬 환경에서 일부 데이터가 없을 때 발생하는 406 에러는 정상 동작임.
*   **Type Mismatch**: `Facility` 타입의 `distance` 속성은 LBS 계산 전에는 없을 수 있으므로 반드시 `optional (?)` 처리를 유지해야 함.
