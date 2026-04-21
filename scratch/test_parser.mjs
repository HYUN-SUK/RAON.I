import fs from 'fs';
import path from 'path';

const HUD_LIST_PATH = 'C:/Users/USER/.gemini/antigravity/brain/2fdd6c5a-5c0c-4236-aa12-eba50a2ccf1d/korea_prestige_landmark_list_v2.md';

function parseHubList() {
    const content = fs.readFileSync(HUD_LIST_PATH, 'utf8');
    const sections = content.split('## ').filter(s => s.trim() && !s.startsWith('#'));
    const hubData = [];

    console.log(`Debug: Total ## sections found: ${sections.length}`);

    sections.forEach(section => {
        const lines = section.split('\n');
        const province = lines[0].trim();
        
        const subSections = section.split('### ').filter(s => s.trim() && s.trim() !== province);
        subSections.forEach(sub => {
            const subLines = sub.split('\n');
            const municipality = subLines[0].trim();
            const listLine = subLines.find(l => l.trim().startsWith('- '));
            if (listLine) {
                const names = listLine.replace('- ', '').split(', ').map(n => n.trim());
                hubData.push({ province, municipality, names });
            }
        });
    });
    return hubData;
}

const data = parseHubList();
console.log(`Debug: Total municipalities parsed: ${data.length}`);
if (data.length > 0) {
    console.log('Sample (Yesan):', data.find(d => d.municipality.includes('예산')));
    console.log('Sample (Asan):', data.find(d => d.municipality.includes('아산')));
}
