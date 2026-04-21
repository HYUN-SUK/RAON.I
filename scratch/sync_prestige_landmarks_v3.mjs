import fs from 'fs';
import path from 'path';

const BASE_PATH = 'C:/Users/USER/.gemini/antigravity/brain/2fdd6c5a-5c0c-4236-aa12-eba50a2ccf1d';
const HUD_LIST_PATH = path.join(BASE_PATH, 'korea_prestige_landmark_list_v2.md');
const STD_CACHE_PATH = path.join(process.cwd(), 'scratch', 'std_data_full.json');
const OUTPUT_PATH = path.join(process.cwd(), 'korea_prestige_landmark_master_v1.md');

// 도 단위 매핑 (유연한 지역 인식)
const provMap = {
    '충남': '충청남도', '충북': '충청북도', '전남': '전라남도', '전북': '전라북도',
    '경남': '경상남도', '경북': '경상북도', '강원': '강원특별자치도', '경기': '경기도',
    '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시',
    '광주': '광주광역시', '대전': '대전광역시', '울산': '울산광역시', '세종': '세종특별자치시', '제주': '제주특별자치도'
};

function normalizeRegion(name) {
    if (!name) return '';
    let clean = name.trim().replace(/특별시|광역시|특별자치시|특별자치도|도|시|군|구/g, '');
    for (const [alias, full] of Object.entries(provMap)) {
        if (name.includes(alias)) return full.replace(/특별시|광역시|특별자치시|특별자치도|도/g, '');
    }
    return clean;
}

function sanitizeName(name) {
    if (!name) return '';
    let clean = name.trim().replace(/\(.*\)/g, '');
    // 핵심 명사가 아닌 정형화된 접미사만 제거
    const suffixes = [' 관광지', ' 관광단지', ' 8경', ' 10경', ' 12경', ' 팔경', ' 일출', ' 낙조'];
    suffixes.forEach(s => { if (clean.endsWith(s)) clean = clean.substring(0, clean.length - s.length).trim(); });
    return clean;
}

async function sync() {
    console.log('🚀 Final Syncing (v1.3) with Strict Data Retention...');
    
    // 1. Hub Data Parsing
    const hubContent = fs.readFileSync(HUD_LIST_PATH, 'utf8');
    const sections = hubContent.split('## ').filter(s => s.trim() && !s.startsWith('#'));
    const masterMap = new Map(); // Key: normalizedMun -> { realProv, realMun, landmarks: Map }

    sections.forEach(sec => {
        const lines = sec.split('\n');
        const rawProv = lines[0].trim();
        const subs = sec.split('### ').filter(s => s.trim() && s.trim() !== rawProv);
        
        subs.forEach(sub => {
            const subLines = sub.split('\n');
            const rawMun = subLines[0].trim();
            const listLine = subLines.find(l => l.trim().startsWith('- '));
            if (listLine) {
                const names = listLine.replace('- ', '').split(', ').map(n => n.trim());
                
                // 지역 매칭 키 생성
                const munKey = normalizeRegion(rawMun);
                if (!masterMap.has(munKey)) {
                    // 상위 도 정보 유추 (Source에서 유실된 경우 보정)
                    const normalizedProv = provMap[rawProv] || provMap[rawProv.substring(0,2)] || '기타';
                    masterMap.set(munKey, { prov: normalizedProv, mun: rawMun, landmarks: new Map() });
                }
                const region = masterMap.get(munKey);
                // 기존 보정 (예산/아산이 도 섹션으로 들어간 오류 해결)
                if (region.prov === '기타' && (rawMun === '예산' || rawMun === '아산')) region.prov = '충청남도';

                names.forEach(n => {
                    const clean = sanitizeName(n);
                    if (clean.length > 1) region.landmarks.set(clean, { tier: 2, source: 'Hub(Blog)' });
                });
            }
        });
    });

    // 2. STD Data Merging (Add missing ones)
    try {
        const stdData = JSON.parse(fs.readFileSync(STD_CACHE_PATH, 'utf8'));
        const items = stdData.response.body.items || [];
        items.forEach(item => {
            const addr = item.lnmadr || item.rdnmadr || '';
            const parts = addr.split(' ');
            const munKey = normalizeRegion(parts[1]);
            const name = sanitizeName(item.trrsrtNm);
            
            if (masterMap.has(munKey)) {
                const region = masterMap.get(munKey);
                if (!region.landmarks.has(name)) {
                    region.landmarks.set(name, { tier: 3, source: `STD(${item.trrsrtSe || 'Official'})` });
                }
            } else if (munKey) {
                masterMap.set(munKey, { 
                    prov: parts[0] || '기타', 
                    mun: parts[1] || '기타', 
                    landmarks: new Map([[name, { tier: 3, source: `STD(${item.trrsrtSe || 'Official'})` }]])
                });
            }
        });
    } catch (e) {}

    // 3. Output Generation
    let output = '# [Final Master v1.3] 전국 랜드마크 통합 데이터\n\n';
    const sortedKeys = Array.from(masterMap.keys()).sort();
    
    sortedKeys.forEach(key => {
        const r = masterMap.get(key);
        output += `## ${r.prov}${r.mun.includes(r.prov) ? '' : ' > ' + r.mun}\n`;
        const items = Array.from(r.landmarks.entries()).sort((a,b) => a[1].tier - b[1].tier);
        items.forEach(([name, d]) => {
            output += `- **${name}** (Tier ${d.tier}, Source: ${d.source})\n`;
        });
        output += '\n';
    });

    fs.writeFileSync(OUTPUT_PATH, output);
    console.log(`✅ Success! Master File Re-generated.`);
    
    // Debug output for confirmation
    const yesan = masterMap.get('예산');
    if (yesan) console.log(`DEBUG_YESAN_COUNT: ${yesan.landmarks.size}`);
}

sync();
