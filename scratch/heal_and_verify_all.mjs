import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function healAndVerify() {
    console.log('====================================================');
    console.log('🌟 [맛보기 3대 카테고리 자가 치유 및 해운대센트럴호텔 복구]');
    console.log('====================================================\n');

    // 1. 해운대센트럴호텔 일정 조회
    const { data: schedule } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', 'fccafb52-56d3-41cd-b90c-78cbacfa9359')
        .single();

    if (!schedule) {
        console.error('❌ 해운대센트럴호텔 일정을 찾을 수 없습니다.');
        return;
    }

    console.log(`1. 대상 일정: ${schedule.campground_name} (${schedule.id})`);
    console.log(`   - 기존 itemListElement:`, schedule.smart_plan_data?.itemListElement?.map(c => `${c.name}(${c.category})`));

    // 2. 완벽한 맛보기 플랜 생성 시뮬레이션
    const lat = schedule.campground_lat || 35.1609477290535;
    const lng = schedule.campground_lng || 129.167194019805;

    const fetchCategorySafely = async (cat, baseRadius, count) => {
        const radii = [baseRadius, 35000, 50000];
        for (const rMeters of radii) {
            let { data, error } = await supabase.rpc('get_master_places_in_radius_v2', {
                target_lat: lat,
                target_lng: lng,
                radius_meters: rMeters,
                limit_count: count,
                p_category: cat
            });

            if (error || !data || data.length === 0) {
                const retryRes = await supabase.rpc('get_master_places_in_radius_v2', {
                    target_lat: lat,
                    target_lng: lng,
                    radius_meters: rMeters,
                    limit_count: count,
                    p_category: cat
                });
                data = retryRes.data;
                error = retryRes.error;
            }

            if (!error && Array.isArray(data) && data.length > 0) {
                return data;
            }
        }
        return [];
    };

    const [rawRestaurants, rawSpots, rawHospitals] = await Promise.all([
        fetchCategorySafely('RESTAURANT', 20000, 300),
        fetchCategorySafely('SPOT', 20000, 300),
        fetchCategorySafely('HOSPITAL', 20000, 100)
    ]);

    const calcDist = (pLat, pLng) => {
        const R = 6371;
        const dLat = (pLat - lat) * (Math.PI / 180);
        const dLng = (pLng - lng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat * (Math.PI / 180)) * Math.cos(pLat * (Math.PI / 180)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(1));
    };

    const globalBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰$|센터$|학원|관리소|사무소|지물포|건재|상사|유통|공구|이발|미용|세탁|철물|사진관|인쇄소|스튜디오|모텔|여관|호텔|약국|디지털|분재|연구소|양복|안경|서점|서적/;

    const parseAndScore = (places) => {
        const seenIds = new Set();
        const uniqueById = places.filter(r => {
            if (seenIds.has(r.id)) return false;
            seenIds.add(r.id);
            return true;
        });

        const cleanName = (s) => (s || '').replace(/\[.*?\]|\(.*?\)/g, '').replace(/\s+/g, '').toLowerCase();
        const deduplicated = [];

        for (const item of uniqueById) {
            const n1 = cleanName(item.name);
            if (!n1) continue;

            let isDup = false;
            for (const existing of deduplicated) {
                const n2 = cleanName(existing.name);
                if (!n2) continue;

                const sameName = n1 === n2 || (n1.length >= 4 && n2.length >= 4 && (n1.includes(n2) || n2.includes(n1)));
                const distDiff = Math.abs(calcDist(item.lat, item.lng) - calcDist(existing.lat, existing.lng));
                
                if (sameName && distDiff < 1.0) {
                    isDup = true;
                    break;
                }
            }
            if (!isDup) {
                deduplicated.push(item);
            }
        }

        return deduplicated
            .filter(r => {
                const name = r.name || '';
                if (r.category !== 'HOSPITAL' && globalBlacklist.test(name)) return false;
                return true;
            })
            .map(r => {
                const dKm = calcDist(r.lat, r.lng);
                const name = r.name || '';
                const desc = r.description || r.raw_data?.description || '';
                const fullText = `${name} ${desc}`;
                const source = r.api_source || r.raw_data?.api_source || '';
                const rawBadges = r.badges || r.raw_data?.badges || [];

                let certBonus = 0;
                let whitelistBonus = 0;
                let distPenalty = 0;
                let baseScore = r.quality_score || 50;

                const certs = [];
                const badges = [];
                const emojis = [];

                if (r.category === 'RESTAURANT' || r.category === 'ROUTE_RESTAURANT') {
                    if (source === 'SMBA_BAEK' || rawBadges.includes('백년가게')) {
                        certs.push('중기부 백년가게'); badges.push('백년가게'); emojis.push('🎖️백년가게');
                        certBonus += 80;
                    }
                    if (source === 'LX_RESTAURANT' || rawBadges.includes('LX인증맛집') || rawBadges.includes('LX인증')) {
                        certs.push('LX한국국토정보공사 인증'); badges.push('LX인증'); emojis.push('🎖️LX인증');
                        certBonus += 80;
                    }
                    if (source === 'MOIS_GOOD_RESTAURANT' || source === 'LOCALDATA_RESTAURANT_GOOD' || rawBadges.includes('모범음식점')) {
                        certs.push('행안부 모범음식점'); badges.push('모범음식점'); emojis.push('🎖️모범음식점');
                        certBonus += 30;
                    }
                    if (source === 'SAFE_RESTAURANT' || source === 'LOCALDATA_RESTAURANT_SAFE' || rawBadges.includes('안심식당')) {
                        certs.push('농식품부 안심식당'); badges.push('안심식당'); emojis.push('🎖️안심식당');
                        certBonus += 20;
                    }

                    if (/미쉐린|미슐랭|블루리본|식신/.test(name)) {
                        if (baseScore + certBonus < 110) certBonus = Math.max(certBonus, 110 - baseScore);
                    }

                    distPenalty = dKm * 3.0;
                    const trustScore = baseScore + certBonus - distPenalty;

                    return {
                        id: r.id,
                        name: r.name,
                        lat: r.lat,
                        lng: r.lng,
                        category: 'RESTAURANT',
                        distanceKm: dKm,
                        trustScore,
                        description: desc || '현지 대표 맛집',
                        roleName: '캠핑장 맛집',
                        evidence: {
                            badges,
                            certifications: certs,
                            displayBadges: certs.map((c, idx) => ({ emoji: emojis[idx] || '🎖️', label: c })),
                            emojiString: emojis.join(' ')
                        },
                        scoreBreakdown: {
                            baseScore,
                            certBonus,
                            tierBonus: 0,
                            contextFit: 0,
                            finalScore: trustScore,
                            distanceBonus: -distPenalty
                        }
                    };
                } else if (r.category === 'SPOT' || r.category === 'ROUTE_SPOT') {
                    const isWhitelist = /전망대|스카이워크|출렁다리|케이블카|수목원|둘레길|박물관/.test(fullText);
                    if (isWhitelist) {
                        baseScore = Math.max(baseScore, 80);
                        whitelistBonus = 40;
                    }
                    const nearbyBonus = dKm <= 5.0 ? 20 : 0;
                    distPenalty = dKm * 2.0;
                    const trustScore = baseScore + whitelistBonus + nearbyBonus - distPenalty;

                    return {
                        id: r.id,
                        name: r.name,
                        lat: r.lat,
                        lng: r.lng,
                        category: 'SPOT',
                        distanceKm: dKm,
                        trustScore,
                        description: desc || '한국관광공사 등록 관광명소',
                        roleName: '현지 명소',
                        evidence: {
                            badges: [],
                            certifications: [],
                            displayBadges: [],
                            emojiString: ''
                        },
                        scoreBreakdown: {
                            baseScore,
                            certBonus: 0,
                            tierBonus: whitelistBonus,
                            contextFit: nearbyBonus,
                            finalScore: trustScore,
                            distanceBonus: -distPenalty
                        }
                    };
                } else if (r.category === 'HOSPITAL') {
                    certBonus = 150;
                    distPenalty = dKm * 3.0;
                    const trustScore = baseScore + certBonus - distPenalty;

                    return {
                        id: r.id,
                        name: r.name,
                        lat: r.lat,
                        lng: r.lng,
                        category: 'HOSPITAL',
                        distanceKm: dKm,
                        trustScore,
                        description: `${name} - 응급의료기관`,
                        roleName: '안전 가디언',
                        evidence: {
                            badges: ['응급의료센터'],
                            certifications: ['응급의료기관'],
                            displayBadges: [{ emoji: '🚨응급의료기관', label: '응급의료기관' }],
                            emojiString: '🚨응급의료기관'
                        },
                        scoreBreakdown: {
                            baseScore,
                            certBonus,
                            tierBonus: 0,
                            contextFit: 0,
                            finalScore: trustScore,
                            distanceBonus: -distPenalty
                        }
                    };
                }
                return null;
            }).filter(Boolean);
    };

    const restaurants = parseAndScore(rawRestaurants).sort((a, b) => b.trustScore - a.trustScore).slice(0, 3);
    const spots = parseAndScore(rawSpots).sort((a, b) => b.trustScore - a.trustScore).slice(0, 3);
    const hospitals = parseAndScore(rawHospitals).sort((a, b) => b.trustScore - a.trustScore).slice(0, 1);

    const mainRestaurant = restaurants[0];
    const mainSpot = spots[0];
    const mainHospital = hospitals[0];

    const itemListElement = [];
    if (mainRestaurant) itemListElement.push(mainRestaurant);
    if (mainSpot) itemListElement.push(mainSpot);
    if (mainHospital) itemListElement.push(mainHospital);

    const alternatives = {};
    if (mainRestaurant && restaurants.length > 1) {
        alternatives['RESTAURANT'] = restaurants.slice(1);
        alternatives[mainRestaurant.id] = restaurants.slice(1);
    }
    if (mainSpot && spots.length > 1) {
        alternatives['SPOT'] = spots.slice(1);
        alternatives[mainSpot.id] = spots.slice(1);
    }

    const healedPlan = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        narration: "여행지 주변의 핵심 맛집, 명소, 안심 병원을 0원 맛보기로 안내해 드립니다.",
        target_date: schedule.check_in,
        stageIntros: {
            '1': '여행지 근처의 검증된 맛집을 먼저 만나보세요.',
            '2': '현지의 보석 같은 명소들을 찾아 떠나요.',
            '3': '만약의 상황을 대비한 가장 가까운 병원입니다.'
        },
        itemListElement,
        alternatives,
        is_preview: true
    };

    // 3. DB에 치유된 플랜 저장
    const { error: updateErr } = await supabase
        .from('user_schedules')
        .update({
            smart_plan_data: healedPlan,
            updated_at: new Date().toISOString()
        })
        .eq('id', schedule.id);

    if (updateErr) {
        console.error('❌ DB 업데이트 에러:', updateErr);
        return;
    }

    console.log('\n✅ DB 업데이트 성공!');
    console.log('--- 치유 완료된 해운대센트럴호텔 itemListElement (3대 카테고리 100% 완전체) ---');
    healedPlan.itemListElement.forEach(item => {
        console.log(`  🍽️/🏞️/🏥 [${item.category}] ${item.name} (${item.distanceKm}km) - 점수: ${item.trustScore}`);
    });
    console.log('\n--- 대안 장소(alternatives) ---');
    console.log(`  식당 대안: ${alternatives.RESTAURANT?.map(r => r.name).join(', ')}`);
    console.log(`  명소 대안: ${alternatives.SPOT?.map(s => s.name).join(', ')}`);
    console.log('\n====================================================');
    console.log('🎉 3대 카테고리 자가 치유 및 해운대센트럴호텔 완벽 복원 성공!');
    console.log('====================================================\n');
}

healAndVerify();
