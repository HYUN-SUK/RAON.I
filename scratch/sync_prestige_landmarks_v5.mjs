import fs from 'fs';
import path from 'path';

const BASE_PATH = 'C:/Users/USER/.gemini/antigravity/brain/2fdd6c5a-5c0c-4236-aa12-eba50a2ccf1d';
const HUB_LIST_PATH = path.join(BASE_PATH, 'korea_prestige_landmark_list_v2.md');
const STD_CACHE_PATH = path.join(process.cwd(), 'scratch', 'std_data_full.json');
const OUTPUT_PATH = path.join(process.cwd(), 'korea_prestige_landmark_master_v1.md');

const provMap = {
    '충남': '충청남도', '충북': '충청북도', '전남': '전라남도', '전북': '전라북도',
    '경남': '경상남도', '경북': '경상북도', '강원': '강원특별자치도', '경기': '경기도',
    '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시',
    '광주': '광주광역시', '대전': '대전광역시', '울산': '울산광역시', '세종': '세종특별자치시', '제주': '제주특별자치도'
};

function getProv(name) {
    if (!name) return '기초';
    for (const [key, full] of Object.entries(provMap)) {
        if (name.includes(key)) return full;
    }
    return name;
}

function normalizeMun(name) {
    if (!name) return '';
    return name.replace(/시|군|구/g, '').trim();
}

function sanitize(name) {
    if (!name) return '';
    let c = name.trim().replace(/\(.*\)/g, '');
    const bad = [' 관광지', ' 관광단지', ' 8경', ' 10경', ' 12경', ' 팔경', ' 일출', ' 낙조'];
    bad.forEach(b => { if (c.endsWith(b)) c = c.substring(0, c.length - b.length).trim(); });
    // 특별 수정: 예당 -> 예당호
    if (c === '예당') return '예당호';
    return c;
}

async function start() {
    const master = new Map(); // "Prov > Mun" -> Set()

    // 1. Hub
    const hub = fs.readFileSync(HUB_LIST_PATH, 'utf8');
    const sections = hub.split('## ').filter(s => s.trim() && !s.startsWith('#'));
    sections.forEach(sec => {
        const lines = sec.split('\n');
        const rawP = lines[0].trim();
        const subs = sec.split('### ').filter(s => s.trim() && s.trim() !== rawP);
        subs.forEach(sub => {
            const sl = sub.split('\n');
            const rawM = sl[0].trim();
            const list = sl.find(l => l.trim().startsWith('- '));
            if (list) {
                const names = list.replace('- ', '').split(', ').map(n => n.trim());
                const p = getProv(rawP);
                const m = rawM;
                const key = `${p} > ${m}`;
                if (!master.has(key)) master.set(key, new Set());
                names.forEach(n => {
                    const clean = sanitize(n);
                    if (clean.length > 1) master.get(key).add(`- **${clean}** (Tier 2, Source: Blog)`);
                });
            }
        });
    });

    // 2. API
    try {
        const std = JSON.parse(fs.readFileSync(STD_CACHE_PATH, 'utf8'));
        const items = std.response.body.items || [];
        items.forEach(i => {
            const addr = i.lnmadr || i.rdnmadr || '';
            const parts = addr.split(' ');
            const p = getProv(parts[0]);
            const m = parts[1] || '';
            const name = sanitize(i.trrsrtNm);
            
            // 매칭 시도 (정규화된 이름으로 찾기)
            let foundKey = Array.from(master.keys()).find(k => k.includes(p) && k.includes(normalizeMun(m)));
            if (!foundKey) foundKey = `${p} > ${m}`;
            
            if (!master.has(foundKey)) master.set(foundKey, new Set());
            const hasExisting = Array.from(master.get(foundKey)).some(ex => ex.includes(`**${name}**`));
            if (!hasExisting) {
                master.get(foundKey).add(`- **${name}** (Tier 3, Source: API)`);
            }
        });
    } catch (e) {}

    // 3. Final Render
    let out = '# [Final Master v1.5] 전국 랜드마크 통합 데이터\n\n';
    const sortedKeys = Array.from(master.keys()).sort();
    sortedKeys.forEach(k => {
        out += `## ${k}\n`;
        const lines = Array.from(master.get(k)).sort();
        lines.forEach(l => out += l + '\n');
        out += '\n';
    });

    fs.writeFileSync(OUTPUT_PATH, out);
    console.log('✅ Success v1.5');
}
start();
