import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// SOP v11.3 Standardization
function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase();
}

const landmarkList = [
    { name: '예당호 출렁다리', sigungu: '예산군', tier: 2 },
    { name: '수덕사', sigungu: '예산군', tier: 2 },
    { name: '충의사', sigungu: '예산군', tier: 2 },
    { name: '추사고택', sigungu: '예산군', tier: 2 },
    { name: '임존성', sigungu: '예산군', tier: 2 },
    { name: '예당평야', sigungu: '예산군', tier: 2 },
    { name: '가야산', sigungu: '예산군', tier: 2 },
    { name: '덕산온천', sigungu: '예산군', tier: 2 },
    { name: '황새공원', sigungu: '예산군', tier: 2 },
    { name: '봉수산자연휴양림', sigungu: '예산군', tier: 2 },
    { name: '홍주읍성', sigungu: '홍성군', tier: 2 },
    { name: '남당항', sigungu: '홍성군', tier: 2 },
    { name: '용봉산', sigungu: '홍성군', tier: 2 },
    { name: '오서산', sigungu: '홍성군', tier: 2 },
    { name: '죽도', sigungu: '홍성군', tier: 2 },
    { name: '김좌진장군 생가지', sigungu: '홍성군', tier: 2 },
    { name: '한용운선사 생가지', sigungu: '홍성군', tier: 2 },
    { name: '궁리포구', sigungu: '홍성군', tier: 2 },
    { name: '그림같은수목원', sigungu: '홍성군', tier: 2 },
    { name: '이응노의 집', sigungu: '홍성군', tier: 2 },
    { name: '홍성전통시장', sigungu: '홍성군', tier: 2 },
    { name: '만해한용운공원', sigungu: '홍성군', tier: 2 }
];

async function matchAnalysis() {
    console.log('--- [Natural Matching Analysis] Prestige Landmarks vs Master DB ---');
    console.log(`Target: 예산군, 홍성군 (${landmarkList.length} items)\n`);

    const results = [];
    
    for (const item of landmarkList) {
        // Search by name and sigungu
        const { data, error } = await supabase
            .from('master_places')
            .select('id, name, address, api_source, is_protected, raw_data')
            .ilike('name', `%${item.name}%`)
            .eq('sigungu', item.sigungu);

        if (error) {
            console.error(`Error matching ${item.name}:`, error);
            continue;
        }

        if (data && data.length > 0) {
            // Found existing match
            results.push({
                landmark: item.name,
                status: 'MATCHED',
                matches: data.map(m => ({
                    id: m.id,
                    name: m.name,
                    source: m.api_source,
                    protected: m.is_protected,
                    currentTier: m.raw_data?.tier || m.raw_data?.prestige?.tier || 'NONE'
                }))
            });
        } else {
            // Not found
            results.push({
                landmark: item.name,
                status: 'MISSING',
                matches: []
            });
        }
    }

    // Report
    console.log(`| 순번 | 랜드마크 명칭 | 시군구 | 매칭 상태 | 기존 소스 | 보호 여부 | 현재 티어 |`);
    console.log(`| :--- | :--- | :--- | :--- | :--- | :---: | :---: |`);
    
    results.forEach((r, idx) => {
        const sigungu = landmarkList[idx].sigungu;
        if (r.status === 'MATCHED') {
            const m = r.matches[0]; // Take first match for summary
            console.log(`| ${idx + 1} | ${r.landmark} | ${sigungu} | ✅ 매칭됨 | ${m.source} | ${m.protected ? 'Y' : 'N'} | ${m.currentTier} |`);
        } else {
            console.log(`| ${idx + 1} | ${r.landmark} | ${sigungu} | ❌ 누락됨 | - | - | - |`);
        }
    });

    const matchedCount = results.filter(r => r.status === 'MATCHED').length;
    const missingCount = results.filter(r => r.status === 'MISSING').length;
    console.log(`\n--- Summary ---`);
    console.log(`- Matched: ${matchedCount}`);
    console.log(`- Missing: ${missingCount}`);
}

matchAnalysis().catch(console.error);
