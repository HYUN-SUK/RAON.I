/**
 * @file reliability.ts
 * @description 스마트 캠핑 플랜 ETL 5.0 - 신뢰도 가중치 및 중복 처리 엔진
 * [핵심 로직]
 * 1. Grouping: 이름과 주소를 정규화하여 동일 장소 그룹화
 * 2. Scoring: 공공 API 출처 개수에 따른 보너스 점수 부여 (Certification Bonus)
 * 3. Merging: 여러 출처의 배지, 평점, 인증 정보를 하나의 FactCard로 통합
 */

export interface RawPlace {
  id: string;
  name: string;
  address: string;
  category: string;
  api_source: string;
  lat: number;
  lng: number;
  raw_data: any;
  trust_score?: number;
}

export interface MergedPlace extends RawPlace {
  certifiedSources: string[];
  certificationBonus: number;
  totalTrustScore: number;
  badges: string[];
  certifications: string[];
  brandScore?: number;
}

/**
 * 마트 브랜드별 우선순위 점수 산출 (SSOT v10.2 매뉴얼 준수)
 */
function calcMartBrandScore(name: string): number {
  const n = name.toUpperCase();
  if (n.includes('하나로마트') || n.includes('NH농협') || n.includes('농협마트')) return 90;
  
  const BIG_3 = ['이마트', '롯데마트', '홈플러스', '노브랜드', '트레이더스'];
  if (BIG_3.some(b => n.includes(b))) return 80;
  
  const SSM = ['GS THE FRESH', 'GS더프레시', '이마트에브리데이', '홈플러스익스프레스', '식자재마트'];
  if (SSM.some(s => n.includes(s))) return 65;
  
  return 60; // 기본 마트 점수
}

/**
 * 캠핑과 무관한 비식품 판매시설 필터링
 */
function isMartNoise(name: string): boolean {
  const NOISE_KEYWORDS = ['패션', '아울렛', '의류', '가구', '침대', '웨딩', '시마을', '전시장'];
  return NOISE_KEYWORDS.some(k => name.includes(k));
}

/**
 * 주소 정규화 (중복 판정의 정확도를 높이기 위함)
 */
function normalizeAddress(addr: string): string {
  if (!addr) return '';
  return addr
    .replace(/\s+/g, ' ') // 공백 단일화
    .replace(/[,\.]/g, '') // 마침표, 쉼표 제거
    .replace(/특별시|광역시|세종특별자치시/g, '') // 광역단체명 간소화
    .trim();
}

/**
 * 1. 동일 장소 그룹화 및 신뢰도 점수 산출
 */
export function groupAndScorePlaces(places: RawPlace[]): MergedPlace[] {
  const groups: Record<string, RawPlace[]> = {};

  // Grouping by Name + Normalized Address
  places.forEach((p) => {
    // 마트 카테고리의 경우 노이즈 필터링 적용
    if (p.category === 'MART' && isMartNoise(p.name)) return;

    const key = `${p.name.trim()}|${normalizeAddress(p.address)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  return Object.values(groups).map((group) => {
    // 가장 신뢰도 높은 소스를 메인으로 선택 (점수 기준 정렬)
    const sorted = group.sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0));
    const main = sorted[0];

    const sources = group.flatMap((p) => p.api_source.split(',').map(s => s.trim()));
    const uniqueSources = Array.from(new Set(sources));

    // 중복 인증 보너스 (매뉴얼 기반)
    // 1개: 0, 2개: +15, 3개 이상: +30
    let bonus = 0;
    if (uniqueSources.length === 2) bonus = 15;
    else if (uniqueSources.length >= 3) bonus = 30;

    let baseScore = main.trust_score || 40;
    
    // 마트 카테고리의 경우 브랜드 기반 점수 재산출 (SSOT v10.2)
    let bScore = undefined;
    if (main.category === 'MART') {
      bScore = calcMartBrandScore(main.name);
      baseScore = bScore;
    }

    const finalScore = Math.min(100, baseScore + bonus);

    // 배지 및 인증 정보 통합
    const badges: string[] = [];
    const certs: string[] = [];
    
    uniqueSources.forEach(s => {
      if (s === 'SMBA_BAEK') { badges.push('백년가게'); certs.push('중기부 백년가게'); }
      if (s === 'SAFE_RESTAURANT') { badges.push('안심식당'); certs.push('농식품부 안심식당'); }
      if (s === 'MOIS_GOOD_RESTAURANT' || s === 'LOCALDATA_RESTAURANT') { 
        badges.push('모범음식점'); 
        certs.push('행안부 모범음식점'); 
      }
      if (s === 'NMC_HOSPITAL') { badges.push('응급의료기관'); certs.push('응급의료기관'); }
      if (s === 'OPINET') { badges.push('공인주유소'); }
      if (s === 'LOCALDATA_MART' || s.includes('LOCALDATA_MART_LARGE')) { badges.push('대형마트'); }
      if (s.includes('LOCALDATA_MART_SSM')) { badges.push('준대규모점포'); }
      if (s.includes('LOCALDATA_MART_SUPER')) { badges.push('식품판매업'); }
    });

    return {
      ...main,
      certifiedSources: uniqueSources,
      certificationBonus: bonus,
      totalTrustScore: finalScore,
      badges: Array.from(new Set(badges)),
      certifications: Array.from(new Set(certs)),
      brandScore: bScore
    };
  });
}
