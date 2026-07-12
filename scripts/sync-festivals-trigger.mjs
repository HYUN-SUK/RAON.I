import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';
import fetch from 'node-fetch';

// Load .env.local
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
} catch (e) {
  console.warn("Could not load .env.local");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOUR_API_KEY = process.env.TOUR_API_KEY;

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const generateFactId = (source, name, address) => 
  uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);

async function runWeeklyFestivalSync() {
  console.log('🚀 Triggering Weekly Festival Sync manually...');
  if (!SUPABASE_URL || !SUPABASE_KEY || !TOUR_API_KEY) {
    console.error('❌ Missing configuration keys in .env.local');
    return;
  }

  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const statsMap = new Map();
  const SIDO_CODES = {
    '1': '서울', '2': '인천', '3': '대전', '4': '대구', '5': '광주',
    '6': '부산', '7': '울산', '8': '세종', '31': '경기', '32': '강원',
    '33': '충북', '34': '충남', '35': '전북', '36': '전남', '37': '경북',
    '38': '경남', '39': '제주'
  };

  Object.values(SIDO_CODES).forEach(region => {
    statsMap.set(region, {
      region,
      name: 'FESTIVAL',
      label: '축제(TourAPI)',
      existing_count: 0,
      fetched_count: 0,
      new_count: { active: 0, inactive: 0 },
      updated_count: { active: 0, inactive: 0 },
      final_count: 0
    });
  });

  try {
    const { data: existingList } = await supabase
      .from('master_places')
      .select('id, address')
      .eq('category', 'FESTIVAL');

    if (existingList) {
      existingList.forEach(item => {
        const addr = item.address || '';
        const region = Object.values(SIDO_CODES).find(r => addr.startsWith(r)) || '기타';
        const stat = statsMap.get(region);
        if (stat) stat.existing_count++;
      });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const tourUrl = `http://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${TOUR_API_KEY}&eventStartDate=${todayStr}&numOfRows=2000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
    
    console.log(`Fetching from TourAPI: ${tourUrl}`);
    const tourRes = await fetch(tourUrl);
    const tourData = await tourRes.json();
    const items = tourData.response?.body?.items?.item || [];
    const festivalList = Array.isArray(items) ? items : [items];

    console.log(`Fetched ${festivalList.length} items from TourAPI.`);

    const upsertList = [];
    const seenIds = new Set();

    for (const item of festivalList) {
      if (!item.title || !item.mapy || !item.mapx) continue;

      const addr1 = item.addr1 || '';
      const fid = generateFactId('TOUR_FSTVL', item.title, addr1);
      
      if (seenIds.has(fid)) continue;
      seenIds.add(fid);

      const region = Object.values(SIDO_CODES).find(r => addr1.startsWith(r)) || '기타';
      const stat = statsMap.get(region);
      if (stat) stat.fetched_count++;

      const name = item.title;
      const playtime = item.playtime || "행사별 상이";
      const usefee = item.usefee || "무료 또는 현장 확인 필요";
      const parking = item.parking || "확인 불가";
      const eventstartdate = item.eventstartdate || "";
      const eventenddate = item.eventenddate || "";

      upsertList.push({
        id: fid,
        api_source: 'TOUR_FSTVL',
        category: 'FESTIVAL',
        name: name,
        address: addr1 || '주소 정보 없음',
        lat: parseFloat(item.mapy),
        lng: parseFloat(item.mapx),
        trust_score: 45,
        description: `${name}은(는) ${eventstartdate ? eventstartdate + '부터 ' : ''}개최되는 지역 축제/행사입니다.`,
        sido: region !== '기타' ? region : '',
        sigungu: '',
        is_active: true,
        raw_data: {
          event_start_date: eventstartdate,
          event_end_date: eventenddate,
          playtime: playtime,
          usefee: usefee,
          eventplace: item.eventplace || '현장 특설 무대',
          parking: parking,
          sponsor1tel: item.sponsor1tel || '정보 없음',
          sponsor2tel: item.sponsor2tel || '정보 없음',
          homepage_url: item.homepage_url || '',
          sub_description: item.sub_description || item.title || '',
          firstimage: item.firstimage || item.firstimage2 || '',
          enriched: true,
          operating_hours: playtime,
          closed_days: "연중무휴 또는 정보 없음",
          representative_menu: [],
          parking_available: parking,
          pet_friendly: "확인 불가"
        },
        updated_at: new Date().toISOString()
      });
    }

    let insertedCount = 0;
    if (upsertList.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < upsertList.length; i += chunkSize) {
        const chunk = upsertList.slice(i, i + chunkSize);
        const { error: upsertErr } = await supabase
          .from('master_places')
          .upsert(chunk, { onConflict: 'id' });

        if (upsertErr) {
          console.error(`Chunk upsert error:`, upsertErr.message);
          throw upsertErr;
        }
        insertedCount += chunk.length;
      }
    }

    const { data: finalFestivalList } = await supabase
      .from('master_places')
      .select('id, address')
      .eq('category', 'FESTIVAL');

    if (finalFestivalList) {
      finalFestivalList.forEach(item => {
        const addr = item.address || '';
        const region = Object.values(SIDO_CODES).find(r => addr.startsWith(r)) || '기타';
        const stat = statsMap.get(region);
        if (stat) stat.final_count++;
      });
    }

    statsMap.forEach(stat => {
      const diff = stat.final_count - stat.existing_count;
      if (diff > 0) {
        stat.new_count.active = diff;
        stat.updated_count.active = Math.max(0, stat.fetched_count - diff);
      } else {
        stat.updated_count.active = stat.fetched_count;
      }
    });

    const executionTime = Date.now() - startTime;
    const statsArray = Array.from(statsMap.values()).filter(s => s.fetched_count > 0 || s.existing_count > 0);

    const { error: logErr } = await supabase
      .from('automation_logs')
      .insert({
        job_name: 'WEEKLY_FESTIVAL_SYNC',
        status: 'SUCCESS',
        processed_count: insertedCount,
        message: `주간 축제 정보 동기화 완료: ${insertedCount}건 적재.`,
        duration_ms: executionTime,
        api_status: statsArray,
        created_at: new Date().toISOString()
      });

    if (logErr) {
      console.error(`Failed to write automation log:`, logErr.message);
    }

    console.log(`✅ Success! Upserted ${insertedCount} festivals in ${executionTime}ms.`);
  } catch (error) {
    console.error(`❌ Sync Failed:`, error.message);
    await supabase.from('automation_logs').insert({
      job_name: 'WEEKLY_FESTIVAL_SYNC',
      status: 'FAILURE',
      processed_count: 0,
      message: `축제 동기화 실패: ${error.message}`,
      duration_ms: Date.now() - startTime,
      created_at: new Date().toISOString()
    });
  }
}

runWeeklyFestivalSync();
