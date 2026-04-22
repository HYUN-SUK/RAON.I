import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

const normalize = (str) => (str || '').replace(/\s/g, '').replace(/충남/g, '충청남도').replace(/경북/g, '경상북도').replace(/경남/g, '경상남도').replace(/전북/g, '전라북도').replace(/전남/g, '전라남도').replace(/충북/g, '충청북도').replace(/\*\*.*?\*\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9가-힣]/gi, '').toLowerCase();

async function getKakaoCoords(query) {
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
            const doc = data.documents[0];
            return {
                address: doc.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                kakao_id: doc.id,
                name: doc.place_name
            };
        }
    } catch (e) {
        console.error(`Kakao Search Error for ${query}:`, e.message);
    }
    return null;
}

async function syncAllLandmarks() {
    console.log('📖 Loading reference landmark lists (Top 100 & 8 Sceneries)...');
    const t1Text = fs.readFileSync('korea_tourism_100_official.md', 'utf-8');
    const t2Text = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf-8');

    const targetList = []; // { name, tier, refRegion }

    // Parse Tourism 100 (Tier 1)
    t1Text.split('\n').forEach(l => {
        const match = l.match(/^- (.+)$/);
        if (match) targetList.push({ name: match[1].trim(), tier: 1 });
    });

    // Parse 8 Sceneries (Tier 2)
    let currentSigungu = '';
    t2Text.split('\n').forEach(l => {
        const h3 = l.match(/^### (.+?)(?:\s+\(|$)/);
        const listMatch = l.match(/^- \*\*(.+?)(?:\(.+?\))?:\*\*\s+(.+)$/);
        if (h3) {
            currentSigungu = h3[1].trim();
        } else if (listMatch) {
            const names = listMatch[2].split(',').map(n => n.trim());
            names.forEach(n => targetList.push({ name: n, tier: 2, refRegion: listMatch[1].trim() }));
        } else if (l.startsWith('- ') && currentSigungu) {
            const names = l.replace('- ', '').split(',').map(n => n.trim());
            names.forEach(n => targetList.push({ name: n, tier: 2, refRegion: currentSigungu }));
        }
    });

    console.log(`✅ Total Targets to Sync: ${targetList.length}`);

    console.log('📡 Fetching Master SPOT records for matching...');
    const { data: masterSpots, error } = await supabase.from('master_places').select('*').eq('category', 'SPOT');
    if (error) { console.error(error); return; }

    let updatedCount = 0;
    let addedCount = 0;

    for (const item of targetList) {
        const cleanTargetName = normalize(item.name);
        
        // Find in DB
        const match = masterSpots.find(m => {
            const mName = normalize(m.name);
            return mName === cleanTargetName || mName.includes(cleanTargetName) || cleanTargetName.includes(mName);
        });

        if (match) {
            // Update existing
            const { error } = await supabase.from('master_places').update({
                raw_data: { ...(match.raw_data || {}), tier: item.tier },
                api_source: 'TOUR_SPOT'
            }).eq('id', match.id);
            if (!error) updatedCount++;
        } else {
            // Not in DB, search Kakao and Insert
            console.log(`🔍 Searching Kakao for: ${item.name}...`);
            const kakao = await getKakaoCoords(item.name + (item.refRegion ? ' ' + item.refRegion : ''));
            if (kakao) {
                const { error } = await supabase.from('master_places').insert({
                    name: kakao.name,
                    category: 'SPOT',
                    api_source: 'TOUR_SPOT',
                    address: kakao.address,
                    lat: kakao.lat,
                    lng: kakao.lng,
                    raw_data: { tier: item.tier, kakao_id: kakao.kakao_id },
                    trust_score: 80 // Trusted source
                });
                if (!error) {
                    console.log(`  ✅ Added: ${kakao.name} (${kakao.address})`);
                    addedCount++;
                }
            } else {
                console.log(`  ❌ Kakao search failed for: ${item.name}`);
            }
        }
    }

    console.log(`\n✨ Sync Task Complete!`);
    console.log(`  -> Updated: ${updatedCount}`);
    console.log(`  -> Added with Coords: ${addedCount}`);
}

syncAllLandmarks();
