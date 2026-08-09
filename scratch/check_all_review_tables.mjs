import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllReviewTables() {
    // 1. Check site_reviews if exists
    const { data: siteReviews, error: err1 } = await supabase
        .from('site_reviews')
        .select('*')
        .order('created_at', { ascending: false });

    if (!err1 && siteReviews) {
        console.log(`[site_reviews] Count: ${siteReviews.length}`);
        siteReviews.forEach(r => console.log(`- ID: ${r.id} | Date/CreatedAt: ${r.created_at || r.date} | Content: "${r.content || r.title}"`));
    } else {
        console.log('[site_reviews] table error or empty:', err1?.message);
    }

    // 2. Check reviews table if exists
    const { data: reviews, error: err2 } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

    if (!err2 && reviews) {
        console.log(`[reviews] Count: ${reviews.length}`);
        reviews.forEach(r => console.log(`- ID: ${r.id} | Date/CreatedAt: ${r.created_at || r.date} | Content: "${r.content || r.title}"`));
    } else {
        console.log('[reviews] table error or empty:', err2?.message);
    }
}

checkAllReviewTables();
