import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugCheck() {
    // Check Reservation
    const { data: resv } = await supabase
        .from('reservations')
        .select('id, user_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

    if (resv && resv.length > 0) {
        const r = resv[0];
        console.log(`[RESV] ID:${r.id.slice(0, 8)}... User:${r.user_id} Status:${r.status} Time:${new Date(r.created_at).toLocaleTimeString('ko-KR')}`);
    } else {
        console.log('[RESV] None found');
    }

    // Check Notification
    const { data: notif } = await supabase
        .from('notifications')
        .select('id, user_id, event_type, status, result, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

    if (notif && notif.length > 0) {
        const n = notif[0];
        const res = n.result ? (JSON.stringify(n.result).length > 50 ? 'Error Details...' : JSON.stringify(n.result)) : 'NULL';
        console.log(`[NOTI] ID:${n.id.slice(0, 8)}... User:${n.user_id} Type:${n.event_type} Status:${n.status} Result:${res} Time:${new Date(n.created_at).toLocaleTimeString('ko-KR')}`);
    } else {
        console.log('[NOTI] None found');
    }
}

debugCheck();
