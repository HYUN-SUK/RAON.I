import fs from 'fs';
import path from 'path';

// 1. 데이터 로드
const dbSpots = JSON.parse(fs.readFileSync('scratch/db_spot_list.json', 'utf-8'));
const t1Content = fs.readFileSync('korea_tourism_100_official.md', 'utf-8');
const t2Content = fs.readFileSync('regional_8_sceneries_pure_list.md', 'utf-8');
const t3Content = fs.readFileSync('korea_tourist_spots_standard_v1.md', 'utf-8');

// 2. 정규화 도구
function normalize(name) {
    if (!name) return "";
    return name.replace(/\s+/g, '')                  // 공백 제거
               .replace(/\(.*\)/g, '')               // 괄호 및 내용 제거
               .replace(/[^\w\s가-힣]/g, '');         // 특수문자 제거
}

// 3. 티어별 데이터 파싱
function parseT1(content) {
    const lines = content.split('\n');
    const items = [];
    lines.forEach(line => {
        if (line.startsWith('- ')) {
            const raw = line.replace('- ', '').trim();
            // "5대 고궁 (경복궁, ...)" 과 같은 복합 항목 처리
            if (raw.includes('(') && raw.includes(',')) {
                const nestedMatch = raw.match(/\((.*)\)/);
                if (nestedMatch) {
                    nestedMatch[1].split(',').forEach(s => items.push(s.trim()));
                }
            } else {
                items.push(raw.split('(')[0].trim());
            }
        }
    });
    return [...new Set(items.filter(i => i.length > 1))];
}

function parseT2(content) {
    const lines = content.split('\n');
    const items = [];
    lines.forEach(line => {
        if (line.startsWith('- ')) {
            const parts = line.replace('- ', '').split(',');
            parts.forEach(p => items.push(p.trim()));
        }
    });
    return [...new Set(items.filter(i => i.length > 1))];
}

// 4. 분석 실행
const t1List = parseT1(t1Content);
const t2List = parseT2(t2Content);
const t3List = parseT2(t3Content); // T3도 리스트 형식이므로 T2와 동일 파서 사용

const dbNormalizedMap = dbSpots.map(s => ({
    original: s,
    norm: normalize(s.name)
}));

function calculateMatch(nameList, tierLabel) {
    let matched = 0;
    const missing = [];
    
    nameList.forEach(name => {
        const normName = normalize(name);
        const find = dbNormalizedMap.find(db => db.norm === normName || db.norm.includes(normName) || normName.includes(db.norm));
        
        if (find) {
            matched++;
        } else {
            missing.append ? null : missing.push(name);
        }
    });
    
    return {
        tier: tierLabel,
        total: nameList.length,
        matched: matched,
        rate: ((matched / nameList.length) * 100).toFixed(2),
        missing: missing.slice(0, 20) // 상위 20개만 샘플링
    };
}

const report = [
    calculateMatch(t1List, "Tier 1 (100선)"),
    calculateMatch(t2List, "Tier 2 (지역 8경)"),
    calculateMatch(t3List, "Tier 3 (표준 데이터)")
];

// 5. 보고서 출력
let reportMd = `# 📊 마스터 DB vs 랜드마크 티어 매칭 분석 보고서\n\n`;
reportMd += `> **기준 마스터 DB 건수**: 12,753건\n\n`;

report.forEach(res => {
    reportMd += `## ${res.tier}\n`;
    reportMd += `- **대상 건수**: ${res.total}건\n`;
    reportMd += `- **매칭 성공**: ${res.matched}건\n`;
    reportMd += `- **매칭률**: **${res.rate}%**\n\n`;
    
    if (res.missing.length > 0) {
        reportMd += `### 누락 샘플 (일부)\n`;
        reportMd += res.missing.map(m => `- ${m}`).join('\n') + "\n\n";
    }
});

fs.writeFileSync('matching_report.md', reportMd);
console.log("분석 완료! matching_report.md 파일을 확인하세요.");
