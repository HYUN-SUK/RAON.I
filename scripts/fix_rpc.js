const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixRpc() {
    console.log("Fixing get_master_places_in_radius RPC...");
    
    // We can't easily drop by signature via JS without knowing them.
    // So we use a PL/pgSQL block to find and drop them.
    const sql = `
    DO $$
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT 'DROP FUNCTION ' || oid::regprocedure
            FROM pg_proc
            WHERE proname = 'get_master_places_in_radius'
        ) LOOP
            EXECUTE r.prop; -- Wait, r.prop should be the string we built
        END LOOP;
    END $$;
    `;
    
    // Actually, let's just use the direct DROP commands for known signatures
    const sql2 = `
    DROP FUNCTION IF EXISTS get_master_places_in_radius(double precision, double precision, double precision);
    DROP FUNCTION IF EXISTS get_master_places_in_radius(double precision, double precision, double precision, text, integer);
    
    CREATE OR REPLACE FUNCTION get_master_places_in_radius(
      target_lat DOUBLE PRECISION,
      target_lng DOUBLE PRECISION,
      radius_meters DOUBLE PRECISION,
      p_category TEXT DEFAULT NULL,
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
    ) AS $body$
    BEGIN
      RETURN QUERY
      SELECT 
        m.id, m.api_source, m.category, m.name, m.description, m.address, 
        m.lat, m.lng, m.trust_score, m.raw_data,
        ST_Distance(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) AS distance_meters
      FROM 
        public.master_places m
      WHERE 
        (p_category IS NULL OR m.category = p_category)
        AND ST_DWithin(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
      ORDER BY 
        m.trust_score DESC, 
        distance_meters ASC
      LIMIT limit_count;
    END;
    $body$ LANGUAGE plpgsql;
    `;
    
    // Since we don't have a direct SQL executor in the client, we use an RPC that can run it, or we use a migration.
    // But I can use the 'supabase' CLI if available or just attempt to run it via a helper.
    // Actually, I'll check if there's an 'exec_sql' RPC.
    
    const { error } = await supabase.rpc('exec_sql', { sql: sql2 });
    if (error) {
        console.error("Error fixing RPC:", error);
    } else {
        console.log("RPC fixed successfully.");
    }
}

fixRpc();
