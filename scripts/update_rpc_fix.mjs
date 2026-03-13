import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
CREATE OR REPLACE FUNCTION public.get_master_places_in_radius(
  target_lat DOUBLE PRECISION,
  target_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION,
  target_category TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  api_source TEXT,
  category TEXT,
  name TEXT,
  description TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  trust_score INTEGER,
  raw_data JSONB,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  WITH combined AS (
    SELECT 
      m.id, m.api_source, m.category, m.name, m.description, m.address, 
      m.lat, m.lng, m.trust_score, m.raw_data,
      ST_Distance(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) AS distance_meters
    FROM 
      public.master_places m
    WHERE 
      (target_category IS NULL OR m.category = target_category)
      AND ST_DWithin(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
    
    UNION ALL
    
    SELECT 
      g.id, g.api_source, g.category, g.name, g.description, g.address, 
      g.lat, g.lng, g.trust_score, g.raw_data,
      ST_Distance(g.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) AS distance_meters
    FROM 
      public.master_places_gas g
    WHERE 
      (target_category IS NULL OR g.category = 'GAS_STATION')
      AND (target_category IS NULL OR target_category = 'GAS_STATION')
      AND ST_DWithin(g.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
  )
  SELECT * FROM combined
  ORDER BY 
    trust_score DESC, 
    distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
`;

async function applyFix() {
    console.log("🛠️ Attempting to update RPC get_master_places_in_radius to include master_places_gas...");

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error("❌ RPC Update Failed:", error.message);
        console.log("\n⚠️ Manual SQL for Supabase Dashboard:\n", sql);
    } else {
        console.log("✅ RPC get_master_places_in_radius updated successfully to include Gas Stations.");
    }
}

applyFix();
