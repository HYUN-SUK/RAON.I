import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const KEY = process.env.PUBLIC_DATA_API_KEY;
if (!KEY) {
    console.log('ERROR: PUBLIC_DATA_API_KEY가 설정되어 있지 않습니다.');
    process.exit(1);
}

const apis = [
    {
        name: '대규모점포 조회서비스',
        url: 'http://apis.data.go.kr/1741000/large_scale_retail_stores/info',
        params: `serviceKey=${KEY}&pageNo=1&numOfRows=10&returnType=json`
    },
    {
        name: '기타식품판매업 조회서비스',
        url: 'http://apis.data.go.kr/1741000/other_food_retailers/info',
        params: `serviceKey=${KEY}&pageNo=1&numOfRows=10&returnType=json`
    },
    {
        name: '모범음식점정보 조회서비스',
        url: 'http://apis.data.go.kr/1741000/excellent_restaurant_info/info',
        params: `serviceKey=${KEY}&pageNo=1&numOfRows=10&returnType=json`
    }
];

async function testConnection() {
    process.stdout.write('🚀 API 연결 테스트 시작 (v11.5 정밀 주소 확인 버전)\n\n');

    for (const api of apis) {
        process.stdout.write(`[테스트] ${api.name}... `);
        try {
            const url = `${api.url}?${api.params}`;
            const res = await fetch(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const text = await res.text();
            
            if (res.ok) {
                try {
                    const json = JSON.parse(text);
                    if (json.response?.header?.resultCode === '00') {
                        console.log('✅ 성공 (정상 데이터 수신됨)');
                    } else {
                        console.log(`⚠️ 실패 (API 에러: ${json.response?.header?.resultMsg || '알 수 없는 에러'})`);
                        if (text.includes('LIMITED NUMBER OF SERVICE')) {
                            console.log('   -> 트래픽 초과 혹은 미승인 키');
                        }
                    }
                } catch (pe) {
                    if (text.includes('BPLC_NM') || text.includes('<item>') || text.includes('<code>00</code>')) {
                        console.log('✅ 성공 (XML 데이터 수신됨)');
                    } else {
                        console.log('❌ 실패 (응답은 오나 유효한 데이터가 아님)');
                        console.log('Sample:', text.substring(0, 150));
                    }
                }
            } else {
                console.log(`❌ 실패 (HTTP ${res.status})`);
                if (text.includes('SERVICE_KEY_IS_NOT_REGISTERED')) {
                    console.log('   -> [중요] 해당 서비스에 활용신청이 안 된 인증키입니다.');
                }
            }
        } catch (e) {
            console.log(`❌ 에러: ${e.message}`);
        }
    }
    process.stdout.write('\n🏁 테스트 종료\n');
}

testConnection();
