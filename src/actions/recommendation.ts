'use server';

import { createClient } from '@/lib/supabase-server';

export interface RecipeSearchResult {
    id: string;
    title: string;
    description?: string;
    category: string;
    image_url?: string;
    time_required?: number;
    difficulty?: number;
    tags?: string[];
}

export type RecipeDetail = any; // TODO: Define strict type matching DB

/**
 * 키워드로 레시피 검색
 */
export async function searchRecipes(query: string): Promise<RecipeSearchResult[]> {
    if (!query.trim()) return [];

    const supabase = await createClient();

    // title or ingredients containing query
    // ingredients is jsonb or array? In migration it seems strict schema.
    // Let's assume title search for now as 'ingredients' structure might vary.
    // Actually `recommendation_pool` has `tags` too.

    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('id, title, description, category, image_url, metadata')
        .eq('category', 'cooking') // 요리만 검색
        .ilike('title', `%${query}%`)
        .limit(20);

    if (error) {
        console.error('Search recipes error:', error);
        return [];
    }

    return data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        image_url: item.image_url,
        // metadata에서 time, difficulty 추출 (schema dependent)
        time_required: item.metadata?.time_required,
        difficulty: item.metadata?.difficulty,
    }));
}

/**
 * 랜덤 추천 요리 가져오기 (DB 연동)
 */
export async function getRandomRecommendations(count: number = 3): Promise<RecipeSearchResult[]> {
    const supabase = await createClient();

    // 1. Get total count or IDs to randomize? 
    // For simplicity with 259 items: fetch larger chunk and shuffle.
    // 'recommendation_pool' might not support random() easily via API.
    // Efficient way: db function or fetch larger chunk and shuffle.

    // Fetching 20 items to shuffle client-side is safe for 259 total.
    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('id, title, description, category, image_url, metadata, tags, difficulty') // Added difficulty to select
        .eq('category', 'cooking')
        .limit(20);

    if (data && data.length > 0) {
        console.log('Detected random recipe difficulty:', data[0].title, data[0].difficulty);
    }

    if (error) {
        console.error('Fetch recommendations error:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Shuffle and slice
    const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, count);

    return shuffled.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        image_url: item.image_url,
        time_required: item.metadata?.time_required, // Keep time_required in metadata? Seed says line 160 it is top level too?
        difficulty: item.difficulty, // Use top-level difficulty
        tags: item.tags || []
    }));
}


/**
 * ID로 레시피 상세 조회
 */
export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return null;
    return data;
}
