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

function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/[()]/g, '').replace(/\s+/g, '').toLowerCase();
}

function generateId(source, name, addr) {
    const cleanSource = getCleanString(source);
    const cleanName = getCleanString(name);
    const cleanAddr = getCleanString(addr);
    return uuidv5(`${cleanSource}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
}

async function startEnrichment() {
    console.log('--- [SPOT Category Enrichment] Starting Nationwide Injection ---');
    
    const auditData = JSON.parse(fs.readFileSync('precise_audit_report_v3.json', 'utf8'));
    const gaps = auditData.gaps;
    
    console.log(`🚀 Target: ${gaps.length} missing SPOT items.`);

    let successCount = 0;
    let failCount = 0;
    const batch = [];

    for (let i = 0; i < gaps.length; i++) {
        const item = gaps[i];
        const query = `${item.sigungu} ${item.name}`;
        
        try {
            const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
                headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
            }).then(r => r.json());

            if (res.documents?.[0]) {
                const doc = res.documents[0];
                const addr = doc.road_address_name || doc.address_name;
                const id = generateId('PRESTIGE_ENRICHMENT', item.name, addr);
                
                batch.push({
                    id,
                    api_source: 'PRESTIGE_ENRICHMENT',
                    category: 'SPOT',
                    name: item.name,
                    address: addr,
                    lat: parseFloat(doc.y),
                    lng: parseFloat(doc.x),
                    sido: doc.address_name.split(' ')[0],
                    sigungu: doc.address_name.split(' ')[1] || item.sigungu,
                    is_active: true,
                    is_protected: true,
                    trust_score: 60,
                    raw_data: { kakao_info: doc, tier: item.tier },
                    updated_at: new Date().toISOString()
                });
                successCount++;
            } else {
                failCount++;
            }
        } catch (e) {
            console.error(`\n❌ Error fetching ${item.name}: ${e.message}`);
            failCount++;
        }

        // Progress Update
        if ((i + 1) % 10 === 0 || i === gaps.length - 1) {
            process.stdout.write(`\rProgress: ${i + 1}/${gaps.length} | Success: ${successCount} | Fail: ${failCount}`);
        }

        // Batch Upsert every 50 items
        if (batch.length >= 50) {
            const { error } = await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
            if (error) console.error(`\nUpsert Error:`, error.message);
            batch.length = 0;
            // Respect API limits
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Final Upsert
    if (batch.length > 0) {
        await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
    }

    console.log(`\n\n✨ Enrichment Task Completed.`);
    console.log(`✅ Successfully injected: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
}

startEnrichment().catch(console.error);
