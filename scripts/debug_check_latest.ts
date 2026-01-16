import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugCheck() {
    console.log('=== LATEST RESERVATION ===');
    const { data: resv, error: rErr } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (rErr) console.error('Reservation Error:', rErr);
    else if (!resv || resv.length === 0) console.log('No reservations found.');
    else {
        const r = resv[0];
        console.log(`ID: ${r.id}`);
        console.log(`User ID: ${r.user_id}`);
        console.log(`Status: ${r.status}`);
        console.log(`Created: ${new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    }

    console.log('\n=== LATEST NOTIFICATION ===');
    const { data: notif, error: nErr } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (nErr) console.error('Notification Error:', nErr);
    else if (!notif || notif.length === 0) console.log('No notifications found.');
    else {
        const n = notif[0];
        console.log(`ID: ${n.id}`);
        console.log(`User ID: ${n.user_id}`);
        console.log(`Type: ${n.event_type}`);
        console.log(`Status: ${n.status}`);
        console.log(`Result: ${JSON.stringify(n.result)}`);
        console.log(`Created: ${new Date(n.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    }
}

debugCheck();
