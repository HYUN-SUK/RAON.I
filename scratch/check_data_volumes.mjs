import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("📊 세종특별자치시 vs 경기도 활성 데이터 규모 비교");

  // 1. 세종 모범음식점 및 마트 개수
  const { count: sejongGood } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('sido', '세종특별자치시')
    .eq('category', 'RESTAURANT')
    .eq('api_source', 'LOCALDATA_RESTAURANT_GOOD');

  const { count: sejongMart } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('sido', '세종특별자치시')
    .eq('category', 'MART');

  // 2. 경기 모범음식점 및 마트 개수
  const { count: ggGood } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('sido', '경기도')
    .eq('category', 'RESTAURANT')
    .eq('api_source', 'LOCALDATA_RESTAURANT_GOOD');

  const { count: ggMart } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('sido', '경기도')
    .eq('category', 'MART');

  console.log("--- 세종특별자치시 ---");
  console.log(`모범음식점: ${sejongGood}건`);
  console.log(`마트 전체 : ${sejongMart}건`);
  console.log("--- 경기도 ---");
  console.log(`모범음식점: ${ggGood}건`);
  console.log(`마트 전체 : ${ggMart}건`);
}

main();
