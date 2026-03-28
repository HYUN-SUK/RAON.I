-- Fix NULL location columns for master_places and master_places_gas
UPDATE public.master_places
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

UPDATE public.master_places_gas
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;
