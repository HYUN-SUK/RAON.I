# Handoff Document - 주변 즐길거리 확장 및 API 통합

## 📝 Summary
이번 세션에서는 사용자가 캠핑장 주변에서 즐길 수 있는 다양한 활동을 찾을 수 있도록 기능을 확장했습니다.
1.  **TourAPI 확장**: 기존 행사 정보 외에 **레포츠(28)**와 **관광지(12)** 정보를 제공하는 `nearby-activities` API를 신설했습니다.
2.  **레포츠 필터링**: 캠핑장에 있는 사용자에게 중복된 정보를 주지 않기 위해 레포츠 목록에서 **'캠핑', '야영', '캠프'** 등의 키워드를 필터링했습니다.
3.  **행사 데이터 통합**: `nearby-events` API를 수정하여 **TourAPI**, **전국공연행사정보표준데이터**, **전국문화축제표준데이터** 3가지 소스를 병합하여 제공하도록 했습니다.
4.  **UI 개선**: `NearbyDetailSheet`를 4개 탭(행사, 레포츠, 관광지, 편의)으로 확장하고, 데이터 소스별 뱃지를 적용했습니다.

## 🚧 Status & Next Steps
- **현재 상태**: 구현은 모두 완료되었으나, 새로 추가한 공공데이터포털 API(공연/축제)가 `Service Key is not registered Error`를 반환 중입니다.
- **다음 단계**: API 활용신청 승인이 완료(1~2시간 소요 예상)된 후, 다시 한 번 앱을 실행하여 `행사` 탭에 데이터가 들어오는지 확인해야 합니다.
  - 별도의 코드 수정은 필요 없습니다. 승인만 되면 자동으로 데이터가 표시됩니다.

## 🔍 Technical Details
### New API Routes
- `GET /api/nearby-activities`: 레포츠(type=leisure), 관광지(type=attraction) 조회. (TourAPI `locationBasedList2` 사용)
- `GET /api/nearby-events`: 행사 통합 조회. (TourAPI `searchFestival2` + 공공데이터 표준데이터 2종 병합)

### Environment Variables
- `TOUR_API_KEY`: 기존 TourAPI 키 사용. (공공데이터포털 API도 동일한 키 사용 가정)

### API Endpoints (Public Data)
- 공연: `https://api.data.go.kr/openapi/tn_pubr_public_pblprfr_event_info_api`
- 축제: `https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api`

## ⚠️ Notes
- `nearby-events` API는 3개 중 하나라도 응답하면 데이터를 반환하도록 `Promise.allSettled`를 사용했습니다.
- 레포츠 필터링 키워드는 `src/app/api/nearby-activities/route.ts`에 하드코딩 되어 있습니다. 필요 시 수정 가능합니다.
