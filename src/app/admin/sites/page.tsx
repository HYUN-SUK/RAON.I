'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Plus, Edit2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { insertSiteAdmin } from '@/actions/admin-sites';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Site = Database['public']['Tables']['sites']['Row'] & {
    weekday?: number | null;
    weekend?: number | null;
    peak_weekday?: number | null;
    peak_weekend?: number | null;
};

export default function AdminSitesPage() {
    const supabase = createClient();
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    
    // 새 사이트 추가 모달 관련 상태
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newSite, setNewSite] = useState({
        id: '',
        name: '',
        site_type: 'AUTO',
        capacity: 4,
        base_price: 40000,
        price: 70000,
        description: '',
        features: '',
        is_active: true,
        weekday: '',
        weekend: '',
        peak_weekday: '',
        peak_weekend: ''
    });

    const fetchSites = async () => {
        try {
            const { data, error } = await supabase
                .from('sites')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;
            if (data) {
                // air-1 ~ air-8 개별 기기들은 관리자 리스트에서 제외 (air-group 통합카드만 편집하도록 노출)
                const filtered = (data as Site[]).filter(s => !/^air-\d+$/.test(s.id));
                setSites(filtered);
            }
        } catch (error) {
            console.error(error);
            toast.error('사이트 리스트를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newSite.id.trim()) {
            toast.error('사이트 ID를 입력하세요.');
            return;
        }
        if (!newSite.name.trim()) {
            toast.error('사이트 이름을 입력하세요.');
            return;
        }

        // ID 중복 검증
        const idExists = sites.some(s => s.id.toLowerCase() === newSite.id.trim().toLowerCase());
        if (idExists) {
            toast.error('이미 존재하는 사이트 ID입니다.');
            return;
        }

        setSubmitting(true);
        try {
            const result = await insertSiteAdmin({
                id: newSite.id.trim(),
                name: newSite.name.trim(),
                type: newSite.site_type,
                max_occupancy: Number(newSite.capacity),
                base_price: Number(newSite.base_price),
                price: Number(newSite.price),
                description: newSite.description.trim() || null,
                features: newSite.features ? newSite.features.split(',').map(f => f.trim()).filter(f => f.length > 0) : [],
                is_active: newSite.is_active,
                weekday: newSite.weekday ? Number(newSite.weekday) : undefined,
                weekend: newSite.weekend ? Number(newSite.weekend) : undefined,
                peak_weekday: newSite.peak_weekday ? Number(newSite.peak_weekday) : undefined,
                peak_weekend: newSite.peak_weekend ? Number(newSite.peak_weekend) : undefined,
            });

            if (result.success) {
                toast.success('새 사이트가 성공적으로 추가되었습니다.');
                setIsAddOpen(false);
                // 폼 초기화
                setNewSite({
                    id: '',
                    name: '',
                    site_type: 'AUTO',
                    capacity: 4,
                    base_price: 40000,
                    price: 70000,
                    description: '',
                    features: '',
                    is_active: true,
                    weekday: '',
                    weekend: '',
                    peak_weekday: '',
                    peak_weekend: ''
                });
                fetchSites();
            } else {
                toast.error(result.error || '사이트 추가 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error(error);
            toast.error('사이트 추가 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-850">사이트 관리</h1>
                    <p className="text-stone-500 text-sm">사이트별 이미지, 소개글, 세부 정보를 관리합니다.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="bg-[#1C4526] hover:bg-[#15341d]">
                    <Plus className="w-4 h-4 mr-2" /> 새 사이트 추가
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sites.map((site) => (
                    <div key={site.id} className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="relative h-48 bg-gray-100">
                            {site.image_url ? (
                                <Image
                                    src={site.image_url}
                                    alt={site.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-stone-400">
                                    이미지 없음
                                </div>
                            )}
                            <div className="absolute top-2 right-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${site.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {site.is_active ? '운영중' : '운영중단'}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{site.name}</h3>
                                    <p className="text-sm text-stone-500 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {site.id}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">{(site.price ?? site.base_price).toLocaleString()}원</p>
                                    <p className="text-xs text-stone-500">기준 {site.base_price.toLocaleString()}원</p>
                                </div>
                            </div>

                            <p className="text-sm text-stone-600 line-clamp-2 min-h-[40px]">
                                {site.description || '소개글이 없습니다.'}
                            </p>

                            <div className="pt-2">
                                <Link href={`/admin/sites/${site.id}`}>
                                    <Button variant="outline" className="w-full">
                                        <Edit2 className="w-4 h-4 mr-2" /> 수정하기
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}

                {sites.length === 0 && (
                    <div className="col-span-full text-center py-12 text-stone-500">
                        등록된 사이트가 없습니다. (Migration이 실행되었나요?)
                    </div>
                )}
            </div>

            {/* 새 사이트 추가 모달 */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">새 사이트 추가</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="site-id">사이트 고유 ID <span className="text-red-500">*</span></Label>
                                <Input
                                    id="site-id"
                                    placeholder="예: site-9, air-9"
                                    value={newSite.id}
                                    onChange={e => setNewSite({ ...newSite, id: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site-name">사이트 이름 <span className="text-red-500">*</span></Label>
                                <Input
                                    id="site-name"
                                    placeholder="예: 철수네 9번, 에어컨 9번"
                                    value={newSite.name}
                                    onChange={e => setNewSite({ ...newSite, name: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="site-type">사이트 타입</Label>
                                <Select
                                    value={newSite.site_type}
                                    onValueChange={val => setNewSite({ ...newSite, site_type: val })}
                                >
                                    <SelectTrigger id="site-type">
                                        <SelectValue placeholder="타입 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TENT">TENT (텐트 데크)</SelectItem>
                                        <SelectItem value="GLAMPING">GLAMPING (글램핑)</SelectItem>
                                        <SelectItem value="CARAVAN">CARAVAN (카라반)</SelectItem>
                                        <SelectItem value="AUTO">AUTO (오토캠핑)</SelectItem>
                                        <SelectItem value="AIR_CON">AIR_CON (에어컨 대여)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site-capacity">최대 수용 인원</Label>
                                <Input
                                    id="site-capacity"
                                    type="number"
                                    min={1}
                                    value={newSite.capacity}
                                    onChange={e => setNewSite({ ...newSite, capacity: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="site-base-price">레거시 평일 기본가</Label>
                                <Input
                                    id="site-base-price"
                                    type="number"
                                    value={newSite.base_price}
                                    onChange={e => setNewSite({ ...newSite, base_price: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site-price">레거시 주말 기본가</Label>
                                <Input
                                    id="site-price"
                                    type="number"
                                    value={newSite.price}
                                    onChange={e => setNewSite({ ...newSite, price: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        {/* 신규 4대 정밀 요금제 (선택 입력) */}
                        <div className="space-y-2 pt-2 border-t">
                            <Label className="font-bold text-stone-800">개별 가격 커스텀 설정 (미입력 시 전역 가격 설정이 자동 연동됩니다)</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="c-weekday" className="text-xs">평일 요금</Label>
                                    <Input
                                        id="c-weekday"
                                        type="number"
                                        placeholder="일괄 자동"
                                        value={newSite.weekday}
                                        onChange={e => setNewSite({ ...newSite, weekday: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="c-weekend" className="text-xs">주말 요금</Label>
                                    <Input
                                        id="c-weekend"
                                        type="number"
                                        placeholder="일괄 자동"
                                        value={newSite.weekend}
                                        onChange={e => setNewSite({ ...newSite, weekend: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="c-peak-weekday" className="text-xs">성수기 평일</Label>
                                    <Input
                                        id="c-peak-weekday"
                                        type="number"
                                        placeholder="일괄 자동"
                                        value={newSite.peak_weekday}
                                        onChange={e => setNewSite({ ...newSite, peak_weekday: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="c-peak-weekend" className="text-xs">성수기 주말</Label>
                                    <Input
                                        id="c-peak-weekend"
                                        type="number"
                                        placeholder="일괄 자동"
                                        value={newSite.peak_weekend}
                                        onChange={e => setNewSite({ ...newSite, peak_weekend: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                            <Label htmlFor="site-description">사이트 소개글</Label>
                            <Textarea
                                id="site-description"
                                placeholder="사이트에 대한 상세 소개글을 입력하세요."
                                value={newSite.description}
                                onChange={e => setNewSite({ ...newSite, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="site-features">특징 (콤마 , 로 구분)</Label>
                            <Input
                                id="site-features"
                                placeholder="예: 파쇄석, 전기 가능, 온수 완비"
                                value={newSite.features}
                                onChange={e => setNewSite({ ...newSite, features: e.target.value })}
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border">
                            <Label htmlFor="site-active" className="cursor-pointer">즉시 운영 개시 (노출 여부)</Label>
                            <Switch
                                id="site-active"
                                checked={newSite.is_active}
                                onCheckedChange={checked => setNewSite({ ...newSite, is_active: checked })}
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={submitting}>
                                취소
                            </Button>
                            <Button type="submit" className="bg-[#1C4526] hover:bg-[#15341d]" disabled={submitting}>
                                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                사이트 생성
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
