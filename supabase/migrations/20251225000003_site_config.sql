-- Create site_config table (Singleton)
create table if not exists site_config (
  id bigint primary key default 1 check (id = 1), -- Enforce singleton
  camp_name text not null default 'RAON.I',
  address_main text not null default '충청남도 예산군 응봉면 응봉서로 280',
  address_detail text default '',
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
DROP POLICY IF EXISTS "Allow public read access" ON site_config;
create policy "Allow public read access"
  on site_config for select
  using (true);

DROP POLICY IF EXISTS "Allow admin update access" ON site_config;
on conflict (id) do nothing;
