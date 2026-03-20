/**
 * RAONAI Smart Persona System v2.0
 * Canonical Tag Definitions & Mapping Rules
 */

export type TagId = 
  | 'FAMILY_INFANT'      // 영유아 동반
  | 'FAMILY_PET'         // 반려동물 동반
  | 'STYLE_SOLO'         // 솔로 캠퍼
  | 'STYLE_COUPLE'       // 커플 캠퍼
  | 'STYLE_FAMILY'       // 다가족/그룹 캠퍼
  | 'FOOD_LOCAL'         // 현지 먹거리/로컬 맛집
  | 'FOOD_BBQ'           // 바베큐/고기 중심
  | 'FOOD_CAFE'          // 카페/디저트 선호
  | 'MOOD_QUIET'         // 조용하고 한적한 곳
  | 'VIEW_OCEAN'         // 바다 뷰 선호
  | 'FACILITY_PRIVATE_BATH' // 개인 샤워실/화장실 선호
  | 'SEASON_WINTER'      // 동계 캠핑/설경 선호
  | 'ACTIVITY_PHOTO'     // 사진 찍기 좋은 곳
  | 'ACTIVITY_FIRE'      // 불멍/화로대 매니아
  | 'ACTIVITY_HEALING'   // 조용한/힐링 선호
  | 'FOOD_COOKING'       // 캠핑 요리 즐김
  | 'SOCIAL_ACTIVE'      // 소셜 활동 활발 (구독/좋아요 등)
  | 'LEGACY_UNKNOWN';    // 매핑 실패 시

export interface TagDefinition {
  id: TagId;
  label: string;
  aliases: string[];     // 기존 한글 태그 매핑용
  category: 'FAMILY' | 'STYLE' | 'FOOD' | 'MOOD' | 'VIEW' | 'FACILITY' | 'ACTIVITY' | 'SEASON';
  baseWeight: number;    // 기본 가중치 (1.0 기준)
}

export const CANONICAL_TAGS: Record<TagId, TagDefinition> = {
  FAMILY_INFANT: {
    id: 'FAMILY_INFANT',
    label: '영유아 동반',
    aliases: ['#영유아', '#아이동반', '#키즈캠핑'],
    category: 'FAMILY',
    baseWeight: 1.2
  },
  FAMILY_PET: {
    id: 'FAMILY_PET',
    label: '반려동물 동반',
    aliases: ['#반려견', '#애견동반', '#펫캠핑'],
    category: 'FAMILY',
    baseWeight: 1.2
  },
  STYLE_SOLO: {
    id: 'STYLE_SOLO',
    label: '솔로 캠퍼',
    aliases: ['#솔로캠핑', '#혼캠', '#백패킹'],
    category: 'STYLE',
    baseWeight: 1.0
  },
  STYLE_COUPLE: {
    id: 'STYLE_COUPLE',
    label: '커플 캠퍼',
    aliases: ['#커플캠핑', '#부부캠핑', '#감성캠핑'],
    category: 'STYLE',
    baseWeight: 1.0
  },
  STYLE_FAMILY: {
    id: 'STYLE_FAMILY',
    label: '가족/단체 캠퍼',
    aliases: ['#가족캠핑', '#단체캠핑', '#떼캠'],
    category: 'STYLE',
    baseWeight: 1.0
  },
  FOOD_LOCAL: {
    id: 'FOOD_LOCAL',
    label: '로컬 맛집 선호',
    aliases: ['#로컬맛집', '#현지음식', '#시장'],
    category: 'FOOD',
    baseWeight: 1.1
  },
  FOOD_BBQ: {
    id: 'FOOD_BBQ',
    label: '바베큐 매니아',
    aliases: ['#바베큐', '#삼겹살', '#구이'],
    category: 'FOOD',
    baseWeight: 1.0
  },
  FOOD_CAFE: {
    id: 'FOOD_CAFE',
    label: '카페/디저트 선호',
    aliases: ['#카페투어', '#디저트', '#커피'],
    category: 'FOOD',
    baseWeight: 1.0
  },
  MOOD_QUIET: {
    id: 'MOOD_QUIET',
    label: '조용하고 한적한 곳',
    aliases: ['#조용한', '#한적한', '#힐링'],
    category: 'MOOD',
    baseWeight: 1.1
  },
  VIEW_OCEAN: {
    id: 'VIEW_OCEAN',
    label: '오션뷰 선호',
    aliases: ['#바다뷰', '#오션뷰', '#해수욕장'],
    category: 'VIEW',
    baseWeight: 1.1
  },
  FACILITY_PRIVATE_BATH: {
    id: 'FACILITY_PRIVATE_BATH',
    label: '개인 편의시설 선호',
    aliases: ['#개별화장실', '#개별샤워실', '#프라이빗'],
    category: 'FACILITY',
    baseWeight: 1.3
  },
  SEASON_WINTER: {
    id: 'SEASON_WINTER',
    label: '동계 캠핑 선호',
    aliases: ['#겨울캠핑', '#동계캠핑', '#설경'],
    category: 'SEASON',
    baseWeight: 1.2
  },
  ACTIVITY_PHOTO: {
    id: 'ACTIVITY_PHOTO',
    label: '인생샷/사진 명소',
    aliases: ['#사진맛집', '#포토존', '#인생샷'],
    category: 'ACTIVITY',
    baseWeight: 1.0
  },
  ACTIVITY_FIRE: {
    id: 'ACTIVITY_FIRE',
    label: '불멍/화로대 매니아',
    aliases: ['#불멍', '#화로대', '#장작'],
    category: 'ACTIVITY',
    baseWeight: 1.0
  },
  ACTIVITY_HEALING: {
    id: 'ACTIVITY_HEALING',
    label: '조용하고 한적한 힐링',
    aliases: ['#힐링', '#여유', '#산책'],
    category: 'ACTIVITY',
    baseWeight: 1.0
  },
  FOOD_COOKING: {
    id: 'FOOD_COOKING',
    label: '캠핑 요리 식음료',
    aliases: ['#요리', '#그리들', '#음식'],
    category: 'FOOD',
    baseWeight: 1.0
  },
  SOCIAL_ACTIVE: {
    id: 'SOCIAL_ACTIVE',
    label: '소셜 활동가',
    aliases: ['#소셜', '#이웃', '#커뮤니티'],
    category: 'STYLE',
    baseWeight: 1.2
  },
  LEGACY_UNKNOWN: {
    id: 'LEGACY_UNKNOWN',
    label: '기타/미분류',
    aliases: [],
    category: 'STYLE',
    baseWeight: 1.0
  }
};

/**
 * 기존 한글 태그 명칭을 Canonical ID로 변환합니다.
 */
export function mapLegacyTagToId(legacyTag: string): TagId {
    const cleanTag = legacyTag.startsWith('#') ? legacyTag : `#${legacyTag}`;
    for (const def of Object.values(CANONICAL_TAGS)) {
        if (def.aliases.includes(cleanTag) || def.label === legacyTag) {
            return def.id;
        }
    }
    return 'LEGACY_UNKNOWN';
}
