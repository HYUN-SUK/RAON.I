import fs from 'fs';

const content = fs.readFileSync('regional_8_sceneries_pure_list.md', 'utf-8');
const sections = content.split('### ');
const gapDistricts = [];

sections.slice(1).forEach(s => {
    const lines = s.split('\n');
    const district = lines[0].trim();
    const itemsLine = lines.find(l => l.startsWith('- '));
    const items = itemsLine ? itemsLine.replace('- ', '').split(',').filter(x => x.trim().length > 1) : [];
    
    if (items.length < 8) {
        gapDistricts.push({
            name: district,
            count: items.length,
            items: items
        });
    }
});

console.log(`=== Tier 2 데이터 부족 지역 분석 결과 ===`);
console.log(`전체 섹션 수: ${sections.length - 1}`);
console.log(`보강 필요 지역(8개 미만): ${gapDistricts.length}곳`);
console.log(`----------------------------------------`);

gapDistricts.sort((a, b) => a.count - b.count).forEach(d => {
    console.log(`- ${d.name}: ${d.count}개 (${d.items.join(', ')})`);
});
