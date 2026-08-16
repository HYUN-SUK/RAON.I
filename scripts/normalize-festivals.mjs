import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

// 연도 추출 및 이름 정규화 함수
function normalizeFestivalName(rawName) {
    if (!rawName) return { normalized: '', detectedYears: [] };

    const detectedYears = [];
    const yearMatches = rawName.match(/20\d{2}/g);
    if (yearMatches) {
        yearMatches.forEach(y => detectedYears.push(parseInt(y)));
    }

    // 선행 연도 제거 (예: "2024춘천연극제" -> "춘천연극제", "2025 빵빵데이" -> "빵빵데이")
    let normalized = rawName
        .replace(/^20\d{2}\s*/, '')
        .replace(/\s*20\d{2}\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return { normalized, detectedYears };
}

async function runNormalizeFestivals() {
    console.log('====================================================');
    console.log('🎪 축제(FESTIVAL) 데이터 정규화 및 연간 반복 이력 체계화');
    console.log('====================================================\n');

    // 1. 전체 FESTIVAL 데이터 조회
    const { data: festivals, error } = await supabase
        .from('master_places')
        .select('*')
        .eq('category', 'FESTIVAL');

    if (error) {
        console.error('축제 데이터 조회 실패:', error);
        return;
    }

    console.log(`총 FESTIVAL 조회 건수: ${festivals.length}건`);

    // 2. festival_key 기준으로 그룹핑
    const groupMap = new Map();

    for (const f of festivals) {
        const { normalized, detectedYears } = normalizeFestivalName(f.name);
        const sido = f.sido || '';
        const sigungu = f.sigungu || '';
        const key = `${normalized}|${sido}|${sigungu}`;

        if (!groupMap.has(key)) {
            groupMap.set(key, []);
        }
        groupMap.get(key).push({
            place: f,
            normalizedName: normalized,
            years: detectedYears
        });
    }

    console.log(`정규화 후 고유 축제 그룹 수: ${groupMap.size}개 그룹\n`);

    let updatedCount = 0;
    let deactivatedDuplicates = 0;
    let historyInserted = 0;

    for (const [key, items] of groupMap.entries()) {
        // 모든 개최 연도 수집
        const allYears = new Set();
        items.forEach(it => {
            it.years.forEach(y => allYears.add(y));
            // raw_data 또는 updated_at 연도도 보조 확인
            if (it.place.updated_at) {
                const uy = new Date(it.place.updated_at).getFullYear();
                if (uy >= 2024) allYears.add(uy);
            }
        });

        const sortedYears = Array.from(allYears).sort((a, b) => a - b);

        // 가장 최신 또는 활성 레코드를 대표(Primary)로 선정
        items.sort((a, b) => {
            if (a.place.is_active !== b.place.is_active) {
                return a.place.is_active ? -1 : 1;
            }
            return new Date(b.place.updated_at).getTime() - new Date(a.place.updated_at).getTime();
        });

        const primary = items[0];
        const duplicates = items.slice(1);

        // 대표 레코드 업데이트 (정규화된 이름 + years_held 메타데이터)
        const updatedRawData = {
            ...(primary.place.raw_data || {}),
            years_held: sortedYears,
            original_names: items.map(i => i.place.name)
        };

        const { error: updErr } = await supabase
            .from('master_places')
            .update({
                name: primary.normalizedName,
                raw_data: updatedRawData,
                updated_at: new Date().toISOString()
            })
            .eq('id', primary.place.id);

        if (!updErr) updatedCount++;

        // place_history에 FESTIVAL_HELD 이벤트 적재
        if (sortedYears.length > 0) {
            const { error: histErr } = await supabase
                .from('place_history')
                .insert({
                    place_id: primary.place.id,
                    event: 'FESTIVAL_HELD',
                    before: null,
                    after: {
                        normalized_name: primary.normalizedName,
                        years_held: sortedYears,
                        total_years: sortedYears.length
                    },
                    source: 'FESTIVAL_NORMALIZATION'
                });
            if (!histErr) historyInserted++;
        }

        // 중복 레코드들은 소프트 비활성화 (is_active = false) 처리하여 노출 차단하되 이력 보존
        for (const dup of duplicates) {
            if (dup.place.is_active) {
                await supabase
                    .from('master_places')
                    .update({
                        is_active: false,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', dup.place.id);
                deactivatedDuplicates++;
            }
        }
    }

    console.log('====================================================');
    console.log('🎉 축제 정규화 및 이력 구축 완료 보고');
    console.log(`- 대표 축제 정규화 및 years_held 갱신: ${updatedCount}건`);
    console.log(`- 중복 축제 소프트 비활성화(보존): ${deactivatedDuplicates}건`);
    console.log(`- place_history 연간 개최 이력 적재: ${historyInserted}건`);
    console.log('====================================================\n');
}

runNormalizeFestivals();
