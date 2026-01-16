import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const { data } = await supabase
        .from('notifications')
        .select('id, status, result, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

    if (data && data[0]) {
        const n = data[0];
        console.log(`\nLatest Notification:`);
        console.log(`Status: ${n.status}`);
        console.log(`Result: ${n.result}`);
        console.log(`Time: ${new Date(n.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    }
}
check();
