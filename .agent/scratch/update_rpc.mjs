import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateRpc() {
  const sql = `
CREATE OR REPLACE FUNCTION get_master_places_in_radius_v2(
  target_lat DOUBLE PRECISION,
  target_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  p_include_closed BOOLEAN DEFAULT FALSE,
  p_keyword TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, api_source TEXT, category TEXT, name TEXT, description TEXT, address TEXT, 
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, trust_score INTEGER, raw_data JSONB, 
  distance_meters DOUBLE PRECISION, is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id, m.api_source, m.category, m.name, m.description, m.address, 
    m.lat, m.lng, m.trust_score, m.raw_data,
    ST_Distance(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) AS distance_meters,
    m.is_active
  FROM 
    public.master_places m
  WHERE 
    (p_category IS NULL OR m.category = p_category)
    AND (p_include_closed IS TRUE OR m.is_active IS TRUE)
    AND (p_keyword IS NULL OR m.name ~* p_keyword OR m.description ~* p_keyword)
    AND ST_DWithin(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
  ORDER BY 
    m.trust_score DESC, 
    distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
`;

  const { error } = await supabase.rpc('run_sql', { sql });
  if (error) {
    console.error('RPC Update Failed:', error);
  } else {
    console.log('Advanced RPC Updated Successfully');
  }
}

updateRpc();
