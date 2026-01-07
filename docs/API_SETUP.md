# API 환경 변수 설정 가이드

## 필요한 환경 변수

`.env.local` 파일에 아래 항목을 추가하세요:

```env
# 한국관광공사 TourAPI (공공데이터포털에서 발급)
TOUR_API_KEY=your_tour_api_key_here

# 카카오맵 Local API (Kakao Developers에서 발급)
KAKAO_REST_API_KEY=your_kakao_rest_api_key_here
```

## API 발급 방법

### 1. TourAPI (행사정보)
1. [공공데이터포털](https://www.data.go.kr) 접속
2. "한국관광공사_국문 관광정보 서비스_GW" 검색
3. **활용신청** 클릭 → 개발용 인증키 즉시 발급
4. 마이페이지 > OpenAPI 인증키 발급 현황에서 확인

### 2. 카카오 Local API (편의시설)
1. [Kakao Developers](https://developers.kakao.com) 접속
2. 앱 생성 → 앱 키 발급
3. **REST API 키** 복사
4. 무료 할당량: 100,000건/일

## 주의사항
- API 키 없이도 앱은 Fallback 데이터로 정상 동작합니다.
- 실제 위치 기반 데이터를 보려면 위 API 키가 필요합니다.
