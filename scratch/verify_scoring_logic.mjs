
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. PRESTIGE_MAP 로드 로직 (caching-smart-plan.mjs 복사)
let PRESTIGE_MAP = new Map();
const getCleanString = (str) => {
    if (!str) return '';
    let s = String(str);
    if (s.includes(':')) s = s.split(':').pop();
    return s.replace(/\*\*.*?\*\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9가-힣]/gi, '').toLowerCase().trim();
};

function loadPrestigeLists() {
    const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');
    
    let currentSido = '', currentSigungu = '';
    t1.split('\n').forEach(line => {
        const sidoMatch = line.match(/^## \d+\. (.+?) /);
        if (sidoMatch) currentSido = sidoMatch[1];
        const sigunguMatch = line.match(/^### (.+?) \(/);
        if (sigunguMatch) currentSigungu = sigunguMatch[1];
        if (line.startsWith('- ')) {
            const names = [line.replace('- ', '').split('(')[0].trim()];
            names.forEach(n => {
                const key = getCleanString(n) + '|' + (currentSigungu || currentSido).replace(/[시군구]$/, '');
                PRESTIGE_MAP.set(key, 1);
            });
        }
    });

    let t2Sigungu = '';
    t2.split('\n').forEach(line => {
        const h3Match = line.match(/^### (.+?)(?:\s+\(|$)/);
        const listMatch = line.match(/^- \*\*(.+?)(?:\(.+?\))?:\*\*\s+(.+)$/);
        if (h3Match) {
            t2Sigungu = h3Match[1].trim().replace(/[시군구]$/, '');
        } else if (listMatch) {
            const sigungu = listMatch[1].trim().replace(/[시군구]$/, '');
            const names = listMatch[2].split(',').map(n => n.trim()).filter(n => n);
            names.forEach(n => {
                const key = getCleanString(n) + '|' + sigungu;
                PRESTIGE_MAP.set(key, 2);
            });
        } else if (line.startsWith('- ') && t2Sigungu) {
            const names = line.replace('- ', '').split(',').map(n => n.trim()).filter(n => n);
            names.forEach(n => {
                const key = getCleanString(n) + '|' + t2Sigungu;
                PRESTIGE_MAP.set(key, 2);
            });
        }
    });
}

async function simulateScoring() {
    loadPrestigeLists();
    
    // 2. DB에서 봉수산자연휴양림 데이터 추출
    const { data: spot } = await supabase
        .from('master_places')
        .select('*')
        .ilike('name', '%봉수산자연휴양림%')
        .limit(1)
        .single();

    if (!spot) {
        console.error("❌ 봉수산자연휴양림 데이터를 찾을 수 없습니다.");
        return;
    }

    console.log(`\n--- [실제 데이터 기반 시뮬레이션: ${spot.name}] ---`);
    
    // 3. 인기도 엔진 v2.6 로직 실행
    let prestigeScore = 15; // Base
    const cleanName = getCleanString(spot.name);
    const normSigungu = (spot.sigungu || '예산군').replace(/[시군구]$/, '');
    const matchKey = `${cleanName}|${normSigungu}`;
    const dynamicTier = PRESTIGE_MAP.get(matchKey);
    const dbTier = spot.raw_data?.prestige_tier; 
    const tier = dbTier || dynamicTier;

    if (tier === 1) prestigeScore = 100;
    else if (tier === 2) prestigeScore = 80;

    console.log(`1. 명성 컴포넌트(Prestige): ${prestigeScore} (Tier: ${tier || 'None'})`);

    // Popularity Component (Mocking combinedPop based on typical values if raw_data is sparse)
    // 실제 코드에서는 주변 pool의 TMAP 순위를 계산하지만, 여기서는 raw_data 내의 지표를 우선 확인
    let ktoScore = 10;
    const ktoRank = spot.raw_data?.kto_official?.rank;
    if (ktoRank && ktoRank <= 100) {
        ktoScore = 100 * (1 - (ktoRank - 1) / 100);
    } else {
        ktoScore = 75; // Fallback estimate for high-rank spot in pool
    }

    let tmapScore = 65; // Fallback estimate
    let ktScore = spot.raw_data?.kt_concentration || 55;

    const combinedPop = (ktoScore * 0.6) + (tmapScore * 0.2) + (ktScore * 0.2);
    console.log(`2. 인기도 컴포넌트(Popularity): ${combinedPop.toFixed(2)} (KTO:${ktoScore}, TMAP:${tmapScore}, KT:${ktScore})`);

    // 4. Confidence Multiplier
    const hasRel = (spot.raw_data?.tmap_related?.length > 0) ? 0.4 : 0;
    const hasConc = (spot.raw_data?.kt_concentration > 0) ? 0.3 : 0;
    const hasPrestige = tier ? 0.3 : 0;
    const confMultiplier = 0.80 + (0.20 * (hasRel + hasConc + hasPrestige));
    console.log(`3. 신뢰도 보정 계수(Confidence): ${confMultiplier.toFixed(2)} (Rel:${hasRel}, Conc:${hasConc}, Pres:${hasPrestige})`);

    // 5. 품질 점수(Quality Score / trust_score) 합성
    // caching-smart-plan.mjs 634행: const qualityScore = (prestigeScore * 0.6) + (combinedPop * 0.4);
    const qualityScore = (prestigeScore * 0.6) + (combinedPop * 0.4);
    const finalTrustScore = Math.round(qualityScore * confMultiplier);
    
    console.log(`\n[결과]`);
    console.log(`- 가공 전 품질 점수: ${qualityScore.toFixed(2)}`);
    console.log(`- 보정 후 최종 품질 점수(trust_score): ${finalTrustScore}`);
    console.log(`\n--- 시뮬레이션 종료 ---\n`);
}

simulateScoring();
