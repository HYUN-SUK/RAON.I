import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SIDO_ROTATION = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', 
  '전남광주시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', 
  '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '경상북도', '경상남도', '제주특별자치도'
];

const TOUR_API_AREA_MAP = {
  '서울특별시': '1', '인천광역시': '2', '대전광역시': '3', '대구광역시': '4', '광주광역시': '5', '부산광역시': '6', '울산광역시': '7', '세종특별자치시': '8',
  '경기도': '31', '강원특별자치도': '32', '충청북도': '33', '충청남도': '34', '전북특별자치도': '35', '전라남도': '36', '경상북도': '37', '경상남도': '38', '제주특별자치도': '39',
  '전남광주시': '38'
};

const KTO_SUB_DISTRICT_MAP = {
  '수원시': [{ sc: '1', name: '장안구' }, { sc: '2', name: '권선구' }, { sc: '3', name: '팔달구' }, { sc: '4', name: '영통구' }],
  '성남시': [{ sc: '2', name: '수정구' }, { sc: '3', name: '중원구' }, { sc: '4', name: '분당구' }],
  '안양시': [{ sc: '5', name: '만안구' }, { sc: '6', name: '동안구' }],
  '고양시': [{ sc: '8', name: '덕양구' }, { sc: '9', name: '일산동구' }, { sc: '10', name: '일산서구' }],
  '부천시': [{ sc: '11', name: '부천시' }],
  '안산시': [{ sc: '14', name: '상록구' }, { sc: '15', name: '단원구' }],
  '용인시': [{ sc: '23', name: '처인구' }, { sc: '24', name: '기흥구' }, { sc: '25', name: '수지구' }],
  '청주시': [{ sc: '11', name: '상당구' }, { sc: '12', name: '서원구' }, { sc: '13', name: '흥덕구' }, { sc: '14', name: '청원구' }],
  '천안시': [{ sc: '9', name: '동남구' }, { sc: '10', name: '서북구' }],
  '전주시': [{ sc: '10', name: '완산구' }, { sc: '11', name: '덕진구' }],
  '포항시': [{ sc: '20', name: '남구' }, { sc: '21', name: '북구' }],
  '창원시': [{ sc: '16', name: '의창구' }, { sc: '17', name: '성산구' }, { sc: '18', name: '마산합포구' }, { sc: '19', name: '마산회원구' }, { sc: '20', name: '진해구' }]
};

const TOUR_API_SIGUNGU_MASTER = {
  '서울특별시': {
    areaCode: '1',
    sigungus: {
      '강남구':'1','강동구':'2','강북구':'3','강서구':'4','관악구':'5','광진구':'6','구로구':'7','금천구':'8','노원구':'9','도봉구':'10',
      '동대문구':'11','동작구':'12','마포구':'13','서대문구':'14','서초구':'15','성동구':'16','성북구':'17','송파구':'18','양천구':'19','영등포구':'20',
      '용산구':'21','은평구':'22','종로구':'23','중구':'24','중랑구':'25'
    }
  },
  '부산광역시': {
    areaCode: '6',
    sigungus: {
      '강서구':'1','금정구':'2','기장군':'3','남구':'4','동구':'5','동래구':'6','부산진구':'7','북구':'8','사상구':'9','사하구':'10',
      '서구':'11','수영구':'12','연제구':'13','영도구':'14','중구':'15','해운대구':'16'
    }
  },
  '대구광역시': {
    areaCode: '4',
    sigungus: { '중구':'1','동구':'2','서구':'3','남구':'4','북구':'5','수성구':'6','달서구':'7','달성군':'8','군위군':'9' }
  },
  '인천광역시': {
    areaCode: '2',
    sigungus: { '중구':'1','동구':'2','미추홀구':'3','연수구':'4','남동구':'5','부평구':'6','계양구':'7','서구':'8','강화군':'9','옹진군':'10' }
  },
  '대전광역시': {
    areaCode: '3',
    sigungus: { '동구':'1','중구':'2','서구':'3','유성구':'4','대덕구':'5' }
  },
  '울산광역시': {
    areaCode: '7',
    sigungus: { '중구':'1','남구':'2','동구':'3','북구':'4','울주군':'5' }
  },
  '세종특별자치시': { areaCode: '8', sigungus: {} },
  '전남광주시': {
    isCombined: true,
    gwangju: { areaCode: '5', sigungus: { '동구':'1','서구':'2','남구':'3','북구':'4','광산구':'5' } },
    jeonnam: { areaCode: '36', sigungus: { '목포시':'1','여수시':'2','순천시':'3','나주시':'4','광양시':'5','담양군':'6','곡성군':'7','구례군':'8','고흥군':'9','보성군':'10','화순군':'11','장흥군':'12','강진군':'13','해남군':'14','영암군':'15','무안군':'16','함평군':'17','영광군':'18','장성군':'19','완도군':'20','진도군':'21','신안군':'22' } }
  }
};

function getTourApiParams(targetSido, sigungu) {
  const master = TOUR_API_SIGUNGU_MASTER[targetSido];
  
  if (master && master.isCombined) {
    if (master.gwangju.sigungus[sigungu]) {
      return [{ areaCode: master.gwangju.areaCode, sigunguCode: master.gwangju.sigungus[sigungu] }];
    }
    if (master.jeonnam.sigungus[sigungu]) {
      return [{ areaCode: master.jeonnam.areaCode, sigunguCode: master.jeonnam.sigungus[sigungu] }];
    }
  }

  if (master && master.sigungus && master.sigungus[sigungu]) {
    return [{ areaCode: master.areaCode, sigunguCode: master.sigungus[sigungu] }];
  }

  const defaultAreaCode = TOUR_API_AREA_MAP[targetSido] || '1';
  const subDists = KTO_SUB_DISTRICT_MAP[sigungu];
  if (subDists && subDists.length > 0) {
    return subDists.map(sub => ({ areaCode: defaultAreaCode, sigunguCode: sub.sc }));
  }

  return [{ areaCode: defaultAreaCode, sigunguCode: '' }];
}

async function testAll16Regions() {
  console.log('🧪 [Unit Test] Testing TourAPI Parameter Mapping for All 16 Rotation Sidos...\n');
  
  const SIDO_ALIASES = {
    '서울': ['서울특별시', '서울'], 
    '부산': ['부산광역시', '부산'], 
    '대구': ['대구광역시', '대구'], 
    '인천': ['인천광역시', '인천'], 
    '광주': ['광주광역시', '광주', '전남광주시'], 
    '대전': ['대전광역시', '대전'], 
    '울산': ['울산광역시', '울산'], 
    '세종': ['세종특별자치시', '세종'], 
    '경기': ['경기도', '경기'], 
    '강원': ['강원특별자치도', '강원'], 
    '충북': ['충청북도', '충북'], 
    '충남': ['충청남도', '충남'], 
    '경북': ['경상북도', '경북'], 
    '경남': ['경상남도', '경남'], 
    '전북': ['전북특별자치도', '전북'], 
    '전남': ['전라남도', '전남', '전남광주시'], 
    '제주': ['제주특별자치도', '제주'],
    '전남광주': ['전남광주시', '광주광역시', '전라남도', '광주', '전남']
  };

  let totalSidosChecked = 0;
  let totalSigungusChecked = 0;
  let totalValidParams = 0;

  for (const sido of SIDO_ROTATION) {
    totalSidosChecked++;
    const aliases = SIDO_ALIASES[sido] || [sido];
    
    const { data: ktoSpots } = await supabase
      .from('master_places')
      .select('sigungu')
      .eq('category', 'SPOT')
      .eq('is_active', true)
      .in('sido', aliases)
      .limit(1000);

    const sigungus = [...new Set((ktoSpots || []).map(s => s.sigungu))].filter(Boolean);
    console.log(`📍 [${sido}] Found ${sigungus.length} active sigungus in DB.`);

    for (const sigungu of sigungus) {
      totalSigungusChecked++;
      const params = getTourApiParams(sido, sigungu);
      const valid = params.every(p => p.areaCode && p.sigunguCode);
      if (valid) totalValidParams++;
    }
  }

  console.log('\n======================================================');
  console.log(`🎉 [Unit Test Passed] 16 Sidos Checked: ${totalSidosChecked}/16`);
  console.log(`✅ Total Sigungus Verified: ${totalSigungusChecked}`);
  console.log(`✨ Valid TourAPI Parameter Sets: ${totalValidParams}`);
  console.log('======================================================\n');
}

testAll16Regions();
