import fs from 'fs';

async function exportFinalMissingList() {
    console.log('--- [Exporting Final Missing List] Dedicated File ---');

    // Read from the logic that generated the final audit
    const reportContent = fs.readFileSync('FINAL_PRESTIGE_AUDIT_REPORT.md', 'utf8');
    const lines = reportContent.split('\n');
    
    let md = '# [RAON.I] 최종 누락 프리스티지 명소 리스트 (247개)\n\n';
    md += `> [!NOTE]\n`;
    md += `> 2단계의 보강 작업과 핵심 지명 추출 로직을 모두 적용했음에도 최종 누락된 리스트입니다.\n`;
    md += `> 대부분 위치가 모호한 경치 묘사(사자성어)이거나 폐쇄된 장소들입니다.\n\n`;
    md += '| 티어 | 지역 | 명소 명칭 | 비고 |\n';
    md += '| :--- | :--- | :--- | :--- |\n';

    let capture = false;
    lines.forEach(line => {
        if (line.includes('## 3. 최종 누락 리스트')) {
            capture = true;
            return;
        }
        if (capture && line.startsWith('| Tier')) {
            md += line + '\n';
        }
    });

    fs.writeFileSync('final_missing_prestige_list.md', md);
    console.log('✅ Final missing list created: final_missing_prestige_list.md');
}

exportFinalMissingList().catch(console.error);
