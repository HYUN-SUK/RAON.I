import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PUBLIC_API_KEY) {
    console.error('❌ Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
function generateId(source, name, addr) {
    const rawStr = `${source}|${(name || '').trim().toLowerCase()}|${(addr || '').trim().toLowerCase()}`;
    return uuidv5(rawStr, NAMESPACE);
}

function uuidv5(name, namespace) {
    const nsBuffer = Buffer.from(namespace.replace(/-/g, ''), 'hex');
    const nameBuffer = Buffer.from(name, 'utf8');
    const hash = crypto.createHash('sha1').update(nsBuffer).update(nameBuffer).digest();

    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;

    const hex = hash.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// 🎯 미수집 13개 지역 핀포인트 전용 타겟 맵
const UNCOLLECTED_TARGETS = [
    { sido: '경기도', sigungu: '수원시', areaCode: '31', subDists: [{ sc: '1', name: '장안구' }, { sc: '2', name: '권선구' }, { sc: '3', name: '팔달구' }, { sc: '4', name: '영통구' }] },
    { sido: '경기도', sigungu: '고양시', areaCode: '31', subDists: [{ sc: '8', name: '덕양구' }, { sc: '9', name: '일산동구' }, { sc: '10', name: '일산서구' }] },
    { sido: '경기도', sigungu: '용인시', areaCode: '31', subDists: [{ sc: '23', name: '처인구' }, { sc: '24', name: '기흥구' }, { sc: '25', name: '수지구' }] },
    { sido: '경기도', sigungu: '성남시', areaCode: '31', subDists: [{ sc: '2', name: '수정구' }, { sc: '3', name: '중원구' }, { sc: '4', name: '분당구' }] },
    { sido: '경기도', sigungu: '부천시', areaCode: '31', subDists: [{ sc: '11', name: '부천시' }] },
    { sido: '경기도', sigungu: '안산시', areaCode: '31', subDists: [{ sc: '14', name: '상록구' }, { sc: '15', name: '단원구' }] },
    { sido: '경기도', sigungu: '안양시', areaCode: '31', subDists: [{ sc: '5', name: '만안구' }, { sc: '6', name: '동안구' }] },
    { sido: '충청남도', sigungu: '천안시', areaCode: '34', subDists: [{ sc: '9', name: '동남구' }, { sc: '10', name: '서북구' }] },
    { sido: '충청북도', sigungu: '청주시', areaCode: '33', subDists: [{ sc: '11', name: '상당구' }, { sc: '12', name: '서원구' }, { sc: '13', name: '흥덕구' }, { sc: '14', name: '청원구' }] },
    { sido: '전북특별자치도', sigungu: '전주시', areaCode: '35', subDists: [{ sc: '10', name: '완산구' }, { sc: '11', name: '덕진구' }] },
    { sido: '경상북도', sigungu: '포항시', areaCode: '37', subDists: [{ sc: '20', name: '남구' }, { sc: '21', name: '북구' }] },
    { sido: '경상남도', sigungu: '창원시', areaCode: '38', subDists: [{ sc: '16', name: '의창구' }, { sc: '17', name: '성산구' }, { sc: '18', name: '마산합포구' }, { sc: '19', name: '마산회원구' }, { sc: '20', name: '진해구' }] },
    { sido: '경상남도', sigungu: '고성군', areaCode: '38', subDists: [{ sc: '2', name: '고성군' }] }
];

async function fetchWithRetry(url, maxRetries = 3) {
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Referer': 'https://www.data.go.kr/'
                }
            });
            if (res.ok) return res;
        } catch (e) {}
        attempt++;
        await new Promise(r => setTimeout(r, 300 * attempt));
    }
    return fetch(url);
}

async function syncUncollectedOnly() {
    console.log('🎯 [KTO Pinpoint Sync] Starting Uncollected 13 Regions Targeted Sync...');

    let totalUpdated = 0;
    let totalInserted = 0;

    for (const reg of UNCOLLECTED_TARGETS) {
        try {
            process.stdout.write(`- [${reg.sido} ${reg.sigungu}] Pinpoint Syncing... `);

            let items = [];
            for (const sub of reg.subDists) {
                const params = new URLSearchParams({
                    serviceKey: PUBLIC_API_KEY,
                    numOfRows: '100', pageNo: '1', MobileOS: 'ETC', MobileApp: 'RAONAI', _type: 'json',
                    areaCode: reg.areaCode,
                    sigunguCode: sub.sc,
                    contentTypeId: '12'
                });

                const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?${params.toString()}`;
                const res = await fetchWithRetry(url);
                const data = await res.json();
                const subItems = data.response?.body?.items?.item || [];
                items = items.concat(subItems);
            }

            if (items.length > 0) {
                let updatedCount = 0;
                let insertedCount = 0;

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const contentId = String(item.contentId || item.contentid || '');
                    const title = (item.title || item.name || '').trim();
                    const addr = item.addr1 || item.address || '';
                    const rank = i + 1;
                    const mapx = parseFloat(item.mapx || item.lng || 0);
                    const mapy = parseFloat(item.mapy || item.lat || 0);

                    const ktoPatch = { kto_official: { rank, baseYm: '202412', updated_at: new Date().toISOString(), source: 'KTO_PINPOINT_SYNC' } };

                    let matchedMpId = null;

                    // 1차 중복 방어: contentId
                    if (contentId) {
                        const { data: mpByCid } = await supabase
                            .from('master_places')
                            .select('id')
                            .filter('raw_data->>contentid', 'eq', contentId)
                            .limit(1);
                        if (mpByCid && mpByCid.length > 0) matchedMpId = mpByCid[0].id;
                    }

                    // 2차 중복 방어: title + sido
                    if (!matchedMpId && title) {
                        const { data: mpByName } = await supabase
                            .from('master_places')
                            .select('id')
                            .eq('sido', reg.sido)
                            .eq('name', title)
                            .limit(1);
                        if (mpByName && mpByName.length > 0) matchedMpId = mpByName[0].id;
                    }

                    // 3차 중복 방어: deterministic UUIDv5
                    const detId = generateId('TOUR_SPOT', title, addr);
                    if (!matchedMpId) {
                        const { data: mpByDet } = await supabase
                            .from('master_places')
                            .select('id')
                            .eq('id', detId)
                            .limit(1);
                        if (mpByDet && mpByDet.length > 0) matchedMpId = mpByDet[0].id;
                    }

                    if (matchedMpId) {
                        const { data: currentMp } = await supabase.from('master_places').select('raw_data').eq('id', matchedMpId).single();
                        const mergedRaw = { ...(currentMp?.raw_data || {}), ...ktoPatch };
                        await supabase.from('master_places').update({ raw_data: mergedRaw }).eq('id', matchedMpId);

                        const { data: spfMatches } = await supabase.from('smart_plan_facts').select('id, raw_data').eq('name', title);
                        if (spfMatches && spfMatches.length > 0) {
                            for (const spf of spfMatches) {
                                const updatedSpfRaw = { ...(spf.raw_data || {}), ...ktoPatch };
                                await supabase.from('smart_plan_facts').update({ raw_data: updatedSpfRaw }).eq('id', spf.id);
                            }
                        }
                        updatedCount++;
                    } else {
                        // 미존재 신규 명소 풀 스키마 신규 적재 (INSERT)
                        const newPlaceData = {
                            id: detId,
                            name: title,
                            category: 'SPOT',
                            sido: reg.sido,
                            sigungu: reg.sigungu,
                            address: addr,
                            lat: mapy,
                            lng: mapx,
                            api_source: 'KTO_OFFICIAL_NEW',
                            is_active: true,
                            trust_score: 85,
                            raw_data: {
                                contentid: contentId,
                                firstimage: item.firstimage || item.firstimage2 || '',
                                tel: item.tel || '',
                                cat1: item.cat1 || '', cat2: item.cat2 || '', cat3: item.cat3 || '',
                                badges: ['KTO 공식 인기 명소'],
                                ...ktoPatch
                            }
                        };
                        await supabase.from('master_places').upsert([newPlaceData], { onConflict: 'id' });

                        const newFactData = {
                            name: title,
                            category: 'SPOT',
                            sido: reg.sido,
                            sigungu: reg.sigungu,
                            address: addr,
                            lat: mapy,
                            lng: mapx,
                            api_source: 'KTO_OFFICIAL_NEW',
                            raw_data: newPlaceData.raw_data
                        };
                        await supabase.from('smart_plan_facts').upsert([newFactData], { onConflict: 'name,sido,sigungu' });
                        insertedCount++;
                    }
                }
                totalUpdated += updatedCount;
                totalInserted += insertedCount;
                console.log(`✅ ${updatedCount} updated, 🆕 ${insertedCount} newly inserted.`);
            } else {
                console.log('⚠️ Empty.');
            }
        } catch (e) {
            console.log(`❌ Error: ${e.message}`);
        }
    }

    console.log(`\n🏁 [KTO Pinpoint Sync] Completed! Total Updated: ${totalUpdated}, Total Newly Inserted: ${totalInserted}`);
}

syncUncollectedOnly();
