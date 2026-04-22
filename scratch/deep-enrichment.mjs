import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUFFIXES = ['낙조', '일출', '일몰', '야경', '8경', '10경', '사계', '출렁다리', '음악분수', '벚꽃길', '단풍', '설경', '조망', '풍경'];

function getBaseName(name) {
    let base = name;
    SUFFIXES.forEach(s => {
        base = base.replace(new RegExp(s, 'g'), '');
    });
    return base.trim();
}

function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/[^a-z0-9가-힣]/gi, '').toLowerCase();
}

async function deepEnrichment() {
    console.log('--- [Deep Enrichment] Extracting Base Names & Final Matching ---');

    const rawGaps = JSON.parse(fs.readFileSync('precise_audit_report_v3.json', 'utf8')).gaps;
    console.log(`🚀 Processing ${rawGaps.length} remaining gaps with base-name logic...`);

    let successCount = 0;
    const batch = [];

    for (let i = 0; i < rawGaps.length; i++) {
        const item = rawGaps[i];
        const baseName = getBaseName(item.name);
        
        // Skip too short names or pure idioms (length < 2 after cleaning)
        if (getCleanString(baseName).length < 2) continue;

        const query = `${item.sigungu} ${baseName}`;
        
        try {
            const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
                headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
            }).then(r => r.json());

            if (res.documents?.[0]) {
                const doc = res.documents[0];
                const addr = doc.road_address_name || doc.address_name;
                const id = uuidv5(`PRESTIGE_ENRICHMENT|${item.name}|${addr}`, MY_NAMESPACE);
                
                batch.push({
                    id,
                    api_source: 'PRESTIGE_ENRICHMENT',
                    category: 'SPOT',
                    name: item.name,
                    address: addr,
                    lat: parseFloat(doc.y),
                    lng: parseFloat(doc.x),
                    sido: doc.address_name.split(' ')[0],
                    sigungu: doc.address_name.split(' ')[1],
                    is_active: true,
                    is_protected: true,
                    trust_score: 80,
                    raw_data: { kakao_info: doc, tier: item.tier, base_name: baseName },
                    updated_at: new Date().toISOString()
                });
                successCount++;
            }
        } catch (e) {
            // ignore
        }

        if (batch.length >= 50) {
            await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
            batch.length = 0;
            await new Promise(r => setTimeout(r, 200));
        }

        if ((i + 1) % 50 === 0 || i === rawGaps.length - 1) {
            process.stdout.write(`\rProgress: ${i + 1}/${rawGaps.length} | Injected: ${successCount}`);
        }
    }

    if (batch.length > 0) {
        await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
    }

    console.log(`\n\n✨ Deep Enrichment Completed. Total ${successCount} items newly added.`);
}

deepEnrichment().catch(console.error);
