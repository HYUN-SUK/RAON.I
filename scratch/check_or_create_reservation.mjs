import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const targetDate = '2026-05-04';
    const { data, error } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('check_in', targetDate);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    if (data.length === 0) {
        console.log('No reservations found. Creating a mock one...');
        const { data: ins, error: insErr } = await supabase
            .from('user_schedules')
            .insert({
                user_id: '00000000-0000-0000-0000-000000000000', // Mock UUID
                campground_name: '라온아이 오토캠핑장',
                campground_address: '충청남도 예산군 신암면 신암로 164-8',
                campground_lat: 36.7865,
                campground_lng: 126.8322,
                check_in: targetDate,
                check_out: '2026-05-06',
                status: 'CONFIRMED'
            })
            .select();
        
        if (insErr) console.error('Insert Error:', insErr);
        else console.log('Mock reservation created:', ins[0].id);
    } else {
        console.log('Existing reservations:', data.map(d => d.id));
    }
}

check();
