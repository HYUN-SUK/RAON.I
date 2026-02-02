/**
 * 캠핑장 추천 로직
 * 점수 계산: 시설 매칭(+20) + 거리(+30) + 모드 환경(+15) + 사용자 태그(+10)
 */

import {
    Campground,
    CampgroundWithScore,
    CampingMode,
    ToggleKey,
    CAMPING_TOGGLES,
    CAMPING_MODES,
} from '@/types/camping-ajiit';

// ═══════════════════════════════════════════════════════════
// 점수 가중치
// ═══════════════════════════════════════════════════════════
const WEIGHTS = {
    FACILITY_MATCH: 20,      // 시설 매칭 시 각각 +20점
    DISTANCE_MAX: 30,        // 거리 점수 최대 30점
    MODE_ENVIRONMENT: 15,    // 모드별 환경 매칭 +15점
    USER_TAG_MATCH: 10,      // 사용자 태그 매칭 +10점
    FAVORITE_BONUS: 5,       // 인기 찜 보너스 (10개당 +5점)
};

// 모드별 선호 환경 태그
const MODE_ENVIRONMENT_PREFERENCES: Record<CampingMode, string[]> = {
    family: ['가족친화', '넓은사이트', '아이놀이'],
    solo: ['조용함', '프라이빗', '힐링'],
    couple: ['뷰맛집', '프라이빗', '깨끗함'],
    friends: ['불멍가능', '넓은사이트', '편의점근처'],
    car: ['전기가능', '평지', '차량접근'],
    healing: ['조용함', '힐링', '자연경관'],
};

// ═══════════════════════════════════════════════════════════
// 거리 계산 (Haversine formula)
// ═══════════════════════════════════════════════════════════
function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // 지구 반지름 (km)
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

// ═══════════════════════════════════════════════════════════
// 점수 계산
// ═══════════════════════════════════════════════════════════
interface ScoreResult {
    totalScore: number;
    matchReason: string;
    facilityScore: number;
    distanceScore: number;
    environmentScore: number;
    tagScore: number;
}

function calculateScore(
    campground: Campground,
    mode: CampingMode,
    toggles: ToggleKey[],
    userLat?: number,
    userLng?: number,
    maxDistance: number = 100
): ScoreResult {
    let facilityScore = 0;
    let distanceScore = 0;
    let environmentScore = 0;
    let tagScore = 0;
    const matchReasons: string[] = [];

    // 1. 시설 매칭 점수
    const matchedFacilities: string[] = [];
    for (const toggleKey of toggles) {
        const toggle = CAMPING_TOGGLES.find((t) => t.key === toggleKey);
        if (!toggle) continue;

        // 특수 케이스: water는 environment 배열 체크
        if (toggleKey === 'water') {
            if (
                campground.environment?.some((e) =>
                    ['계곡', '물가', '강', '바다'].some((w) => e.includes(w))
                )
            ) {
                facilityScore += WEIGHTS.FACILITY_MATCH;
                matchedFacilities.push(toggle.label);
            }
        } else {
            // 일반 boolean 필드 체크
            const fieldValue = campground[toggle.dbField as keyof Campground];
            if (fieldValue === true) {
                facilityScore += WEIGHTS.FACILITY_MATCH;
                matchedFacilities.push(toggle.label);
            }
        }
    }
    if (matchedFacilities.length > 0) {
        matchReasons.push(`${matchedFacilities.join('/')} 충족`);
    }

    // 2. 거리 점수 (가까울수록 높은 점수)
    let distance: number | undefined;
    if (userLat && userLng && campground.lat && campground.lng) {
        distance = calculateDistance(
            userLat,
            userLng,
            Number(campground.lat),
            Number(campground.lng)
        );
        if (distance <= maxDistance) {
            // 거리가 가까울수록 높은 점수 (선형 감소)
            distanceScore = Math.max(0, WEIGHTS.DISTANCE_MAX * (1 - distance / maxDistance));
            matchReasons.push(`${Math.round(distance)}km`);
        }
    }

    // 3. 모드별 환경 매칭
    const preferredEnv = MODE_ENVIRONMENT_PREFERENCES[mode];
    const matchedEnv = campground.auto_tags?.filter((tag) =>
        preferredEnv.some((pref) => tag.includes(pref))
    );
    if (matchedEnv && matchedEnv.length > 0) {
        environmentScore = WEIGHTS.MODE_ENVIRONMENT;
        matchReasons.push(matchedEnv[0]);
    }

    // 4. 사용자 태그 점수 (인기 태그)
    if (campground.user_tags && typeof campground.user_tags === 'object') {
        const topTags = Object.entries(campground.user_tags)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3);
        if (topTags.length > 0) {
            tagScore = Math.min(WEIGHTS.USER_TAG_MATCH, topTags.length * 3);
        }
    }

    const totalScore = facilityScore + distanceScore + environmentScore + tagScore;

    // 매칭 이유 생성
    const modeConfig = CAMPING_MODES.find((m) => m.key === mode);
    const modeLabel = modeConfig?.label || mode;
    const reasonText =
        matchReasons.length > 0
            ? `${modeLabel}모드 + ${matchReasons.join(', ')}`
            : `${modeLabel}모드 추천`;

    return {
        totalScore,
        matchReason: reasonText,
        facilityScore,
        distanceScore,
        environmentScore,
        tagScore,
    };
}

// ═══════════════════════════════════════════════════════════
// 메인 추천 함수
// ═══════════════════════════════════════════════════════════
export interface RecommendationOptions {
    mode: CampingMode;
    toggles: ToggleKey[];
    userLat?: number;
    userLng?: number;
    maxDistance?: number;
    limit?: number;
}

export function recommendCampgrounds(
    campgrounds: Campground[],
    favorites: Map<string, number>, // campground_id -> favorite_count
    userFavorites: Set<string>, // 사용자가 찜한 캠핑장 ID
    options: RecommendationOptions
): CampgroundWithScore[] {
    const { mode, toggles, userLat, userLng, maxDistance = 100, limit = 3 } = options;

    const scoredCampgrounds: CampgroundWithScore[] = campgrounds.map((campground) => {
        const scoreResult = calculateScore(
            campground,
            mode,
            toggles,
            userLat,
            userLng,
            maxDistance
        );

        // 찜 수 보너스
        const favoriteCount = favorites.get(campground.id) || 0;
        const favoriteBonus = Math.floor(favoriteCount / 10) * WEIGHTS.FAVORITE_BONUS;
        const totalScore = scoreResult.totalScore + favoriteBonus;

        // 거리 계산
        let distance: number | undefined;
        if (userLat && userLng && campground.lat && campground.lng) {
            distance = calculateDistance(
                userLat,
                userLng,
                Number(campground.lat),
                Number(campground.lng)
            );
        }

        return {
            ...campground,
            score: totalScore,
            matchReason: scoreResult.matchReason,
            distance,
            favoriteCount,
            isFavorite: userFavorites.has(campground.id),
        };
    });

    // 거리 필터링 (maxDistance 초과 제외)
    const filtered = scoredCampgrounds.filter(
        (c) => c.distance === undefined || c.distance <= maxDistance
    );

    // 점수순 정렬 후 상위 N개 반환
    return filtered.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ═══════════════════════════════════════════════════════════
// 검색 링크 생성 (예약 URL이 없는 경우)
// ═══════════════════════════════════════════════════════════
export function getSearchUrl(campgroundName: string): string {
    const encoded = encodeURIComponent(campgroundName);
    return `https://search.naver.com/search.naver?query=${encoded}+예약`;
}

export function getKakaoMapUrl(
    name: string,
    lat?: number,
    lng?: number
): string {
    if (lat && lng) {
        return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
    }
    return `https://map.kakao.com/?q=${encodeURIComponent(name)}`;
}

export function getNaverMapUrl(
    name: string,
    lat?: number,
    lng?: number
): string {
    if (lat && lng) {
        return `https://map.naver.com/v5/directions/-/${lng},${lat},${encodeURIComponent(name)}/-/transit`;
    }
    return `https://map.naver.com/v5/search/${encodeURIComponent(name)}`;
}
