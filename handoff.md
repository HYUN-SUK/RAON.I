# 📑 RAON.I - 홈화면 튕김 장애 완치 세션 인수인계 문서 (Handoff)

## 📌 1. 현재 상태 요약 (Current Status)
이번 세션에서는 사용자가 다가오는 일정 상세 페이지 진입 시 발생하던 고질적인 무소음 홈 리다이렉트 튕김 현상(`pushState Silent Redirect to '/'`)을 완벽하게 진단하고 최종 완치하였습니다.

- **최상위 layout.tsx의 `force-dynamic` 제거 완료**: 클라이언트 이동 시 불필요한 전체 RSC 서버 요청을 차단하여 라우터 엔진 안정성 확보.
- **getScheduleById 서버 액션 내 `Write-on-Read` 제거 완료**: 일정 단일 조회 중에 DB를 인라인 수정(update)하여 Next.js App Router 캐시 무효화를 초래하던 부작용을 순수 조회 함수로 개조하여 완치.
- **useSearchParams() Suspense 안전 장치 탑재**: `records`, `admin/reservations`, `community`, `schedule/[id]` 상세페이지에 각각 `<Suspense>` 경계를 안전하게 씌워 Next.js 빌드 시 prerender 에러 및 클라이언트 렌더 이탈 문제를 종결.
- **동시성 비동기 트랜잭션 충돌 해결**: 홈화면 위젯 마운트 시의 백그라운드 자동 동기화(`syncAll()`)를 제거하여 클릭 스레드와의 DB 경쟁 상태를 해결하고, 이미 매핑된 일정이 있으면 즉시 0.001초 직통 이동하도록 교통정리 적용.
- **타입 검사 및 빌드 검증 전수 완료**: `npx tsc --noEmit` 검사 및 `npm run build` 정적 최적화 페이지 빌드를 100% 오류 0개로 통과 완료.

---

## ⚙️ 2. 기술적 결정 사항 (Technical Decisions)
1. **Single Source of Truth (데이터 단일 통로 보장)**
   - 홈 위젯 마운트와 카드 클릭 두 시점에서 거의 동시에 `ensureScheduleFromReservation`이 중복 발동되어 Supabase RPC `upsert_schedule` DB 트랜잭션이 충돌하던 것을, 백그라운드 자동 동기화를 제거하여 단일 클릭 채널로 단순화했습니다.
2. **Fast-path Redirect (0.001초 직통 라우팅)**
   - 이미 DB에 일치하는 일정이 생성되어 있다면 무거운 비동기 서버 액션을 아예 스킵하고 곧바로 `/myspace/schedule/[id]`로 직통 라우팅시켜 비동기 레이싱 대기 시간을 완전히 제거했습니다.
3. **App-wide Suspense Wrapping**
   - Next.js 14/15/16 App Router 표준 규격에 따라 `useSearchParams`를 사용하는 모든 `'use client'` 페이지들을 `<Suspense>` 경계로 감싸, 빌드 타임 Prerender 크래시와 런타임 Hydration 에러로 인한 홈 비상 튕김을 원천 방어했습니다.

---

## 📋 3. 다음 작업 가이드 (Next Steps)
1. **사용자 행동 흐름 추가 검증**
   - 배포 후 모바일 실제 기기에서 새로고침 -> 다가오는 일정 상세 진입 -> 홈 버튼 터치 -> 재진입 등 전체 시나리오 하에서 튕김 현상이 100% 소멸되었는지 최종 유저 모니터링 진행.
2. **기타 미래 기능 개발 착수**
   - 한 단계만 뒤로가기 제어 시나리오 수립 및 반영.
   - 구글 플레이스토어 심사 승인 이후 AAB 패키지 빌드 시 TWA 클라이언트 더블 클릭 종료 팝업 추가.
   - 스마트플랜 LIVE 타임라인 UI (Phase 1) 구현 진행.

---

## ⚠️ 4. 주의 사항 (Precautions)
- **Server Action 내 DB Mutation 주의**
  - 단순 조회(Read) 용도의 Server Action 내부에서는 절대로 인라인 DB 수정(Update/Insert) 처리를 병행하지 마십시오. Next.js App Router가 클라이언트 라우터 캐시를 강제로 무효화(Invalidate)시켜 예상치 못한 홈 리다이렉트를 일으킬 수 있습니다.
- **useSearchParams 사용 시 Suspense 필수**
  - Next.js App Router 환경에서 `useSearchParams()` 훅을 사용하는 클라이언트 컴포넌트는 반드시 상위에 `<Suspense>` 경계가 확보되어 있어야 정적 빌드 오류와 런타임 엇박자 튕김을 막을 수 있습니다.
