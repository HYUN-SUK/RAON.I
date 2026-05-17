# 라온아이 스마트플랜 특허 논의를 위한 아키텍처 및 코드 컨텍스트

이 문서는 라온아이(RAON.I) 스마트 캠핑 플랜 시스템의 특허성(BM 및 기술 특허)을 논의하기 위해 정리된 프롬프트입니다. 아래의 5가지 핵심 특허 후보와 실제 코드 스니펫을 바탕으로 특허 청구항의 가치와 차별성을 평가해 주세요.

---

## 1. 프로젝트 아키텍처 철학 (Background)
라온아이의 스마트 캠핑 플랜은 단순한 앱 기능이 아닌, 향후 B2B API 서버로 독립 가능한 **"헤드리스 지능형 엔진(Headless Intelligent Engine)"**입니다. 
유료 API 호출이나 LLM의 무작위 생성에 의존하지 않고, 공공데이터를 0원(Zero-Cost)으로 정제하여 초정밀 팩트(JSON)를 구축한 후, 이를 바탕으로 개인화된 5단계 여정 서사를 만들어냅니다.

---

## 2. 특허 후보 1: 리소스 제한 환경의 일일 지역 로테이션 갱신 
- **개념**: 공공 API의 일일 호출 한도(Quota) 한계를 극복하기 위해 전국 데이터를 한 번에 갱신하지 않고, 사용자 트래픽과 예약 기반으로 지역을 분할하여 병렬/비동기로 갱신하는 쿼터 최적화 로직.
- **코드 스니펫 (`sync-smart-plan/route.ts` 발췌)**:
```typescript
// 카테고리별 Limit 제어 및 로테이션 쿼터 병렬 할당 로직
const categories = [
    { cat: 'RESTAURANT', limit: 1000 },
    { cat: 'MART', limit: 100 },
    { cat: 'SPOT', limit: 100 },
    { cat: 'FESTIVAL', limit: 100 },
    { cat: 'HOSPITAL', limit: 100 },
    { cat: 'GAS_STATION', limit: 100 }
];

// Promise.all을 통한 병렬 쿼터 검색 처리
await Promise.all(categories.map(async ({ cat, limit }) => {
    const { data } = await supabase.rpc('get_master_places_in_radius', {
        target_lat: targetLat, 
        target_lng: targetLng, 
        radius_meters: 30000, 
        limit_count: limit, 
        p_category: cat
    });
    if (data) candidates.push(...data);
}));
```

---

## 3. 특허 후보 2: 다중 소스 결합형 하이브리드 페르소나 스코어링 엔진
- **개념**: 단순 별점 추천이 아닌, 정적 데이터(백년가게/LX 인증 등), 동적 환경(우천/강설), 사용자 구성(시니어/영유아/반려견 유무) 등 이질적 데이터를 결합해 여정 적합도(`ContextFit`)를 도출하는 엔진.
- **코드 스니펫 (`src/lib/smartPlan.ts` 발췌)**:
```typescript
// 실시간 날씨 및 페르소나 기반 ContextFit 계산 로직
export function calcContextFitDeep(f: FactCard, weather: string, isWinter: boolean, persona: UserPersona): number {
    let score = 25; // Base contextFit
    const name = f.name || '';
    const text = name + ' ' + (f.description || '');
    
    // 유저 페르소나 센서 수집
    const hasKids = (persona.guestDetails?.kids?.preschool || 0) > 0;
    const hasPet = persona.guestDetails?.hasPet || false;
    const seniors = persona.guestDetails?.seniors || 0;

    // 1. Weather Deep Score (기상 변수 융합)
    if (weather.includes('비') || weather.includes('눈')) {
        if (text.match(/탕|찌개|칼국수|국밥|전골/)) score += 20;
        if (text.match(/박물관|실내|미술관/)) score += 20;
    }
    if (weather.includes('맑음')) {
        if (text.match(/막국수|냉면|구이/)) score += 15;
        if (text.match(/수목원|둘레길|계곡|야외|산책/)) score += 15;
    }

    // 2. Strong Signal Safety Score (위험 회피 및 안전 가점)
    let safetyScore = 0;
    if (hasKids) {
        if (f.category === 'HOSPITAL' && text.match(/소아과|아동병원/)) safetyScore += 40;
        if (text.match(/어린이|노키즈존/)) {
            if (text.includes('노키즈존')) safetyScore -= 40; // 패널티
            else safetyScore += 10;
        }
    }
    if (hasPet && text.match(/애견동반|반려동물/)) safetyScore += 15;
    if (seniors > 0 && text.match(/백숙|보양식|한정식/)) safetyScore += 15;

    return Math.max(0, Math.min(100, score + safetyScore));
}

// 점수 합산 방정식
// Final Score = Base + ContextFit + Logistics(거리) + Bonus(인증) - Penalty
f.trustScore = 50 + cFit + distScore + simpleSpotBonus + certBonus + tierBonus;
```

---

## 4. 특허 후보 3: D-3 이벤트 기반 이중 트랙 캐싱 파이프라인
- **개념**: 여행(체크인) 3일 전이라는 명확한 '이벤트(Event)'를 트리거로, 무거운 데이터 수집은 사전 클러스터링(Track A)으로 끝내고, 사용자 요청 시에는 실시간 계산(Track B)만 하는 비동기 구조.
- **코드 스니펫 (`caching-smart-plan.mjs` 발췌)**:
```javascript
// D-3 예약 타겟팅 (체크인 정확히 3일 전 대상자 색출)
let targetStr = new Date(new Date().getTime() + 12 * 3600000 + 3 * 86400000).toISOString().split('T')[0];
const { data: schedules } = await supabase.from('user_schedules').select('*').eq('check_in', targetStr);

let clusters = [];
for (const s of schedules) {
    // 반경 20km Geo-Clustering을 통한 좌표 병합 (호출 비용 감소)
    let cluster = clusters.find(c => {
        const dLine = Math.sqrt(Math.pow(c.points[0].lat - s.lat, 2) + Math.pow(c.points[0].lng - s.lng, 2)) * 111;
        return dLine <= 20; 
    });
    
    if (cluster) cluster.points.push({ lat: s.lat, lng: s.lng });
    else clusters.push({ points: [{ lat: s.lat, lng: s.lng }], names: [s.campground_name] });
}
```

---

## 5. 특허 후보 4: 다중 공공데이터 병합을 위한 멱등적 식별자 생성 기법
- **개념**: 소스(행안부, 관광공사, 카카오 등)가 달라도, 지역명(Sido) 통일화와 공격적 문자열 정제(Aggressive Cleaning)를 통해 동일 장소에 항상 같은 UUID v5 마스터 키를 발급하여 중복을 원천 차단하는 기법.
- **코드 스니펫 (`caching-smart-plan.mjs` 발췌)**:
```javascript
// 1. Sido Unification (광역지자체명 정규화)
function getNormalizedAddr(addr) {
    let a = addr.replace(/,\s?대한민국$/, '').trim();
    a = a.replace(/^(서울|서울특별시)\s?/, '서울특별시 ');
    a = a.replace(/^(경기|경기도)\s?/, '경기도 ');
    // ... 생략 ...
    return a.trim();
}

// 2. 특수문자 및 노이즈 공격적 정제
const getCleanString = (str) => {
    let s = String(str);
    if (s.includes(':')) s = s.split(':').pop();
    // 괄호, 강조 표시, 띄어쓰기를 완전히 무시하여 고유 형태소만 추출
    return s.replace(/\*\*.*?\*\*/g, '').replace(/\(.*?\)/g, '')
            .replace(/[^a-z0-9가-힣]/gi, '').toLowerCase().trim();
};

// 3. 멱등적 UUID v5 생성
const generateFactId = (source, name, address) => {
    const cleanSource = getCleanString(source);
    const cleanName = getCleanString(name);
    const cleanAddr = getCleanString(getNormalizedAddr(address));
    return uuidv5(`${cleanSource}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};
```

---

## 6. 특허 후보 5: 동절기 자원 확보를 위한 나선형 탐색 및 3중 폴백 로직
- **개념**: 생존 필수재인 '동계 등유' 주유소를 반드시 확보하기 위해 반경을 동적으로 나선형 확장(Spiral Search)하며, API 주소가 누락될 경우 TM128 좌표를 WGS84로 변환 후 카카오 역지오코딩을 태우는 3중 보강 기술.
- **코드 스니펫 (`caching-smart-plan.mjs` 발췌)**:
```javascript
// 5km ~ 30km 나선형 확장(Spiral Search) 오프셋 매트릭스
const spiralShifts = [
    [{x:0, y:0}], // 1차 탐색 (중심점)
    [{x:10000,y:0}, {x:-10000,y:0}, {x:0,y:10000}, {x:0,y:-10000}], // 2차 확장
    // 3차, 4차 확장 로직 ...
];

for (const group of spiralShifts) {
    if (seenGas.size >= 15) break; 
    
    // TM128 특수 좌표계 투사 및 다중 병렬 API 호출
    const gasPromises = group.map(s => {
        const url = `http://www.opinet.co.kr/api/aroundAll.do?...&x=${Math.round(wtmX+s.x)}&y=${Math.round(wtmY+s.y)}&radius=5000&prodcd=C004`;
        return fetch(url).then(r => r.json());
    });
    
    // 결과 처리 및 3중 주소 보강(Fallback)
    // 1순위 API 기본 주소 -> 2순위 도로명 주소 -> 3순위 WGS84 변환 후 역지오코딩
    let gasAddress = item.VAN_ADR || item.NEW_ADR || '';
    if (!gasAddress && KAKAO_KEY) {
        // proj4를 이용한 EPSG:4326(WGS84) 좌표계 변환
        const [gLon, gLat] = proj4("TM128", "EPSG:4326", [parseFloat(item.GIS_X_COOR), parseFloat(item.GIS_Y_COOR)]);
        const rgr = await fetch(`https://dapi.kakao.com/.../coord2address.json?x=${gLon}&y=${gLat}`);
        gasAddress = rgr.documents[0].road_address?.address_name;
    }
}
```

---

## 7. 특허 후보 6: AI 서사 기반 무지연(Zero-Latency) 적응형 교체 시스템 및 동적 라우팅
- **개념**: 단순한 장소 목록을 제공하는 것을 넘어, 1순위 추천 노드와 대체(Alternative) 노드 그룹을 일괄 사전 전송(JSON Tree)하여, 사용자가 장소를 변경할 때 서버 재호출 지연 없이 즉각적으로 스왑(Swap)하며 AI가 생성한 타임라인 서사를 깨뜨리지 않고 다기종 내비게이션으로 동적 라우팅하는 기술.
- **코드 스니펫 (`src/lib/smartPlan.ts` 및 클라이언트 라우팅 발췌)**:
```typescript
// 백엔드: 1순위 추천과 대체 리스트(Alternatives)를 하나의 JSON 트리로 결합
const responsePayload = {
    narrative: aiGeneratedTimeline,
    primaryFacts: [factA, factB, factC, factD, factE],
    alternatives: {
        'GOING': topGoingCandidates.slice(1, 15),
        'MART': topMartCandidates.slice(1, 15),
        'LUNCH': topLunchCandidates.slice(1, 15),
        'HEALING': topHealingCandidates.slice(1, 15),
        'RETURN': topReturnCandidates.slice(1, 15)
    }
};

// 클라이언트 (UI): 상태 스왑 시 서버 로딩 없는 무지연(Zero-Latency) 교체
const handleSwap = (stage: string) => {
    // API 재호출(Loading State) 없이 사전 적재된 대체 노드로 즉시 치환
    setPrimaryFacts(prev => {
        const altNode = alternatives[stage][swapIndex];
        return replaceNodeWithoutBreakingNarrative(prev, altNode);
    });
};

// 이기종 내비게이션 딥링크 동적 파싱 및 라우팅 표준화
const launchNavigation = (destLat: number, destLng: number, destName: string, naviType: 'TMAP' | 'KAKAO' | 'NAVER') => {
    // WGS84 좌표를 각 플랫폼별 고유 URL 스킴 및 파라미터로 즉시 변환
    if (naviType === 'TMAP') {
        // Tmap의 경우 안드로이드/iOS 파라미터 표준화 및 강제 목적지 세팅
        return `tmap://route?goalname=${encodeURIComponent(destName)}&goalx=${destLng}&goaly=${destLat}&rRouteType=1`;
    } else if (naviType === 'KAKAO') {
        return `kakaomap://route?ep=${destLat},${destLng}&by=CAR`;
    }
};
```
