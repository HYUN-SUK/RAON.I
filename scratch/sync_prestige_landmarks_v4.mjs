import fs from 'fs';
import path from 'path';

const BASE_PATH = 'C:/Users/USER/.gemini/antigravity/brain/2fdd6c5a-5c0c-4236-aa12-eba50a2ccf1d';
const HUD_LIST_PATH = path.join(BASE_PATH, 'korea_prestige_landmark_list_v2.md');
const STD_CACHE_PATH = path.join(process.cwd(), 'scratch', 'std_data_full.json');
const OUTPUT_PATH = path.join(process.cwd(), 'korea_prestige_landmark_master_v1.md');

// 지자체별 상위 도(Province) 강제 매핑 테이블
const munToProvMap = {
    '예산': '충청남도', '아산': '충청남도', '천안': '충청남도', '공주': '충청남도', '보령': '충청남도', '서산': '충청남도', '논산': '충청남도', '계룡': '충청남도', '당진': '충청남도', '금산': '충청남도', '부여': '충청남도', '서천': '충청남도', '청양': '충청남도', '홍성': '충청남도', '태안': '충청남도',
    '전주': '전라북도', '군산': '전라북도', '익산': '전라북도', '정읍': '전라북도', '남원': '전라북도', '김제': '전라북도', '완주': '전라북도', '진안': '전라북도', '무주': '전라북도', '장수': '전라북도', '임실': '전라북도', '순창': '전라북도', '고창': '전라북도', '부안': '전라북도',
    '포항': '경상북도', '경주': '경상북도', '김천': '경상북도', '안동': '경상북도', '구미': '경상북도', '영주': '경상북도', '영천': '경상북도', '상주': '경상북도', '문경': '경상북도', '경산': '경상북도', '군위': '경상북도', '의성': '경상북도', '청송': '경상북도', '영양': '경상북도', '영덕': '경상북도', '청도': '경상북도', '고령': '경상북도', '성주': '경상북도', '칠곡': '경상북도', '예천': '경상북도', '봉화': '경상북도', '울진': '경상북도', '울릉': '경상북도'
};

function normalizeRegion(name) {
    if (!name) return '';
    return name.replace(/특별시|광역시|특별자치시|특별자치도|도|시|군|구/g, '').trim();
}

function sanitizeName(name) {
    if (!name) return '';
    let clean = name.trim().replace(/\(.*\)/g, '');
    const suffixes = [' 관광지', ' 관광단지', ' 8경', ' 10경', ' 12경', ' 팔경', ' 일출', ' 낙조'];
    suffixes.forEach(s => { if (clean.endsWith(s)) clean = clean.substring(0, clean.length - s.length).trim(); });
    // 특별 케이스: 예당호
    if (clean === '예당') return '예당호';
    return clean;
}

async function sync() {
    console.log('🚀 Ultimate Syncing (v1.4) with Hard-coded Mapping...');
    const masterMap = new Map(); // Key: normalizedMun -> { prov, mun, landmarks: Map }

    // 1. Hub Data (Blog)
    const hubContent = fs.readFileSync(HUD_LIST_PATH, 'utf8');
    const sections = hubContent.split('## ').filter(s => s.trim() && !s.startsWith('#'));
    
    sections.forEach(sec => {
        const lines = sec.split('\n');
        const rawProv = lines[0].trim();
        const subs = sec.split('### ').filter(s => s.trim() && s.trim() !== rawProv);
        
        subs.forEach(sub => {
            const subLines = sub.split('\n');
            const rawMun = subLines[0].trim();
            const munKey = normalizeRegion(rawMun);
            
            const listLine = subLines.find(l => l.trim().startsWith('- '));
            if (listLine) {
                const names = listLine.replace('- ', '').split(', ').map(n => n.trim());
                if (!masterMap.has(munKey)) {
                    masterMap.set(munKey, { 
                        prov: munToProvMap[munKey] || rawProv, 
                        mun: rawMun, 
                        landmarks: new Map() 
                    });
                }
                const region = masterMap.get(munKey);
                names.forEach(n => {
                    const clean = sanitizeName(n);
                    if (clean.length > 1) region.landmarks.set(clean, { tier: 2, source: 'Blog' });
                });
            }
        });
    });

    // 2. STD Data (API)
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
                    region.landmarks.set(name, { tier: 3, source: 'API' });
                }
            } else if (munKey) {
                masterMap.set(munKey, {
                    prov: parts[0],
                    mun: parts[1],
                    landmarks: new Map([[name, { tier: 3, source: 'API' }]])
                });
            }
        });
    } catch (e) {}

    // 3. Final Output
    const sortedKeys = Array.from(masterMap.keys()).sort();
    let md = '# [Final] 전국 랜드마크 통합 마스터 (v1.4)\n\n';
    sortedKeys.forEach(k => {
        const r = masterMap.get(k);
        md += `## ${r.prov.replace(/특별시|광역시|특별자치시|특별자치도|도/g, '')} > ${r.mun}\n`;
        const items = Array.from(r.landmarks.entries()).sort((a,b) => a[1].tier - b[1].tier);
        items.forEach(([name, d]) => md += `- **${name}** (Tier ${d.tier}, Source: ${d.source})\n`);
        md += '\n';
    });

    fs.writeFileSync(OUTPUT_PATH, md);
    console.log('✅ Master Sync (v1.4) Complete.');
}

sync();
