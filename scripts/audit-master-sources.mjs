
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SOURCES = [
    { cat: 'SPOT', src: 'TOUR_SPOT', label: '관광명소(SPOT)' },
    { cat: 'RESTAURANT', src: 'SMBA_BAEK', label: '백년가게(BAEK)' },
    { cat: 'RESTAURANT', src: 'MOIS_GOOD_RESTAURANT', label: '모범음식점(GOOD)' },
    { cat: 'RESTAURANT', src: 'SAFE_RESTAURANT', label: '안심식당(SAFE)' },
    { cat: 'MART', src: 'LOCALDATA_MART_LARGE', label: '대형마트(LARGE)' },
    { cat: 'MART', src: 'LOCALDATA_MART_SSM', label: '준대규모(SSM)' },
    { cat: 'MART', src: 'LOCALDATA_MART_OTHER', label: '기타식품(OTHER)' },
    { cat: 'MART', src: 'LOCALDATA_MART_SUPER', label: '중형슈퍼(SUPER)' }
];

async function census() {
    console.log('--- RAONAI Master Places Census ---');
    const results = [];
    
    for (const s of SOURCES) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('api_source', s.src);
            
        if (error) {
            console.error(`Error counting ${s.src}:`, error.message);
            results.push({ Category: s.cat, Source: s.label, Count: 'ERROR' });
        } else {
            results.push({ Category: s.cat, Source: s.label, Count: count });
        }
    }

    console.table(results);
    const total = results.reduce((acc, r) => acc + (typeof r.Count === 'number' ? r.Count : 0), 0);
    console.log(`\nTotal Consolidated Records: ${total.toLocaleString()}`);
}

census();
