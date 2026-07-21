import { v5 as uuidv5 } from 'uuid';

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function getNormalizedAddr(addr) {
  if (!addr) return '';
  let a = addr.replace(/\s+/g, ' ').trim();
  
  // 경기도 광주시 보정 로직
  const isGyeonggiGwangju = /^(경기|경기도|광주|광주시)\s/.test(a) && 
    (/(오포읍|초월읍|곤지암읍|도척면|퇴촌면|남종면|남한산성면)/.test(a));

  if (isGyeonggiGwangju) {
    a = a.replace(/^(경기|경기도|광주|광주시)\s(광주시\s)?/, '경기도 광주시 ');
    return a.trim();
  }

  // Standardize Sido
  a = a.replace(/^(서울|서울특별시)\s?/, '서울특별시 ');
  a = a.replace(/^(경기|경기도)\s?/, '경기도 ');
  return a.trim();
}

function getCleanString(str) {
  if (!str) return '';
  return String(str)
    .replace(/\(.+?\)/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const generateId = (source, name, addr) => {
  const normalizedAddr = getNormalizedAddr(addr);
  const cleanName = getCleanString(name);
  const cleanAddr = getCleanString(normalizedAddr);
  return uuidv5(`${source}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};

const generated = generateId('LOCALDATA_RESTAURANT_GOOD', '가평축협 한우명가', '경기도 가평군 가평읍 달전로 19');
console.log(`생성된 ID: ${generated}`);
console.log(`DB 실제 ID: 0417b07d-f432-5952-adfe-2add87ea41e5`);
console.log(`일치 여부: ${generated === '0417b07d-f432-5952-adfe-2add87ea41e5'}`);
