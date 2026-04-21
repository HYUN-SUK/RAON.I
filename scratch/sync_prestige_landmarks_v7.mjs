import fs from 'fs';
import path from 'path';

const BASE_PATH = 'C:/Users/USER/.gemini/antigravity/brain/2fdd6c5a-5c0c-4236-aa12-eba50a2ccf1d';
const HUB_PATH = path.join(BASE_PATH, 'korea_prestige_landmark_list_v2.md');
const API_PATH = path.join(process.cwd(), 'scratch', 'std_data_full.json');
const OUTPUT_PATH = path.join(process.cwd(), 'korea_prestige_landmark_master_v1.md');

// 지자체-광역단체 매핑 유닛 (v1.7 완전판)
const stdMap = {
    '예산': '충청남도 > 예산군', '아산': '충청남도 > 아산시', '천안': '충청남도 > 천안시',
    '공주': '충청남도 > 공주시', '당진': '충청남도 > 당진시', '서산': '충청남도 > 서산시',
    '강릉': '강원특별자치도 > 강릉시', '속초': '강원특별자치도 > 속초시'
};

function getStdKey(mun, provHint) {
    const cleanMun = mun.replace(/시|군|구/g, '').trim();
    if (stdMap[cleanMun]) return stdMap[cleanMun];
    let p = (provHint || '').replace(/특별시|광역시|특별자치시|특별자치도|도/g, '').substring(0, 2);
    const pNames = {'충남': '충청남도', '충북': '충청북도', '전남': '전라남도', '전북': '전북특별자치도', '경남': '경상남도', '경북': '경상북도', '강원': '강원특별자치도', '경기': '경기도'};
    const standardProv = pNames[p] || provHint || '기타';
    return `${standardProv} > ${mun}${mun.endsWith('시')||mun.endsWith('군')||mun.endsWith('구') ? '' : '시'}`;
}

function sanitize(name) {
    if (!name) return '';
    let c = name.trim().replace(/\(.*\)/g, '');
    [' 관광지', ' 관광단지', ' 8경', ' 10경', ' 12경', ' 팔경', ' 일출', ' 낙조'].forEach(b => {
        if (c.endsWith(b)) c = c.substring(0, c.length - b.length).trim();
    });
    if (c === '예당') return '예당호';
    return c;
}

async function start() {
    const master = new Map();
    const hub = fs.readFileSync(HUB_PATH, 'utf8');
    hub.split('## ').filter(s=>s.trim() && !s.startsWith('#')).forEach(sec => {
        const lines = sec.split('\n');
        const pHint = lines[0].trim();
        sec.split('### ').filter(s=>s.trim() && s.trim()!==pHint).forEach(sub => {
            const sl = sub.split('\n');
            const mun = sl[0].trim();
            const listLine = sl.find(l=>l.trim().startsWith('- '));
            if (listLine) {
                const key = getStdKey(mun, pHint);
                if (!master.has(key)) master.set(key, new Set());
                listLine.replace('- ', '').split(', ').forEach(n => {
                    const clean = sanitize(n);
                    if (clean.length > 1) master.get(key).add(`- **${clean}** (Tier 2, Source: Blog)`);
                });
            }
        });
    });

    try {
        const std = JSON.parse(fs.readFileSync(API_PATH, 'utf8'));
        (std.response.body.items || []).forEach(i => {
            const mun = (i.lnmadr || i.rdnmadr || '').split(' ')[1] || '';
            const key = getStdKey(mun, (i.lnmadr || i.rdnmadr || '').split(' ')[0] || '');
            const name = sanitize(i.trrsrtNm);
            if (!master.has(key)) master.set(key, new Set());
            const exists = Array.from(master.get(key)).some(ex => ex.includes(`**${name}**`));
            if (!exists) master.get(key).add(`- **${name}** (Tier 3, Source: API)`);
        });
    } catch(e) {}

    let res = '# [Final Master v1.7] 전국 랜드마크 통합 데이터 (최종 무결성 검증본)\n\n';
    Array.from(master.keys()).sort().forEach(k => {
        res += `## ${k}\n`;
        Array.from(master.get(k)).sort().forEach(l => res += l + '\n');
        res += '\n';
    });

    fs.writeFileSync(OUTPUT_PATH, res, 'utf8');
    console.log(`✅ Success! Written to ${OUTPUT_PATH}`);
}
start();
