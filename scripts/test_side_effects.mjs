import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MOUNTAIN_PRESETS = {
    '지리산 천왕봉': { lat: 35.3128, lng: 127.7584, parkingName: '지리산 중산리 탐방지원센터 주차장' },
    '설악산 대청봉': { lat: 38.1732, lng: 128.4901, parkingName: '설악산 소공원 주차장' },
    '한라산 백록담': { lat: 33.3867, lng: 126.6074, parkingName: '한라산 성판악 탐방로 주차장' },
};

async function resolveDestinationCoords(destination, destName, apiKey) {
    const cleanName = (destName || '').trim();
    for (const [key, preset] of Object.entries(MOUNTAIN_PRESETS)) {
        if (cleanName.includes(key) || key.includes(cleanName)) {
            return {
                lat: preset.lat,
                lng: preset.lng,
                name: preset.parkingName,
                isRefined: true,
                originalName: destName
            };
        }
    }
    return {
        lat: destination.lat,
        lng: destination.lng,
        name: destName || '목적지',
        isRefined: false
    };
}

async function testSideEffects() {
  console.log('====================================================');
  console.log('🔍 산악 보정 및 일반 목적지 사이드이펙트 실측 검증');
  console.log('====================================================\n');

  // Case 1: Normal Camping Site (가평 라온아이 캠핑장)
  const normalDest = { lat: 37.831, lng: 127.509 };
  const resNormal = await resolveDestinationCoords(normalDest, '라온아이 캠핑장');
  console.log('📌 Case 1. 일반 캠핑장 목적지 테스트 (가평 라온아이):');
  console.log('   Result:', resNormal);
  console.log('   Check: isRefined === false (보정 없이 원본 100% 사용):', !resNormal.isRefined ? '✅ PASS (부작용 없음)' : '❌ FAIL');

  // Case 2: Known Mountain Preset (지리산 천왕봉)
  const mountainDest = { lat: 35.337, lng: 127.730 };
  const resMountain = await resolveDestinationCoords(mountainDest, '지리산 천왕봉');
  console.log('\n📌 Case 2. 산악 랜드마크 목적지 테스트 (지리산 천왕봉):');
  console.log('   Result:', resMountain);
  console.log('   Check: isRefined === true & 중산리 주차장 보정:', resMountain.isRefined ? '✅ PASS (정상 작동)' : '❌ FAIL');

  console.log('\n====================================================\n');
}

testSideEffects();
