import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const generateId = (source, name, addr) => {
  return uuidv5(`${source}|${String(name || '').trim()}|${String(addr || '').trim()}`, MY_NAMESPACE);
};

async function run() {
  const migrations = [
    { old: 'MOIS_GOOD_RESTAURANT', new: 'LOCALDATA_RESTAURANT_GOOD' },
    { old: 'LOCALDATA_MART_SUPER', new: 'LOCALDATA_MART_SSM' }
  ];

  for (const mig of migrations) {
    let totalUpdated = 0;
    while (true) {
      const { data, error } = await supabase.from('master_places').select('id, name, address')
        .eq('api_source', mig.old)
        .limit(500);
      
      if (error) {
        console.error('Fetch Error:', error);
        break;
      }
      if (!data || data.length === 0) break;

      for (const item of data) {
        const newId = generateId(mig.new, item.name, item.address);
        // Supabase Postgres allows updating PK when no strict cascades prevent it
        const { error: upErr } = await supabase.from('master_places').update({ id: newId, api_source: mig.new }).eq('id', item.id);
        
        if (upErr) {
          console.error(`ID ${item.id} update error:`, upErr.message);
          // Failsafe: insert new and delete old if update fails
          const { data: fullItem } = await supabase.from('master_places').select('*').eq('id', item.id).single();
          if (fullItem) {
            fullItem.id = newId;
            fullItem.api_source = mig.new;
            await supabase.from('master_places').insert(fullItem);
            await supabase.from('master_places').delete().eq('id', item.id);
          }
        }
      }
      totalUpdated += data.length;
      console.log(`Migrated ${totalUpdated} records for ${mig.old}`);
    }
  }
  console.log('Migration Complete.');
}

run();
