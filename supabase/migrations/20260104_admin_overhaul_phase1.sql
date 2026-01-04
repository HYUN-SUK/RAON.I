-- 1. Extend site_config for Hero & Bank Info
alter table public.site_config 
add column if not exists hero_image_url text default '/images/main_hero.jpg', 
add column if not exists bank_name text default '카카오뱅크',
add column if not exists bank_account text default '3333-00-0000000',
add column if not exists bank_holder text default '박지암';

-- 2. Create sites table
create table if not exists public.sites (
  id text primary key, -- 'site-1', 'site-2' etc.
  name text not null,
  type text default 'AUTO',
  description text,
  price int not null default 0,
  base_price int not null default 0,
  max_occupancy int not null default 4,
  image_url text,
  features text[] default '{}',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS for sites
alter table public.sites enable row level security;

create policy "Public sites are viewable by everyone" 
on public.sites for select using (true);

create policy "Admins can update sites" 
on public.sites for update using (auth.role() = 'authenticated'); -- Simplified for MVP

create policy "Admins can insert sites" 
on public.sites for insert with check (auth.role() = 'authenticated');

-- 4. Seed Initial Data (Upsert to avoid duplicates)
insert into public.sites (id, name, type, description, price, base_price, max_occupancy, image_url, features) values
('site-1', '철수네', 'AUTO', '숲속 가장 깊은 곳, 조용한 휴식을 위한 프라이빗 사이트입니다.', 40000, 40000, 4, '/images/tent_view_hero.png', ARRAY['전기 사용 가능', '파쇄석', '그늘 많음', '프라이빗']),
('site-2', '영희네', 'AUTO', '계곡 물소리가 들리는 시원한 명당 자리입니다.', 40000, 40000, 4, '/images/tent_view_wide_scenic.png', ARRAY['전기 사용 가능', '데크', '계곡 뷰', '편의시설 인접']),
('site-3', '민수네', 'AUTO', '모든 것이 준비된 럭셔리 글램핑 사이트입니다.', 130000, 130000, 4, '/images/tent_view_hero.png', ARRAY['침대 구비', '개별 화장실', '에어컨', '냉장고']),
('site-4', '석이네', 'AUTO', '넓은 주차 공간과 함께하는 오토캠핑 사이트입니다.', 50000, 50000, 6, '/images/tent_view_wide_scenic.png', ARRAY['차량 진입 가능', '파쇄석', '넓은 공간', '전기 사용 가능']),
('site-5', '순이네', 'AUTO', '아이들이 뛰어놀기 좋은 평지 사이트입니다.', 40000, 40000, 4, '/images/tent_view_hero.png', ARRAY['잔디', '놀이터 인접', '전기 사용 가능']),
('site-6', '옥이네', 'AUTO', '나무 그늘이 풍부한 시원한 사이트입니다.', 40000, 40000, 4, '/images/tent_view_wide_scenic.png', ARRAY['파쇄석', '그늘 많음', '해먹 설치 가능']),
('site-7', '담이네', 'AUTO', '카라반 진입이 가능한 넓은 사이트입니다.', 60000, 60000, 6, '/images/tent_view_hero.png', ARRAY['카라반 가능', '전기 30A', '수도 시설']),
('site-8', '정이네', 'AUTO', '관리동과 가까워 편리한 사이트입니다.', 40000, 40000, 4, '/images/tent_view_wide_scenic.png', ARRAY['편의시설 인접', '파쇄석', '와이파이'])
on conflict (id) do update set 
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  base_price = excluded.base_price,
  image_url = excluded.image_url,
  features = excluded.features;
