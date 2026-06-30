import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function count() {
  const { count: nullCount, error } = await supabase
    .from('master_places')
    .select('id', { count: 'exact', head: true })
    .eq('category', 'SPOT')
    .eq('is_active', true)
    .or('sido.is.null,sigungu.is.null');

  if (error) {
    console.error("Count Error:", error.message);
  } else {
    console.log("Remaining Null Sido/Sigungu places:", nullCount);
  }
}

count();
