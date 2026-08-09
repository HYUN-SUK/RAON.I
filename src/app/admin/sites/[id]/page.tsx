'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, ArrowLeft, ImageIcon, Trash2, Plus, Check } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { communityService } from '@/services/communityService';
import { updateSiteAdmin } from '@/actions/admin-sites';
import { fetchAirconUnits, addAirconUnit, deleteAirconUnit, updateAirconUnitStatus, updateAirconUnitDetails } from '@/actions/admin-aircon';

type Site = Database['public']['Tables']['sites']['Row'] & {
    weekday?: number | null;
    weekend?: number | null;
    peak_weekday?: number | null;
    peak_weekend?: number | null;
};

// 전역 요금 기본값 상수 (site_config 또는 전역 default_price_config 동기화용)
const GLOBAL_DEFAULT_PRICES = {
    weekday: 40000,
    weekend: 70000,
    peakWeekday: 50000,
    peakWeekend: 70000
};

export default function AdminSiteEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [site, setSite] = useState<Site | null>(null);

    // 에어컨 개별 기기 상태
    const isAirGroup = id === 'air-group';
    const [airconUnits, setAirconUnits] = useState<any[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [tempAirData, setTempAirData] = useState<Record<string, { name: string; price: string }>>({});

    const loadAirconUnits = async () => {
        setLoadingUnits(true);
        const res = await fetchAirconUnits();
        if (res.success && res.data) {
            setAirconUnits(res.data);
            const initialTemp: Record<string, { name: string; price: string }> = {};
            res.data.forEach((unit: any) => {
                initialTemp[unit.id] = {
                    name: unit.name,
                    price: String(unit.price || 10000)
                };
            });
            setTempAirData(initialTemp);
        }
        setLoadingUnits(false);
    };

    const handleAddUnit = async () => {
        const res = await addAirconUnit();
        if (res.success) {
            toast.success('새 에어컨 기기가 추가되었습니다.');
            loadAirconUnits();
        } else {
            toast.error(res.error || '기기 추가 실패');
        }
    };

    const handleDeleteUnit = async (unitId: string) => {
        if (!confirm('정말 이 에어컨 기기를 삭제하시겠습니까?')) return;
        const res = await deleteAirconUnit(unitId);
        if (res.success) {
            toast.success('에어컨 기기가 삭제되었습니다.');
            loadAirconUnits();
        } else {
            toast.error(res.error || '기기 삭제 실패');
        }
    };

    const handleToggleUnit = async (unitId: string, currentStatus: boolean) => {
        const res = await updateAirconUnitStatus(unitId, !currentStatus);
        if (res.success) {
            toast.success('기기 운영상태가 변경되었습니다.');
            loadAirconUnits();
        } else {
            toast.error(res.error || '상태 변경 실패');
        }
    };

    const handleSaveUnitDetails = async (unitId: string) => {
        const tempData = tempAirData[unitId];
        if (!tempData) return;
        if (!tempData.name.trim()) {
            toast.error('기기 이름을 입력해주세요.');
            return;
        }
        if (isNaN(Number(tempData.price))) {
            toast.error('올바른 가격(숫자)을 입력해주세요.');
            return;
        }

        const res = await updateAirconUnitDetails(unitId, tempData.name.trim(), Number(tempData.price));
        if (res.success) {
            toast.success('에어컨 기기 정보가 수정되었습니다.');
            loadAirconUnits();
        } else {
            toast.error(res.error || '기기 정보 수정 실패');
        }
    };

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: 0,
        base_price: 0,
        max_occupancy: 4,
        image_url: '',
        image_urls: [] as string[],
        features: '', 
        is_active: true,
        // 신규 추가된 4대 요금 커스텀 필드
        weekday: '',
        weekend: '',
        peak_weekday: '',
        peak_weekend: ''
    });

    useEffect(() => {
        const fetchSite = async () => {
            try {
                const { data, error } = await supabase
                    .from('sites')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (data) {
                    const rawSite = data as any;
                    setSite(rawSite);
                    setFormData({
                        name: rawSite.name,
                        description: rawSite.description || '',
                        price: rawSite.price || 0,
                        base_price: rawSite.base_price,
                        max_occupancy: rawSite.max_occupancy ?? rawSite.capacity ?? 4,
                        image_url: rawSite.image_url || '',
                        image_urls: rawSite.image_urls || [],
                        features: rawSite.features ? rawSite.features.join(', ') : '',
                        is_active: rawSite.is_active,
                        weekday: rawSite.weekday !== null && rawSite.weekday !== undefined ? String(rawSite.weekday) : '',
                        weekend: rawSite.weekend !== null && rawSite.weekend !== undefined ? String(rawSite.weekend) : '',
                        peak_weekday: rawSite.peak_weekday !== null && rawSite.peak_weekday !== undefined ? String(rawSite.peak_weekday) : '',
                        peak_weekend: rawSite.peak_weekend !== null && rawSite.peak_weekend !== undefined ? String(rawSite.peak_weekend) : '',
                    });
                }
            } catch (error) {
                console.error(error);
                toast.error('사이트 정보를 불러오지 못했습니다.');
                router.push('/admin/sites');
            } finally {
                setLoading(false);
            }
        };

        fetchSite();
        if (id === 'air-group') {
            loadAirconUnits();
        }
    }, [id, supabase, router]);

    const handleImageUploadAtIndex = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setSaving(true);
            const url = await communityService.uploadImage(file);
            setFormData(prev => {
                const newUrls = [...(prev.image_urls || [])];
                while (newUrls.length <= index) {
                    newUrls.push('');
                }
                newUrls[index] = url;
                const mainUrl = newUrls[0] || url;
                return { 
                    ...prev, 
                    image_urls: newUrls, 
                    image_url: mainUrl 
                };
            });
            toast.success(`${index + 1}번 이미지가 업로드되었습니다.`);
        } catch (error) {
            console.error(error);
            toast.error('이미지 업로드 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleImageDeleteAtIndex = (index: number) => {
        setFormData(prev => {
            const newUrls = [...(prev.image_urls || [])];
            newUrls[index] = '';
            while (newUrls.length > 0 && newUrls[newUrls.length - 1] === '') {
                newUrls.pop();
            }
            const mainUrl = newUrls[0] || '';
            return {
                ...prev,
                image_urls: newUrls,
                image_url: mainUrl
            };
        });
        toast.info(`${index + 1}번 이미지가 제거되었습니다.`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const featuresArray = formData.features
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            const result = await updateSiteAdmin(id, {
                name: formData.name,
                description: formData.description,
                price: formData.price,
                base_price: formData.base_price,
                max_occupancy: formData.max_occupancy,
                image_url: formData.image_url,
                image_urls: formData.image_urls,
                features: featuresArray,
                is_active: formData.is_active,
                weekday: formData.weekday ? Number(formData.weekday) : undefined,
                weekend: formData.weekend ? Number(formData.weekend) : undefined,
                peak_weekday: formData.peak_weekday ? Number(formData.peak_weekday) : undefined,
                peak_weekend: formData.peak_weekend ? Number(formData.peak_weekend) : undefined,
            });

            if (result.success) {
                toast.success('사이트 정보가 성공적으로 수정되었습니다.');
                router.push('/admin/sites');
            } else {
                toast.error(result.error || '저장 중 오류가 발생했습니다.');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || '저장 중 예외가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
    if (!site) return <div className="p-8">사이트를 찾을 수 없습니다.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">사이트 수정: {site.id}</h1>
                    <p className="text-gray-500 text-sm">사이트 정보를 수정합니다.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Image & Status */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
                        <div>
                            <Label className="font-bold text-base">사이트 이미지 (최대 3장)</Label>
                            <p className="text-xs text-gray-500 mt-1">
                                첫 번째 이미지가 대표 이미지로 지정되며, 사용자 상세화면에서 가로 스와이프로 노출됩니다.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                            {[0, 1, 2].map((idx) => {
                                const url = formData.image_urls?.[idx] || (idx === 0 ? formData.image_url : '');
                                return (
                                    <div key={idx} className="space-y-2">
                                        <div className="aspect-square relative bg-gray-50 rounded-lg overflow-hidden border flex flex-col items-center justify-center group">
                                            {url ? (
                                                <>
                                                    <Image
                                                        src={url}
                                                        alt={`Slot ${idx + 1}`}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleImageDeleteAtIndex(idx)}
                                                        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-1 shadow transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    {idx === 0 && (
                                                        <span className="absolute bottom-1 left-1 bg-green-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                                                            대표
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-center p-2 text-gray-400">
                                                    <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                                                    <span className="text-[10px] block font-medium">슬롯 {idx + 1}</span>
                                                </div>
                                            )}
                                        </div>
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleImageUploadAtIndex(idx, e)}
                                            className="text-xs file:text-xs px-1 py-0.5 h-auto cursor-pointer"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>운영 상태</Label>
                            <Switch
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            운영 중단 시 사용자 화면의 사이트 목록에서 숨김 처리되어 예약을 원천 방어합니다.
                        </p>
                    </div>
                </div>

                {/* Right Column: Details */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
                        <div className="space-y-2">
                            <Label>사이트 이름</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>소개글 (Description)</Label>
                            <Textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>레거시 평일가 (base_price)</Label>
                                <Input
                                    type="number"
                                    value={formData.base_price}
                                    onChange={e => setFormData({ ...formData, base_price: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>레거시 주말가 (price)</Label>
                                <Input
                                    type="number"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>최대 수용 인원</Label>
                                <Input
                                    type="number"
                                    value={formData.max_occupancy}
                                    onChange={e => setFormData({ ...formData, max_occupancy: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        {/* 신규 추가된 4대 요금제 설정 */}
                        <div className="space-y-4 pt-4 border-t">
                            <div className="space-y-1">
                                <Label className="font-bold text-stone-800">개별 가격 커스텀 설정</Label>
                                <p className="text-xs text-stone-500 mb-2">
                                    값을 비워두시면, 전역 가격/시즌의 전체 설정 요금이 자동으로 일괄 반영됩니다.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="custom-weekday">평일 요금</Label>
                                    <Input
                                        id="custom-weekday"
                                        type="number"
                                        placeholder={`일괄 자동 (${GLOBAL_DEFAULT_PRICES.weekday.toLocaleString()}원)`}
                                        value={formData.weekday}
                                        onChange={e => setFormData({ ...formData, weekday: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="custom-weekend">주말 요금</Label>
                                    <Input
                                        id="custom-weekend"
                                        type="number"
                                        placeholder={`일괄 자동 (${GLOBAL_DEFAULT_PRICES.weekend.toLocaleString()}원)`}
                                        value={formData.weekend}
                                        onChange={e => setFormData({ ...formData, weekend: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="custom-peak-weekday">성수기 평일 요금</Label>
                                    <Input
                                        id="custom-peak-weekday"
                                        type="number"
                                        placeholder={`일괄 자동 (${GLOBAL_DEFAULT_PRICES.peakWeekday.toLocaleString()}원)`}
                                        value={formData.peak_weekday}
                                        onChange={e => setFormData({ ...formData, peak_weekday: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="custom-peak-weekend">성수기 주말 요금</Label>
                                    <Input
                                        id="custom-peak-weekend"
                                        type="number"
                                        placeholder={`일괄 자동 (${GLOBAL_DEFAULT_PRICES.peakWeekend.toLocaleString()}원)`}
                                        value={formData.peak_weekend}
                                        onChange={e => setFormData({ ...formData, peak_weekend: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>특징 (콤마 , 로 구분)</Label>
                            <Input
                                value={formData.features}
                                onChange={e => setFormData({ ...formData, features: e.target.value })}
                                placeholder="예: 전기 가능, 파쇄석, 그늘 많음"
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-[#1C4526] hover:bg-[#15341d]" disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        변경사항 저장
                    </Button>
                </div>

                {/* 개별 에어컨 기기 관리 섹션 (그리드 하단에 전체 가로 넓이 col-span-3로 독립 배치) */}
                {isAirGroup && (
                    <div className="md:col-span-3 bg-white p-6 rounded-xl border shadow-sm space-y-4 mt-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-stone-950 flex items-center gap-2">
                                    개별 에어컨 기기 목록 및 상태 설정 ({airconUnits.length}대)
                                </h3>
                                <p className="text-xs text-stone-500">
                                    각 개별 에어컨의 기기명과 대여 요금(가격), 그리고 개별 운영 여부를 즉시 수정하여 저장할 수 있습니다.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddUnit}
                                className="border-[#1C4526] text-[#1C4526] hover:bg-[#1C4526]/5 flex items-center gap-1 font-semibold"
                            >
                                <Plus className="w-4 h-4" />
                                기기 추가
                            </Button>
                        </div>

                        {loadingUnits ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin text-stone-400 w-6 h-6" />
                            </div>
                        ) : airconUnits.length === 0 ? (
                            <div className="border border-dashed border-stone-200 rounded-xl p-8 text-center text-stone-400 text-sm bg-stone-50/50">
                                등록된 개별 에어컨 기기가 없습니다. [기기 추가] 버튼을 눌러 개설하세요.
                            </div>
                        ) : (
                            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                <table className="min-w-full divide-y divide-stone-100">
                                    <thead className="bg-stone-50 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3">기기 ID</th>
                                            <th className="px-4 py-3">기기 이름 (수정 가능)</th>
                                            <th className="px-4 py-3">대여 요금 (원화, 수정 가능)</th>
                                            <th className="px-4 py-3">운영 상태</th>
                                            <th className="px-4 py-3 text-center">작업</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 text-sm text-stone-700">
                                        {airconUnits.map(unit => {
                                            const currentTemp = tempAirData[unit.id] || { name: unit.name, price: String(unit.price || 10000) };
                                            return (
                                                <tr key={unit.id} className="hover:bg-stone-50/50 transition-colors">
                                                    <td className="px-4 py-2 font-mono text-xs text-stone-500">{unit.id}</td>
                                                    <td className="px-4 py-2">
                                                        <Input
                                                            className="h-9 py-1 px-3 text-stone-900 border-stone-200 focus:border-[#1C4526] focus:ring-0 max-w-xs font-medium bg-stone-50/50 focus:bg-white"
                                                            value={currentTemp.name}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setTempAirData(prev => ({
                                                                    ...prev,
                                                                    [unit.id]: {
                                                                        name: val,
                                                                        price: prev[unit.id]?.price || String(unit.price || 10000)
                                                                    }
                                                                }));
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <Input
                                                            type="number"
                                                            className="h-9 py-1 px-3 text-stone-900 border-stone-200 focus:border-[#1C4526] focus:ring-0 w-36 bg-stone-50/50 focus:bg-white"
                                                            value={currentTemp.price}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setTempAirData(prev => ({
                                                                    ...prev,
                                                                    [unit.id]: {
                                                                        name: prev[unit.id]?.name || unit.name,
                                                                        price: val
                                                                    }
                                                                }));
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <Switch
                                                            checked={unit.is_active !== false}
                                                            onCheckedChange={() => handleToggleUnit(unit.id, unit.is_active !== false)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleSaveUnitDetails(unit.id)}
                                                                className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 h-8 w-8 rounded-md"
                                                                title="기기 저장"
                                                            >
                                                                <Check className="w-4.5 h-4.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDeleteUnit(unit.id)}
                                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-md"
                                                                title="기기 삭제"
                                                            >
                                                                <Trash2 className="w-4.5 h-4.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </form>
        </div>
    );
}
