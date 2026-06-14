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

// Helper for pacing out API requests to prevent HTTP 429
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Categories Definition
const CATEGORY_TREE = [
    {
        name: "🏨 일반 여행 (실내/숙소)",
        icon_emoji: "🏨",
        sort_order: 1,
        children: [
            { name: "👩‍❤️‍👨 2인/커플", sort_order: 1 },
            { name: "👨‍👩‍👧‍👦 가족/아이 동반", sort_order: 2 },
            { name: "👥 단체/친목", sort_order: 3 },
            { name: "🌿 혼자/사색", sort_order: 4 }
        ]
    },
    {
        name: "🏞️ 야외/액티브 (자연)",
        icon_emoji: "🏞️",
        sort_order: 2,
        children: [
            { name: "👩‍❤️‍👨 2인/커플", sort_order: 1 },
            { name: "👨‍👩‍👧‍👦 가족/아이 동반", sort_order: 2 },
            { name: "👥 단체/친목", sort_order: 3 },
            { name: "🌿 혼자/사색", sort_order: 4 }
        ]
    },
    {
        name: "⛺ 감성 캠핑 (화로/텐트)",
        icon_emoji: "⛺",
        sort_order: 3,
        children: [
            { name: "👩‍❤️‍👨 2인/커플", sort_order: 1 },
            { name: "👨‍👩‍👧‍👦 가족/아이 동반", sort_order: 2 },
            { name: "👥 단체/친목", sort_order: 3 },
            { name: "🌿 혼자/사색", sort_order: 4 }
        ]
    }
];

// Flatten the children categories to process one by one
const subCategories: { parentName: string, name: string }[] = [];
for (const parentNode of CATEGORY_TREE) {
    for (const childNode of parentNode.children) {
        subCategories.push({ parentName: parentNode.name, name: childNode.name });
    }
}

interface GeneratedPlay {
    category_name: string;
    title: string;
    description: string;
    difficulty: number;
    time_required: number;
    materials: string[];
    process_steps: string[];
    tips: string;
    age_group: string;
}

async function seedData() {
    try {
        console.log("🚀 Starting database seeding for Travel Play & Game Explorer...");

        // 1. Insert Categories (Tree Structure)
        const categoryMap: Record<string, number> = {};

        for (const parentNode of CATEGORY_TREE) {
            let parentId: number;
            const { data: existingParent } = await supabase
                .from('travel_play_categories')
                .select('id')
                .eq('name', parentNode.name)
                .is('parent_id', null)
                .single();

            if (existingParent) {
                parentId = existingParent.id;
                console.log(`- Parent category [${parentNode.name}] already exists (ID: ${parentId})`);
            } else {
                const { data: newParent, error: parentError } = await supabase
                    .from('travel_play_categories')
                    .insert({
                        name: parentNode.name,
                        icon_emoji: parentNode.icon_emoji,
                        sort_order: parentNode.sort_order,
                        parent_id: null
                    })
                    .select()
                    .single();

                if (parentError || !newParent) {
                    throw new Error(`Failed to insert parent category: ${parentError?.message}`);
                }
                parentId = newParent.id;
                console.log(`- Created parent category [${parentNode.name}] (ID: ${parentId})`);
            }

            for (const childNode of parentNode.children) {
                const { data: existingChild } = await supabase
                    .from('travel_play_categories')
                    .select('id')
                    .eq('name', childNode.name)
                    .eq('parent_id', parentId)
                    .single();

                if (existingChild) {
                    categoryMap[`${parentNode.name}_${childNode.name}`] = existingChild.id;
                } else {
                    const { data: newChild, error: childError } = await supabase
                        .from('travel_play_categories')
                        .insert({
                            name: childNode.name,
                            parent_id: parentId,
                            sort_order: childNode.sort_order
                        })
                        .select()
                        .single();

                    if (childError || !newChild) {
                        throw new Error(`Failed to insert child category: ${childError?.message}`);
                    }
                    categoryMap[`${parentNode.name}_${childNode.name}`] = newChild.id;
                    console.log(`  + Created child category [${childNode.name}] under [${parentNode.name}] (ID: ${newChild.id})`);
                }
            }
        }

        console.log("✅ Categories setup complete.");

        // 2. Fetch existing play titles to prevent duplication
        const { data: existingPlays } = await supabase.from('travel_plays').select('title');
        const dbExistingTitles = new Set(existingPlays?.map(e => e.title) || []);
        console.log(`ℹ️ Found ${dbExistingTitles.size} existing play titles in DB.`);

        // 3. Generate Plays via Gemini sequentially per sub-category
        let totalCreated = 0;

        for (let idx = 0; idx < subCategories.length; idx++) {
            const cat = subCategories[idx];
            console.log(`\n🤖 Calling Gemini API for Category [${cat.parentName} > ${cat.name}] (${idx + 1}/${subCategories.length})`);

            // Extract titles already in DB or created during this session to block them in prompt
            const currentExistingStr = Array.from(dbExistingTitles).slice(-100).join(", "); // limit context length safely

            const prompt = `
당신은 여행 및 캠핑 여정 중 즐길 수 있는 놀이와 보드게임 룰을 구축하는 플레이 디렉터입니다.
주어진 카테고리에 완벽히 부합하며, 펜션/호텔/에어비앤비/자연캠프지 등 여행지나 야외에서 사람들과 따뜻하고 즐겁게 수행할 수 있는 실제 행동형 놀이/게임 데이터를 만들어주세요.

[생성할 카테고리 정보]
- 상위 환경 (대분류): ${cat.parentName}
- 참여자/성격 (소분류): ${cat.name}

[요청 사항]
1. 위 카테고리에 완벽히 어울리는 서로 겹치지 않는 다양한 실제 놀이/게임 데이터를 정확히 35개에서 38개 생성해 주세요.
2. 놀이의 제목(title)은 직관적이면서 흥미를 끄는 이름이어야 하며, 설명(description)은 놀이의 의도와 감성적인 맥락을 1~2줄로 설명해야 합니다.
3. 준비물(materials)은 주변에서 구하기 쉽거나 여행지에 구비된 물품 위주로 작성하고, 놀이 방법(process_steps)은 3~5단계 배열 형태로 명확히 작성해 주세요.
4. 난이도(difficulty)는 1에서 5 사이의 정수, 소요시간(time_required)은 5에서 90 사이의 분 단위 정수로 지정해 주세요.
5. 아래의 놀이 제목들은 이미 데이터베이스에 존재하거나 이전에 생성되었으므로 **절대 중복으로 다시 생성하지 마세요.**
   [중복 금지 목록]: ${currentExistingStr || "없음"}
6. 반드시 아래 JSON 배열 구조로만 응답해 주세요. 다른 설명 텍스트는 일체 생략하세요.

[
  {
    "category_name": "${cat.name}",
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
    "age_group": "전연령 (또는 초등학생 이상, 성인 전용 등)"
  }
]
            `.trim();

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
                console.error(`❌ Gemini API for Category [${cat.parentName} > ${cat.name}] failed with status ${response.status}`);
                await delay(12000);
                continue;
            }

            const apiData = await response.json();
            let responseText = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (responseText.includes("```json")) {
                responseText = responseText.split("```json")[1].split("```")[0].trim();
            } else if (responseText.includes("```")) {
                responseText = responseText.split("```")[1].split("```")[0].trim();
            }

            if (!responseText) {
                console.error(`❌ Empty response for Category [${cat.parentName} > ${cat.name}]`);
                await delay(12000);
                continue;
            }

            try {
                const parsedPlays: GeneratedPlay[] = JSON.parse(responseText);
                console.log(`- Successfully parsed ${parsedPlays.length} plays for [${cat.parentName} > ${cat.name}].`);

                const categoryId = categoryMap[`${cat.parentName}_${cat.name}`];
                if (!categoryId) {
                    console.error(`❌ Category mapping not found for ${cat.parentName}_${cat.name}`);
                    continue;
                }

                // Filter out invalid items to prevent NOT NULL database constraint errors (such as missing titles)
                const validParsedPlays = parsedPlays.filter(p => p && typeof p.title === 'string' && p.title.trim() !== '' && typeof p.description === 'string' && p.description.trim() !== '');

                const dbPlays = validParsedPlays.map(p => ({
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
                    // Filter duplicates in final batch
                    const finalBatch = dbPlays.filter(b => !dbExistingTitles.has(b.title));

                    if (finalBatch.length > 0) {
                        const { error: insertError } = await supabase
                            .from('travel_plays')
                            .insert(finalBatch);

                        if (insertError) {
                            console.error("Plays Insertion Error:", insertError);
                            throw insertError;
                        }
                        
                        // Add newly created titles to local duplicate check list
                        finalBatch.forEach(b => dbExistingTitles.add(b.title));
                        totalCreated += finalBatch.length;
                        console.log(`- Ingested ${finalBatch.length} new plays to Database.`);
                    } else {
                        console.log(`- All generated plays already exist in DB. Skipped.`);
                    }
                }
            } catch (err: any) {
                console.error(`❌ Error parsing/saving Category [${cat.parentName} > ${cat.name}]:`, err.message);
            }

            // Pacing limit: wait 12 seconds to prevent 429
            if (idx < subCategories.length - 1) {
                console.log("⏳ Pacing cooldown: waiting 12 seconds...");
                await delay(12000);
            }
        }

        console.log(`\n🎉 DB Seeding Finished! Total new plays created: ${totalCreated} items.`);

    } catch (e: any) {
        console.error("❌ Seeding failed:", e.message);
    }
}

seedData();
