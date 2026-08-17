async function scrapeLocalDataLinks() {
    console.log('--- localdata.go.kr 다운로드 페이지 스크랩 ---');
    try {
        const res = await fetch('https://www.localdata.go.kr/devcenter/dataDown.do?menuNo=20001', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await res.text();
        console.log(`페이지 크기: ${html.length}자`);
        
        // orgCode 또는 download 관련 패턴 검색
        const matches = html.match(/6460000|6290000|광주|전남|전라남도|통합/g);
        console.log('매칭된 키워드:', matches?.slice(0, 20));

        // select option 태그나 orgCode 매핑 추출
        const options = html.match(/<option[^>]*value="[^"]*"[^>]*>[^<]*<\/option>/g) || [];
        console.log(`발견된 option 태그 ${options.length}개:`);
        for (const opt of options) {
            if (/광주|전남|전라남도|통합|전남광주/.test(opt)) {
                console.log('  ->', opt);
            }
        }
    } catch (e) {
        console.log('스크랩 실패:', e.message);
    }
}

scrapeLocalDataLinks();
