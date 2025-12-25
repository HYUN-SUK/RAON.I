'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Save, MapPin, Phone, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { communityService } from '@/services/communityService'; // Reuse upload service

export default function AdminSettingsPage() {
    const supabase = createClient();
    const { config, loading: configLoading, refetch } = useSiteConfig();

    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        camp_name: '',
        address_main: '',
        address_detail: '',
        phone_number: '',
        layout_image_url: '',
        guide_map_url: '',
        pricing_guide_text: '',
        rules_guide_text: '',
    });

    // Nearby Places (JSON Editor simple version)
    const [nearbyPlaces, setNearbyPlaces] = useState<{ title: string, desc: string }[]>([]);

    useEffect(() => {
        if (config) {
            setFormData({
                camp_name: config.camp_name || '',
                address_main: config.address_main || '',
                address_detail: config.address_detail || '',
                phone_number: config.phone_number || '',
                layout_image_url: config.layout_image_url || '',
                guide_map_url: config.guide_map_url || '',
                pricing_guide_text: config.pricing_guide_text || '',
                rules_guide_text: config.rules_guide_text || '',
            });

            // Safe parse JSON
            try {
                const places = Array.isArray(config.nearby_places)
                    ? config.nearby_places as { title: string, desc: string }[]
                    : [];
                setNearbyPlaces(places);
            } catch (e) {
                console.error(e);
            }
        }
    }, [config]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const url = await communityService.uploadImage(file);
            setFormData(prev => ({ ...prev, layout_image_url: url }));
            toast.success('이미지가 업로드되었습니다.');
        } catch (error) {
            console.error(error);
            toast.error('이미지 업로드 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPlace = () => {
        setNearbyPlaces([...nearbyPlaces, { title: '', desc: '' }]);
    };

    const handlePlaceChange = (index: number, field: 'title' | 'desc', value: string) => {
        const newPlaces = [...nearbyPlaces];
        newPlaces[index] = { ...newPlaces[index], [field]: value };
        setNearbyPlaces(newPlaces);
    };

    const handleRemovePlace = (index: number) => {
        setNearbyPlaces(nearbyPlaces.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from('site_config')
                .update({
                    ...formData,
                    nearby_places: nearbyPlaces,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', 1);

            if (error) throw error;

            toast.success('설정이 저장되었습니다.');
            refetch();
        } catch (error: any) {
            console.error(error);
            toast.error(`저장 실패: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (configLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">기본정보 설정</h1>
                <Button onClick={handleSubmit} disabled={loading} className="bg-[#1C4526] text-white">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    저장하기
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6 bg-white p-6 rounded-xl border shadow-sm">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-500" /> 기본 정보
                    </h2>

                    <div className="space-y-2">
                        <Label>캠핑장 이름</Label>
                        <Input
                            value={formData.camp_name}
                            onChange={e => setFormData({ ...formData, camp_name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>대표 주소</Label>
                        <Input
                            value={formData.address_main}
                            onChange={e => setFormData({ ...formData, address_main: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>상세 주소 (지번 등)</Label>
                        <Input
                            value={formData.address_detail}
                            onChange={e => setFormData({ ...formData, address_detail: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>대표 전화번호</Label>
                        <Input
                            value={formData.phone_number}
                            onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                        />
                    </div>
                </div>

                {/* Facilities & Guide */}
                <div className="space-y-6 bg-white p-6 rounded-xl border shadow-sm">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Upload className="w-5 h-5 text-gray-500" /> 시설 및 안내
                    </h2>

                    <div className="space-y-2">
                        <Label>시설 배치도 이미지</Label>
                        <div className="flex gap-4 items-start">
                            {formData.layout_image_url && (
                                <img
                                    src={formData.layout_image_url}
                                    alt="Layout"
                                    className="w-24 h-24 object-cover rounded-lg border"
                                />
                            )}
                            <div className="flex-1">
                                <Input type="file" accept="image/*" onChange={handleImageUpload} />
                                <p className="text-xs text-gray-500 mt-1">
                                    배치도 칩 클릭 시 보여질 이미지입니다.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>오시는 길 안내도 (URL/외부링크)</Label>
                            <Input
                                value={formData.guide_map_url}
                                onChange={e => setFormData({ ...formData, guide_map_url: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>가격/이용 안내 (텍스트)</Label>
                        <Textarea
                            rows={8}
                            value={formData.pricing_guide_text}
                            onChange={e => setFormData({ ...formData, pricing_guide_text: e.target.value })}
                            placeholder="이용 요금 및 관련 안내 사항을 입력하세요."
                        />
                    </div>
                </div>
            </div>

            {/* 2. Home Screen Chips Configuration (6 Items) */}
            <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-[#1C4526]">홈 화면 칩 설정 (6개 고정)</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Chip 1: Wayfinding */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3">
                        <Label className="font-bold text-gray-700">1. 길찾기 (주소)</Label>
                        <div className="space-y-2">
                            <Label className="text-xs">메인 주소</Label>
                            <Input
                                value={formData.address_main}
                                onChange={e => setFormData({ ...formData, address_main: e.target.value })}
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">상세 주소 (선택)</Label>
                            <Input
                                value={formData.address_detail}
                                onChange={e => setFormData({ ...formData, address_detail: e.target.value })}
                                className="bg-white"
                            />
                        </div>
                    </div>

                    {/* Chip 2: Contact */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3">
                        <Label className="font-bold text-gray-700">2. 문의 (연락처)</Label>
                        <div className="space-y-2">
                            <Label className="text-xs">대표 전화번호</Label>
                            <Input
                                value={formData.phone_number}
                                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                className="bg-white"
                            />
                        </div>
                    </div>

                    {/* Chip 3: Rules */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3 md:col-span-2">
                        <Label className="font-bold text-gray-700">3. 이용수칙</Label>
                        <div className="space-y-2">
                            <Label className="text-xs">이용 수칙 상세 내용 (줄바꿈 지원)</Label>
                            <Textarea
                                value={formData.rules_guide_text}
                                onChange={e => setFormData({ ...formData, rules_guide_text: e.target.value })}
                                className="bg-white h-24"
                                placeholder="예: 매너타임은 22시부터 08시까지입니다..."
                            />
                        </div>
                    </div>

                    {/* Chip 4: Facilities (Map) */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3 md:col-span-2">
                        <Label className="font-bold text-gray-700">4. 시설현황 (배치도)</Label>
                        <div className="space-y-2">
                            <Label className="text-xs">배치도 이미지 업로드</Label>
                            <div className="flex gap-4 items-start">
                                {formData.layout_image_url && (
                                    <img src={formData.layout_image_url} alt="Layout" className="w-24 h-24 object-cover rounded border bg-white" />
                                )}
                                <Input type="file" onChange={handleImageUpload} className="bg-white flex-1" />
                            </div>
                        </div>
                    </div>

                    {/* Chip 5: Nearby Places */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3 md:col-span-2">
                        <div className="flex justify-between items-center">
                            <Label className="font-bold text-gray-700">5. 주변 명소</Label>
                            <Button variant="outline" size="sm" onClick={handleAddPlace}>+ 장소 추가</Button>
                        </div>
                        <div className="space-y-2">
                            {nearbyPlaces.map((place, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <Input
                                        placeholder="장소명"
                                        value={place.title}
                                        onChange={e => handlePlaceChange(idx, 'title', e.target.value)}
                                        className="bg-white w-1/3"
                                    />
                                    <Input
                                        placeholder="설명 (거리 등)"
                                        value={place.desc}
                                        onChange={e => handlePlaceChange(idx, 'desc', e.target.value)}
                                        className="bg-white flex-1"
                                    />
                                    <button onClick={() => handleRemovePlace(idx)} className="text-red-500 p-2"><X className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chip 6: Price Guide */}
                    <div className="border p-4 rounded-lg bg-gray-50 space-y-3 md:col-span-2">
                        <Label className="font-bold text-gray-700">6. 가격 안내</Label>
                        <div className="space-y-2">
                            <Label className="text-xs">가격 정보 (텍스트)</Label>
                            <Textarea
                                value={formData.pricing_guide_text}
                                onChange={e => setFormData({ ...formData, pricing_guide_text: e.target.value })}
                                className="bg-white h-24"
                                placeholder="예: 평일 50,000원 / 주말 70,000원..."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
