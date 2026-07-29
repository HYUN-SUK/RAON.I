import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

const MY_NAMESPACE = '6ba7b810-9ed0-11d1-80b4-00c04fd430c8';

function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/[^\w\u3131-\u318E\uAC00-\uD7A3]/g, '').toLowerCase();
}

function getNormalizedAddr(addr) {
    if (!addr) return '';
    return String(addr).trim();
}

const generateId = (source, name, addr) => {
    const normalizedAddr = getNormalizedAddr(addr);
    const cleanName = getCleanString(name);
    const cleanAddr = getCleanString(normalizedAddr);
    return uuidv5(`${source}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};

/**
 * [v12.1] KTO 가용 데이터 월(baseYm) 자동 검색 헬퍼
 * 공공데이터 시차(보통 1~2개월)를 고려하여 최신 데이터를 찾습니다.
 */
async function getLatestValidBaseYm() {
    const now = new Date();
    // 최근 4개월치 시도
    for (let i = 1; i <= 4; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyymm = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
        
        console.log(`🔍 Checking KTO availability for ${yyyymm}...`);
        const params = new URLSearchParams({
            serviceKey: PUBLIC_API_KEY,
            numOfRows: '1', pageNo: '1', MobileOS: 'ETC', MobileApp: 'RAONAI', _type: 'json',
            baseYm: yyyymm, areaCd: '1', signguCd: '110' // 서울 종로구 샘플
        });
        
        try {
            const res = await fetch(`https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`);
            const data = await res.json();
            if (data.response?.body?.totalCount > 0) {
                console.log(`✅ Found valid KTO data month: ${yyyymm}`);
                return yyyymm;
            }
        } catch (e) {}
    }
    return '202412'; // Fallback
}

    const KTO_AREA_MAP = {
        '서울': '1', '서울특별시': '1',
        '인천': '2', '인천광역시': '2',
        '대전': '3', '대전광역시': '3',
        '대구': '4', '대구광역시': '4',
        '광주': '5', '광주광역시': '5',
        '부산': '6', '부산광역시': '6',
        '울산': '7', '울산광역시': '7',
        '세종': '8', '세종특별자치시': '8',
        '경기': '31', '경기도': '31',
        '강원': '32', '강원도': '32', '강원특별자치도': '32',
        '충북': '33', '충청북도': '33',
        '충남': '34', '충청남도': '34',
        '전북': '35', '전라북도': '35', '전북특별자치도': '35',
        '전남': '36', '전라남도': '36',
        '경북': '37', '경상북도': '37',
        '경남': '38', '경상남도': '38',
        '제주': '39', '제주특별자치도': '39'
    };

    // 대도시 하위 행정구 전용 KTO 시군구 코드 매핑 (시 전체 0건 응답 방지)
    const KTO_SUB_DISTRICT_MAP = {
        '수원시': [{ sc: '1', name: '장안구' }, { sc: '2', name: '권선구' }, { sc: '3', name: '팔달구' }, { sc: '4', name: '영통구' }],
        '성남시': [{ sc: '2', name: '수정구' }, { sc: '3', name: '중원구' }, { sc: '4', name: '분당구' }],
        '안양시': [{ sc: '5', name: '만안구' }, { sc: '6', name: '동안구' }],
        '고양시': [{ sc: '8', name: '덕양구' }, { sc: '9', name: '일산동구' }, { sc: '10', name: '일산서구' }],
        '부천시': [{ sc: '11', name: '부천시' }],
        '안산시': [{ sc: '14', name: '상록구' }, { sc: '15', name: '단원구' }],
        '용인시': [{ sc: '23', name: '처인구' }, { sc: '24', name: '기흥구' }, { sc: '25', name: '수지구' }],
        '청주시': [{ sc: '11', name: '상당구' }, { sc: '12', name: '서원구' }, { sc: '13', name: '흥덕구' }, { sc: '14', name: '청원구' }],
        '천안시': [{ sc: '9', name: '동남구' }, { sc: '10', name: '서북구' }],
        '전주시': [{ sc: '10', name: '완산구' }, { sc: '11', name: '덕진구' }],
        '포항시': [{ sc: '20', name: '남구' }, { sc: '21', name: '북구' }],
        '창원시': [{ sc: '16', name: '의창구' }, { sc: '17', name: '성산구' }, { sc: '18', name: '마산합포구' }, { sc: '19', name: '마산회원구' }, { sc: '20', name: '진해구' }]
    };

async function fetchWithRetry(url, maxRetries = 3) {
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

async function syncKtoNationwideFinal() {
    console.log('🚀 [KTO Global Sync] Starting High-Integrity Nationwide Sync...');

    const validBaseYm = await getLatestValidBaseYm();
    console.log(`📅 Target Data Month: ${validBaseYm}`);

    // 1. Fetch valid KTO Region Pairs from master_places & smart_plan_facts (Case-insensitive)
    const { data: rawPairs } = await supabase
        .from('master_places')
        .select('sido, sigungu, raw_data')
        .not('raw_data', 'is', null)
        .limit(10000);

    const seen = new Set();
    const finalRegionMap = [];
    
    (rawPairs || []).forEach(r => {
        const sidoClean = (r.sido || '').trim();
        const sigunguClean = (r.sigungu || '').trim();
        const rd = r.raw_data || {};
        const ac = (rd.areaCode || rd.areacode) ? String(rd.areaCode || rd.areacode) : KTO_AREA_MAP[sidoClean];
        const sc = (rd.sigunguCode || rd.sigungucode) ? String(rd.sigunguCode || rd.sigungucode) : '';

        if (!sidoClean || !sigunguClean || !ac) return;

        const key = `${sidoClean}|${sigunguClean}`;
        if (seen.has(key)) return;
        seen.add(key);
        
        finalRegionMap.push({
            sido: sidoClean,
            sigungu: sigunguClean,
            areaCode: ac,
            sigunguCode: sc
        });
    });

    if (!finalRegionMap || finalRegionMap.length === 0) {
        console.error('❌ Critical: Failed to detect any KTO regions.');
        return;
    }

    console.log(`- Detected ${finalRegionMap.length} Unique KTO-standard Regions.`);

    let successCount = 0;
    for (const reg of finalRegionMap) {
        try {
            process.stdout.write(`- [${reg.sido} ${reg.sigungu}] Syncing... `);
            
            const subDists = KTO_SUB_DISTRICT_MAP[reg.sigungu] || [{ sc: reg.sigunguCode, name: reg.sigungu }];
            let items = [];

            for (const sub of subDists) {
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

                    const ktoPatch = {
                        kto_official: {
                            rank,
                            baseYm: validBaseYm,
                            updated_at: new Date().toISOString(),
                            source: 'KTO_NATIONWIDE_V12.1'
                        }
                    };

                    let matchedMpId = null;

                    // 1차 중복 방어: contentId 기반 매핑
                    if (contentId) {
                        const { data: mpByCid } = await supabase
                            .from('master_places')
                            .select('id, raw_data')
                            .filter('raw_data->>contentid', 'eq', contentId)
                            .limit(1);
                        if (mpByCid && mpByCid.length > 0) {
                            matchedMpId = mpByCid[0].id;
                        }
                    }

                    // 2차 중복 방어: cleanName + sido + sigungu 매핑
                    if (!matchedMpId && title) {
                        const { data: mpByName } = await supabase
                            .from('master_places')
                            .select('id, raw_data')
                            .eq('sido', reg.sido)
                            .eq('sigungu', reg.sigungu)
                            .eq('name', title)
                            .limit(1);
                        if (mpByName && mpByName.length > 0) {
                            matchedMpId = mpByName[0].id;
                        }
                    }

                    // 3차 중복 방어: deterministic UUID 매핑
                    const detId = generateId('TOUR_SPOT', title, addr);
                    if (!matchedMpId) {
                        const { data: mpByDet } = await supabase
                            .from('master_places')
                            .select('id, raw_data')
                            .eq('id', detId)
                            .maybeSingle();
                        if (mpByDet) matchedMpId = mpByDet.id;
                    }

                    if (matchedMpId) {
                        const { data: currentMp } = await supabase
                            .from('master_places')
                            .select('raw_data')
                            .eq('id', matchedMpId)
                            .maybeSingle();
                        
                        const mergedRaw = { ...(currentMp?.raw_data || {}), ...ktoPatch };
                        const { error: uErr } = await supabase
                            .from('master_places')
                            .update({ raw_data: mergedRaw })
                            .eq('id', matchedMpId);

                        const { data: spfMatches } = await supabase
                            .from('smart_plan_facts')
                            .select('id, raw_data')
                            .eq('name', title);
                        if (spfMatches && spfMatches.length > 0) {
                            for (const spf of spfMatches) {
                                const updatedSpfRaw = { ...(spf.raw_data || {}), ...ktoPatch };
                                await supabase
                                    .from('smart_plan_facts')
                                    .update({ raw_data: updatedSpfRaw })
                                    .eq('id', spf.id);
                            }
                        }
                        updatedCount++;
                    } else {
                        // 3단계 검증을 모두 통과한 100% 미존재 신규 명소: 풀 스키마 신규 추가 (INSERT)
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

                        const { error: insErr } = await supabase.from('master_places').upsert([newPlaceData], { onConflict: 'id' });

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
                console.log(`✅ ${updatedCount} updated, 🆕 ${insertedCount} newly inserted.`);
                successCount++;
            } else {
                console.log('⚠️ Empty.');
            }
        } catch (e) {
            console.log(`❌ Error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n🏁 [KTO Global Sync] Completed. Success: ${successCount}/${finalRegionMap.length}`);
}

syncKtoNationwideFinal().catch(console.error);
