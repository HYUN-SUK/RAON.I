
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// extractSigungu 로직 복사 (수정된 버전)
const extractSigungu = (addr) => {
    if (!addr) return null;
    const sido = addr.startsWith('세종') ? '세종특별자치시' : '기타';
    if (sido === '세종특별자치시') return ''; 
    return '기타';
};

const arboretumAddr = '세종특별자치시 세종동 1203';
const ptSigungu = extractSigungu(arboretumAddr);
console.log(`Arboretum Address: ${arboretumAddr}`);
console.log(`Extracted Sigungu: "${ptSigungu}"`);

const nmcSido = '세종';
const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&STAGE1=${encodeURIComponent(nmcSido)}&STAGE2=${encodeURIComponent(ptSigungu)}&pageNo=1&numOfRows=100&_type=json`;

console.log(`NMC URL: ${url}`);

import fetch from 'node-fetch';
const res = await fetch(url);
const data = await res.json();
console.log('NMC Response Items Count:', data.response?.body?.items?.item ? (Array.isArray(data.response.body.items.item) ? data.response.body.items.item.length : 1) : 0);

if (data.response?.body?.items?.item) {
    const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
    items.forEach(it => console.log(`- ${it.dutyName}`));
}
