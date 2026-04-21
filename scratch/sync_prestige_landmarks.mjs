import fs from 'fs';
import path from 'path';

const PUBLIC_DATA_API_KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';
const API_URL = 'http://api.data.go.kr/openapi/tn_pubr_public_trrsrt_api';

const BASE_PATH = 'C:/Users/USER/.gemini/antigravity/brain/2fdd6c5a-5c0c-4236-aa12-eba50a2ccf1d';
const HUD_LIST_PATH = path.join(BASE_PATH, 'korea_prestige_landmark_list_v2.md');
const OUTPUT_PATH = path.join(BASE_PATH, 'korea_prestige_landmark_master_v1.md');

// 수식어 제거 및 정제 함수 (v2.1 개선판)
const suffixes = [
    '의 일출', '의 낙조', '의 설경', '의 야경', '의 운해', '의 아침', '의 저녁', '의 봄', '의 가을', '의 사계',
    ' 일출', ' 낙조', ' 설경', ' 야경', ' 운해', ' 단풍', ' 기암', ' 폭포', ' 정경', ' 풍경', ' 해돋이', ' 저녁달',
    ' 석양', ' 일몰', ' 물안개', ' 새벽종소리', ' 고기잡이 불빛', ' 돗단배', ' 기러기 떼', ' 낚시', ' 벚꽃', ' 억새',
    ' 아침 안개', ' 저녁 종소리', ' 야영', ' 캠핑', ' 관광지', ' 관광단지'
];

function sanitizeName(name) {
    if (!name) return '';
    let clean = name.trim();
    clean = clean.replace(/\(.*\)/g, '');
    suffixes.forEach(s => {
        if (clean.endsWith(s)) clean = clean.substring(0, clean.length - s.length);
    });
    return clean.replace(/[一-龥]/g, '').trim();
}

async function fetchAllStandardData() {
    console.log('🚀 Loading National Standard Tourism Data from Local Cache...');
    const localCachePath = path.join(process.cwd(), 'scratch', 'std_data_full.json');
    
    try {
        if (!fs.existsSync(localCachePath)) {
            throw new Error(`Cache file not found at ${localCachePath}`);
        }
        const data = JSON.parse(fs.readFileSync(localCachePath, 'utf8'));
        const items = data.response.body.items || [];
        console.log(`📦 Loaded ${items.length} items from cache.`);
        return items;
    } catch (e) {
        console.error('❌ Data Access Error:', e.message);
        return [];
    }
}

function parseHubList() {
    if (!fs.existsSync(HUD_LIST_PATH)) return {};
    const content = fs.readFileSync(HUD_LIST_PATH, 'utf8');
    const sections = content.split('## ');
    const hubData = {};

    sections.forEach(section => {
        const lines = section.split('\n');
        const province = lines[0].trim();
        if (!province || province.startsWith('#')) return;

        hubData[province] = hubData[province] || {};
        const subSections = section.split('### ');
        subSections.forEach(sub => {
            const subLines = sub.split('\n');
            const municipality = subLines[0].trim();
            if (!municipality || municipality === province) return;
            
            const listStr = subLines.find(l => l.startsWith('- '));
            if (listStr) {
                const names = listStr.replace('- ', '').split(', ').map(n => n.trim());
                hubData[province][municipality] = names;
            }
        });
    });
    return hubData;
}

async function startSync() {
    const hubData = parseHubList();
    const stdItems = await fetchAllStandardData();

    // 지역별 마스터 Map 생성
    const masterMap = new Map();

    // 1. Hub 데이터 주입 (Tier 2 위주)
    for (const prov in hubData) {
        for (const mun in hubData[prov]) {
            const key = `${prov}|${mun}`;
            if (!masterMap.has(key)) masterMap.set(key, new Set());
            hubData[prov][mun].forEach(name => masterMap.get(key).add({ name, tier: 2, source: 'Hub(Blog)' }));
        }
    }

    // 2. STD API 데이터 필터링 및 주입 (Tier 3 위주)
    stdItems.forEach(item => {
        const name = sanitizeName(item.trrsrtNm);
        const intro = item.trrsrtIntrcn || '';
        const address = item.lnmadr || item.rdnmadr || '';
        
        let tier = 0;
        let reason = '';

        if (name.includes('8경') || name.includes('10경') || intro.includes('8경') || intro.includes('10경')) {
            tier = 2; // 공식 n경 명시됨
            reason = 'STD(n-Scenery)';
        } else if (item.trrsrtSe === '유원지' || name.includes('유원지')) {
            tier = 3;
            reason = 'STD(Amusement)';
        } else if (item.trrsrtSe === '관광지' || item.trrsrtSe === '관광단지') {
            tier = 3;
            reason = 'STD(Official)';
        }

        if (tier > 0) {
            // 주소에서 도/시 필터링 (최소 단위 매칭)
            const addrParts = address.split(' ');
            const prov = addrParts[0] || '기타';
            const mun = addrParts[1] || '전체';
            const key = `${prov}|${mun}`;
            
            if (!masterMap.has(key)) masterMap.set(key, new Set());
            // 기존 Hub 데이터와 이름이 유사하면 병합 (Skip 중복)
            const exists = Array.from(masterMap.get(key)).some(ex => ex.name === name);
            if (!exists) {
                masterMap.get(key).add({ name, tier, source: reason });
            }
        }
    });

    // 3. 최종 리포트 파일 생성
    let output = '# [Final Master] 전국 250개 시군구 대표 명소 통합 마스터 (v1.0)\n\n';
    output += `> 수집 결과: 총 ${masterMap.size}개 지역의 랜드마크 데이터 확보 완료\n\n`;

    const sortedEntries = Array.from(masterMap.entries()).sort();
    sortedEntries.forEach(([key, landmarks]) => {
        const [prov, mun] = key.split('|');
        output += `## ${prov} > ${mun}\n`;
        const sortedLandmarks = Array.from(landmarks).sort((a,b) => a.tier - b.tier);
        sortedLandmarks.forEach(l => {
            output += `- **${l.name}** (Tier ${l.tier}, Source: ${l.source})\n`;
        });
        output += '\n';
    });

    fs.writeFileSync(OUTPUT_PATH, output);
    console.log(`✅ Master List Sync Complete! Saved to: ${OUTPUT_PATH}`);
}

startSync();
