
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// .env 파일 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env methods');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log('Testing RPC: get_public_reservations...');

    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0];

    const { data, error } = await supabase.rpc('get_public_reservations', {
        p_start_date: today,
        p_end_date: nextMonthStr
    });

    if (error) {
        console.error('RPC Failed:', error);
    } else {
        console.log('RPC Success! Data count:', data.length);
        console.log('Sample data:', data.slice(0, 2));
    }
}

testRpc();
