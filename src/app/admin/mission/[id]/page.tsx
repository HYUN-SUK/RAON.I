'use client';

import { adminMissionService, AdminMissionInput } from '@/services/adminMissionService';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Trash2, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function EditMissionPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<AdminMissionInput>({
        title: '',
        description: '',
        mission_type: 'PHOTO',
        start_date: '',
        end_date: '',
        reward_xp: 100,
        reward_point: 50,
        is_active: true
    });

    useEffect(() => {
        if (id) {
            loadMission(id);
        }
    }, [id]);

    const loadMission = async (missionId: string) => {
        try {
            const data = await adminMissionService.getMissionById(missionId);
            setFormData({
                title: data.title,
                description: data.description || '',
                mission_type: data.mission_type,
                // Convert DB timestamp to input datetime-local format (YYYY-MM-DDTHH:mm)
                start_date: data.start_date ? new Date(data.start_date).toISOString().slice(0, 16) : '',
                end_date: data.end_date ? new Date(data.end_date).toISOString().slice(0, 16) : '',
                reward_xp: data.reward_xp,
                reward_point: data.reward_point,
                is_active: data.is_active
            });
        } catch (error) {
            console.error(error);
            alert('미션 정보를 불러오지 못했습니다.');
            router.push('/admin/mission');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'number') {
            setFormData(prev => ({ ...prev, [name]: Number(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSelectChange = (value: string) => {
        setFormData(prev => ({ ...prev, mission_type: value as any }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Validation
            if (!formData.title || !formData.start_date || !formData.end_date) {
                alert('필수 항목을 입력해주세요.');
                return;
            }

            // ISO String conversion
            const payload = {
                ...formData,
                start_date: new Date(formData.start_date).toISOString(),
                end_date: new Date(formData.end_date).toISOString()
            };

            await adminMissionService.updateMission(id, payload);
            alert('미션이 수정되었습니다.');
            router.push('/admin/mission');
        } catch (error) {
            console.error(error);
            alert('미션 수정 실패');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            await adminMissionService.deleteMission(id);
            alert('삭제되었습니다.');
            router.push('/admin/mission');
        } catch (error) {
            alert('삭제 실패');
        }
    };

    if (isLoading) return <div className="p-8 text-center">로딩 중...</div>;

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/mission">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h2 className="text-2xl font-bold text-gray-800">미션 수정</h2>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={async () => {
                        if (!confirm('현재 미션의 랭킹을 정산하시겠습니까? (상위 3명 선정)')) return;
                        try {
                            const result = await adminMissionService.processRanking(id);
                            console.log(result);
                            alert('랭킹 정산이 완료되었습니다!\n상위 3명에게 보상이 지급되었습니다.');
                        } catch (e) {
                            console.error(e);
                            alert('정산 중 오류가 발생했습니다.');
                        }
                    }} className="flex gap-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                        <Trophy size={16} />
                        랭킹 정산
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} className="flex gap-2">
                        <Trash2 size={16} />
                        삭제
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>미션 정보 수정</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">미션 제목</Label>
                            <Input
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">설명</Label>
                            <Textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={4}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>미션 타입</Label>
                                <Select onValueChange={handleSelectChange} value={formData.mission_type}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="타입 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PHOTO">사진 인증 (Photo)</SelectItem>
                                        <SelectItem value="CHECKIN">체크인 (Check-in)</SelectItem>
                                        <SelectItem value="COMMUNITY">커뮤니티 활동</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>상태</Label>
                                <div className="flex items-center h-10 gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        name="is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                                        className="w-5 h-5 accent-green-600"
                                    />
                                    <Label htmlFor="is_active" className="cursor-pointer">활성화 (공개)</Label>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start_date">시작일</Label>
                                <Input
                                    id="start_date"
                                    name="start_date"
                                    type="datetime-local"
                                    value={formData.start_date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end_date">종료일</Label>
                                <Input
                                    id="end_date"
                                    name="end_date"
                                    type="datetime-local"
                                    value={formData.end_date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="reward_xp">보상 XP</Label>
                                <Input
                                    id="reward_xp"
                                    name="reward_xp"
                                    type="number"
                                    value={formData.reward_xp}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reward_point">보상 포인트</Label>
                                <Input
                                    id="reward_point"
                                    name="reward_point"
                                    type="number"
                                    value={formData.reward_point}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" className="bg-green-700 hover:bg-green-800 w-full md:w-auto" disabled={isSubmitting}>
                                <Save className="w-4 h-4 mr-2" />
                                {isSubmitting ? '수정사항 저장' : '수정사항 저장'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
