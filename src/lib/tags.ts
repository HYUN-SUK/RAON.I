/**
 * RAONAI Smart Persona System v2.0
 * Canonical Tag Definitions & Mapping Rules
 */

export type TagId = 
  // [1. 구성원 및 스타일]
  | 'STYLE_SOLO' | 'STYLE_COUPLE' | 'STYLE_FAMILY' | 'FAMILY_PET' | 'STYLE_GUEST' | 'FAMILY_INFANT' | 'STYLE_KIDS_EL' | 'STYLE_GROUP'
  // [2. 환경 및 뷰]
  | 'VIEW_OCEAN' | 'VIEW_LAKE' | 'VIEW_FOREST' | 'VIEW_MOUNTAIN' | 'VIEW_OPEN' | 'VIEW_STARRY' | 'VIEW_SHADE' | 'VIEW_CITY'
  // [3. 시설 및 인프라]
  | 'FACILITY_LUXURY' | 'FACILITY_PRIVATE_BATH' | 'FACILITY_WIDE' | 'FACILITY_AUTO' | 'FACILITY_GLAMP' | 'FACILITY_OFFROAD' | 'FACILITY_KIDS' | 'FACILITY_STORE'
  // [4. 액티비티 및 경험]
  | 'ACTIVITY_FIRE' | 'FOOD_COOKING' | 'ACTIVITY_HIKE' | 'ACTIVITY_WATER' | 'ACTIVITY_FESTIVAL' | 'ACTIVITY_READ' | 'ACTIVITY_PHOTO' | 'ACTIVITY_MINIMAL' | 'ACTIVITY_GEAR' | 'ACTIVITY_BUSY'
  // [5. 감성 및 무드]
  | 'MOOD_QUIET' | 'MOOD_LAZY' | 'MOOD_ACC' | 'MOOD_RAIN' | 'MOOD_SNOW' | 'MOOD_VINTAGE' | 'SOCIAL_ACTIVE' | 'MOOD_NATURE'
  // [6. 식음료 및 주변 탐색]
  | 'FOOD_BBQ' | 'FOOD_SEAFOOD' | 'FOOD_MEALKIT' | 'FOOD_LOCAL' | 'FOOD_CAFE' | 'FOOD_ALCOHOL' | 'FOOD_VEGAN' | 'FOOD_BAKERY'
  // [기타]
  | 'SEASON_WINTER' | 'ACTIVITY_HEALING' | 'LEGACY_UNKNOWN';

export interface TagDefinition {
  id: TagId;
  label: string;
  aliases: string[];     // 기존 한글 태그 매핑용
  category: 'FAMILY' | 'STYLE' | 'FOOD' | 'MOOD' | 'VIEW' | 'FACILITY' | 'ACTIVITY' | 'SEASON';
  baseWeight: number;    // 기본 가중치 (1.0 기준)
}

export const CANONICAL_TAGS: Record<TagId, TagDefinition> = {
  // [1. 구성원 및 스타일]
  STYLE_SOLO: { id: 'STYLE_SOLO', label: '솔로 캠퍼', aliases: ['#솔로캠핑', '#혼캠', '#백패킹'], category: 'STYLE', baseWeight: 1.0 },
  STYLE_COUPLE: { id: 'STYLE_COUPLE', label: '커플 캠핑', aliases: ['#커플캠핑', '#부부캠핑'], category: 'STYLE', baseWeight: 1.0 },
  STYLE_FAMILY: { id: 'STYLE_FAMILY', label: '가족 캠핑', aliases: ['#가족캠핑'], category: 'STYLE', baseWeight: 1.0 },
  FAMILY_PET: { id: 'FAMILY_PET', label: '반려견 동반', aliases: ['#반려견', '#애견동반', '#펫캠핑'], category: 'FAMILY', baseWeight: 1.2 },
  STYLE_GUEST: { id: 'STYLE_GUEST', label: '접대 캠핑', aliases: ['#접대캠프'], category: 'STYLE', baseWeight: 1.0 },
  FAMILY_INFANT: { id: 'FAMILY_INFANT', label: '영유아 동반', aliases: ['#영유아', '#아이동반', '#키즈캠핑'], category: 'FAMILY', baseWeight: 1.2 },
  STYLE_KIDS_EL: { id: 'STYLE_KIDS_EL', label: '초중등 자녀', aliases: ['#초중등자녀'], category: 'STYLE', baseWeight: 1.0 },
  STYLE_GROUP: { id: 'STYLE_GROUP', label: '단체/떼캠', aliases: ['#단체캠프', '#떼캠'], category: 'STYLE', baseWeight: 1.0 },

  // [2. 환경 및 뷰]
  VIEW_OCEAN: { id: 'VIEW_OCEAN', label: '오션뷰', aliases: ['#바다뷰', '#오션뷰', '#해수욕장'], category: 'VIEW', baseWeight: 1.1 },
  VIEW_LAKE: { id: 'VIEW_LAKE', label: '호수/계곡', aliases: ['#호수', '#계곡', '#물가'], category: 'VIEW', baseWeight: 1.1 },
  VIEW_FOREST: { id: 'VIEW_FOREST', label: '포레스트뷰', aliases: ['#숲속', '#포레스트'], category: 'VIEW', baseWeight: 1.1 },
  VIEW_MOUNTAIN: { id: 'VIEW_MOUNTAIN', label: '마운틴뷰', aliases: ['#산행', '#마운틴'], category: 'VIEW', baseWeight: 1.1 },
  VIEW_OPEN: { id: 'VIEW_OPEN', label: '탁트인시야', aliases: ['#전망좋은', '#탁트인'], category: 'VIEW', baseWeight: 1.1 },
  VIEW_STARRY: { id: 'VIEW_STARRY', label: '밤하늘별빛', aliases: ['#별빛', '#은하수'], category: 'VIEW', baseWeight: 1.1 },
  VIEW_SHADE: { id: 'VIEW_SHADE', label: '그늘풍부', aliases: ['#그늘'], category: 'VIEW', baseWeight: 1.0 },
  VIEW_CITY: { id: 'VIEW_CITY', label: '도심인접', aliases: ['#도심근교', '#도시뷰'], category: 'VIEW', baseWeight: 1.0 },

  // [3. 시설 및 인프라]
  FACILITY_LUXURY: { id: 'FACILITY_LUXURY', label: '최상급시설', aliases: ['#5성급', '#프리미엄'], category: 'FACILITY', baseWeight: 1.2 },
  FACILITY_PRIVATE_BATH: { id: 'FACILITY_PRIVATE_BATH', label: '개별화장실', aliases: ['#개별샤워실', '#프라이빗'], category: 'FACILITY', baseWeight: 1.3 },
  FACILITY_WIDE: { id: 'FACILITY_WIDE', label: '사이트간격넓은', aliases: ['#넓은사이트'], category: 'FACILITY', baseWeight: 1.1 },
  FACILITY_AUTO: { id: 'FACILITY_AUTO', label: '오토캠핑', aliases: ['#오토캠핑장'], category: 'FACILITY', baseWeight: 1.0 },
  FACILITY_GLAMP: { id: 'FACILITY_GLAMP', label: '글램핑/카라반', aliases: ['#글램핑', '#카라반'], category: 'FACILITY', baseWeight: 1.1 },
  FACILITY_OFFROAD: { id: 'FACILITY_OFFROAD', label: '노지/차박', aliases: ['#오프로드', '#차박'], category: 'FACILITY', baseWeight: 1.1 },
  FACILITY_KIDS: { id: 'FACILITY_KIDS', label: '키즈친화(놀이터)', aliases: ['#놀이터', '#키즈존'], category: 'FACILITY', baseWeight: 1.1 },
  FACILITY_STORE: { id: 'FACILITY_STORE', label: '매점/인프라중시', aliases: ['#매점', '#편의점'], category: 'FACILITY', baseWeight: 1.0 },

  // [4. 액티비티 및 경험]
  ACTIVITY_FIRE: { id: 'ACTIVITY_FIRE', label: '불멍매니아', aliases: ['#불멍', '#화로대'], category: 'ACTIVITY', baseWeight: 1.0 },
  FOOD_COOKING: { id: 'FOOD_COOKING', label: '캠핑요리사', aliases: ['#요리', '#그리들'], category: 'FOOD', baseWeight: 1.0 },
  ACTIVITY_HIKE: { id: 'ACTIVITY_HIKE', label: '하이킹/산책', aliases: ['#등산', '#산책'], category: 'ACTIVITY', baseWeight: 1.0 },
  ACTIVITY_WATER: { id: 'ACTIVITY_WATER', label: '수상액티비티', aliases: ['#물놀이', '#수영'], category: 'ACTIVITY', baseWeight: 1.0 },
  ACTIVITY_FESTIVAL: { id: 'ACTIVITY_FESTIVAL', label: '로컬축제탐방', aliases: ['#축제', '#지역행사'], category: 'ACTIVITY', baseWeight: 1.0 },
  ACTIVITY_READ: { id: 'ACTIVITY_READ', label: '독서/사색', aliases: ['#책읽기', '#사색'], category: 'ACTIVITY', baseWeight: 1.0 },
  ACTIVITY_PHOTO: { id: 'ACTIVITY_PHOTO', label: '사진/기록', aliases: ['#사진맛집', '#포토존'], category: 'ACTIVITY', baseWeight: 1.0 },
  ACTIVITY_MINIMAL: { id: 'ACTIVITY_MINIMAL', label: '미니멀리스트', aliases: ['#미니멀캠핑', '#백패킹'], category: 'ACTIVITY', baseWeight: 1.1 },
  ACTIVITY_GEAR: { id: 'ACTIVITY_GEAR', label: '장비세팅매니아', aliases: ['#장비자랑', '#맥시멀캠핑'], category: 'ACTIVITY', baseWeight: 1.0 },
  ACTIVITY_BUSY: { id: 'ACTIVITY_BUSY', label: '가득찬일정', aliases: ['#꽉찬일정'], category: 'ACTIVITY', baseWeight: 1.0 },

  // [5. 감성 및 무드]
  MOOD_QUIET: { id: 'MOOD_QUIET', label: '조용한/힐링', aliases: ['#조용한', '#한적한'], category: 'MOOD', baseWeight: 1.1 },
  MOOD_LAZY: { id: 'MOOD_LAZY', label: '여유로운/레이지', aliases: ['#휴식', '#낮잠'], category: 'MOOD', baseWeight: 1.0 },
  MOOD_ACC: { id: 'MOOD_ACC', label: '감성소품/알전구', aliases: ['#감성템', '#알전구'], category: 'MOOD', baseWeight: 1.0 },
  MOOD_RAIN: { id: 'MOOD_RAIN', label: '우중캠핑낭만', aliases: ['#우중캠핑'], category: 'MOOD', baseWeight: 1.1 },
  MOOD_SNOW: { id: 'MOOD_SNOW', label: '설중캠핑', aliases: ['#겨울눈'], category: 'MOOD', baseWeight: 1.2 },
  MOOD_VINTAGE: { id: 'MOOD_VINTAGE', label: '빈티지/레트로', aliases: ['#빈티지캠핑'], category: 'MOOD', baseWeight: 1.0 },
  SOCIAL_ACTIVE: { id: 'SOCIAL_ACTIVE', label: '소셜/이웃교류', aliases: ['#이웃사촌', '#소셜'], category: 'STYLE', baseWeight: 1.2 },
  MOOD_NATURE: { id: 'MOOD_NATURE', label: '자연그대로', aliases: ['#야생캠핑'], category: 'MOOD', baseWeight: 1.1 },

  // [6. 식음료 및 주변 탐색]
  FOOD_BBQ: { id: 'FOOD_BBQ', label: '육식주의/바베큐', aliases: ['#고기파', '#바베큐'], category: 'FOOD', baseWeight: 1.0 },
  FOOD_SEAFOOD: { id: 'FOOD_SEAFOOD', label: '해산물러버', aliases: ['#회포장', '#조개구이'], category: 'FOOD', baseWeight: 1.0 },
  FOOD_MEALKIT: { id: 'FOOD_MEALKIT', label: '밀키트/간편조리', aliases: ['#간편식', '#밀키트'], category: 'FOOD', baseWeight: 1.0 },
  FOOD_LOCAL: { id: 'FOOD_LOCAL', label: '현지맛집탐방', aliases: ['#로컬맛집'], category: 'FOOD', baseWeight: 1.1 },
  FOOD_CAFE: { id: 'FOOD_CAFE', label: '분위기좋은카페', aliases: ['#카페투어'], category: 'FOOD', baseWeight: 1.0 },
  FOOD_ALCOHOL: { id: 'FOOD_ALCOHOL', label: '주류/안주매니아', aliases: ['#안주맛집', '#술'], category: 'FOOD', baseWeight: 1.0 },
  FOOD_VEGAN: { id: 'FOOD_VEGAN', label: '건강식/비건', aliases: ['#채식'], category: 'FOOD', baseWeight: 1.1 },
  FOOD_BAKERY: { id: 'FOOD_BAKERY', label: '로컬베이커리/빵지순례', aliases: ['#빵집'], category: 'FOOD', baseWeight: 1.0 },

  // [기타 및 하위호환]
  SEASON_WINTER: { id: 'SEASON_WINTER', label: '동계 캠핑 선호', aliases: ['#겨울'], category: 'SEASON', baseWeight: 1.2 },
  ACTIVITY_HEALING: { id: 'ACTIVITY_HEALING', label: '조용하고 한적한 힐링', aliases: ['#힐링'], category: 'ACTIVITY', baseWeight: 1.0 },
  LEGACY_UNKNOWN: { id: 'LEGACY_UNKNOWN', label: '기타/미분류', aliases: [], category: 'STYLE', baseWeight: 1.0 }
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
