const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Target Coordinates (Yesan-gun 캠핑장 "철수네" 근처)
const targetLat = 36.65759;
const targetLng = 126.83785;
const radius = 30000;

async function simulate() {
  const out = [];
  const log = (msg) => { console.log(msg); out.push(msg); };

  log(`=== [Simulation] 3/27 예약 건 필터링/스코어링 고도화 시뮬레이션 ===`);
  log(`중심점: ${targetLat}, ${targetLng} (반경 30km)\n`);

  // 1. Fetch raw candidates from master_places (to see everything including previously excluded ones)
  const { data: rawCandidates, error } = await supabase.rpc('get_master_places_in_radius', {
    target_lat: targetLat, target_lng: targetLng, radius_meters: radius, limit_count: 2000
  });

  if (error) { console.error(error); return; }
  log(`Raw Candidate 확보: ${rawCandidates.length}건\n`);

  // 2. MART Simulation
  log('--- [MART] Simulation Results (Brand-First & Noise-Free) ---');
  const marts = rawCandidates.filter(c => c.category === 'MART').map(c => {
    let s = 60; // Base score for food Mart
    const name = c.name;
    const isFashion = /패션|아울렛|의류|슈즈|전자|하이마트|가구|백화점|쇼핑블럭|쎈타|시장/.test(name);
    
    // Brand Weights (Manual Step 5.5 / User Request)
    if (/하나로마트|농협/.test(name)) s = 90;
    else if (/이마트|롯데마트|홈플러스|노브랜드/.test(name)) s = 80;
    else if (/식자재|도매|익스프레스|에브리데이/.test(name)) s = 65;
    
    // Distance Weight (Max 40)
    const d = c.distance || 0;
    const distScore = Math.max(0, (1 - (d / radius)) * 40);
    const finalScore = s + distScore;
    
    return { ...c, simScore: finalScore, isExcluded: isFashion, distKm: d / 1000 };
  })
  .filter(m => !m.isExcluded)
  .sort((a, b) => b.simScore - a.simScore)
  .slice(0, 10);

  marts.forEach((m, idx) => {
    log(`${idx+1}. ${m.name.padEnd(20)} | 거리: ${m.distKm.toFixed(1)}km | 점수: ${m.simScore.toFixed(1)} | ${m.address}`);
  });

  // 3. RESTAURANT Simulation (Multi-Auth Bonus)
  log('\n--- [RESTAURANT] Simulation Results (3-API Overlap Bonus) ---');
  const rests = rawCandidates.filter(c => c.category === 'RESTAURANT').map(c => {
    let s = 60; // Base for standard restaurant
    const name = c.name;
    const sources = (c.api_source || '').split(',').map(s => s.trim());
    
    // 3개 API 중복 보너스 (Manual Sec 2. Step 3)
    if (sources.length >= 3) s = 100;
    else if (sources.length === 2) s = 85;
    else if (sources.includes('SMBA_BAEK') || sources.includes('LOCALDATA_RESTAURANT')) s = 70;
    
    // Noise Filter (Non-food)
    const isNoise = /안경|의상|한복|건축|이용원|이발|미용/.test(name);
    
    const d = c.distance || 0;
    const distScore = Math.max(0, (1 - (d / radius)) * 40);
    const finalScore = s + distScore;
    
    return { ...c, simScore: finalScore, isExcluded: isNoise, sources, distKm: d / 1000 };
  })
  .filter(r => !r.isExcluded)
  .sort((a, b) => b.simScore - a.simScore)
  .slice(0, 15);

  rests.forEach((r, idx) => {
    log(`${idx+1}. ${r.name.padEnd(20)} | 거리: ${r.distKm.toFixed(1)}km | 점수: ${r.simScore.toFixed(1)} | 소스: ${r.sources.join(',')} | ${r.address}`);
  });

  // 4. HOSPITAL Simulation (Hierarchy-based)
  log('\n--- [HOSPITAL] Simulation Results (ER/General Hierarchy) ---');
  const hosps = rawCandidates.filter(c => c.category === 'HOSPITAL').map(c => {
    let s = 20; // Default
    const name = c.name;
    const cat = c.raw_data?.category_name || ''; 
    
    // Hierarchy Scoring (Manual Sec 4.1)
    if (c.api_source?.includes('NMC_HOSPITAL') || /종합병원|의료원/.test(name)) s = 100;
    else if (/내과|소아과|외과|가정의학/.test(name)) s = 70;
    else if (/보건소|보건지소/.test(name)) s = 50;
    
    // Noise Filter (Animal, Mental, Admin, etc.)
    const isNoise = /동물|반려|정신|행정관|피부|치과|요양/.test(name) || /반려|동물/.test(cat);
    
    const d = c.distance || 0;
    const distScore = Math.max(0, (1 - (d / radius)) * 50); 
    const finalScore = s + distScore;
    
    return { ...c, simScore: finalScore, isExcluded: isNoise, distKm: d / 1000 };
  })
  .filter(h => !h.isExcluded)
  .sort((a, b) => b.simScore - a.simScore)
  .slice(0, 10);

  hosps.forEach((h, idx) => {
    log(`${idx+1}. ${h.name.padEnd(20)} | 거리: ${h.distKm.toFixed(1)}km | 점수: ${h.simScore.toFixed(1)} | ${h.address}`);
  });

  fs.writeFileSync('simulation_result_v10.txt', out.join('\n'), 'utf8');
}

simulate().catch(console.error);
