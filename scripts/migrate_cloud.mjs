import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  console.log('Migrating Cloud DB...');
  
  // Create table if not exists (in case it wasn't there)
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
    CREATE TABLE IF NOT EXISTS public.automation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_name TEXT NOT NULL,
        status TEXT NOT NULL,
        processed_count INTEGER DEFAULT 0,
        message TEXT,
        duration_ms INTEGER,
        target_date DATE,
        api_status JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_automation_logs_job_name ON public.automation_logs(job_name);
    CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON public.automation_logs(created_at DESC);
    `
  });

  if (createError) {
    console.error('Migration failed:', createError);
    
    // Try adding column only if table exists but column is missing
    const { error: colError } = await supabase.rpc('exec_sql', {
       sql: 'ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS api_status JSONB DEFAULT \'[]\'::jsonb;'
    });
    console.log('Column add result:', colError);
  } else {
    console.log('Migration successful.');
  }
}

migrate();
