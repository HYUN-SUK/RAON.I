import fs from 'fs';

async function generateSpotSimulationFile() {
    console.log('--- [Generating SPOT Simulation File] ---');

    if (!fs.existsSync('spot_final_audit.md')) {
        console.error('File not found: spot_final_audit.md');
        return;
    }

    const fullAudit = fs.readFileSync('spot_final_audit.md', 'utf8');
    const lines = fullAudit.split('\n');

    let md = '# [RAON.I] 명소(SPOT) 카테고리 최종 시뮬레이션 리스트 (2026-04-25 예산군)\n\n';
    md += `> [!IMPORTANT]\n`;
    md += `> **명성 점수(Prestige Score) 연동 완료**: DB의 prestige_tier 표식을 직접 읽어 점수를 부여합니다.\n`;
    md += `> **중복 제거 완료**: 동일한 명칭의 장소는 최고 점수 1개만 표시합니다.\n\n`;

    // 1. Extract Section 1 (Raw Candidates)
    md += '## 1. 1차 쿼터: DB 수집 명소 후보군 (중복 제거 전)\n';
    md += '| 번호 | 이름 | 주소 | 거리(m) | 비고 |\n';
    md += '| :--- | :--- | :--- | :---: | :--- |\n';
    
    let capture1 = false;
    let s1Count = 0;
    lines.forEach(line => {
        if (line.includes('## [SECTION 1]')) capture1 = true;
        if (line.includes('## [SECTION 2]')) capture1 = false;
        
        if (capture1 && line.includes('| SPOT |')) {
            const parts = line.split('|').map(p => p.trim());
            md += `| ${++s1Count} | ${parts[3]} | ${parts[5]} | ${parts[6]} | - |\n`;
        }
    });

    md += '\n---\n\n';

    // 2. Extract Section 2 (Final Selection with Deduplication)
    md += '## 2. 2차 쿼터: 최종 하이브리드 리스트 (중복 제거 & 명성 점수 반영)\n';
    md += '| 순위 | 이름 | 최종점수 | **명성점수** | 인기점수 | 거리(km) | 상태 |\n';
    md += '| :--- | :--- | :---: | :---: | :---: | :---: | :--- |\n';

    let capture2 = false;
    let s2Count = 0;
    const seenNames = new Set();
    
    lines.forEach(line => {
        if (line.includes('## [SECTION 2]')) capture2 = true;
        if (capture2 && line.includes('| SPOT |')) {
            const parts = line.split('|').map(p => p.trim());
            // Expected columns: | 번호 | 카테고리 | 이름 | 최종 점수 | 명성 점수 | 품질 점수 | 거리(km) | 주소 |
            const name = parts[3];
            const finalScore = parts[4];
            const prestigeScore = parts[5];
            const popScore = parts[6];
            const distKm = parts[7];

            if (!seenNames.has(name)) {
                md += `| ${++s2Count} | ${name} | **${finalScore}** | ${prestigeScore} | ${popScore} | ${distKm} | ${s2Count <= 20 ? '✅선발' : '탈락'} |\n`;
                seenNames.add(name);
            }
        }
    });

    fs.writeFileSync('SPOT_FULL_SIMULATION_LIST.md', md);
    console.log('✅ SPOT simulation file updated: SPOT_FULL_SIMULATION_LIST.md');
}

generateSpotSimulationFile().catch(console.error);
