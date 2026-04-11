import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function getNormalizedAddr(addr) {
  if (!addr) return '';
  let normalized = addr.trim();
  const hashSidoMap = {
    '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시', '광주': '광주광역시',
    '대전': '대전광역시', '울산': '울산광역시', '세종': '세종특별자치시', '경기': '경기도', '강원': '강원특별자치도',
    '충북': '충청북도', '충남': '충청남도', '전북': '전라북도', '전남': '전라남도', '경북': '경상북도',
    '경남': '경상남도', '제주': '제주특별자치도'
  };
  for (const [short, full] of Object.entries(hashSidoMap)) {
    if (normalized.startsWith(short) && !normalized.startsWith(full)) {
      normalized = normalized.replace(short, full);
      break;
    }
  }
  return normalized;
}

function getCleanString(str) {
  if (!str) return '';
  return String(str).replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase();
}

const generateId = (source, name, addr) => {
  const normalizedAddr = getNormalizedAddr(addr);
  const cleanName = getCleanString(name);
  const cleanAddr = getCleanString(normalizedAddr);
  return uuidv5(`${source}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};

async function testCSV() {
  console.log('--- CSV vs Generated ID Test (Gyeongnam MART) ---');
  // Using LocalData download service URL for Gyeongnam (6480000) - MART (other_food_sales)
  const url = `https://www.localdata.go.kr/platform/rest/common/openDataPath/6480000/other_food_sales`;
  const res = await fetch(url);
  
  let count = 0;
  res.body
    .pipe(iconv.decodeStream('EUC-KR'))
    .pipe(csvParser())
    .on('data', (row) => {
      if (count < 5) {
        const name = row['사업장명'] || '';
        const addr = row['소재지전체주소'] || '';
        const id = generateId('LOCALDATA_MART_OTHER', name, addr);
        console.log(`- RAW: [${name}] [${addr}]`);
        console.log(`  CLEAN: [${getCleanString(name)}] [${getCleanString(getNormalizedAddr(addr))}]`);
        console.log(`  GEN_ID: ${id}`);
        count++;
      }
    })
    .on('end', () => console.log('Done.'));
}

testCSV();
