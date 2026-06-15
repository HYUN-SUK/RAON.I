# 🔔 푸시 알림 브랜딩 고도화 및 중복/오발송 결함 해결 워크스루

이번 작업에서는 라온아이 플랫폼의 푸시 알림 시스템의 신뢰성을 제고하고, 브랜딩 가시성을 높이기 위해 오발송/중복 수신 결함 해결 및 로고/뱃지/이미지 적용을 완수했습니다.

---

## 1. 주요 수정 내용

*   **FCM 중복 알림(이중 팝업) 해결**:
    *   **파일**: [push-notification/index.ts](file:///c:/Users/USER/Desktop/RAON.I/supabase/functions/push-notification/index.ts#L140-L162)
    *   **조치**: FCM 전송 시 `notification` 필드를 삭제하고, 모든 정보는 `data` 필드와 `webpush.notification`에만 매핑했습니다. 이로 인해 브라우저의 자동 팝업과 서비스 워커의 `showNotification`이 동시 실행되던 이중 팝업 문제가 종식되었습니다.
*   **푸시 알림 브랜딩 고도화**:
    *   **에셋 배치**: 라온아이 공식 고해상도 캐릭터 로고(`icon-192.png`), 안드로이드 상태바용 투명 단색 아이콘(`badge.png`), 리마인더 카드용 야경 전경 이미지(`reminder_hero.png`)를 각각 `/public` 경로에 새롭게 반영했습니다.
    *   **동적 바인딩**: Edge Function의 `webpush.notification` 스펙에 `icon`, `badge`, `image` 경로를 매핑하여 푸시 수신 시 깔끔한 브랜딩 디자인으로 렌더링되게 개선했습니다.
*   **예약 취소자 스케줄러 리마인더 오발송 차단 (이중 방어)**:
    *   **파일**: [camping-reminder/index.ts](file:///c:/Users/USER/Desktop/RAON.I/supabase/functions/camping-reminder/index.ts#L716-L790)
    *   **조치**:
        *   **1차 방어**: `user_schedules` 테이블 조회 시 `.eq('status', 'scheduled')` 조건을 추가하여 `cancelled` 상태의 일정을 DB 조회 단계에서 제외했습니다.
        *   **2차 방어**: 발송 처리 루프 시작 지점에 `if (s.status === 'cancelled') continue;` 방어 가드를 심어 안전성을 더블 보장했습니다.
*   **D-1 리마인더 딥링크 개편**:
    *   **파일**: [camping-reminder/index.ts](file:///c:/Users/USER/Desktop/RAON.I/supabase/functions/camping-reminder/index.ts#L889-L899)
    *   **조치**: D-1 알림 클릭 시의 진입 경로를 기존의 상세일정 탭에서 새로 구축된 모바일 **레시피 탐색기 경로(`'/recipe'`)**로 변경하여 자연스러운 유저 행동 유입을 유도했습니다.
*   **클라이언트 백그라운드 푸시 리스너 최적화**:
    *   **파일**: [firebase-messaging-sw.js](file:///c:/Users/USER/Desktop/RAON.I/public/firebase-messaging-sw.js#L27-L43)
    *   **조치**: 페이로드 규격 조정에 맞춰 `payload.data`로부터 정보를 긁어와 수동으로 1회만 알림을 띄우며, 로고, 뱃지, 전경 이미지가 올바른 비주얼로 그려지도록 매핑했습니다.

---

## 2. 빌드 및 배포 검증 결과

*   **Edge Functions 배포 성공**: `push-notification` 및 `camping-reminder` 에지 펑션이 Supabase 실서버에 무사히 배포 완료되었습니다.
*   **로컬 컴파일 빌드 성공**: `npm run build`를 구동하여 100% 컴파일 성공(Exit Code: 0) 및 정적 페이지 빌드 상태를 확인했습니다.

---

## 3. 세종시 지역 데이터 최적화 및 병원 뱃지 로직 개선 (이전 내역)

이번 작업에서는 세종특별자치시의 특수한 행정 구역 구조로 인해 발생했던 데이터 누락 문제를 해결하고, 병원 데이터의 품질을 높이기 위한 인증 로직을 강화했습니다.

- **원인**: 세종시는 '시/군/구' 단계가 없으나 기존 엔진이 주소의 두 번째 단어를 시군구로 오인하여 NMC API 파라미터로 전달했으며, 파싱 실패 시 기본값으로 '예산군'이 들어가도록 설정되어 있어 데이터가 꼬임.
- **조치**: `extractSigungu` 함수에서 '세종특별자치시'인 경우 빈 문자열(`""`)을 반환하도록 예외 처리하고, 클러스터 내의 하드코딩된 '예산군' 기본값을 제거함. 또한 `api_source: 'NMC_HOSPITAL'`인 경우 '응급의료센터' 뱃지를 강제로 유지하도록 보강.
- **결과**: 세종 지역 병원 수신 건수가 0건에서 5건으로 정상화되었으며, 세종충남대학교병원이 세종수목원 일정의 병원 리스트 1위에 성공적으로 안착함.
