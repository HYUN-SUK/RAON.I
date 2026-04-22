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

async function userRefinedEnrichment() {
    console.log('--- [User Refined Enrichment] Processing Manually Cleaned List ---');

    const content = fs.readFileSync('final_missing_prestige_list.md', 'utf8');
    const lines = content.split('\n');
    
    const refinedItems = [];
    lines.forEach(line => {
        if (line.startsWith('| Tier')) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 4) {
                const tier = parseInt(parts[1].replace('Tier ', ''));
                const sigungu = parts[2];
                const rawNames = parts[3];
                // Split by comma or &
                const names = rawNames.split(/[,&]/).map(n => n.trim()).filter(n => n);
                names.forEach(name => {
                    refinedItems.push({ tier, sigungu, name });
                });
            }
        }
    });

    console.log(`🚀 Found ${refinedItems.length} refined items to process.`);

    let successCount = 0;
    const batch = [];

    for (let i = 0; i < refinedItems.length; i++) {
        const item = refinedItems[i];
        // Clean special characters like **
        const cleanName = item.name.replace(/\*\*/g, '').replace(/[\(\)].*$/, '').trim();
        const query = `${item.sigungu} ${cleanName}`;
        
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
                    trust_score: 100, // Higher score for user-refined items
                    raw_data: { kakao_info: doc, tier: item.tier, user_refined: true },
                    updated_at: new Date().toISOString()
                });
                successCount++;
            }
        } catch (e) {
            // ignore
        }

        if (batch.length >= 20) {
            await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
            batch.length = 0;
        }

        if ((i + 1) % 10 === 0 || i === refinedItems.length - 1) {
            process.stdout.write(`\rProgress: ${i + 1}/${refinedItems.length} | Injected: ${successCount}`);
        }
    }

    if (batch.length > 0) {
        await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
    }

    console.log(`\n\n✨ User Refined Enrichment Completed. ${successCount} items added/updated.`);
}

userRefinedEnrichment().catch(console.error);
