
function getNormalizedAddr(addr) {
    if (!addr) return '';
    let a = addr.replace(/,\s?대한민국$/, '').trim();
    a = a.replace(/^(세종특별자치시|세종)\s?/, '세종특별자치시 ');
    // ... (기타 변환 생략)
    return a.trim();
}

const extractSido = (addr) => {
    if (!addr) return null;
    const normalized = getNormalizedAddr(addr);
    const standardSidos = ['세종특별자치시'];
    return standardSidos.find(s => normalized.startsWith(s)) || null;
};

const extractSigungu = (addr) => {
    if (!addr) return null;
    const normalized = getNormalizedAddr(addr);
    const sido = extractSido(addr);
    if (!sido) return null;
    const parts = normalized.replace(sido, '').trim().split(' ');
    if (parts.length >= 2 && (parts[0].endsWith('시') || parts[0].endsWith('군')) && (parts[1].endsWith('구') || parts[1].endsWith('시'))) {
        return `${parts[0]} ${parts[1]}`;
    }
    return parts[0] || null;
};

const testAddr = '세종특별자치시 수목원로 136';
console.log('--- Sejong Arboretum ---');
console.log('Address:', testAddr);
console.log('Sido:', extractSido(testAddr));
console.log('Sigungu:', extractSigungu(testAddr));

const hospitalAddr = '세종특별자치시 보듬7로 20';
console.log('\n--- Sejong CNU Hospital ---');
console.log('Address:', hospitalAddr);
console.log('Sido:', extractSido(hospitalAddr));
console.log('Sigungu:', extractSigungu(hospitalAddr));

const triniumAddr = '세종특별자치시 국책연구원3로 6';
console.log('\n--- Trinium Hospital ---');
console.log('Address:', triniumAddr);
console.log('Sigungu:', extractSigungu(triniumAddr));
