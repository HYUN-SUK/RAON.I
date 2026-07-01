import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== 🔍 오늘 실제 호출된 마트 10건의 raw_data 상세 실사 ===");

  const targetNames = [
    '노브랜드 여주한글시장점',
    '부지런한 식자재 마트',
    '우리마트',
    '롯데슈퍼 군산소룡점',
    '원탑식자재마트',
    '모다아울렛',
    '디더블유유통',
    '관산식자재마트',
    '금호그랜드',
    '(주)이편한마트'
  ];

  let lastId = '';
  const places = [];

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, name, address, raw_data, description, category')
      .order('id')
      .limit(4000);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const p of data) {
      if (p.category === 'MART' && targetNames.includes(p.name)) {
        places.push(p);
      }
    }

    if (places.length >= targetNames.length) break;
    lastId = data[data.length - 1].id;
  }

  places.forEach(p => {
    const rawStr = JSON.stringify(p.raw_data || {});
    console.log(`- 매장명: ${p.name}`);
    console.log(`  raw_data 글자수: ${rawStr.length} 자`);
    console.log(`  raw_data 상세내용 단편: ${rawStr.substring(0, 300)}...`);
    console.log(`  실제 적재된 설명: ${p.description}\n`);
  });
}

main();
