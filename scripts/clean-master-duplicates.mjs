import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const normalize = (str) => (str || '').replace(/\s/g, '').replace(/충남/g, '충청남도').replace(/경북/g, '경상북도').replace(/경남/g, '경상남도').replace(/전북/g, '전라북도').replace(/전남/g, '전라남도').replace(/충북/g, '충청북도').replace(/\*\*.*?\*\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9가-힣]/gi, '').toLowerCase();

async function cleanMasterDuplicates() {
    console.log('📡 Fetching all SPOT records for global cleaning...');
    let allData = [];
    let from = 0;
    const size = 1000;
    
    while (true) {
        // Use a simpler query without heavy order if possible, or ensure it's on an indexed col
        const { data, error } = await supabase.from('master_places').select('*').eq('category', 'SPOT').range(from, from + size - 1);
        if (error) { 
            console.error('Fetch Error at ' + from + ':', error.message); 
            break; 
        }
        if (!data || data.length === 0) break;
        
        allData.push(...data);
        console.log(`  -> Loaded ${allData.length}...`);
        if (data.length < size) break;
        from += size;
    }
    
    console.log(`✅ Total Records Loaded: ${allData.length}`);
    
    const groups = {};
    allData.forEach(item => {
        const cleanName = normalize(item.name);
        const cleanAddr = normalize((item.address || '').split(' ').slice(0,3).join(''));
        const key = `${cleanName}|${cleanAddr}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    const toDeleteIds = [];
    const toUpdateRecords = [];
    let totalMerged = 0;

    for (const key in groups) {
        const list = groups[key];
        if (list.length > 1) {
            // Pick winner: TOUR_SPOT preferred
            let winner = list.find(it => it.api_source === 'TOUR_SPOT');
            if (!winner) winner = list.find(it => it.raw_data && it.raw_data.tier);
            if (!winner) winner = list[0];

            list.forEach(item => {
                if (item.id !== winner.id) {
                    toDeleteIds.push(item.id);
                    if (item.raw_data && item.raw_data.tier) {
                        const currentTier = winner.raw_data ? winner.raw_data.tier : null;
                        if (!currentTier || currentTier > item.raw_data.tier) { // Lower tier number is better (1 > 2)
                            winner.raw_data = { ...(winner.raw_data || {}), tier: item.raw_data.tier };
                            totalMerged++;
                            if (!toUpdateRecords.find(r => r.id === winner.id)) {
                                toUpdateRecords.push({ ...winner, api_source: 'TOUR_SPOT' });
                            }
                        }
                    }
                }
            });
        }
    }

    console.log(`⚠️  Analysis Complete:`);
    console.log(`  -> Duplicate Groups: ${Object.keys(groups).filter(k => groups[k].length > 1).length}`);
    console.log(`  -> Records to Delete: ${toDeleteIds.length}`);
    console.log(`  -> Prestige Info Merged: ${totalMerged}`);

    if (toUpdateRecords.length > 0) {
        console.log(`🚀 Updating ${toUpdateRecords.length} winners with merged info...`);
        for (let i = 0; i < toUpdateRecords.length; i += 50) {
            const chunk = toUpdateRecords.slice(i, i + 50);
            const { error } = await supabase.from('master_places').upsert(chunk);
            if (error) console.error('Update Error:', error.message);
        }
    }

    if (toDeleteIds.length > 0) {
        console.log(`🗑️  Deleting ${toDeleteIds.length} duplicate records...`);
        for (let i = 0; i < toDeleteIds.length; i += 100) {
            const chunk = toDeleteIds.slice(i, i + 100);
            const { error } = await supabase.from('master_places').delete().in('id', chunk);
            if (error) console.error('Delete Error:', error.message);
        }
    }

    console.log('✨ Cleanup and Integration Complete!');
}

cleanMasterDuplicates();
