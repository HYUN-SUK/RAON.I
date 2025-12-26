-- 1. Populate 'nearby_events' (Cultural/Tourism API Simulation)
-- Clear existing valid events first (optional, for idempotency)
DELETE FROM public.nearby_events WHERE id > 0;

INSERT INTO public.nearby_events 
(title, description, location, latitude, longitude, start_date, end_date, image_url, is_active)
VALUES
(
    '제 12회 산천어 축제', 
    '청정 자연에서 즐기는 겨울철 대표 축제. 얼음낚시, 맨손잡기 등 다양한 체험 프로그램이 준비되어 있습니다.', 
    '화천군 화천읍', 
    38.106, 127.708, 
    CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 
    'https://images.unsplash.com/photo-1547893933-7e44a04e5485?q=80&w=1000&auto=format&fit=crop',
    true
),
(
    '별빛 수목원 야간개장', 
    '밤하늘의 별과 수목원의 조명이 어우러지는 환상적인 야경. 로맨틱한 산책로를 즐겨보세요.', 
    '가평군 아침고요수목원', 
    37.838, 127.397, 
    CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1000&auto=format&fit=crop',
    true
),
(
    '주말 농산물 직거래 장터', 
    '지역 농부들이 직접 기른 신선한 농산물을 저렴하게 구매할 수 있는 주말 장터입니다.', 
    '캠핑장 입구 공터', 
    37.950, 127.500, 
    CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?q=80&w=1000&auto=format&fit=crop',
    true
);


-- 2. Update 'site_config.nearby_places' (Facilities JSON)
-- Structure: { category: string, name: string, distance: string, phone: string, lat: number, lng: number }
UPDATE public.site_config
SET nearby_places = '[
    {
        "category": "마트",
        "name": "하나로마트 가평점",
        "distance": "3.5km",
        "phone": "031-582-1111",
        "lat": 37.831,
        "lng": 127.509
    },
    {
        "category": "편의점",
        "name": "GS25 상색점",
        "distance": "1.2km",
        "phone": "031-581-2222",
        "lat": 37.835,
        "lng": 127.505
    },
    {
        "category": "주유소",
        "name": "SK엔크린 청평주유소",
        "distance": "5.0km",
        "phone": "031-584-3333",
        "lat": 37.740,
        "lng": 127.420
    },
    {
        "category": "약국",
        "name": "청평 약국",
        "distance": "4.8km",
        "phone": "031-584-4444",
        "lat": 37.741,
        "lng": 127.422
    },
    {
        "category": "병원",
        "name": "청평 삼성병원",
        "distance": "5.2km",
        "phone": "031-584-5555",
        "lat": 37.739,
        "lng": 127.418
    }
]'::json
WHERE id = 1;
