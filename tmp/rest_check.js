const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function restaurantCheck() {
    const { count: rest } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'RESTAURANT');
    console.log(`Category RESTAURANT: ${rest}`);
}

restaurantCheck();
