/**
 * 캠핑장 자동 태깅 로직
 *
 * 고캠핑 API 응답을 분석하여 자동으로 태그를 생성합니다.
 * - 시설 기반 태그 (샤워, 전기, 와이파이 등)
 * - 환경 기반 태그 (계곡, 숲속, 바다 등)
 */

import { GoCampingItem } from './gocamping-api';
import { ToggleKey } from '@/types/camping-ajiit';

// ═══════════════════════════════════════════════════════════
// 변환 결과 타입
// ═══════════════════════════════════════════════════════════

export interface CampgroundInsertData {
    gocamping_id: string;
    name: string;
    address: string | null;
    tel: string | null;
    homepage_url: string | null;
    lat: number | null;
    lng: number | null;
    facility_type: string[];
    has_shower: boolean;
    has_electricity: boolean;
    has_wifi: boolean;
    pet_allowed: boolean;
    has_firepit: boolean;
    has_playground: boolean;
    has_parking: boolean;
    env_water: boolean;
    env_quiet: boolean;
    env_view: boolean;
    env_forest: boolean;
    env_ocean: boolean;
    environment: string[];
    auto_tags: string[];
    site_count: number | null;
    intro: string | null;
}

// ═══════════════════════════════════════════════════════════
// 시설 감지 함수들
// ═══════════════════════════════════════════════════════════

/**
 * 샤워 시설 여부 감지
 */
function hasShower(item: GoCampingItem): boolean {
    // 샤워실 개수 또는 부대시설에 '온수' 포함
    if (item.swrmCo && item.swrmCo > 0) return true;
    if (item.sbrsCl?.includes('온수')) return true;
    if (item.sbrsCl?.includes('샤워')) return true;
    return false;
}

/**
 * 전기 시설 여부 감지
 */
function hasElectricity(item: GoCampingItem): boolean {
    if (item.sbrsCl?.includes('전기')) return true;
    return false;
}

/**
 * 와이파이 여부 감지
 */
function hasWifi(item: GoCampingItem): boolean {
    if (item.sbrsCl?.includes('무선인터넷')) return true;
    if (item.sbrsCl?.includes('와이파이')) return true;
    if (item.sbrsCl?.includes('WiFi')) return true;
    return false;
}

/**
 * 반려동물 동반 가능 여부 감지
 */
function isPetAllowed(item: GoCampingItem): boolean {
    if (!item.animalCmgCl) return false;
    if (item.animalCmgCl === '불가능') return false;
    if (item.animalCmgCl.includes('가능')) return true;
    return false;
}

/**
 * 화로대(불멍) 가능 여부 감지
 */
function hasFirepit(item: GoCampingItem): boolean {
    if (!item.brazierCl) return false;
    if (item.brazierCl === '불가') return false;
    if (item.brazierCl.includes('개별')) return true;
    if (item.brazierCl.includes('가능')) return true;
    return false;
}

/**
 * 놀이시설 여부 감지
 */
function hasPlayground(item: GoCampingItem): boolean {
    // 체험프로그램이나 부대시설에서 감지
    if (item.sbrsCl?.includes('놀이')) return true;
    if (item.sbrsCl?.includes('어린이')) return true;
    if (item.posblFcltyCl?.includes('놀이터')) return true;
    if (item.exprnProgrm?.includes('놀이')) return true;
    if (item.featureNm?.includes('가족')) return true;
    return false;
}

/**
 * 개별 주차 여부 감지
 */
function hasParking(item: GoCampingItem): boolean {
    // 자동차 야영장이면 개별 주차 가능으로 판단
    if (item.facltDivNm?.includes('자동차')) return true;
    if (item.induty?.includes('자동차야영장')) return true;
    if (Number(item.autoSiteCo) > 0) return true;
    return false;
}

// ═══════════════════════════════════════════════════════════
// 환경 감지 함수들
// ═══════════════════════════════════════════════════════════

/**
 * 계곡/물가 환경 감지
 */
function hasWaterEnvironment(item: GoCampingItem): boolean {
    const keywords = ['계곡', '강', '호수', '하천', '물가', '천변'];
    const searchText = `${item.lctCl || ''} ${item.featureNm || ''} ${item.themaEnvrnCl || ''}`;
    return keywords.some((k) => searchText.includes(k));
}

/**
 * 조용한 환경 감지
 */
function hasQuietEnvironment(item: GoCampingItem): boolean {
    const keywords = ['조용', '힐링', '프라이빗', '독채', '독립'];
    const searchText = `${item.featureNm || ''} ${item.intro || ''} ${item.lineIntro || ''}`;
    return keywords.some((k) => searchText.includes(k));
}

/**
 * 뷰맛집 환경 감지
 */
function hasViewEnvironment(item: GoCampingItem): boolean {
    const keywords = ['일출', '일몰', '전망', '야경', '별', '경치', '뷰'];
    const searchText = `${item.themaEnvrnCl || ''} ${item.featureNm || ''} ${item.intro || ''}`;
    return keywords.some((k) => searchText.includes(k));
}

/**
 * 숲속 환경 감지
 */
function hasForestEnvironment(item: GoCampingItem): boolean {
    const keywords = ['숲', '산', '삼림', '자연휴양림', '수목원'];
    const locationKeywords = ['산', '숲'];
    const searchText = `${item.lctCl || ''} ${item.featureNm || ''} ${item.themaEnvrnCl || ''}`;
    const matchLocation = locationKeywords.some((k) => (item.lctCl || '').includes(k));
    const matchFeature = keywords.some((k) => searchText.includes(k));
    return matchLocation || matchFeature;
}

/**
 * 바다/해변 환경 감지
 */
function hasOceanEnvironment(item: GoCampingItem): boolean {
    const keywords = ['해변', '바다', '해안', '섬'];
    const searchText = `${item.lctCl || ''} ${item.featureNm || ''} ${item.themaEnvrnCl || ''}`;
    return keywords.some((k) => searchText.includes(k));
}

// ═══════════════════════════════════════════════════════════
// 자동 태그 생성
// ═══════════════════════════════════════════════════════════

/**
 * 고캠핑 아이템에서 자동 태그 배열 생성
 */
function generateAutoTags(item: GoCampingItem): string[] {
    const tags: string[] = [];

    // 시설 태그
    if (hasShower(item)) tags.push('샤워가능');
    if (hasElectricity(item)) tags.push('전기가능');
    if (hasWifi(item)) tags.push('와이파이');
    if (isPetAllowed(item)) tags.push('반려동물');
    if (hasFirepit(item)) tags.push('불멍가능');
    if (hasPlayground(item)) tags.push('놀이시설');
    if (hasParking(item)) tags.push('개별주차');

    // 환경 태그
    if (hasWaterEnvironment(item)) tags.push('계곡물가');
    if (hasQuietEnvironment(item)) tags.push('조용함');
    if (hasViewEnvironment(item)) tags.push('뷰맛집');
    if (hasForestEnvironment(item)) tags.push('숲속');
    if (hasOceanEnvironment(item)) tags.push('바다해변');

    // 캠핑장 유형 태그
    if (item.induty?.includes('글램핑')) tags.push('글램핑');
    if (item.induty?.includes('카라반')) tags.push('카라반');
    if (item.induty?.includes('자동차야영장')) tags.push('차박');

    // 테마 태그 (themaEnvrnCl 활용)
    if (item.themaEnvrnCl) {
        const themes = item.themaEnvrnCl.split(',').map((t) => t.trim());
        themes.forEach((theme) => {
            if (theme && !tags.includes(theme) && tags.length < 15) {
                tags.push(theme);
            }
        });
    }

    return tags;
}

/**
 * 시설 유형 배열 생성
 */
function extractFacilityTypes(item: GoCampingItem): string[] {
    const types: string[] = [];

    if (item.induty) {
        const industries = item.induty.split(',').map((t) => t.trim());
        types.push(...industries);
    }

    return types;
}

/**
 * 환경 배열 생성
 */
function extractEnvironments(item: GoCampingItem): string[] {
    const envs: string[] = [];

    if (item.lctCl) {
        const locations = item.lctCl.split(',').map((t) => t.trim());
        envs.push(...locations);
    }

    return envs;
}

/**
 * 총 사이트 수 계산
 */
function calculateTotalSites(item: GoCampingItem): number {
    const gnrl = Number(item.gnrlSiteCo) || 0;
    const auto = Number(item.autoSiteCo) || 0;
    const glamp = Number(item.glampSiteCo) || 0;
    const carav = Number(item.caravSiteCo) || 0;
    const indvdl = Number(item.indvdlCaravSiteCo) || 0;
    return gnrl + auto + glamp + carav + indvdl;
}

// ═══════════════════════════════════════════════════════════
// 메인 변환 함수
// ═══════════════════════════════════════════════════════════

/**
 * 고캠핑 API 아이템을 DB 삽입용 데이터로 변환
 */
export function transformGoCampingItem(item: GoCampingItem): CampgroundInsertData {
    return {
        gocamping_id: item.contentId,
        name: item.facltNm,
        address: item.addr1 ? `${item.addr1} ${item.addr2 || ''}`.trim() : null,
        tel: item.tel || null,
        homepage_url: item.homepage || item.resveUrl || null,
        lat: item.mapY ? parseFloat(item.mapY) : null,
        lng: item.mapX ? parseFloat(item.mapX) : null,
        facility_type: extractFacilityTypes(item),
        has_shower: hasShower(item),
        has_electricity: hasElectricity(item),
        has_wifi: hasWifi(item),
        pet_allowed: isPetAllowed(item),
        has_firepit: hasFirepit(item),
        has_playground: hasPlayground(item),
        has_parking: hasParking(item),
        env_water: hasWaterEnvironment(item),
        env_quiet: hasQuietEnvironment(item),
        env_view: hasViewEnvironment(item),
        env_forest: hasForestEnvironment(item),
        env_ocean: hasOceanEnvironment(item),
        environment: extractEnvironments(item),
        auto_tags: generateAutoTags(item),
        site_count: calculateTotalSites(item) || null,
        intro: item.intro || item.lineIntro || null,
    };
}

/**
 * 여러 아이템 일괄 변환
 */
export function transformGoCampingItems(
    items: GoCampingItem[]
): CampgroundInsertData[] {
    return items.map(transformGoCampingItem);
}

/**
 * 자동 태그에서 토글 키 추출 (역매핑)
 */
export function getTogglesFromAutoTags(autoTags: string[]): ToggleKey[] {
    const toggleMap: Record<string, ToggleKey> = {
        '샤워가능': 'shower',
        '전기가능': 'electricity',
        '와이파이': 'wifi',
        '반려동물': 'pet',
        '불멍가능': 'firepit',
        '놀이시설': 'playground',
        '개별주차': 'parking',
        '계곡물가': 'water',
        '조용함': 'quiet',
        '뷰맛집': 'view',
        '숲속': 'forest',
        '바다해변': 'ocean',
    };

    const toggles: ToggleKey[] = [];
    for (const tag of autoTags) {
        if (toggleMap[tag]) {
            toggles.push(toggleMap[tag]);
        }
    }
    return toggles;
}
