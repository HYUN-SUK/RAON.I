export interface ScrapingResult {
    rating: number; // 0.0 ~ 5.0
    reviewCount: number;
    success: boolean;
}

/**
 * 카카오맵 상세페이지(place_url)를 분석하여 별점과 리뷰 수를 추출합니다.
 * @param url 카카오맵 장소 상세 URL (예: https://place.map.kakao.com/22716674)
 */
export async function scrapeKakaoPlace(url: string): Promise<ScrapingResult> {
    try {
        // URL에서 placeId 추출
        const placeIdMatch = url.match(/\/(\d+)$/);
        if (!placeIdMatch) throw new Error("Invalid Kakao Place URL format");
        const placeId = placeIdMatch[1];

        // 브라우저 리서치로 확인된 히든 API 엔드포인트 사용 (JSON 직접 수배)
        // Referer 헤더가 없으면 403 Forbidden이 뜰 수 있음
        const apiHeaders = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
            'Referer': `https://place.map.kakao.com/${placeId}`
        };

        // 1. 기본 정보 API (panel3) - 별점 정보 포함 가능성
        const mainInfoUrl = `https://place-api.map.kakao.com/places/panel3/${placeId}`;
        const mainRes = await fetch(mainInfoUrl, { headers: apiHeaders });

        let rating = 0;
        let reviewCount = 0;

        if (mainRes.ok) {
            const mainData = await mainRes.json();
            if (mainData.basicInfo?.feedback?.score) {
                rating = parseFloat(mainData.basicInfo.feedback.score);
            }
        }

        // 2. 리뷰 메타데이터 API (더 정확한 리뷰 수)
        const reviewMetaUrl = `https://place-api.map.kakao.com/places/reviews/kakaomap/meta/${placeId}`;
        const reviewRes = await fetch(reviewMetaUrl, { headers: apiHeaders });

        if (reviewRes.ok) {
            const reviewData = await reviewRes.json();
            if (reviewData.reviewCount !== undefined) {
                reviewCount = parseInt(reviewData.reviewCount, 10);
            }
        }

        return {
            rating: rating || 0,
            reviewCount: reviewCount || 0,
            success: rating > 0 || reviewCount > 0
        };

    } catch (error) {
        console.error(`[Scraper] Error enrichment via API for ${url}:`, error);
        return { rating: 0, reviewCount: 0, success: false };
    }
}
