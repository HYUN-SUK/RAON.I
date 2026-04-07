import { NextResponse } from 'next/server';

export async function GET() {
  const MOIS_API_KEY = process.env.PUBLIC_DATA_API_KEY;
  const url = `http://apis.data.go.kr/1741000/LargeScaleRetailStore/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청남도')}`;
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    return NextResponse.json({ status: res.status, text: text.substring(0, 200) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
