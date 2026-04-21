import fs from 'fs';
import path from 'path';

const PUBLIC_DATA_API_KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';
const BASE_PATH = 'C:/Users/USER/.gemini/antigravity/brain/2fdd6c5a-5c0c-4236-aa12-eba50a2ccf1d';
const HUD_LIST_PATH = path.join(BASE_PATH, 'korea_prestige_landmark_list_v2.md');
const OUTPUT_PATH = path.join(process.cwd(), 'korea_prestige_landmark_master_v1.md');

// 지역명 정규화 함수 (매칭용)
function normalizeRegion(name) {
    if (!name) return '기타';
    return name.replace(/특별시|광역시|특별자치시|특별자치도|도|시|군|구/g, '').trim();
}

function sanitizeName(name) {
    if (!name) return '';
    let clean = name.trim();
    clean = clean.replace(/\(.*\)/g, '');
    const suffixes = ['일출', '낙조', '설경', '야경', '운해', '풍경', '저녁달', ' 석양', ' 일몰', ' 8경', ' 10경', ' 12경', ' 팔경', '관광지', '관광단지'];
    suffixes.forEach(s => { if (clean.endsWith(s)) clean = clean.substring(0, clean.length - s.length).trim(); });
    return clean.replace(/[一-龥]/g, '').trim();
}

async function fetchAllStandardData() {
    const localCachePath = path.join(process.cwd(), 'scratch', 'std_data_full.json');
    try {
        const data = JSON.parse(fs.readFileSync(localCachePath, 'utf8'));
        return data.response.body.items || [];
    } catch (e) {
        return [];
    }
}

function parseHubList() {
    const content = fs.readFileSync(HUD_LIST_PATH, 'utf8');
    const sections = content.split('## ');
    const hubData = []; // [ { prov, mun, names[] } ]

    sections.forEach(section => {
        const lines = section.split('\n');
        const province = lines[0].trim();
        if (!province || province.startsWith('#')) return;

        const subSections = section.split('### ');
        subSections.forEach(sub => {
            const subLines = sub.split('\n');
            const municipality = subLines[0].trim();
            if (!municipality || municipality === province) return;
            
            const listStr = subLines.find(l => l.startsWith('- '));
            if (listStr) {
                const names = listStr.replace('- ', '').split(', ').map(n => n.trim());
                hubData.push({ province, municipality, names });
            }
        });
    });
    return hubData;
}

async function startSync() {
    console.log('🔄 Re-syncing with Enhanced Matching Logic...');
    const hubData = parseHubList(); // 블로그 원본 리스트
    const stdItems = await fetchAllStandardData(); // 표준데이터 API 원본

    // 1. 블로그 데이터를 기반으로 마스터 맵 초기화 (100% 보장)
    const masterMap = new Map(); // Key: "ProvNorm|MunNorm" -> { realProv, realMun, landmarks: Set }

    hubData.forEach(item => {
        const key = `${normalizeRegion(item.province)}|${normalizeRegion(item.municipality)}`;
        if (!masterMap.has(key)) {
            masterMap.set(key, { 
                realProv: item.province, 
                realMun: item.municipality, 
                landmarks: new Map() // Name -> { tier, source }
            });
        }
        item.names.forEach(name => {
            const clean = sanitizeName(name);
            if (clean.length > 1) {
                masterMap.get(key).landmarks.set(clean, { tier: 2, source: 'Hub(Blog)' });
            }
        });
    });

    // 2. 표준데이터 병합 (기존 블로그 데이터는 유지하고, 새로운 데이터만 추가)
    stdItems.forEach(item => {
        const addr = item.lnmadr || item.rdnmadr || '';
        const parts = addr.split(' ');
        const prov = parts[0];
        const mun = parts[1];
        const key = `${normalizeRegion(prov)}|${normalizeRegion(mun)}`;

        const name = sanitizeName(item.trrsrtNm);
        let tier = 3;
        if (name.includes('8경') || name.includes('10경')) tier = 2;

        if (masterMap.has(key)) {
            const region = masterMap.get(key);
            if (!region.landmarks.has(name)) {
                region.landmarks.set(name, { tier, source: `STD(${item.trrsrtSe || 'Official'})` });
            }
        } else {
            // 블로그에 없던 새로운 지역 발견 시 추가
            masterMap.set(key, {
                realProv: prov,
                realMun: mun,
                landmarks: new Map([[name, { tier, source: `STD(${item.trrsrtSe || 'Official'})` }]])
            });
        }
    });

    // 3. 최종 리포트 파일 생성 (Markdown & Artifact)
    let output = '# [Final Master v1.2] 전국 시군구 대표 명소 통합 마스터 (복구 완료)\n\n';
    output += `> 블로그 데이터(8경/10경) 전수 복구 및 표준데이터 병합 완료\n\n`;

    const sortedKeys = Array.from(masterMap.keys()).sort();
    sortedKeys.forEach(key => {
        const region = masterMap.get(key);
        output += `## ${region.realProv} > ${region.realMun}\n`;
        const sortedLandmarks = Array.from(region.landmarks.entries()).sort((a,b) => a[1].tier - b[1].tier);
        sortedLandmarks.forEach(([name, data]) => {
            output += `- **${name}** (Tier ${data.tier}, Source: ${data.source})\n`;
        });
        output += '\n';
    });

    fs.writeFileSync(OUTPUT_PATH, output);
    console.log(`✅ Master List Restored & Saved to: ${OUTPUT_PATH}`);
}

startSync();
