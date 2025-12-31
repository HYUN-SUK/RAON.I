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
import { Plus, Calendar, MapPin, ChefHat, Tent, Trash2, Edit, Upload, Copy } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { Database } from '@/types/supabase';
import { communityService } from '@/services/communityService';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

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

export default function RecommendationAdminPage() {
    const supabase = createClient();

    // Data
    const [recItems, setRecItems] = useState<RecItem[]>([]);
    const [events, setEvents] = useState<EventItem[]>([]);

    // Bulk Import State
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkJson, setBulkJson] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);

    // Form States
    const [isRecSheetOpen, setIsRecSheetOpen] = useState(false);
    const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

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

    // Helper for List Inputs
    const [tempInput, setTempInput] = useState('');
    // Helper for Ingredient Inputs
    const [tempIngName, setTempIngName] = useState('');
    const [tempIngAmount, setTempIngAmount] = useState('');


    // Fetch Data
    const fetchData = React.useCallback(async () => {
        try {
            const { data: recs } = await supabase.from('recommendation_pool').select('*').order('created_at', { ascending: false });
            if (recs) setRecItems(recs);

            const { data: evts } = await supabase.from('nearby_events').select('*').order('start_date', { ascending: true });
            if (evts) setEvents(evts);
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

    const handleDelete = async (table: 'recommendation_pool' | 'nearby_events', id: number) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await supabase.from(table).delete().eq('id', id);
        toast.success('삭제되었습니다.');
        fetchData();
    };

    const handleBulkImport = async () => {
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
            } catch (e) {
                toast.error('JSON 형식이 올바르지 않습니다.');
                return;
            }

            // Map incoming JSON to DB columns if needed, or assume matching structure
            // Just basic validation here
            const items = parsed.map(item => ({
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
                // V2.1 Fields
                servings: item.servings || null,
                calories: item.calories || null,
                age_group: item.age_group || null,
                location_type: item.location_type || null,
                tags: item.tags || {},
                image_url: item.image_url || null,
                is_active: true
            }));

            const { error } = await supabase.from('recommendation_pool').insert(items);
            if (error) throw error;

            toast.success(`${items.length}개의 아이템이 일괄 등록되었습니다!`);
            setIsBulkOpen(false);
            setBulkJson('');
            fetchData();
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : "알 수 없는 오류";
            toast.error(`일괄 등록 중 오류 발생: ${message}`);
        } finally {
            setBulkLoading(false);
        }
        setBulkLoading(false);
    }


    const handleCopyTemplate = () => {
        navigator.clipboard.writeText(AI_IMPORT_TEMPLATE);
        toast.success("AI 요청 양식이 클립보드에 복사되었습니다!");
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'rec' | 'event') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = await communityService.uploadImage(file);
        if (type === 'rec') setRecFormData(prev => ({ ...prev, image_url: url }));
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


    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">추천 엔진 관리</h1>

            <Tabs defaultValue="pool">
                <TabsList>
                    <TabsTrigger value="pool">추천 콘텐츠 풀</TabsTrigger>
                    <TabsTrigger value="events">행사 (Events)</TabsTrigger>
                </TabsList>

                {/* Recommendation Pool Tab */}
                <TabsContent value="pool" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-500">요리, 놀이 추천 데이터베이스를 관리합니다.</div>
                        <div className="flex gap-2">
                            <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="gap-2">
                                        <Upload className="w-4 h-4" />
                                        AI 일괄 등록
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle>AI 추천 데이터 일괄 등록</DialogTitle>
                                        <DialogDescription>
                                            JSON 형식으로 데이터를 붙여넣으세요. (category: 'cooking' | 'play')
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
                                        <Button onClick={handleBulkImport} disabled={bulkLoading}>
                                            {bulkLoading ? "등록 중..." : "일괄 등록하기"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button onClick={() => openRecSheet()} className="bg-[#1C4526]">
                                <Plus size={16} className="mr-2" /> 아이템 추가
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recItems.map(item => (
                            <div key={item.id} className="border rounded-lg p-4 bg-white shadow-sm flex gap-4">
                                {item.image_url ? (
                                    <Image unoptimized src={item.image_url} width={80} height={80} className="w-20 h-20 rounded-md object-cover bg-gray-100" alt={item.title} />
                                ) : (
                                    <div className="w-20 h-20 rounded-md bg-gray-100 flex items-center justify-center">
                                        {item.category === 'cooking' ? <ChefHat size={24} className="text-gray-400" /> : <Tent size={24} className="text-gray-400" />}
                                    </div>
                                )}
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.category === 'cooking' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                            {item.category === 'cooking' ? '요리' : '놀이'}
                                        </span>
                                        <div className="flex gap-2">
                                            <button onClick={() => openRecSheet(item)} className="text-gray-400 hover:text-blue-500"><Edit size={14} /></button>
                                            <button onClick={() => handleDelete('recommendation_pool', item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-sm">{item.title}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                                    <div className="flex gap-2 mt-1 text-xs text-stone-400">
                                        <span>난이도: {item.difficulty}</span>
                                        <span>소요시간: {item.time_required}분</span>
                                    </div>
                                </div>
                            </div>
                        ))}
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
            </Tabs>

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
        </div>
    );
}
