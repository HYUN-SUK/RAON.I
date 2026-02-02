/**
 * 캠핑 아지트 (Camping Ajiit) 타입 정의
 */

// ═══════════════════════════════════════════════════════════
// 캠핑 모드
// ═══════════════════════════════════════════════════════════
export type CampingMode = 'family' | 'solo' | 'couple' | 'friends' | 'car' | 'healing';

export interface CampingModeConfig {
    key: CampingMode;
    label: string;
    icon: string;
    defaultToggles: ToggleKey[];
    defaultDistance: number;
    description: string;
}

export const CAMPING_MODES: CampingModeConfig[] = [
    {
        key: 'family',
        label: '가족',
        icon: 'Users',
        defaultToggles: ['shower', 'electricity'],
        defaultDistance: 80,
        description: '아이와 함께하는 편안한 캠핑'
    },
    {
        key: 'solo',
        label: '솔로',
        icon: 'User',
        defaultToggles: ['wifi'],
        defaultDistance: 150,
        description: '나만의 조용한 힐링 시간'
    },
    {
        key: 'couple',
        label: '커플',
        icon: 'Heart',
        defaultToggles: [],
        defaultDistance: 100,
        description: '둘만의 로맨틱한 캠핑'
    },
    {
        key: 'friends',
        label: '친구',
        icon: 'Flame',
        defaultToggles: ['firepit'],
        defaultDistance: 100,
        description: '친구들과 함께하는 불멍'
    },
    {
        key: 'car',
        label: '차박',
        icon: 'Car',
        defaultToggles: ['electricity'],
        defaultDistance: 150,
        description: '차에서 즐기는 자유로운 캠핑'
    },
    {
        key: 'healing',
        label: '힐링',
        icon: 'Leaf',
        defaultToggles: [],
        defaultDistance: 80,
        description: '자연 속 깊은 휴식'
    },
];

// ═══════════════════════════════════════════════════════════
// 토글 (시설/환경 필터)
// ═══════════════════════════════════════════════════════════
export type ToggleKey = 'shower' | 'electricity' | 'wifi' | 'pet' | 'firepit' | 'water';

export interface ToggleConfig {
    key: ToggleKey;
    label: string;
    icon: string;
    dbField: string; // campgrounds 테이블의 해당 필드
    description: string;
}

export const CAMPING_TOGGLES: ToggleConfig[] = [
    { key: 'shower', label: '샤워/화장실', icon: '🚿', dbField: 'has_shower', description: '깨끗한 샤워 시설' },
    { key: 'electricity', label: '전기', icon: '🔌', dbField: 'has_electricity', description: '개별 전기 사용 가능' },
    { key: 'wifi', label: '와이파이', icon: '📶', dbField: 'has_wifi', description: 'Wi-Fi 제공' },
    { key: 'pet', label: '반려동물', icon: '🐕', dbField: 'pet_allowed', description: '반려동물 동반 가능' },
    { key: 'firepit', label: '불멍', icon: '🔥', dbField: 'has_firepit', description: '개별 화로대/불멍' },
    { key: 'water', label: '계곡/물가', icon: '💧', dbField: 'environment', description: '물놀이 가능' },
];

export const MAX_TOGGLE_SELECTION = 3;

// ═══════════════════════════════════════════════════════════
// 캠핑장 데이터
// ═══════════════════════════════════════════════════════════
export interface Campground {
    id: string;
    gocamping_id?: string;
    name: string;
    address?: string;
    tel?: string;
    homepage_url?: string;
    lat?: number;
    lng?: number;
    facility_type?: string[];
    has_shower: boolean;
    has_electricity: boolean;
    has_wifi: boolean;
    pet_allowed: boolean;
    has_firepit: boolean;
    environment?: string[];
    auto_tags?: string[];
    user_tags?: Record<string, number>; // { tag: count }
    site_count?: number;
    intro?: string;
    created_at: string;
    updated_at: string;
}

export interface CampgroundWithScore extends Campground {
    score: number;
    matchReason: string;
    distance?: number;
    favoriteCount?: number;
    isFavorite?: boolean;
}

// ═══════════════════════════════════════════════════════════
// Plan Lock
// ═══════════════════════════════════════════════════════════
export type PlanLockStatus = 'planning' | 'booked' | 'completed';

export interface UserPlanLock {
    id: string;
    user_id: string;
    mode: CampingMode;
    toggles: ToggleKey[];
    distance_km: number;
    locked_at: string;
    recommended_campgrounds?: string[];
    selected_campground_id?: string;
    status: PlanLockStatus;
}

// ═══════════════════════════════════════════════════════════
// 사용자 캠핑 일정
// ═══════════════════════════════════════════════════════════
export type ScheduleSource = 'raonai' | 'external';
export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';

export interface UserCampingSchedule {
    id: string;
    user_id: string;
    source: ScheduleSource;
    reservation_id?: string;
    campground_name?: string;
    campground_address?: string;
    campground_lat?: number;
    campground_lng?: number;
    check_in: string;
    check_out: string;
    status: ScheduleStatus;
    record_written: boolean;
    notification_d4_sent: boolean;
    notification_d1_sent: boolean;
    notification_d0_sent: boolean;
    created_at: string;
}

// ═══════════════════════════════════════════════════════════
// 기록 태그
// ═══════════════════════════════════════════════════════════
export type TagCategory = 'mood' | 'facility' | 'activity' | 'etc';

export interface StandardTag {
    key: string;
    label: string;
    category: TagCategory;
}

export const STANDARD_TAGS: StandardTag[] = [
    // 분위기
    { key: 'quiet', label: '#조용해요', category: 'mood' },
    { key: 'nice_view', label: '#뷰맛집', category: 'mood' },
    { key: 'private', label: '#프라이빗', category: 'mood' },
    { key: 'family_friendly', label: '#가족친화', category: 'mood' },
    { key: 'healing', label: '#힐링됨', category: 'mood' },
    // 시설
    { key: 'shower_good', label: '#샤워굿', category: 'facility' },
    { key: 'electricity_good', label: '#전기굿', category: 'facility' },
    { key: 'toilet_clean', label: '#화장실깔끔', category: 'facility' },
    { key: 'wide_site', label: '#넓은사이트', category: 'facility' },
    { key: 'wifi_good', label: '#Wi-Fi굿', category: 'facility' },
    // 액티비티
    { key: 'firepit_best', label: '#불멍최고', category: 'activity' },
    { key: 'water_play', label: '#물놀이', category: 'activity' },
    { key: 'kids_friendly', label: '#아이랑좋아요', category: 'activity' },
    { key: 'pet_welcome', label: '#반려견환영', category: 'activity' },
    { key: 'forest_exp', label: '#숲체험', category: 'activity' },
    // 기타
    { key: 'value', label: '#가성비', category: 'etc' },
    { key: 'kind_owner', label: '#사장님친절', category: 'etc' },
    { key: 'food_spot', label: '#음식맛집', category: 'etc' },
    { key: 'revisit', label: '#재방문의사', category: 'etc' },
    { key: 'stargazing', label: '#별보기좋음', category: 'etc' },
];

export const MAX_TAG_SELECTION = 5;
