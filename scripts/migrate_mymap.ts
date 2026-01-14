
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Default Location (Raon Camping)
const DEFAULT_LAT = 36.6596;
const DEFAULT_LNG = 126.6830;

async function migrateMapItems() {
    console.log('Starting Map Item Migration...');

    // 1. Fetch all items
    const { data: items, error } = await supabase
        .from('map_items')
        .select('*');

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    console.log(`Found ${items.length} items.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
        // If lat/lng exists and is not 0 (or very close to 0 which might be default), skip
        if (item.lat && item.lng && (Math.abs(item.lat) > 1 || Math.abs(item.lng) > 1)) {
            skippedCount++;
            continue;
        }

        // Apply Jitter
        // Simple jitter: +/- 0.002 degrees (~200m radius)
        const jitter = () => (Math.random() - 0.5) * 0.002;

        const newLat = DEFAULT_LAT + jitter();
        const newLng = DEFAULT_LNG + jitter();

        // Default address if missing
        const newAddress = item.address && item.address.length > 5 ? item.address : '충청남도 예산군 응봉면 입침리 341';

        const { error: updateError } = await supabase
            .from('map_items')
            .update({
                lat: newLat,
                lng: newLng,
                address: newAddress
            })
            .eq('id', item.id);

        if (updateError) {
            console.error(`Failed to update item ${item.id}:`, updateError);
        } else {
            updatedCount++;
        }
    }

    console.log('Migration Complete');
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
}

migrateMapItems();
