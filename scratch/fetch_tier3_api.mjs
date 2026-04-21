import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;
const ENDPOINT = 'https://api.data.go.kr/openapi/tn_pubr_public_trrsrt_api';

async function fetchAllStandardData() {
    console.log("=== [Tier 3] 공공데이터 API 전수 수집 시작 ===");
    let allData = [];
    let pageNo = 1;
    const numOfRows = 200;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
        console.log(`- ${pageNo}페이지 호출 중... (건당 ${numOfRows}개)`);
        // 공공데이터 API는 특수문자가 포함된 인증키의 경우 인코딩 문제로 실패할 수 있으므로 주의가 필요합니다.
        const url = `${ENDPOINT}?serviceKey=${API_KEY}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`;
        
        try {
            await sleep(500); // 0.5초 대기
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const json = await response.json();

            if (!json.response || !json.response.header) {
                console.error("응답 형식이 올바르지 않습니다.");
                break;
            }

            if (json.response.header.resultCode !== '00') {
                console.error("API 응답 에러:", json.response.header.resultMsg);
                break;
            }

            const items = json.response.body.items;
            if (!items || items.length === 0) {
                console.log("더 이상 데이터가 없습니다.");
                break;
            }

            allData = allData.concat(items);
            console.log(`  현재까지 ${allData.length}건 수집 완료`);

            if (items.length < numOfRows) break;
            pageNo++;
        } catch (err) {
            console.error(`  ${pageNo}페이지 수집 실패:`, err.message);
            console.log("  3초 후 재시도합니다...");
            await sleep(3000);
            // 재시도 횟수 제한 없이 반복 시도 (사용자 요청 완수 우선)
        }
    }

    console.log(`\n총 ${allData.length}건 수집 완료.`);

    // 리스트 파일 생성
    let mdContent = `# 🏛️ 전국관광지정보표준데이터 전수 리스트 (Tier 3)\n\n`;
    mdContent += `> **수집 일시**: ${new Date().toLocaleString()}\n`;
    mdContent += `> **총 데이터 건수**: ${allData.length}건\n\n`;

    // 권역별 분류 (Sido 기반)
    const grouped = {};
    allData.forEach(item => {
        const sido = item.rdnmadr?.split(' ')[0] || item.lnmadr?.split(' ')[0] || '기타';
        if (!grouped[sido]) grouped[sido] = [];
        grouped[sido].push(item.trrsrtNm);
    });

    Object.keys(grouped).sort().forEach(sido => {
        mdContent += `### ${sido}\n`;
        mdContent += `- ${grouped[sido].join(', ')}\n\n`;
    });

    fs.writeFileSync('korea_tourist_spots_standard_FULL.md', mdContent);
    console.log("=== 파일 생성 완료: korea_tourist_spots_standard_FULL.md ===");
}

fetchAllStandardData();
