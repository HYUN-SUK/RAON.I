
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// .env 파일 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Service Role Key가 더 확실하지만, Anon으로도 Public 조회 가능하면 시도

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDb() {
    console.log('=== DB Debugging Start ===');
    const targetDate = '2026-01-26'; // 사용자가 문제라고 지목한 날짜

    // 1. Reservations 조회
    const { data: reservations, error: rError } = await supabase
        .from('reservations')
        .select('*')
        .or(`check_in_date.eq.${targetDate},check_out_date.eq.${targetDate}`);

    if (rError) console.error('Reservations Error:', rError);
    console.log(`[Reservations] Data found for ${targetDate}:`, reservations?.length || 0);
    if (reservations && reservations.length > 0) {
        console.log(JSON.stringify(reservations, null, 2));
    }

    // 2. Blocked Dates 조회
    const { data: blocked, error: bError } = await supabase
        .from('blocked_dates')
        .select('*')
        .lte('start_date', '2026-01-27')
        .gte('end_date', '2026-01-26');

    if (bError) console.error('Blocked Dates Error:', bError);
    console.log(`[Blocked Dates] Data found for range 26~27:`, blocked?.length || 0);
    if (blocked && blocked.length > 0) {
        console.log(JSON.stringify(blocked, null, 2));
    }

    console.log('=== DB Debugging End ===');
}

debugDb();
