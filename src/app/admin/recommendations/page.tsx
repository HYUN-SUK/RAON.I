/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar, MapPin, ChefHat, Tent, Trash2, Edit, Copy, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import type { Database } from '@/types/supabase';
import { communityService } from '@/services/communityService';
import { JsonImportButton } from './JsonImportButton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type RecItem = Database['public']['Tables']['recommendation_pool']['Row'];
type EventItem = Database['public']['Tables']['nearby_events']['Row'];

interface IngredientItem {
    name: string;
    amount: string;
}

const AI_IMPORT_TEMPLATE = `
[AI 요청 프롬프트 예시]

"다음 JSON 형식에 맞춰 '요리(cooking)' 또는 '놀이(play)' 추천 아이템 3개를 생성해줘. 한국어로 작성해."

[
  {
    "category": "cooking",
    "title": "요리 제목",
    "description": "요리 설명",
    "image_url": "https://example.com/image.jpg",
    "difficulty": 1,
    "time_required": 30,
    "ingredients": [
      { "name": "재료명", "amount": "100g" }
    ],
    "process_steps": ["1단계 설명", "2단계 설명"],
    "tips": "요리 팁",
    "servings": "2인분",
    "calories": 500
  },
  {
    "category": "play",
    "title": "놀이 제목",
    "description": "놀이 설명",
    "image_url": "https://example.com/image.jpg",
    "difficulty": 1,
    "time_required": 60,
    "min_participants": 2,
    "max_participants": 4,
    "materials": ["준비물1", "준비물2"],
    "process_steps": ["놀이 방법 1", "놀이 방법 2"],
    "tips": "안전 팁",
    "age_group": "5세 이상",
    "location_type": "실외"
  }
]
`;

const TRAVEL_RECIPE_AI_TEMPLATE = `
[AI 요청 프롬프트 예시]

"다음 JSON 형식에 맞춰 독립된 '여행 레시피' 아이템 3개를 생성해줘. 한국어로 작성해."

[
  {
    "category": "국물/밀키트", // 카테고리명 (🔥 바베큐/그릴, 소/돼지, 닭/오리, 해산물, 꼬치/기타, 🍳 원팬/간단, 면/파스타, 볶음/덮밥, 전/부침, 기타간단요리, 🥘 국물/밀키트, 찌개/전골, 탕/어묵탕, 🥗 아침/브런치, 샌드위치/토스트, 샐러드/과일, 죽/누룽지, 🍹 파티/스낵, 핑거푸드/치즈, 튀김/마른안주 등 중에서 선택)
    "name": "레시피 이름",
    "thumbnail_url": null,
    "ingredients": [
      { "name": "재료명", "amount": "수량 (예: 150g, 1개, 적당량)" }
    ],
    "travel_tips": [
      "조리 꿀팁 1",
      "조리 꿀팁 2"
    ],
    "youtube_search_keyword": "유튜브 검색 키워드",
    "instagram_search_keyword": "인스타 검색 키워드"
  }
]
`;

export default function RecommendationAdminPage() {
    const supabase = createClient();

    // Data
    const [recItems, setRecItems] = useState<RecItem[]>([]);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [travelRecipes, setTravelRecipes] = useState<any[]>([]);
    const [recipeCategories, setRecipeCategories] = useState<any[]>([]);

    // Bulk Import State
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkJson, setBulkJson] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);

    // Travel Recipe Bulk Import State
    const [isTravelRecipeBulkOpen, setIsTravelRecipeBulkOpen] = useState(false);
    const [travelRecipeBulkJson, setTravelRecipeBulkJson] = useState('');
    const [travelRecipeBulkLoading, setTravelRecipeBulkLoading] = useState(false);

    // Form States
    const [isRecSheetOpen, setIsRecSheetOpen] = useState(false);
    const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
    const [isTravelRecipeSheetOpen, setIsTravelRecipeSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);

    const [recFormData, setRecFormData] = useState({
        category: 'cooking',
        title: '',
        description: '',
        season: 'all', // all, spring, summer, autumn, winter
        image_url: '',
        difficulty: 1, // 1-5
        time_required: 30, // minutes
        min_participants: 1,
        max_participants: 10,
        materials: [] as string[],
        ingredients: [] as IngredientItem[], // V2: Structured Ingredients
        process_steps: [] as string[],
        tips: '',
        // V2.1 Fields
        servings: '',
        calories: 0,
        age_group: '',
        location_type: '',
    });

    const [eventFormData, setEventFormData] = useState({
        title: '',
        location: '',
        start_date: '',
        end_date: '',
        image_url: '',
    });

    const [travelRecipeFormData, setTravelRecipeFormData] = useState({
        category_id: '',
        name: '',
        thumbnail_url: '',
        ingredients: [] as IngredientItem[],
        travel_tips: [] as string[],
        youtube_search_keyword: '',
        instagram_search_keyword: '',
    });

    // Helper for List Inputs
    const [tempInput, setTempInput] = useState('');
    // Helper for Ingredient Inputs
    const [tempIngName, setTempIngName] = useState('');
    const [tempIngAmount, setTempIngAmount] = useState('');

    // Helpers for Travel Recipe
    const [tempTip, setTempTip] = useState('');
    const [tempRecipeIngName, setTempRecipeIngName] = useState('');
    const [tempRecipeIngAmount, setTempRecipeIngAmount] = useState('');

    // V2 Admin Features
    const [filterCategory, setFilterCategory] = useState<'all' | 'cooking' | 'play'>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Delete Dialog State
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk', table?: 'recommendation_pool' | 'nearby_events' | 'travel_recipes', id?: string } | null>(null);

    // Computed
    const filteredItems = recItems.filter(item => {
        if (filterCategory === 'all') return true;
        return item.category === filterCategory;
    });

    // Fetch Data
    const fetchData = React.useCallback(async () => {
        try {
            const { data: recs } = await supabase.from('recommendation_pool').select('*').order('created_at', { ascending: false });
            if (recs) setRecItems(recs);

            const { data: evts } = await supabase.from('nearby_events').select('*').order('start_date', { ascending: true });
            if (evts) setEvents(evts);

            const { data: tRecs } = await supabase.from('travel_recipes').select('*').order('created_at', { ascending: false });
            if (tRecs) setTravelRecipes(tRecs);

            const { data: tCats } = await supabase.from('travel_recipe_categories').select('*').order('sort_order', { ascending: true });
            if (tCats) setRecipeCategories(tCats);
        } catch (e) {
            console.error(e);
        }
    }, [supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handlers
    const handleRecSubmit = async () => {
        try {
            const tags = { season: recFormData.season === 'all' ? [] : [recFormData.season] };

            const payload = {
                category: recFormData.category,
                title: recFormData.title,
                description: recFormData.description,
                image_url: recFormData.image_url,
                tags: tags,
                difficulty: recFormData.difficulty,
                time_required: recFormData.time_required,
                min_participants: recFormData.min_participants,
                max_participants: recFormData.max_participants,
                materials: recFormData.materials,
                ingredients: recFormData.ingredients,
                process_steps: recFormData.process_steps,
                tips: recFormData.tips,
                // V2.1 Fields
                servings: recFormData.servings,
                calories: recFormData.calories,
                age_group: recFormData.age_group,
                location_type: recFormData.location_type,
            };

            if (editingItem) {
                const { error } = await supabase.from('recommendation_pool').update(payload).eq('id', editingItem.id);
                if (error) throw error;
                toast.success('수정되었습니다.');
            } else {
                const { error } = await supabase.from('recommendation_pool').insert({ ...payload, is_active: true });
                if (error) throw error;
                toast.success('추가되었습니다.');
            }
            setIsRecSheetOpen(false);
            setEditingItem(null);
            fetchData();
        } catch (e) {
            const message = e instanceof Error ? e.message : "오류가 발생했습니다.";
            toast.error(message);
        }
    };

    const handleEventSubmit = async () => {
        try {
            if (editingItem) {
                await supabase.from('nearby_events').update({
                    ...eventFormData,
                    // safe convert dates, if needed
                }).eq('id', editingItem.id);
                toast.success('수정되었습니다.');
            } else {
                await supabase.from('nearby_events').insert({
                    ...eventFormData,
                    is_active: true
                });
                toast.success('추가되었습니다.');
            }
            setIsEventSheetOpen(false);
            setEditingItem(null);
            fetchData();
        } catch (e) {
            const message = e instanceof Error ? e.message : "오류가 발생했습니다.";
            toast.error(message);
        }
    };

    const handleDelete = (table: 'recommendation_pool' | 'nearby_events' | 'travel_recipes', id: string) => {
        setDeleteTarget({ type: 'single', table, id });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        try {
            if (deleteTarget.type === 'single' && deleteTarget.table && deleteTarget.id) {
                const { error } = await supabase.from(deleteTarget.table).delete().eq('id', deleteTarget.id);
                if (error) throw error;
                toast.success('삭제되었습니다.');
            } else if (deleteTarget.type === 'bulk') {
                if (selectedIds.size === 0) return;
                const { error } = await supabase.from('recommendation_pool').delete().in('id', Array.from(selectedIds));
                if (error) throw error;
                toast.success(`${selectedIds.size}개 항목이 삭제되었습니다.`);
                setSelectedIds(new Set());
            }
            fetchData();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : '삭제 중 오류가 발생했습니다.';
            toast.error(message);
        } finally {
            setDeleteTarget(null);
        }
    };

    // Shared DB Insert Helper
    const insertItemsToDb = async (items: any[]) => {
        // Map incoming JSON to DB columns
        const dbItems = items.map(item => ({
            category: item.category || 'play',
            title: item.title,
            description: item.description,
            difficulty: item.difficulty || 1,
            time_required: item.time_required || 30,
            min_participants: item.min_participants || 1,
            max_participants: item.max_participants || 10,
            materials: item.materials || [],
            ingredients: item.ingredients || [],
            process_steps: item.process_steps || [],
            tips: item.tips || '',
            servings: item.servings || null,
            calories: item.calories || null,
            age_group: item.age_group || null,
            location_type: item.location_type || null,
            tags: item.tags || {},
            image_url: item.image_url || null,
            is_active: true
        }));

        const { error } = await supabase.from('recommendation_pool').insert(dbItems);
        if (error) throw error;
        return dbItems.length;
    };

    const handleBulkJsonImport = async (items: any[]) => {
        try {
            setBulkLoading(true);
            const count = await insertItemsToDb(items);
            toast.success(`${count}개의 아이템이 파일에서 등록되었습니다!`);
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(`파일 등록 중 오류 발생: ${error.message}`);
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkPasteImport = async () => {
        if (!bulkJson.trim()) {
            toast.error('JSON 데이터를 입력해주세요.');
            return;
        }

        try {
            setBulkLoading(true);
            let parsed: any[];
            try {
                parsed = JSON.parse(bulkJson);
                if (!Array.isArray(parsed)) throw new Error('데이터 형식이 배열이 아닙니다.');
            } catch {
                toast.error('JSON 형식이 올바르지 않습니다.');
                return;
            }

            const count = await insertItemsToDb(parsed);
            toast.success(`${count}개의 아이템이 붙여넣기로 등록되었습니다!`);
            setIsBulkOpen(false);
            setBulkJson('');
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(`등록 중 오류 발생: ${error.message}`);
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setDeleteTarget({ type: 'bulk' });
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };


    const handleCopyTemplate = () => {
        navigator.clipboard.writeText(AI_IMPORT_TEMPLATE);
        toast.success("AI 요청 양식이 클립보드에 복사되었습니다!");
    };

    const handleCopyTravelRecipeTemplate = () => {
        navigator.clipboard.writeText(TRAVEL_RECIPE_AI_TEMPLATE);
        toast.success("AI 요청 양식이 클립보드에 복사되었습니다!");
    };

    const handleTravelRecipeBulkImport = async () => {
        if (!travelRecipeBulkJson.trim()) {
            toast.error('JSON 데이터를 입력해주세요.');
            return;
        }

        try {
            setTravelRecipeBulkLoading(true);
            
            // Clean up backticks like ```json ... ```
            let cleanJson = travelRecipeBulkJson.trim();
            if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
            }
            cleanJson = cleanJson.trim();

            let parsed: any;
            try {
                parsed = JSON.parse(cleanJson);
            } catch {
                toast.error('JSON 형식이 올바르지 않습니다.');
                return;
            }

            // Standardize to array
            const items = Array.isArray(parsed) ? parsed : [parsed];

            // Validation
            const invalidItems = items.filter(item => !item.name);
            if (invalidItems.length > 0) {
                toast.error(`${invalidItems.length}개의 아이템에 필수 항목(name)이 누락되었습니다.`);
                return;
            }

            // Map category name to category_id
            const { data: categories } = await supabase
                .from('travel_recipe_categories')
                .select('id, name');
            
            const catMap = new Map<string, number>();
            if (categories) {
                categories.forEach(c => {
                    const cleanDbName = c.name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
                    catMap.set(c.name.trim(), Number(c.id));
                    catMap.set(cleanDbName, Number(c.id));
                });
            }

            let fallbackCatId: number | null = null;
            if (categories && categories.length > 0) {
                const fallbackCat = categories.find(c => c.name.includes('기타')) || categories[0];
                fallbackCatId = Number(fallbackCat.id);
            }

            const dbRecipes = items.map(item => {
                const categoryStr = (item.category || '').trim();
                let categoryId = fallbackCatId;
                
                if (categoryStr) {
                    const cleanCatName = categoryStr.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
                    if (catMap.has(categoryStr)) {
                        categoryId = catMap.get(categoryStr)!;
                    } else if (catMap.has(cleanCatName)) {
                        categoryId = catMap.get(cleanCatName)!;
                    } else {
                        const matchedCat = categories?.find(c => 
                            c.name.includes(cleanCatName) || cleanCatName.includes(c.name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim())
                        );
                        if (matchedCat) {
                            categoryId = Number(matchedCat.id);
                        }
                    }
                }

                return {
                    category_id: categoryId,
                    name: item.name,
                    thumbnail_url: item.thumbnail_url || null,
                    ingredients: item.ingredients || [],
                    travel_tips: item.travel_tips || [],
                    youtube_search_keyword: item.youtube_search_keyword || null,
                    instagram_search_keyword: item.instagram_search_keyword || null,
                    view_count: 0
                };
            });

            const { error: insertError } = await supabase
                .from('travel_recipes')
                .insert(dbRecipes);

            if (insertError) throw insertError;

            toast.success(`${dbRecipes.length}개의 여행 레시피가 성공적으로 등록되었습니다!`);
            setIsTravelRecipeBulkOpen(false);
            setTravelRecipeBulkJson('');
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(`등록 중 오류 발생: ${error.message}`);
        } finally {
            setTravelRecipeBulkLoading(false);
        }
    };

    const handleCopyJson = () => {
        const itemsToExport = selectedIds.size > 0
            ? recItems.filter(item => selectedIds.has(item.id))
            : recItems;

        if (itemsToExport.length === 0) {
            toast.error("복사할 데이터가 없습니다.");
            return;
        }

        const jsonStr = JSON.stringify(itemsToExport, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            toast.success(`${itemsToExport.length}개 항목(JSON)이 복사되었습니다! 채팅창에 붙여넣어주세요.`);
        }).catch(() => {
            toast.error("클립보드 복사에 실패했습니다.");
        });
    };

    const handleBulkExport = () => {
        const itemsToExport = selectedIds.size > 0
            ? recItems.filter(item => selectedIds.has(item.id))
            : recItems;

        if (itemsToExport.length === 0) {
            toast.error("다운로드할 데이터가 없습니다.");
            return;
        }

        // CSV Header
        const headers = ['id', 'category', 'title', 'description', 'tags', 'difficulty', 'time_required', 'ingredients', 'image_url'];
        const csvRows = [headers.join(',')];

        // CSV Body
        for (const item of itemsToExport) {
            const tags = item.tags ? JSON.stringify(item.tags).replace(/"/g, '""') : '';
            const ingredients = item.ingredients ? JSON.stringify(item.ingredients).replace(/"/g, '""') : '';
            const description = item.description ? item.description.replace(/"/g, '""').replace(/\n/g, ' ') : '';
            const title = item.title.replace(/"/g, '""');

            const row = [
                item.id,
                item.category,
                `"${title}"`,
                `"${description}"`,
                `"${tags}"`,
                item.difficulty,
                item.time_required,
                `"${ingredients}"`,
                item.image_url
            ];
            csvRows.push(row.join(','));
        }

        // BOM for Excel Korean support
        const bom = '\uFEFF';
        const csvString = bom + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `recommendations_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    const openRecSheet = (item?: RecItem) => {
        if (item) {
            setEditingItem(item);
            const tags = item.tags as any;

            // Handle ingredients normalization (string[] vs object[])
            let ingredientsNormalized: IngredientItem[] = [];
            if (Array.isArray(item.ingredients)) {
                ingredientsNormalized = item.ingredients.map((ing: unknown) => {
                    if (typeof ing === 'string') return { name: ing, amount: '' };
                    return ing as IngredientItem; // assume object
                });
            }

            setRecFormData({
                category: item.category,
                title: item.title,
                description: item.description || '',
                season: tags?.season?.[0] || 'all',
                image_url: item.image_url || '',
                difficulty: item.difficulty || 1,
                time_required: item.time_required || 30,
                min_participants: item.min_participants || 1,
                max_participants: item.max_participants || 10,
                materials: (item.materials as string[]) || [],
                ingredients: ingredientsNormalized,
                process_steps: (item.process_steps as string[]) || [],
                tips: item.tips || '',
                // V2.1 Fields
                servings: item.servings || '',
                calories: item.calories || 0,
                age_group: item.age_group || '',
                location_type: item.location_type || '',
            });
        } else {
            setEditingItem(null);
            setRecFormData({
                category: 'cooking',
                title: '',
                description: '',
                season: 'all',
                image_url: '',
                difficulty: 1,
                time_required: 30,
                min_participants: 1,
                max_participants: 10,
                materials: [],
                ingredients: [],
                process_steps: [],
                tips: '',
                // V2.1 Fields
                servings: '',
                calories: 0,
                age_group: '',
                location_type: '',
            });
        }
        setIsRecSheetOpen(true);
    };

    const openEventSheet = (item?: EventItem) => {
        if (item) {
            setEditingItem(item);
            setEventFormData({
                title: item.title,
                location: item.location || '',
                start_date: item.start_date || '',
                end_date: item.end_date || '',
                image_url: item.image_url || ''
            });
        } else {
            setEditingItem(null);
            setEventFormData({ title: '', location: '', start_date: '', end_date: '', image_url: '' });
        }
        setIsEventSheetOpen(true);
    };

    const openTravelRecipeSheet = (item?: any) => {
        if (item) {
            setEditingItem(item);
            setTravelRecipeFormData({
                category_id: item.category_id ? String(item.category_id) : '',
                name: item.name,
                thumbnail_url: item.thumbnail_url || '',
                ingredients: item.ingredients || [],
                travel_tips: item.travel_tips || [],
                youtube_search_keyword: item.youtube_search_keyword || '',
                instagram_search_keyword: item.instagram_search_keyword || '',
            });
        } else {
            setEditingItem(null);
            setTravelRecipeFormData({
                category_id: '',
                name: '',
                thumbnail_url: '',
                ingredients: [],
                travel_tips: [],
                youtube_search_keyword: '',
                instagram_search_keyword: '',
            });
        }
        setIsTravelRecipeSheetOpen(true);
    };

    const handleTravelRecipeSubmit = async () => {
        try {
            const payload = {
                category_id: travelRecipeFormData.category_id ? parseInt(travelRecipeFormData.category_id) : null,
                name: travelRecipeFormData.name,
                thumbnail_url: travelRecipeFormData.thumbnail_url || null,
                ingredients: travelRecipeFormData.ingredients,
                travel_tips: travelRecipeFormData.travel_tips,
                youtube_search_keyword: travelRecipeFormData.youtube_search_keyword || null,
                instagram_search_keyword: travelRecipeFormData.instagram_search_keyword || null,
            };

            if (editingItem && 'travel_tips' in editingItem) {
                const { error } = await supabase.from('travel_recipes').update(payload).eq('id', editingItem.id);
                if (error) throw error;
                toast.success('수정되었습니다.');
            } else {
                const { error } = await supabase.from('travel_recipes').insert(payload);
                if (error) throw error;
                toast.success('추가되었습니다.');
            }
            setIsTravelRecipeSheetOpen(false);
            setEditingItem(null);
            fetchData();
        } catch (e) {
            const message = e instanceof Error ? e.message : "오류가 발생했습니다.";
            toast.error(message);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'rec' | 'event' | 'travel') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = await communityService.uploadImage(file);
        if (type === 'rec') setRecFormData(prev => ({ ...prev, image_url: url }));
        else if (type === 'travel') setTravelRecipeFormData(prev => ({ ...prev, thumbnail_url: url }));
        else setEventFormData(prev => ({ ...prev, image_url: url }));
    };

    // List Handlers
    const addMaterial = () => {
        if (!tempInput.trim()) return;
        setRecFormData(prev => ({
            ...prev,
            materials: [...prev.materials, tempInput.trim()]
        }));
        setTempInput('');
    };

    const addIngredient = () => {
        if (!tempIngName.trim()) return;
        setRecFormData(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, { name: tempIngName.trim(), amount: tempIngAmount.trim() }]
        }));
        setTempIngName('');
        setTempIngAmount('');
    };

    const removeListItem = (field: 'materials' | 'ingredients' | 'process_steps', idx: number) => {
        setRecFormData(prev => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== idx)
        }));
    };

    const addTravelTip = () => {
        if (!tempTip.trim()) return;
        setTravelRecipeFormData(prev => ({
            ...prev,
            travel_tips: [...prev.travel_tips, tempTip.trim()]
        }));
        setTempTip('');
    };

    const removeTravelTip = (idx: number) => {
        setTravelRecipeFormData(prev => ({
            ...prev,
            travel_tips: prev.travel_tips.filter((_, i) => i !== idx)
        }));
    };

    const addTravelIngredient = () => {
        if (!tempRecipeIngName.trim()) return;
        setTravelRecipeFormData(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, { name: tempRecipeIngName.trim(), amount: tempRecipeIngAmount.trim() }]
        }));
        setTempRecipeIngName('');
        setTempRecipeIngAmount('');
    };

    const removeTravelIngredient = (idx: number) => {
        setTravelRecipeFormData(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== idx)
        }));
    };


    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">추천 엔진 관리</h1>

            <Tabs defaultValue="pool">
                <TabsList>
                    <TabsTrigger value="pool">추천 콘텐츠 풀</TabsTrigger>
                    <TabsTrigger value="events">행사 (Events)</TabsTrigger>
                    <TabsTrigger value="travel_recipes">여행 레시피</TabsTrigger>
                </TabsList>

                {/* Recommendation Pool Tab */}
                <TabsContent value="pool" className="space-y-4">
                    {/* 1. Header & Filters */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <div className="flex bg-stone-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setFilterCategory('all')}
                                    className={`px-4 py-1.5 text-sm rounded-md transition-all ${filterCategory === 'all' ? 'bg-white shadow-sm font-bold text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    전체 ({recItems.length})
                                </button>
                                <button
                                    onClick={() => setFilterCategory('cooking')}
                                    className={`px-4 py-1.5 text-sm rounded-md transition-all ${filterCategory === 'cooking' ? 'bg-white shadow-sm font-bold text-orange-700' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    요리 ({recItems.filter(i => i.category === 'cooking').length})
                                </button>
                                <button
                                    onClick={() => setFilterCategory('play')}
                                    className={`px-4 py-1.5 text-sm rounded-md transition-all ${filterCategory === 'play' ? 'bg-white shadow-sm font-bold text-green-700' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    놀이 ({recItems.filter(i => i.category === 'play').length})
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto justify-end">
                            {selectedIds.size > 0 && (
                                <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="animate-in fade-in zoom-in">
                                    <Trash2 size={14} className="mr-2" />
                                    선택 삭제 ({selectedIds.size})
                                </Button>
                            )}

                            {/* Paste Import Dialog */}
                            <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="gap-2">
                                        <Copy className="w-4 h-4" />
                                        직접 붙여넣기
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle>JSON 데이터 직접 붙여넣기</DialogTitle>
                                        <DialogDescription>
                                            AI가 생성한 JSON 데이터를 아래에 붙여넣으세요.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex justify-end px-1 pt-2">
                                        <Button variant="ghost" size="sm" onClick={handleCopyTemplate} className="text-xs text-blue-600 gap-1">
                                            <Copy size={12} /> AI 요청용 양식 복사
                                        </Button>
                                    </div>
                                    <div className="flex-1 py-2">
                                        <Textarea
                                            placeholder='[{"category": "cooking", "title": "...", "ingredients": [...]}, ...]'
                                            className="h-full font-mono text-xs"
                                            value={bulkJson}
                                            onChange={(e) => setBulkJson(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleBulkPasteImport} disabled={bulkLoading}>
                                            {bulkLoading ? "등록 중..." : "등록하기"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button onClick={handleCopyJson} variant="outline" className="gap-2 border-stone-200 text-stone-700 hover:bg-stone-50">
                                <Copy size={16} /> JSON 복사
                            </Button>

                            <Button onClick={handleBulkExport} variant="outline" className="gap-2 border-green-200 text-green-700 hover:bg-green-50">
                                <Download size={16} /> CSV 다운로드
                            </Button>

                            <JsonImportButton onImport={handleBulkJsonImport} isLoading={bulkLoading} />

                            <Button onClick={() => openRecSheet()} className="bg-[#1C4526]">
                                <Plus size={16} className="mr-2" /> 개별 추가
                            </Button>
                        </div>
                    </div>

                    {/* 2. Select All Bar */}
                    <div className="flex items-center gap-2 px-1">
                        <input
                            type="checkbox"
                            checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-[#1C4526] focus:ring-[#1C4526]"
                        />
                        <span className="text-sm text-gray-500">전체 선택</span>
                    </div>

                    {/* 3. Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                className={`
                                    relative border rounded-lg p-4 bg-white shadow-sm flex gap-4 transition-all
                                    ${selectedIds.has(item.id) ? 'ring-2 ring-[#1C4526] bg-green-50/10' : ''}
                                `}
                            >
                                {/* Checkbox Overlay */}
                                <div className="absolute top-3 left-3 z-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(item.id)}
                                        onChange={() => toggleSelection(item.id)}
                                        className="w-5 h-5 rounded border-gray-300 text-[#1C4526] focus:ring-[#1C4526] cursor-pointer"
                                    />
                                </div>

                                <div className="pl-6 flex gap-4 w-full">
                                    {item.image_url ? (
                                        <Image unoptimized src={item.image_url} width={80} height={80} className="w-20 h-20 rounded-md object-cover bg-gray-100 shrink-0" alt={item.title} />
                                    ) : (
                                        <div className="w-20 h-20 rounded-md bg-stone-50 flex items-center justify-center shrink-0">
                                            {item.category === 'cooking' ? <ChefHat size={24} className="text-stone-300" /> : <Tent size={24} className="text-stone-300" />}
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${item.category === 'cooking' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                {item.category === 'cooking' ? '요리' : '놀이'}
                                            </span>
                                            <div className="flex gap-1">
                                                <button onClick={() => openRecSheet(item)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Edit size={14} /></button>
                                                <button onClick={() => handleDelete('recommendation_pool', item.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-sm truncate">{item.title}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 min-h-[2.5em]">{item.description}</p>
                                        <div className="flex gap-2 mt-1 text-[10px] text-stone-400">
                                            <span className="flex items-center gap-1">⏱️ {item.time_required}분</span>
                                            <span className="flex items-center gap-1">⭐ {item.difficulty}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredItems.length === 0 && (
                            <div className="col-span-full py-20 text-center text-stone-400">
                                데이터가 없습니다.
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* Events Tab */}
                <TabsContent value="events" className="space-y-4">
                    {/* ... (Existing Events List) ... */}
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-500">주변 행사/축제 정보를 관리합니다.</div>
                        <Button onClick={() => openEventSheet()} className="bg-blue-600 hover:bg-blue-700">
                            <Plus size={16} className="mr-2" /> 행사 추가
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {events.map(evt => (
                            <div key={evt.id} className="flex items-center gap-4 bg-white p-4 rounded-lg border">
                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                    {evt.image_url ? <Image unoptimized src={evt.image_url} width={64} height={64} className="w-full h-full object-cover" alt={evt.title} /> : <Calendar className="text-gray-400" />}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold">{evt.title}</h3>
                                    <div className="flex gap-4 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center"><MapPin size={12} className="mr-1" /> {evt.location}</span>
                                        <span className="flex items-center"><Calendar size={12} className="mr-1" /> {evt.start_date} ~ {evt.end_date}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => openEventSheet(evt)}><Edit size={16} /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete('nearby_events', evt.id)} className="text-red-500"><Trash2 size={16} /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                {/* Travel Recipes Tab */}
                <TabsContent value="travel_recipes" className="space-y-4">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border">
                        <div className="text-sm text-gray-500">독립된 여행 및 캠핑 요리 레시피 데이터를 관리합니다. (총 {travelRecipes.length}개)</div>
                        <div className="flex gap-2">
                            {/* Travel Recipe Bulk Paste Dialog */}
                            <Dialog open={isTravelRecipeBulkOpen} onOpenChange={setIsTravelRecipeBulkOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                        <Copy className="w-4 h-4" />
                                        직접 붙여넣기
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle>여행 레시피 JSON 데이터 직접 붙여넣기</DialogTitle>
                                        <DialogDescription>
                                            AI가 생성한 여행 레시피 JSON 데이터를 아래에 붙여넣으세요.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex justify-end px-1 pt-2">
                                        <Button variant="ghost" size="sm" onClick={handleCopyTravelRecipeTemplate} className="text-xs text-blue-600 gap-1">
                                            <Copy size={12} /> AI 요청용 양식 복사
                                        </Button>
                                    </div>
                                    <div className="flex-1 py-2">
                                        <Textarea
                                            placeholder='[{"category": "국물/밀키트", "name": "부대찌개", "ingredients": [{"name": "햄", "amount": "100g"}], "travel_tips": ["팁"]}, ...]'
                                            className="h-full font-mono text-xs"
                                            value={travelRecipeBulkJson}
                                            onChange={(e) => setTravelRecipeBulkJson(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleTravelRecipeBulkImport} disabled={travelRecipeBulkLoading} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                                            {travelRecipeBulkLoading ? "등록 중..." : "등록하기"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button onClick={() => openTravelRecipeSheet()} className="bg-emerald-700 hover:bg-emerald-800">
                                <Plus size={16} className="mr-2" /> 레시피 추가
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {travelRecipes.map(recipe => {
                            const catName = recipeCategories.find(c => c.id === recipe.category_id)?.name || '기타';
                            return (
                                <div key={recipe.id} className="relative border rounded-lg p-4 bg-white shadow-sm flex gap-4 transition-all">
                                    <div className="flex gap-4 w-full">
                                        {recipe.thumbnail_url ? (
                                            <Image unoptimized src={recipe.thumbnail_url} width={80} height={80} className="w-20 h-20 rounded-md object-cover bg-gray-100 shrink-0" alt={recipe.name} />
                                        ) : (
                                            <div className="w-20 h-20 rounded-md bg-stone-50 flex items-center justify-center shrink-0">
                                                <ChefHat size={24} className="text-stone-300" />
                                            </div>
                                        )}
                                        <div className="flex-1 space-y-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">
                                                    {catName}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => openTravelRecipeSheet(recipe)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Edit size={14} /></button>
                                                    <button onClick={() => handleDelete('travel_recipes', recipe.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-sm truncate">{recipe.name}</h3>
                                            <div className="text-[10px] text-stone-500">💡 {recipe.travel_tips?.[0] || '등록된 팁 없음'}</div>
                                            <div className="flex gap-2 mt-1 text-[10px] text-stone-400">
                                                <span>🛒 재료 {recipe.ingredients?.length || 0}종</span>
                                                <span>👁️ {recipe.view_count || 0}회</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {travelRecipes.length === 0 && (
                            <div className="col-span-full py-20 text-center text-stone-400">
                                등록된 여행 레시피가 없습니다.
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Delete Alert Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.type === 'bulk'
                                ? `선택한 ${selectedIds.size}개 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
                                : '이 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            삭제 확인
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rec Modal (Enhanced V2) */}
            <Sheet open={isRecSheetOpen} onOpenChange={setIsRecSheetOpen}>
                <SheetContent className="overflow-y-auto sm:max-w-md">
                    <SheetHeader><SheetTitle>{editingItem ? '콘텐츠 수정' : '콘텐츠 추가'}</SheetTitle></SheetHeader>
                    <div className="space-y-4 py-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>카테고리</Label>
                                <Select value={recFormData.category} onValueChange={v => setRecFormData({ ...recFormData, category: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cooking">요리 (Cooking)</SelectItem>
                                        <SelectItem value="play">놀이 (Play)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>계절 태그</Label>
                                <Select value={recFormData.season} onValueChange={v => setRecFormData({ ...recFormData, season: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">사계절</SelectItem>
                                        <SelectItem value="spring">봄</SelectItem>
                                        <SelectItem value="summer">여름</SelectItem>
                                        <SelectItem value="autumn">가을</SelectItem>
                                        <SelectItem value="winter">겨울</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>제목</Label>
                            <Input value={recFormData.title} onChange={e => setRecFormData({ ...recFormData, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>설명</Label>
                            <Textarea value={recFormData.description} onChange={e => setRecFormData({ ...recFormData, description: e.target.value })} rows={2} />
                        </div>

                        {/* V2 Detail Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>난이도 (1-5)</Label>
                                <Input type="number" min={1} max={5} value={recFormData.difficulty} onChange={e => setRecFormData({ ...recFormData, difficulty: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>소요 시간 (분)</Label>
                                <Input type="number" value={recFormData.time_required} onChange={e => setRecFormData({ ...recFormData, time_required: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        {/* V2.1 Premium Fields */}
                        {recFormData.category === 'cooking' && (
                            <div className="grid grid-cols-2 gap-4 bg-orange-50/50 p-2 rounded-lg border border-orange-100">
                                <div className="space-y-2">
                                    <Label className="text-orange-900">인분 (Servings)</Label>
                                    <Input placeholder="예: 2-3인분" value={recFormData.servings} onChange={e => setRecFormData({ ...recFormData, servings: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-orange-900">칼로리 (kcal)</Label>
                                    <Input type="number" value={recFormData.calories} onChange={e => setRecFormData({ ...recFormData, calories: parseInt(e.target.value) })} />
                                </div>
                            </div>
                        )}

                        {recFormData.category === 'play' && (
                            <div className="grid grid-cols-2 gap-4 bg-green-50/50 p-2 rounded-lg border border-green-100">
                                <div className="space-y-2">
                                    <Label className="text-green-900">권장 연령</Label>
                                    <Input placeholder="예: 5세 이상" value={recFormData.age_group} onChange={e => setRecFormData({ ...recFormData, age_group: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-green-900">장소 유형</Label>
                                    <Select value={recFormData.location_type} onValueChange={v => setRecFormData({ ...recFormData, location_type: v })}>
                                        <SelectTrigger><SelectValue placeholder="선택하세요" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="실내">실내</SelectItem>
                                            <SelectItem value="실외">실외 (야외)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {recFormData.category === 'play' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>최소 인원</Label>
                                    <Input type="number" value={recFormData.min_participants} onChange={e => setRecFormData({ ...recFormData, min_participants: parseInt(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>최대 인원</Label>
                                    <Input type="number" value={recFormData.max_participants} onChange={e => setRecFormData({ ...recFormData, max_participants: parseInt(e.target.value) })} />
                                </div>
                            </div>
                        )}

                        {recFormData.category === 'play' && (
                            <div className="space-y-2">
                                <Label>준비물 (Materials)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={tempInput}
                                        onChange={e => setTempInput(e.target.value)}
                                        placeholder="항목 입력 후 추가"
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMaterial(); } }}
                                    />
                                    <Button type="button" onClick={addMaterial} variant="outline"><Plus size={16} /></Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {recFormData.materials.map((item, idx) => (
                                        <div key={idx} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-1">
                                            {item}
                                            <button onClick={() => removeListItem('materials', idx)}><Trash2 size={12} className="text-gray-400 hover:text-red-500" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ingredients: Structured Input */}
                        {recFormData.category === 'cooking' && (
                            <div className="space-y-2 p-3 bg-stone-50 rounded-lg border">
                                <Label className="text-stone-700">🛒 재료 (Ingredients)</Label>
                                <div className="flex gap-2 mb-2">
                                    <Input
                                        value={tempIngName}
                                        onChange={e => setTempIngName(e.target.value)}
                                        placeholder="재료명 (예: 삼겹살)"
                                        className="flex-1"
                                    />
                                    <Input
                                        value={tempIngAmount}
                                        onChange={e => setTempIngAmount(e.target.value)}
                                        placeholder="용량 (예: 300g)"
                                        className="w-24"
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } }}
                                    />
                                    <Button type="button" onClick={addIngredient} variant="default" size="icon" className="shrink-0">
                                        <Plus size={16} />
                                    </Button>
                                </div>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {recFormData.ingredients.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded border text-sm shadow-sm">
                                            <span>{item.name}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-stone-500 text-xs">{item.amount}</span>
                                                <button onClick={() => removeListItem('ingredients', idx)}>
                                                    <Trash2 size={14} className="text-stone-400 hover:text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {recFormData.ingredients.length === 0 && (
                                        <p className="text-xs text-stone-400 text-center py-2">등록된 재료가 없습니다.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>이미지</Label>
                            <Input type="file" onChange={e => handleImageUpload(e, 'rec')} />
                        </div>

                        {/* Process Steps (Reuse logic for now, simpler) */}
                        <div className="space-y-2">
                            <Label>진행 방법 / 레시피</Label>
                            <Textarea
                                rows={5}
                                placeholder="단계별 내용을 줄바꿈으로 입력하거나, 직접 입력하세요."
                                value={recFormData.process_steps.join('\n')}
                                onChange={e => setRecFormData({ ...recFormData, process_steps: e.target.value.split('\n') })}
                            />
                            <p className="text-xs text-gray-400">각 단계는 줄바꿈으로 구분됩니다.</p>
                        </div>

                        {/* V2: Tips Field */}
                        <div className="space-y-2">
                            <Label>💡 꿀팁 (Tip)</Label>
                            <Textarea
                                rows={2}
                                placeholder="요리/놀이를 더 즐겁게 즐기는 팁을 작성하세요."
                                value={recFormData.tips}
                                onChange={e => setRecFormData({ ...recFormData, tips: e.target.value })}
                            />
                        </div>

                    </div>
                    <SheetFooter><Button onClick={handleRecSubmit}>저장</Button></SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Event Modal (Unchanged) */}
            <Sheet open={isEventSheetOpen} onOpenChange={setIsEventSheetOpen}>
                <SheetContent>
                    <SheetHeader><SheetTitle>{editingItem ? '행사 수정' : '행사 추가'}</SheetTitle></SheetHeader>
                    <div className="space-y-4 py-6">
                        <div className="space-y-2">
                            <Label>행사명</Label>
                            <Input value={eventFormData.title} onChange={e => setEventFormData({ ...eventFormData, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>장소</Label>
                            <Input value={eventFormData.location} onChange={e => setEventFormData({ ...eventFormData, location: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label>시작일</Label>
                                <Input type="date" value={eventFormData.start_date} onChange={e => setEventFormData({ ...eventFormData, start_date: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>종료일</Label>
                                <Input type="date" value={eventFormData.end_date} onChange={e => setEventFormData({ ...eventFormData, end_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>포스터 이미지</Label>
                            <Input type="file" onChange={e => handleImageUpload(e, 'event')} />
                        </div>
                    </div>
                    <SheetFooter><Button onClick={handleEventSubmit}>저장</Button></SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Travel Recipe Admin Sheet */}
            <Sheet open={isTravelRecipeSheetOpen} onOpenChange={setIsTravelRecipeSheetOpen}>
                <SheetContent className="overflow-y-auto sm:max-w-md">
                    <SheetHeader><SheetTitle>{editingItem && 'travel_tips' in editingItem ? '여행 레시피 수정' : '여행 레시피 추가'}</SheetTitle></SheetHeader>
                    <div className="space-y-4 py-6">
                        <div className="space-y-2">
                            <Label>카테고리</Label>
                            <Select value={travelRecipeFormData.category_id} onValueChange={v => setTravelRecipeFormData({ ...travelRecipeFormData, category_id: v })}>
                                <SelectTrigger><SelectValue placeholder="카테고리를 선택하세요" /></SelectTrigger>
                                <SelectContent>
                                    {recipeCategories.filter(c => c.parent_id !== null).map(c => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>요리 이름</Label>
                            <Input value={travelRecipeFormData.name} onChange={e => setTravelRecipeFormData({ ...travelRecipeFormData, name: e.target.value })} placeholder="예: 삼겹살 김치찌개" />
                        </div>

                        <div className="space-y-2">
                            <Label>썸네일 이미지</Label>
                            <Input type="file" onChange={e => handleImageUpload(e, 'travel')} />
                        </div>

                        {/* Ingredients Checklist */}
                        <div className="space-y-2 p-3 bg-stone-50 rounded-lg border">
                            <Label className="text-stone-700">🛒 요리 재료</Label>
                            <div className="flex gap-2 mb-2">
                                <Input
                                    value={tempRecipeIngName}
                                    onChange={e => setTempRecipeIngName(e.target.value)}
                                    placeholder="재료명 (예: 김치)"
                                    className="flex-1"
                                />
                                <Input
                                    value={tempRecipeIngAmount}
                                    onChange={e => setTempRecipeIngAmount(e.target.value)}
                                    placeholder="분량 (예: 1포기)"
                                    className="w-24"
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTravelIngredient(); } }}
                                />
                                <Button type="button" onClick={addTravelIngredient} variant="default" size="icon" className="shrink-0">
                                    <Plus size={16} />
                                </Button>
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {travelRecipeFormData.ingredients.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded border text-sm shadow-sm">
                                        <span>{item.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-stone-500 text-xs">{item.amount}</span>
                                            <button onClick={() => removeTravelIngredient(idx)}>
                                                <Trash2 size={14} className="text-stone-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {travelRecipeFormData.ingredients.length === 0 && (
                                    <p className="text-xs text-stone-400 text-center py-2">등록된 재료가 없습니다.</p>
                                )}
                            </div>
                        </div>

                        {/* Travel Tips List */}
                        <div className="space-y-2 p-3 bg-stone-50 rounded-lg border">
                            <Label className="text-stone-700">💡 조리 팁 목록</Label>
                            <div className="flex gap-2 mb-2">
                                <Input
                                    value={tempTip}
                                    onChange={e => setTempTip(e.target.value)}
                                    placeholder="조리 꿀팁 입력"
                                    className="flex-1"
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTravelTip(); } }}
                                />
                                <Button type="button" onClick={addTravelTip} variant="default" size="icon" className="shrink-0">
                                    <Plus size={16} />
                                </Button>
                            </div>
                            <div className="space-y-1">
                                {travelRecipeFormData.travel_tips.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded border text-sm shadow-sm">
                                        <span className="truncate flex-1">{item}</span>
                                        <button onClick={() => removeTravelTip(idx)} className="shrink-0 ml-2">
                                            <Trash2 size={14} className="text-stone-400 hover:text-red-500" />
                                        </button>
                                    </div>
                                ))}
                                {travelRecipeFormData.travel_tips.length === 0 && (
                                    <p className="text-xs text-stone-400 text-center py-2">등록된 조리 팁이 없습니다.</p>
                                )}
                            </div>
                        </div>

                        {/* Search Keywords */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>유튜브 검색 키워드</Label>
                                <Input value={travelRecipeFormData.youtube_search_keyword} onChange={e => setTravelRecipeFormData({ ...travelRecipeFormData, youtube_search_keyword: e.target.value })} placeholder="예: 삼겹살 김치찌개 캠핑" />
                            </div>
                            <div className="space-y-2">
                                <Label>인스타 태그 키워드</Label>
                                <Input value={travelRecipeFormData.instagram_search_keyword} onChange={e => setTravelRecipeFormData({ ...travelRecipeFormData, instagram_search_keyword: e.target.value })} placeholder="예: #캠핑요리" />
                            </div>
                        </div>
                    </div>
                    <SheetFooter><Button onClick={handleTravelRecipeSubmit}>저장</Button></SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
