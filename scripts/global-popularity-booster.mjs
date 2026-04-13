/**
 * 전국 인기도 데이터 부스터 (Global Popularity Booster v2 - Finalizer Only)
 * 페이징 문제 해결: 전국 1.3만건 전수 수집 및 정규화
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getCleanString(str) {
  if (!str) return '';
  return String(str).replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase();
}

async function finalizePopularityv2() {
  console.log(`\n💎 [Popularity Engine v2 - Final Pass] Normalizing scores across all regions (Nationwide)...`);
  
  let allSpots = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('master_places')
      .select('id, name, api_source, category, address, lat, lng, sido, is_active, raw_data, trust_score')
      .eq('api_source', 'TOUR_SPOT')
      .eq('is_active', true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`❌ Error fetching spots page ${page}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    
    allSpots = [...allSpots, ...data];
    console.log(`- Loaded ${allSpots.length} spots...`);
    page++;
  }

  if (allSpots.length === 0) {
    console.error('Error: No spots loaded.');
    return;
  }

  const inScoreMap = new Map();
  const nameToId = new Map();
  allSpots.forEach(s => nameToId.set(getCleanString(s.name), s.id));

  for (const spot of allSpots) {
    const relations = spot.raw_data?.tmap_related || [];
    for (const rel of relations) {
      const targetId = nameToId.get(getCleanString(rel.target));
      if (targetId) {
        const score = 1 / Math.log2(rel.rank + 1);
        inScoreMap.set(targetId, (inScoreMap.get(targetId) || 0) + score);
      }
    }
  }

  const scores = [...inScoreMap.values()];
  const maxIn = Math.max(...scores, 1);
  console.log(`- Max Inbound Weight: ${maxIn}`);

  const updates = [];
  for (const spot of allSpots) {
    const basePopRaw = inScoreMap.get(spot.id) || 0;
    const basePopNorm = (basePopRaw / maxIn) * 100;
    const ktRate = spot.raw_data?.kt_concentration || 50;
    const boost = ktRate > 90 ? 1.25 : (ktRate > 70 ? 1.1 : 1.0);
    const finalPopScore = Math.min(100, Math.round(basePopNorm * boost));

    updates.push({
      id: spot.id,
      api_source: spot.api_source,
      category: spot.category,
      name: spot.name,
      address: spot.address,
      lat: spot.lat,
      lng: spot.lng,
      sido: spot.sido,
      is_active: spot.is_active,
      trust_score: Math.max(50, finalPopScore),
      raw_data: {
        ...spot.raw_data,
        popularity_v2: {
          base_pop: basePopNorm,
          season_boost: boost,
          calculated_at: new Date().toISOString()
        }
      }
    });
  }

  console.log(`- Data ready for ${updates.length} spots. Starting batch upsert...`);
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    const { error: upError } = await supabase.from('master_places').upsert(batch);
    if (upError) console.error(`❌ Error in batch ${i}:`, upError.message);
    if (i % 1000 === 0) console.log(`  - Upserted ${i} spots...`);
  }
  console.log(`✅ [Popularity v2] Final Trust Scores updated for ${updates.length} spots.`);
}

finalizePopularityv2().catch(console.error);
