import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function enrichGaps() {
    console.log('--- [Prestige Enrichment] Fetching Coordinates for Gaps ---');
    
    if (!fs.existsSync('prestige_gaps_v2.json')) {
        console.error('Gap list file not found.');
        return;
    }

    const gaps = JSON.parse(fs.readFileSync('prestige_gaps_v2.json', 'utf8'));
    console.log(`Target: ${gaps.length} items.`);

    const enriched = [];
    const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    
    // UUID v5 Helper (Same as caching script)
    const { v5: uuidv5 } = await import('uuid');
    function generateId(source, name, addr) {
        const clean = (s) => String(s).replace(/[()]/g, '').replace(/\s+/g, '').toLowerCase();
        return uuidv5(`${clean(source)}|${clean(name)}|${clean(addr)}`, MY_NAMESPACE);
    }

    for (let i = 0; i < gaps.length; i++) {
        const item = gaps[i];
        process.stdout.write(`\r[${i + 1}/${gaps.length}] Searching: ${item.name} (${item.sigungu})...`);
        
        try {
            const query = `${item.sigungu} ${item.name}`;
            const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
                headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
            }).then(r => r.json());

            if (res.documents?.[0]) {
                const doc = res.documents[0];
                const addr = doc.road_address_name || doc.address_name;
                const id = generateId('PRESTIGE_ENRICHMENT', item.name, addr);
                
                enriched.push({
                    id,
                    api_source: 'PRESTIGE_ENRICHMENT',
                    category: 'SPOT',
                    name: item.name,
                    address: addr,
                    lat: parseFloat(doc.y),
                    lng: parseFloat(doc.x),
                    sido: doc.address_name.split(' ')[0],
                    sigungu: item.sigungu.includes('시') || item.sigungu.includes('군') ? item.sigungu : (doc.address_name.split(' ')[1] || item.sigungu),
                    is_active: true,
                    is_protected: true,
                    trust_score: 50,
                    raw_data: { kakao_info: doc, tier: item.tier },
                    updated_at: new Date().toISOString()
                });
            }
        } catch (e) {
            console.error(`\nError enrichment for ${item.name}:`, e.message);
        }

        // Throttle to respect API limits
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 200));
        
        // Batch upsert every 50 items
        if (enriched.length >= 50) {
            const { error } = await supabase.from('master_places').upsert(enriched, { onConflict: 'id' });
            if (error) console.error(`\nUpsert Error:`, error.message);
            else console.log(`\n  ✅ Batch Upserted: ${enriched.length} items.`);
            enriched.length = 0;
        }
    }

    // Final batch
    if (enriched.length > 0) {
        const { error } = await supabase.from('master_places').upsert(enriched, { onConflict: 'id' });
        if (error) console.error(`\nFinal Upsert Error:`, error.message);
        else console.log(`\n  ✅ Final Batch Upserted: ${enriched.length} items.`);
    }

    console.log('\n✨ Enrichment Complete!');
}

enrichGaps().catch(console.error);
