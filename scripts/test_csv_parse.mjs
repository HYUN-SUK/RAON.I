import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';

dotenv.config({ path: '.env.local' });
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateId(source, name, address) {
    return uuidv5(`${source}|${String(name||'').trim()}|${String(address||'').trim()}`, '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
}

async function run() {
  const orgCode = '6440000_ALL'; // 충청남도
  const url = `https://file.localdata.go.kr/file/download/large_scale_retail_stores/info?orgCode=${orgCode}`;
  
  console.log('Fetching:', url);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.data.go.kr/' } });
  
  if(!res.ok) throw new Error(res.status);
  
  const chunk = [];
  await new Promise((resolve, reject) => {
    res.body
      .pipe(iconv.decodeStream('EUC-KR'))
      .pipe(csvParser())
      .on('data', (row) => {
        const name = row['사업장명'] || row['업소명'] || '';
        const addr = row['소재지전체주소'] || row['도로명전체주소'] || row['도로명주소'] || row['지번주소'] || '';
        const status = String(row['영업상태명'] || row['상세영업상태명'] || '');
        
        if (!name || !addr) return;
        const isOpen = status.includes('영업');
        
        const id = generateId('LOCALDATA_MART_LARGE', name, addr);
        
        chunk.push({
          id, api_source: 'LOCALDATA_MART_LARGE', category: 'MART',
          name, address: addr, trust_score: isOpen ? 60 : 0, is_active: isOpen,
          sido: '충청남도', sigungu: addr.split(' ')[1] || '', raw_data: row, updated_at: new Date().toISOString()
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });
  
  console.log('Parsed items:', chunk.length);
  if(chunk.length > 0) {
    const { error } = await supabase.from('master_places').upsert(chunk.slice(0, 50), { onConflict: 'id' });
    if(error) console.error('UPSERT ERROR:', error);
    else console.log('Upsert success!');
  }
}
run();
