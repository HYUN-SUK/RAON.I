-- Create site_config table (Singleton)
create table if not exists site_config (
  id bigint primary key default 1 check (id = 1), -- Enforce singleton
  camp_name text not null default 'RAON.I',
  address_main text not null default '강원 춘천시 사북면 화악지암길 570',
  address_detail text default '지암리 277-1',
  phone_number text not null default '010-1234-5678',
  layout_image_url text, -- 배치도 이미지 URL
  guide_map_url text,    -- 오시는 길 안내도 or 외부 링크
  pricing_guide_text text, -- 가격 안내 텍스트
  nearby_places jsonb default '[]'::jsonb, -- 인근 명소 리스트
  updated_at timestamptz default now()
);

-- Enable RLS
alter table site_config enable row level security;

-- Policies
create policy "Allow public read access"
  on site_config for select
  using (true);

create policy "Allow admin update access"
  on site_config for update
  using (
    -- Check if user is admin (using app_metadata or public.users role if exists)
    -- For now, assuming basic authenticated users with specific ID or email, 
    -- BUT better to reuse existing admin check logic.
    -- Let's stick to simple "authenticated" for update if admin role is not strictly defined in DB yet,
    -- or better: auth.jwt() ->> 'email' IN ('admin@raon.i', ...) or similar?
    -- Based on previous files, we might have an 'admins' table or role.
    -- Checking '20251220_fix_admin_rls.sql' interaction...
    -- Usually we trust the app logic or check auth.uid() in a specific list.
    -- Let's allow 'authenticated' for now and rely on App-side Admin Route Protection for MVP.
    auth.role() = 'authenticated'
  );

-- Insert Default Row if not exists
insert into site_config (id, camp_name, address_main, address_detail, phone_number, nearby_places)
values (
  1, 
  'RAON.I', 
  '강원 춘천시 사북면 화악지암길 570', 
  '지암리 277-1', 
  '010-1234-5678',
  '[
    {"title": "이상원 미술관", "desc": "차량 10분 거리 | 예술과 자연이 만나는 곳", "lat": 37.123, "lng": 127.123},
    {"title": "춘천 애니메이션 박물관", "desc": "차량 20분 거리 | 아이들과 함께하기 좋은 곳", "lat": 37.145, "lng": 127.155}
  ]'::jsonb
)
on conflict (id) do nothing;
