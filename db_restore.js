const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restore() {
    console.log("Starting Database Restoration...");

    // We need to drop the broken components introduced by today's 'master_fix_v1'
    // 1. trigger_push_notification
    // 2. handle_new_notification()

    // Since we don't have a direct 'sql' execution tool, we have to use an RPC or hope we can drop them via a helper.
    // We can try to use a dummy migration or if there's a specialized RPC.
    // Actually, I can use the 'supabase' CLI to run SQL if I have the password, or use an RPC if it exists.

    // Checking for 'exec_sql' RPC (commonly found in these projects)
    const { data: result, error } = await supabase.rpc('exec_sql', {
        sql_query: `
      -- 1. 고장난 트리거 삭제
      DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;
      
      -- 2. 고장난 함수 삭제
      DROP FUNCTION IF EXISTS public.handle_new_notification();
      
      -- 3. 혹시 모를 레거시 트리거들 마저 정리
      DROP TRIGGER IF EXISTS handle_new_notification_trigger ON public.notifications;
      DROP TRIGGER IF EXISTS on_notification_insert ON public.notifications;
    `
    });

    if (error) {
        if (error.message.includes('function "exec_sql" does not exist')) {
            console.error("RPC 'exec_sql' not found. Cannot clean DB via JS client.");
            console.log("Please run the following SQL manually in Supabase SQL Editor:");
            console.log(`
            DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;
            DROP FUNCTION IF EXISTS public.handle_new_notification();
        `);
        } else {
            console.error("Restoration Error:", error.message);
        }
        return;
    }

    console.log("DB Restoration Successful. All broken triggers removed.");
}

restore();
