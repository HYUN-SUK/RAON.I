import fs from 'fs';
import path from 'path';

const CACHE_PATH = path.join(process.cwd(), 'scratch', 'std_data_full.json');
const OUTPUT_PATH = path.join(process.cwd(), 'national_standard_api_list_v1.md');

function sanitizeName(name) {
    if (!name) return '';
    return name.replace(/\(.*\)/g, '').replace(/[一-龥]/g, '').trim();
}

try {
    const data = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const items = data.response.body.items || [];

    let output = '# [Source/API] 전국관광지정보표준데이터 추출 리스트 (v1.0)\n\n';
    output += `> 총 수집 데이터: ${items.length}건 (지방자치단체 지정 관광지/유원지)\n\n`;

    const regionMap = new Map();
    items.forEach(item => {
        const addr = item.lnmadr || item.rdnmadr || '기타';
        const parts = addr.split(' ');
        const prov = parts[0];
        const mun = parts[1] || '전체';
        const key = `${prov} > ${mun}`;
        
        if (!regionMap.has(key)) regionMap.set(key, []);
        regionMap.get(key).push({
            name: sanitizeName(item.trrsrtNm),
            type: item.trrsrtSe || '일반관광지',
            intro: item.trrsrtIntrcn || '-'
        });
    });

    const sortedKeys = Array.from(regionMap.keys()).sort();
    sortedKeys.forEach(key => {
        output += `## ${key}\n`;
        regionMap.get(key).forEach(l => {
            output += `- **${l.name}** (${l.type}): ${l.intro.substring(0, 50)}...\n`;
        });
        output += '\n';
    });

    fs.writeFileSync(OUTPUT_PATH, output);
    console.log(`✅ API List Generated: ${OUTPUT_PATH}`);
} catch (e) {
    console.error('❌ Error generating API list:', e.message);
}
