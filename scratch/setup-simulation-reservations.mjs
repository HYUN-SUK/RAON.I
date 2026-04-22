import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
    // 1. Create Yesan Reservation
    await s.from('user_schedules').insert([{
        user_id: 'eb94f30c-2678-43df-9759-33b00067347a', // test user
        camping_id: 'a6279f72-965a-4309-8472-881829e06173', // 예산 캠핑장
        check_in_date: '2026-04-25',
        sigungu: '예산군',
        sido: '충청남도'
    }]);

    // 2. Create Hongseong Reservation
    await s.from('user_schedules').insert([{
        user_id: 'eb94f30c-2678-43df-9759-33b00067347a',
        camping_id: 'b6279f72-965a-4309-8472-881829e06174', // 홍성 캠핑장 가상 ID
        check_in_date: '2026-04-25',
        sigungu: '홍성군',
        sido: '충청남도'
    }]);

    console.log('✅ Simulation reservations created for Yesan and Hongseong (2026-04-25)');
}
setup();
