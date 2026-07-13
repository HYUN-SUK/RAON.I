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
import { Loader2, Save, ArrowLeft, ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { communityService } from '@/services/communityService';

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

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: 0,
        base_price: 0,
        max_occupancy: 4,
        image_url: '',
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
                    const rawSite = data as Site;
                    setSite(rawSite);
                    setFormData({
                        name: rawSite.name,
                        description: rawSite.description || '',
                        price: rawSite.price || 0,
                        base_price: rawSite.base_price,
                        max_occupancy: rawSite.capacity,
                        image_url: rawSite.image_url || '',
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
    }, [id, supabase, router]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setSaving(true);
            const url = await communityService.uploadImage(file);
            setFormData(prev => ({ ...prev, image_url: url }));
            toast.success('이미지가 업로드되었습니다.');
        } catch (error) {
            console.error(error);
            toast.error('이미지 업로드 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const featuresArray = formData.features
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            const { error } = await supabase
                .from('sites')
                .update({
                    name: formData.name,
                    description: formData.description,
                    price: formData.price,
                    base_price: formData.base_price,
                    max_occupancy: formData.max_occupancy,
                    image_url: formData.image_url,
                    features: featuresArray,
                    is_active: formData.is_active,
                    weekday: formData.weekday ? Number(formData.weekday) : null,
                    weekend: formData.weekend ? Number(formData.weekend) : null,
                    peak_weekday: formData.peak_weekday ? Number(formData.peak_weekday) : null,
                    peak_weekend: formData.peak_weekend ? Number(formData.peak_weekend) : null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('사이트 정보가 수정되었습니다.');
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('저장 중 오류가 발생했습니다.');
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
                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                        <Label>사이트 이미지</Label>
                        <div className="aspect-video relative bg-gray-100 rounded-lg overflow-hidden border">
                            {formData.image_url ? (
                                <Image
                                    src={formData.image_url}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <ImageIcon className="w-8 h-8 opacity-50" />
                                </div>
                            )}
                        </div>
                        <Input type="file" accept="image/*" onChange={handleImageUpload} />
                        <p className="text-xs text-gray-500">
                            예약 페이지 및 상세 보기에 표시될 메인 이미지입니다.
                        </p>
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
                                        value={formData.weekday ? '' : formData.peak_weekday} // disabled or clear if needed, just standard value mapping
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
            </form>
        </div>
    );
}
