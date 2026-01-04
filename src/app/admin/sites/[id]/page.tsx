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
import { Loader2, Save, ArrowLeft, Upload, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { communityService } from '@/services/communityService';

type Site = Database['public']['Tables']['sites']['Row'];

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
        features: '', // converted to string for edit
        is_active: true,
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
                    setSite(data);
                    setFormData({
                        name: data.name,
                        description: data.description || '',
                        price: data.price,
                        base_price: data.base_price,
                        max_occupancy: data.max_occupancy,
                        image_url: data.image_url || '',
                        features: data.features ? data.features.join(', ') : '',
                        is_active: data.is_active,
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
            setSaving(true); // temporary loading state
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
                            운영 중단 시 예약 화면에서 '예약 불가' 상태로 표시되거나 숨겨집니다.
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
                                rows={4}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>기본 가격 (평일)</Label>
                                <Input
                                    type="number"
                                    value={formData.base_price}
                                    onChange={e => setFormData({ ...formData, base_price: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>최대 가격 (주말/성수기)</Label>
                                <Input
                                    type="number"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>최대 인원</Label>
                                <Input
                                    type="number"
                                    value={formData.max_occupancy}
                                    onChange={e => setFormData({ ...formData, max_occupancy: Number(e.target.value) })}
                                />
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

                    <Button type="submit" className="w-full bg-[#1C4526]" disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        변경사항 저장
                    </Button>
                </div>
            </form>
        </div>
    );
}
