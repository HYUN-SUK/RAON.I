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
        name: "🔥 바베큐/그릴",
        icon_emoji: "🔥",
        sort_order: 1,
        children: [
            { name: "소/돼지", sort_order: 1 },
            { name: "닭/오리", sort_order: 2 },
            { name: "해산물", sort_order: 3 },
            { name: "꼬치/기타", sort_order: 4 }
        ]
    },
    {
        name: "🍳 원팬/간단",
        icon_emoji: "🍳",
        sort_order: 2,
        children: [
            { name: "면/파스타", sort_order: 1 },
            { name: "볶음/덮밥", sort_order: 2 },
            { name: "전/부침", sort_order: 3 },
            { name: "기타간단요리", sort_order: 4 }
        ]
    },
    {
        name: "🥘 국물/밀키트",
        icon_emoji: "🥘",
        sort_order: 3,
        children: [
            { name: "찌개/전골", sort_order: 1 },
            { name: "탕/어묵탕", sort_order: 2 }
        ]
    },
    {
        name: "🥗 아침/브런치",
        icon_emoji: "🥗",
        sort_order: 4,
        children: [
            { name: "샌드위치/토스트", sort_order: 1 },
            { name: "샐러드/과일", sort_order: 2 },
            { name: "죽/누룽지", sort_order: 3 }
        ]
    },
    {
        name: "🍹 파티/스낵",
        icon_emoji: "🍹",
        sort_order: 5,
        children: [
            { name: "핑거푸드/치즈", sort_order: 1 },
            { name: "튀김/마른안주", sort_order: 2 }
        ]
    }
];

// Flatten the children categories to process one by one to avoid max token truncation
const subCategories: { parentName: string, name: string }[] = [];
for (const parentNode of CATEGORY_TREE) {
    for (const childNode of parentNode.children) {
        subCategories.push({ parentName: parentNode.name, name: childNode.name });
    }
}

interface GeneratedRecipe {
    category_name: string;
    name: string;
    ingredients: { name: string; amount: string }[];
    travel_tips: string[];
    youtube_search_keyword: string;
    instagram_search_keyword: string;
}

async function seedData() {
    try {
        console.log("🚀 Starting database seeding for Travel Recipe Explorer...");

        // 1. Insert Categories (Tree Structure)
        const categoryMap: Record<string, number> = {};

        for (const parentNode of CATEGORY_TREE) {
            let parentId: number;
            const { data: existingParent } = await supabase
                .from('travel_recipe_categories')
                .select('id')
                .eq('name', parentNode.name)
                .is('parent_id', null)
                .single();

            if (existingParent) {
                parentId = existingParent.id;
                console.log(`- Parent category [${parentNode.name}] already exists (ID: ${parentId})`);
            } else {
                const { data: newParent, error: parentError } = await supabase
                    .from('travel_recipe_categories')
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
                const key = `${parentNode.name}_${childNode.name}`;
                const { data: existingChild } = await supabase
                    .from('travel_recipe_categories')
                    .select('id')
                    .eq('name', childNode.name)
                    .eq('parent_id', parentId)
                    .single();

                if (existingChild) {
                    categoryMap[childNode.name] = existingChild.id;
                } else {
                    const { data: newChild, error: childError } = await supabase
                        .from('travel_recipe_categories')
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
                    categoryMap[childNode.name] = newChild.id;
                    console.log(`  + Created child category [${childNode.name}] (ID: ${newChild.id})`);
                }
            }
        }

        console.log("✅ Categories setup complete.");

        // 2. Generate Recipes via Gemini sequentially per sub-category
        let totalCreated = 0;

        for (let idx = 0; idx < subCategories.length; idx++) {
            const cat = subCategories[idx];
            console.log(`\n🤖 Calling Gemini API for Category [${cat.name}] (${idx + 1}/${subCategories.length})`);

            const prompt = `
당신은 여행 및 캠핑 요리 레시피 데이터베이스를 구축하는 콘텐츠 디렉터입니다.
주어진 카테고리에 최적화된, 펜션이나 캠핑장 등 여행지에서 누구나 손쉽게 할 수 있는 실제 한식/퓨전 요리 데이터를 만들어주세요.

[생성할 카테고리 정보]
- 상위 카테고리: ${cat.parentName}
- 상세 카테고리: ${cat.name}

[요청 사항]
1. 상세 카테고리 "${cat.name}"에 해당하는 정확히 22개에서 25개의 서로 겹치지 않는 다양한 실제 요리 데이터를 생성해 주세요.
2. 조리 팁(travel_tips)은 펜션 주방, 가스버너, 그리들, 숯불 등 야외나 숙소 조리 환경에 초점을 맞춰 실용적으로 2개 적어주세요.
3. 소셜 검색 키워드는 사용자가 유튜브나 인스타에 그대로 검색했을 때 관련 꿀팁 영상이나 숏폼이 가장 잘 나오는 캠핑/여행 융합 키워드로 입력해 주세요.
4. 반드시 아래 JSON 배열 구조로만 응답해 주세요. 다른 설명 텍스트는 일체 생략하세요.

[
  {
    "category_name": "${cat.name}",
    "name": "요리명",
    "ingredients": [{"name": "재료명", "amount": "분량"}],
    "travel_tips": ["팁1", "팁2"],
    "youtube_search_keyword": "유튜브 검색어",
    "instagram_search_keyword": "인스타 태그명"
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
                console.error(`❌ Gemini API for Category [${cat.name}] failed with status ${response.status}`);
                // Pacing cooldown even if it fails to prevent hitting temporary ban
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
                console.error(`❌ Empty response for Category [${cat.name}]`);
                await delay(12000);
                continue;
            }

            try {
                const parsedRecipes: GeneratedRecipe[] = JSON.parse(responseText);
                console.log(`- Successfully parsed ${parsedRecipes.length} recipes for Category [${cat.name}].`);

                const dbRecipes = parsedRecipes.map(r => {
                    const categoryId = categoryMap[r.category_name];
                    return {
                        category_id: categoryId || null,
                        name: r.name,
                        ingredients: r.ingredients,
                        travel_tips: r.travel_tips,
                        youtube_search_keyword: r.youtube_search_keyword,
                        instagram_search_keyword: r.instagram_search_keyword,
                        view_count: Math.floor(Math.random() * 80) + 10
                    };
                }).filter(r => r.category_id !== null);

                if (dbRecipes.length > 0) {
                    // Filter duplicates in DB
                    const names = dbRecipes.map(b => b.name);
                    const { data: existingRecipes } = await supabase
                        .from('travel_recipes')
                        .select('name')
                        .in('name', names);

                    const existingNames = new Set(existingRecipes?.map(e => e.name) || []);
                    const finalBatch = dbRecipes.filter(b => !existingNames.has(b.name));

                    if (finalBatch.length > 0) {
                        const { error: insertError } = await supabase
                            .from('travel_recipes')
                            .insert(finalBatch);

                        if (insertError) {
                            console.error("Category Insertion Error:", insertError);
                            throw insertError;
                        }
                        successCount(finalBatch.length);
                        totalCreated += finalBatch.length;
                        console.log(`- Ingested ${finalBatch.length} new recipes to Database.`);
                    } else {
                        console.log(`- All recipes already exist in DB. Skipped.`);
                    }
                }
            } catch (err: any) {
                console.error(`❌ Error parsing/saving Category [${cat.name}]:`, err.message);
            }

            // Pacing limit: wait 12 seconds before the next call to avoid rate limit for free keys
            if (idx < subCategories.length - 1) {
                console.log("⏳ Pacing cooldown: waiting 12 seconds...");
                await delay(12000);
            }
        }

        console.log(`\n🎉 DB Seeding Finished! Total new recipes created: ${totalCreated} items.`);

    } catch (e: any) {
        console.error("❌ Seeding failed:", e.message);
    }
}

// Helper to count progress logs
function successCount(num: number) {
    // Empty log tracker
}

seedData();
