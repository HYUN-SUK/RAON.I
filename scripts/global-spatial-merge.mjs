import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getDist(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const f1 = lat1 * Math.PI/180;
    const f2 = lat2 * Math.PI/180;
    const df = (lat2-lat1) * Math.PI/180;
    const dl = (lng2-lng1) * Math.PI/180;
    const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function cleanName(s) {
    if (!s) return '';
    return s.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s/g, '')
            .replace(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|특별자치도|특별자치시|특별시|광역시|제주)/, '')
            .replace(/^(예산군|홍성군|서산시|보령시|청양군|당진시|천안시|아산시|공주시|논산시|계룡시|금산군|부여군|서천군|태안군)/, '')
            .replace(/명소|여행지|관광지|여행|투어/g, '');
}

async function globalSpatialMerge() {
    console.log('📡 Loading all SPOT records for global spatial merge...');
    let allData = [];
    let from = 0;
    let size = 1000;
    while(true) {
        const { data, error } = await supabase.from('master_places').select('*').eq('category', 'SPOT').range(from, from + size - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...data);
        if (data.length < size) break;
        from += size;
    }
    console.log(`✅ Loaded ${allData.length} records.`);

    const processed = new Set();
    const winners = [];
    const losers = [];

    for (let i = 0; i < allData.length; i++) {
        if (processed.has(allData[i].id)) continue;

        let group = [allData[i]];
        for (let j = i + 1; j < allData.length; j++) {
            if (processed.has(allData[j].id)) continue;

            const dist = getDist(allData[i].lat, allData[i].lng, allData[j].lat, allData[j].lng);
            const n1 = cleanName(allData[i].name);
            const n2 = cleanName(allData[j].name);

            // Similarity check: Distance < 500m AND Name match
            if (dist < 500 && (n1.includes(n2) || n2.includes(n1) || n1 === n2)) {
                group.push(allData[j]);
                processed.add(allData[j].id);
            }
        }

        if (group.length > 1) {
            // Pick Winner: Priority to those with Tier, then higher Trust Score
            group.sort((a, b) => {
                const aTier = a.raw_data?.tier || 99;
                const bTier = b.raw_data?.tier || 99;
                if (aTier !== bTier) return aTier - bTier;
                return (b.trust_score || 0) - (a.trust_score || 0);
            });

            const winner = { ...group[0] };
            const others = group.slice(1);

            // Merge raw_data (Capture all tiers and kakao_ids)
            others.forEach(o => {
                if (o.raw_data?.tier && (!winner.raw_data?.tier || o.raw_data.tier < winner.raw_data.tier)) {
                    winner.raw_data.tier = o.raw_data.tier;
                }
                if (o.raw_data?.kakao_id && !winner.raw_data?.kakao_id) {
                    winner.raw_data.kakao_id = o.raw_data.kakao_id;
                }
                losers.push(o.id);
            });

            winners.push(winner);
            processed.add(allData[i].id);
        }
    }

    console.log(`🚀 Found ${winners.length} duplicate groups. Merging and Deleting ${losers.length} records...`);

    if (winners.length > 0) {
        for (let i = 0; i < winners.length; i += 50) {
            const chunk = winners.slice(i, i + 50);
            const { error } = await supabase.from('master_places').upsert(chunk);
            if (error) console.error('Upsert Error:', error.message);
        }
    }

    if (losers.length > 0) {
        for (let i = 0; i < losers.length; i += 100) {
            const chunk = losers.slice(i, i + 100);
            const { error } = await supabase.from('master_places').delete().in('id', chunk);
            if (error) console.error('Delete Error:', error.message);
        }
    }

    console.log('✨ Global Spatial Merge Complete!');
}

globalSpatialMerge();
