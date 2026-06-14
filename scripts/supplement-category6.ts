import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;
const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiKey) {
    console.error("Missing configuration keys (Supabase URL, Key or Gemini Key). Please check .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function supplementCategory6() {
    try {
        console.log("🚀 Starting supplementary database seeding for Category 6 (야외/액티브 > 가족/아이 동반)...");

        // 1. Retrieve Category IDs dynamically
        const { data: parentCat } = await supabase
            .from('travel_play_categories')
            .select('id')
            .eq('name', '🏞️ 야외/액티브 (자연)')
            .is('parent_id', null)
            .single();

        if (!parentCat) {
            console.error("❌ Parent category [🏞️ 야외/액티브 (자연)] not found.");
            process.exit(1);
        }

        const { data: childCat } = await supabase
            .from('travel_play_categories')
            .select('id')
            .eq('name', '👨‍👩‍👧‍👦 가족/아이 동반')
            .eq('parent_id', parentCat.id)
            .single();

        if (!childCat) {
            console.error("❌ Child category [👨‍👩‍👧‍👦 가족/아이 동반] not found under Parent.");
            process.exit(1);
        }

        const categoryId = childCat.id;
        console.log(`✅ Targeted Category ID: ${categoryId}`);

        // 2. Fetch existing play titles inside Category 6 ONLY to prevent local duplication
        const { data: existingPlays } = await supabase
            .from('travel_plays')
            .select('title')
            .eq('category_id', categoryId);

        const localExistingTitles = new Set(existingPlays?.map(e => e.title) || []);
        console.log(`ℹ️ Found ${localExistingTitles.size} existing play titles inside Category 6 in DB.`);

        // 3. Prompt Gemini for unique active family outdoor plays
        const prompt = `
당신은 여행 및 캠핑 여정 중 즐길 수 있는 놀이와 보드게임 룰을 구축하는 플레이 디렉터입니다.
주어진 카테고리에 완벽히 부합하며, 야외 자연 환경(계곡, 숲, 잔디밭, 캠핑장 마당 등)에서 가족과 아이가 함께 몸을 움직이거나 감정을 나누며 즐겁게 수행할 수 있는 실제 행동형 놀이/게임 데이터를 만들어주세요.

[생성할 카테고리 정보]
- 상위 환경 (대분류): 🏞️ 야외/액티브 (자연)
- 참여자/성격 (소분류): 👨‍👩‍👧‍👦 가족/아이 동반

[요청 사항]
1. 위 카테고리에 완벽히 어울리는 서로 겹치지 않는 다양한 실제 놀이/게임 데이터를 정확히 30개에서 35개 생성해 주세요.
2. 놀이의 제목(title)은 직관적이면서 흥미를 끄는 이름이어야 하며, 설명(description)은 놀이의 의도와 감성적인 맥락을 1~2줄로 설명해야 합니다.
3. 준비물(materials)은 주변에서 구하기 쉽거나 야외 자연물(돌, 나뭇가지, 나뭇잎, 흙 등)을 포함해 작성하고, 놀이 방법(process_steps)은 3~5단계 배열 형태로 명확히 작성해 주세요.
4. 난이도(difficulty)는 1에서 4 사이의 정수, 소요시간(time_required)은 5에서 60 사이의 분 단위 정수로 지정해 주세요.
5. 아래의 놀이 제목들은 이미 이 카테고리에 존재하므로 **절대 중복으로 다시 생성하지 마세요.**
   [중복 금지 목록]: ${Array.from(localExistingTitles).join(", ") || "없음"}
6. 반드시 아래 JSON 배열 구조로만 응답해 주세요. 다른 설명 텍스트는 일체 생략하세요.

[
  {
    "category_name": "👨‍👩‍👧‍👦 가족/아이 동반",
    "title": "놀이 제목",
    "description": "놀이의 의도와 맥락에 대한 1~2줄의 친근한 설명",
    "difficulty": 2,
    "time_required": 15,
    "materials": ["준비물1", "준비물2"],
    "process_steps": [
      "1단계: 방법 설명",
      "2단계: 방법 설명"
    ],
    "tips": "더 재미있게 즐기는 법이나 주의할 안전 가이드 꿀팁",
    "age_group": "전연령 (또는 초등학생 이상, 아동 동반 등)"
  }
]
        `.trim();

        console.log("🤖 Calling Gemini API for Category 6...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    response_mime_type: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API failed with status ${response.status}`);
        }

        const apiData = await response.json();
        let responseText = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (responseText.includes("```json")) {
            responseText = responseText.split("```json")[1].split("```")[0].trim();
        } else if (responseText.includes("```")) {
            responseText = responseText.split("```")[1].split("```")[0].trim();
        }

        if (!responseText) {
            throw new Error("Empty response from Gemini API.");
        }

        const parsedPlays = JSON.parse(responseText);
        console.log(`- Successfully parsed ${parsedPlays.length} plays from Gemini.`);

        // Filter out null/invalid entries
        const validParsedPlays = parsedPlays.filter((p: any) => p && typeof p.title === 'string' && p.title.trim() !== '' && typeof p.description === 'string' && p.description.trim() !== '');

        const dbPlays = validParsedPlays.map((p: any) => ({
            category_id: categoryId,
            title: p.title.trim(),
            description: p.description.trim(),
            difficulty: p.difficulty || 2,
            time_required: p.time_required || 15,
            materials: p.materials || [],
            process_steps: p.process_steps || [],
            tips: p.tips || '',
            age_group: p.age_group || '전연령',
            view_count: Math.floor(Math.random() * 50) + 5
        }));

        if (dbPlays.length > 0) {
            // Check duplicates against Category 6 list
            const finalBatch = dbPlays.filter(b => !localExistingTitles.has(b.title));

            if (finalBatch.length > 0) {
                const { error: insertError } = await supabase
                    .from('travel_plays')
                    .insert(finalBatch);

                if (insertError) throw insertError;
                console.log(`🎉 Success! Ingested ${finalBatch.length} new outdoor family plays to Database.`);
            } else {
                console.log("ℹ️ All generated plays already exist in this category. Skipped.");
            }
        } else {
            console.log("ℹ️ No valid plays to ingest.");
        }

    } catch (e: any) {
        console.error("❌ Supplementary seeding failed:", e.message);
    }
}

supplementCategory6();
