// LOCALDATA_RESTAURANT XLSX 파싱 진단 스크립트
const fetch = require('node-fetch');
const XLSX = require('xlsx');
const fs = require('fs');

async function main() {
  const out = [];
  const log = (...args) => { const line = args.join(' '); out.push(line); };

  log('=== LOCALDATA_RESTAURANT XLSX 파싱 진단 ===');
  
  const url = 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx';
  log('Downloading XLSX from:', url);
  
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  log('HTTP Status:', res.status);
  log('Content-Type:', res.headers.get('content-type'));
  
  const buffer = Buffer.from(await res.arrayBuffer());
  log('Buffer size:', buffer.length, 'bytes');
  
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  log('Sheet names:', JSON.stringify(workbook.SheetNames));
  
  const sheetName = workbook.SheetNames[0];
  const records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  log('Total parsed records:', records.length);
  
  if (records.length > 0) {
    // 첫 번째 레코드의 모든 키 출력
    const firstRecord = records[0];
    log('\n=== 첫 번째 레코드 키 목록 ===');
    const keys = Object.keys(firstRecord);
    keys.forEach(k => log(`  KEY: "${k}" => VALUE: "${String(firstRecord[k]).substring(0, 50)}"`));
    
    // 코드에서 사용하는 키 매핑 확인
    log('\n=== 코드 키 매핑 점검 ===');
    const nameKeys = ['사업장명', '업소명', '상호', 'BPLC_NM', 'bplcNm'];
    const addrKeys = ['도로명전체주소', '소재지전체주소', 'RDNWHL_ADDR', 'SITE_WHL_ADDR'];
    const statusKeys = ['상세영업상태명', '상세영업상태', '영업상태명', '상태명', 'TRD_STATE_NM', 'trdStateNm'];
    
    log('Name key match:', nameKeys.filter(k => firstRecord[k] !== undefined));
    log('Addr key match:', addrKeys.filter(k => firstRecord[k] !== undefined));
    log('Status key match:', statusKeys.filter(k => firstRecord[k] !== undefined));
    
    // 상태값 분석
    log('\n=== 영업상태 분포 분석 (상위 30건) ===');
    const statusDist = {};
    const statusKey = statusKeys.find(k => records.some(r => r[k] !== undefined));
    log('Found status key:', statusKey || 'NONE');
    
    if (statusKey) {
      records.forEach(r => {
        const s = String(r[statusKey] || 'EMPTY');
        statusDist[s] = (statusDist[s] || 0) + 1;
      });
      Object.entries(statusDist).sort((a,b) => b[1]-a[1]).slice(0,30).forEach(([k,v]) => {
        log(`  "${k}": ${v}건`);
      });
    } else {
      // 모든 키 중 '상태' 또는 'state' 포함하는 키 찾기
      log('상태 키를 찾지 못함. 상태 관련 키 탐색:');
      keys.filter(k => k.includes('상태') || k.toLowerCase().includes('state') || k.includes('영업')).forEach(k => {
        log(`  FOUND: "${k}" => "${String(firstRecord[k]).substring(0, 50)}"`);
      });
    }
    
    // 이름/주소 유효 건수
    const nameKey = nameKeys.find(k => records.some(r => r[k] !== undefined));
    const addrKey = addrKeys.find(k => records.some(r => r[k] !== undefined));
    log('\n=== 유효 데이터 필터링 시뮬레이션 ===');
    log('Name key used:', nameKey || 'NONE');
    log('Addr key used:', addrKey || 'NONE');
    
    let withName = 0, withAddr = 0, withBoth = 0, withStatus영업 = 0, passFilter = 0;
    for (const r of records) {
      const name = (r[nameKey] || '').toString().trim();
      const addr = (r[addrKey] || '').toString().trim();
      const status = statusKey ? (r[statusKey] || '').toString() : '';
      
      if (name) withName++;
      if (addr) withAddr++;
      if (name && addr) withBoth++;
      if (status.includes('영업')) withStatus영업++;
      
      // 코드 로직 시뮬레이션: if (!name || !addr || (status && !String(status).includes('영업'))) continue;
      if (name && addr && (!status || String(status).includes('영업'))) passFilter++;
    }
    
    log(`  이름 있음: ${withName}/${records.length}`);
    log(`  주소 있음: ${withAddr}/${records.length}`);
    log(`  이름+주소 있음: ${withBoth}/${records.length}`);
    log(`  영업 상태: ${withStatus영업}/${records.length}`);
    log(`  필터 통과 (name && addr && (no status || includes 영업)): ${passFilter}/${records.length}`);
    
    // 좌표 존재 여부
    const coordKeys = keys.filter(k => k.includes('좌표') || k === 'X' || k === 'Y' || k === 'x' || k === 'y');
    log('\n=== 좌표 관련 키 ===');
    coordKeys.forEach(k => log(`  "${k}" => "${String(firstRecord[k]).substring(0, 30)}"`));
    
    if (coordKeys.length === 0) {
      log('  ⚠️ 좌표 관련 키 없음! -> 모든 레코드에 지오코딩 필요');
    }
  }
  
  fs.writeFileSync('diag_localdata.txt', out.join('\n'), 'utf8');
  console.log('Done. Written to diag_localdata.txt');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
