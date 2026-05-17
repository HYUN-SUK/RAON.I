// ========================================================================================
// Smart Plan LIVE: Timeline Builder Engine
// 동선 기반 시간 흐름 중심의 타임라인을 조립하는 순수 계산 모듈
// ========================================================================================

import { FactCard, TimelineBlock, TimelineDay, ProTimelinePlan } from './smartPlan';

// ========================================================================================
// Constants
// ========================================================================================

/** tootg 개발 계정 UUID */
export const DEV_PRO_USER_ID = '4730be31-30b5-4594-a993-d8f5a7a5e26c';

/** 카테고리별 기본 체류 시간 (분) */
const DEFAULT_DURATION: Record<string, number> = {
    'RESTAURANT': 60,
    'ROUTE_RESTAURANT': 60,
    'SPOT': 60,
    'ROUTE_SPOT': 45,
    'ROUTE_CAFE': 35,
    'CAFE': 35,
    'MART': 30,
    'GAS_STATION': 15,
    'FESTIVAL': 60,
};

/** Day 라벨 */
const DAY_LABELS = [
    '첫째 날 — 설레는 출발',
    '둘째 날 — 온전한 힐링',
    '셋째 날 — 아쉬운 귀가',
];

// ========================================================================================
// Time Slot Definitions (카테고리 기반 시간대 슬롯)
// ========================================================================================

interface SlotDefinition {
    slotType: string;
    time: string;      // 기본 시작 시간 "HH:MM"
    category: string;  // 매칭할 FactCard category
    type: TimelineBlock['type'];
    duration: number;   // 기본 체류 시간 (분)
    label: string;      // UI 표시용
}

const TIME_SLOTS: Record<string, Record<string, SlotDefinition[]>> = {
    general: {
        day1_evening: [
            { slotType: 'dinner', time: '18:00', category: 'RESTAURANT', type: 'meal', duration: 60, label: '저녁 식사' },
            { slotType: 'evening_walk', time: '19:30', category: 'SPOT', type: 'activity', duration: 45, label: '저녁 산책' },
        ],
        day2_full: [
            { slotType: 'breakfast', time: '08:00', category: 'RESTAURANT', type: 'meal', duration: 50, label: '아침 식사' },
            { slotType: 'morning_spot', time: '09:30', category: 'SPOT', type: 'activity', duration: 60, label: '오전 관광' },
            { slotType: 'lunch', time: '12:00', category: 'RESTAURANT', type: 'meal', duration: 60, label: '점심 식사' },
            { slotType: 'afternoon_cafe', time: '13:30', category: 'ROUTE_CAFE', type: 'cafe', duration: 40, label: '오후 카페' },
            { slotType: 'afternoon_spot', time: '14:30', category: 'SPOT', type: 'activity', duration: 60, label: '오후 관광' },
            { slotType: 'dinner', time: '18:00', category: 'RESTAURANT', type: 'meal', duration: 60, label: '저녁 식사' },
        ],
        day3_morning: [
            { slotType: 'breakfast', time: '08:00', category: 'RESTAURANT', type: 'meal', duration: 50, label: '아침 식사' },
            { slotType: 'morning_cafe', time: '09:30', category: 'ROUTE_CAFE', type: 'cafe', duration: 40, label: '오전 카페' },
            { slotType: 'morning_spot', time: '10:30', category: 'SPOT', type: 'activity', duration: 60, label: '오전 관광' },
            { slotType: 'lunch', time: '12:00', category: 'RESTAURANT', type: 'meal', duration: 60, label: '점심 식사' },
        ],
    },
};

// ========================================================================================
// Utility Functions
// ========================================================================================

/** "HH:MM" → 분(number)으로 변환 */
function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

/** 분(number) → "HH:MM" 변환 */
function minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** 두 좌표 간 Haversine 거리 (km) */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const x = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** 두 좌표 간 예상 이동 시간 (분). 직선거리 × 1.4 보정 / 평균 50km/h */
function estimateTravelMins(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
    const km = haversineKm(from, to) * 1.4; // 도로 보정 계수
    return Math.max(5, Math.round(km / 50 * 60)); // 최소 5분
}

/** 고유 ID 생성 */
function genId(): string {
    return `tb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// ========================================================================================
// Route Progress Calculator (경로 진행률 — 가는길/복귀용)
// ========================================================================================

interface KakaoRoad {
    vertexes: number[]; // [lng, lat, lng, lat, ...]
    duration: number;   // 초
    distance: number;   // 미터
}

/** 점(P)에서 선분(A→B)까지 최단 거리 (km) */
function pointToSegmentDist(
    p: { lat: number; lng: number },
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    if (dx === 0 && dy === 0) return haversineKm(p, a);
    let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    return haversineKm(p, { lat: a.lat + t * dy, lng: a.lng + t * dx });
}

/**
 * 카카오 내비 경로(roads[]) 위에서 특정 좌표가 경로의 몇 % 지점인지 계산
 * @returns 0.0 ~ 1.0 (0=출발, 1=도착)
 */
export function calcRouteProgress(roads: KakaoRoad[], point: { lat: number; lng: number }): number {
    if (!roads || roads.length === 0) return 0.5;

    const totalDuration = roads.reduce((sum, r) => sum + r.duration, 0);
    if (totalDuration === 0) return 0.5;

    let bestDist = Infinity;
    let bestAccDuration = 0;
    let accDuration = 0;

    for (const road of roads) {
        const vx = road.vertexes;
        for (let i = 0; i < vx.length - 3; i += 2) {
            const a = { lat: vx[i + 1], lng: vx[i] };
            const b = { lat: vx[i + 3], lng: vx[i + 2] };
            const d = pointToSegmentDist(point, a, b);
            if (d < bestDist) {
                bestDist = d;
                // 세그먼트 내 비율로 보정
                const segRatio = i / Math.max(1, vx.length - 2);
                bestAccDuration = accDuration + road.duration * segRatio;
            }
        }
        accDuration += road.duration;
    }

    return Math.max(0, Math.min(1, bestAccDuration / totalDuration));
}

// ========================================================================================
// Day 1 Going Route: 경로 진행률 기반 블록 생성
// ========================================================================================

function buildRouteBlocks(
    routeFacts: FactCard[],
    routeRoads: KakaoRoad[],
    departureTime: string,
    day: number,
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
): TimelineBlock[] {
    if (routeFacts.length === 0) return [];

    // 경로 진행률로 정렬
    const sorted = routeFacts
        .map(f => ({ fact: f, progress: calcRouteProgress(routeRoads, { lat: f.lat, lng: f.lng }) }))
        .sort((a, b) => a.progress - b.progress);

    const blocks: TimelineBlock[] = [];
    let currentTime = timeToMinutes(departureTime);
    let prevCoord = origin;

    // 출발 블록
    blocks.push({
        id: genId(), day, time: departureTime, endTime: departureTime,
        type: 'move', title: '출발', duration_mins: 0, travel_mins: 0,
        slotType: 'departure', status: 'upcoming',
    });

    for (const { fact } of sorted) {
        const coord = { lat: fact.lat, lng: fact.lng };
        const travelMins = estimateTravelMins(prevCoord, coord);
        currentTime += travelMins;
        const startTime = minutesToTime(currentTime);
        const dur = DEFAULT_DURATION[fact.category] || 45;
        const endTime = minutesToTime(currentTime + dur);

        blocks.push({
            id: genId(), day, time: startTime, endTime,
            type: fact.category.includes('RESTAURANT') ? 'meal' : fact.category.includes('CAFE') ? 'cafe' : 'activity',
            title: fact.name, duration_mins: dur, travel_mins: travelMins,
            location_id: fact.id, factCard: fact,
            phone: fact.metadata?.phone || fact.metadata?.tel,
            slotType: `route_${fact.category.toLowerCase()}`, status: 'upcoming',
        });

        currentTime += dur;
        prevCoord = coord;
    }

    // 도착 블록
    const arrivalTravel = estimateTravelMins(prevCoord, destination);
    currentTime += arrivalTravel;
    blocks.push({
        id: genId(), day, time: minutesToTime(currentTime), endTime: minutesToTime(currentTime),
        type: 'rest', title: '숙소 도착 · 짐 정리', duration_mins: 0, travel_mins: arrivalTravel,
        slotType: 'arrival', status: 'upcoming',
    });

    return blocks;
}

// ========================================================================================
// Slot-Based Blocks: 카테고리 시간대 슬롯 기반 블록 생성
// ========================================================================================

function buildSlotBlocks(
    slots: SlotDefinition[],
    factCards: FactCard[],
    alternatives: Record<string, FactCard[]>,
    accommodationCoord: { lat: number; lng: number },
    day: number,
    usedIds: Set<string>
): TimelineBlock[] {
    const blocks: TimelineBlock[] = [];
    let prevCoord = accommodationCoord;

    for (const slot of slots) {
        // 해당 카테고리에서 아직 사용되지 않은 최고 점수 카드 선택
        const candidates = [
            ...factCards.filter(f => f.category === slot.category && !usedIds.has(f.id)),
            ...(alternatives[slot.category] || []).filter(f => !usedIds.has(f.id)),
        ];
        // ROUTE_CAFE 슬롯인데 Track A에 카페가 없으면, ROUTE_CAFE 카테고리의 alternatives 활용
        const card = candidates.length > 0 ? candidates[0] : null;
        if (!card) continue;

        usedIds.add(card.id);
        const coord = { lat: card.lat, lng: card.lng };
        const travelMins = estimateTravelMins(prevCoord, coord);
        const dur = slot.duration;

        blocks.push({
            id: genId(), day, time: slot.time, endTime: minutesToTime(timeToMinutes(slot.time) + dur),
            type: slot.type, title: card.name, duration_mins: dur, travel_mins: travelMins,
            location_id: card.id, factCard: card,
            phone: card.metadata?.phone || card.metadata?.tel,
            description: card.reasoning || card.description,
            slotType: slot.slotType, status: 'upcoming',
        });

        prevCoord = coord;
    }

    return blocks;
}

// ========================================================================================
// Recalculation Engine (범용 재계산)
// ========================================================================================

/**
 * 변경 발생 지점부터 이후 모든 블록의 시간을 재계산.
 * Swap, 제거, 추가, 시간편집, "~로 출발" 모두 이 함수를 거침.
 *
 * @param blocks    - 해당 Day의 전체 블록 배열
 * @param fromIndex - 변경이 발생한 블록 인덱스
 * @param baseTime  - 기준 시간 "HH:MM" (편집값 또는 현재 시각)
 * @param baseCoord - 기준 좌표 (현재 GPS 또는 이전 장소)
 */
export function recalcTimelineFrom(
    blocks: TimelineBlock[],
    fromIndex: number,
    baseTime: string,
    baseCoord?: { lat: number; lng: number }
): TimelineBlock[] {
    const result = [...blocks];
    let currentTime = timeToMinutes(baseTime);
    let prevCoord = baseCoord || null;

    // fromIndex 이전의 블록에서 마지막 좌표 추출 (baseCoord 미지정 시)
    if (!prevCoord && fromIndex > 0) {
        for (let i = fromIndex - 1; i >= 0; i--) {
            const fc = result[i].factCard;
            if (fc && !result[i].hidden) {
                prevCoord = { lat: fc.lat, lng: fc.lng };
                break;
            }
        }
    }

    for (let i = fromIndex; i < result.length; i++) {
        const block = { ...result[i] };

        // 숨겨진 블록은 건너뛰되 배열에 유지
        if (block.hidden) {
            result[i] = block;
            continue;
        }

        // 이동 시간 재계산
        if (prevCoord && block.factCard) {
            const dest = { lat: block.factCard.lat, lng: block.factCard.lng };
            block.travel_mins = estimateTravelMins(prevCoord, dest);
        }

        // 시간 배치: 이전 블록 종료 + 이동 시간
        if (i === fromIndex) {
            // 기준 블록은 baseTime 사용
            block.time = baseTime;
        } else {
            currentTime += block.travel_mins;
            block.time = minutesToTime(currentTime);
        }

        block.endTime = minutesToTime(timeToMinutes(block.time) + block.duration_mins);
        currentTime = timeToMinutes(block.endTime);

        if (block.factCard) {
            prevCoord = { lat: block.factCard.lat, lng: block.factCard.lng };
        }

        result[i] = block;
    }

    return result;
}

// ========================================================================================
// Main: Full Timeline Builder
// ========================================================================================

export interface BuildTimelineParams {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    routeData: any;                              // 카카오 내비 경로 데이터
    trackBFacts: FactCard[];                     // 가는 길 1위들
    trackAFacts: FactCard[];                     // 숙소 주변 1위들
    alternatives: Record<string, FactCard[]>;
    returnFacts: FactCard[];                     // 오는 길 (Track B 2위들)
    travelType: 'camping' | 'general';
    startDate: Date;
    endDate: Date;
    departureTime?: string;                      // 기본 "09:00"
}

export function buildFullTimeline(params: BuildTimelineParams): TimelineDay[] {
    const {
        origin, destination, routeData, trackBFacts, trackAFacts,
        alternatives, returnFacts, travelType, startDate, endDate,
        departureTime = '09:00'
    } = params;

    const nights = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
    const totalDays = nights + 1;
    const days: TimelineDay[] = [];
    const usedIds = new Set<string>();

    // 경로 데이터에서 roads 추출
    const roads: KakaoRoad[] = routeData?.sections?.[0]?.roads || [];

    // Track B 1위들의 ID를 used에 추가
    trackBFacts.forEach(f => usedIds.add(f.id));

    for (let d = 1; d <= totalDays; d++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + d - 1);
        const dateStr = date.toISOString().split('T')[0];
        const label = DAY_LABELS[d - 1] || `${d}째 날`;
        const blocks: TimelineBlock[] = [];

        if (d === 1) {
            // Day 1: 가는 길 (경로 진행률) + 도착 저녁 (시간대 슬롯)
            const routeBlocks = buildRouteBlocks(trackBFacts, roads, departureTime, d, origin, destination);
            blocks.push(...routeBlocks);

            if (travelType === 'general') {
                const eveningSlots = TIME_SLOTS.general.day1_evening;
                const eveningBlocks = buildSlotBlocks(eveningSlots, trackAFacts, alternatives, destination, d, usedIds);
                blocks.push(...eveningBlocks);
            }
            // 캠핑 모드: 저녁 슬롯 없음 (체류 카드로 대체)
        } else if (d === totalDays) {
            // 마지막 날: 오전 (시간대 슬롯) + 복귀 (경로 진행률 역방향)
            if (travelType === 'general') {
                const morningSlots = TIME_SLOTS.general.day3_morning;
                const morningBlocks = buildSlotBlocks(morningSlots, trackAFacts, alternatives, destination, d, usedIds);
                blocks.push(...morningBlocks);
            }

            // 복귀 출발 블록
            const returnDepartTime = travelType === 'general' ? '13:30' : '11:00';
            blocks.push({
                id: genId(), day: d, time: returnDepartTime, endTime: returnDepartTime,
                type: 'move', title: '숙소 출발 (귀가)', duration_mins: 0, travel_mins: 0,
                slotType: 'return_departure', status: 'upcoming',
            });

            // 귀갓길 (역방향 경로 진행률)
            if (returnFacts.length > 0) {
                const returnBlocks = buildRouteBlocks(returnFacts, roads, returnDepartTime, d, destination, origin);
                // 첫 블록(출발)은 이미 추가했으므로 제거
                blocks.push(...returnBlocks.slice(1));
            }
        } else {
            // 중간 Day: 종일 (시간대 슬롯)
            if (travelType === 'general') {
                const fullSlots = TIME_SLOTS.general.day2_full;
                const fullBlocks = buildSlotBlocks(fullSlots, trackAFacts, alternatives, destination, d, usedIds);
                blocks.push(...fullBlocks);

                // 숙소 복귀 블록
                blocks.push({
                    id: genId(), day: d, time: '19:30', endTime: '19:30',
                    type: 'rest', title: '숙소 복귀', duration_mins: 0, travel_mins: 10,
                    slotType: 'return_accom', status: 'upcoming',
                });
            }
            // 캠핑 모드: 종일 슬롯 없음
        }

        days.push({ day: d, date: dateStr, label, blocks });
    }

    return days;
}

/**
 * 캠핑 모드 체류 구간 카드 리스트 생성
 */
export function buildCampingCards(
    trackAFacts: FactCard[],
    alternatives: Record<string, FactCard[]>
): ProTimelinePlan['campingCards'] {
    const getCards = (cat: string): FactCard[] => {
        const primary = trackAFacts.filter(f => f.category === cat);
        const alts = alternatives[cat] || [];
        return [...primary, ...alts].slice(0, 10);
    };

    return {
        mart: getCards('MART'),
        spot: getCards('SPOT'),
        restaurant: getCards('RESTAURANT'),
        gas: getCards('GAS_STATION'),
    };
}
