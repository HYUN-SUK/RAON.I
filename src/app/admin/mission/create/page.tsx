'use client';

import { adminMissionService, AdminMissionInput } from '@/services/adminMissionService';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CreateMissionPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [missionType, setMissionType] = useState<'PHOTO' | 'CHECKIN' | 'COMMUNITY'>('PHOTO');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const formData = new FormData(e.currentTarget);

            const title = formData.get('title') as string;
            const description = formData.get('description') as string;
            const startDateStr = formData.get('start_date') as string;
            const endDateStr = formData.get('end_date') as string;
            const rewardXp = formData.get('reward_xp') as string;
            const rewardPoint = formData.get('reward_point') as string;
            const isActive = formData.get('is_active') === 'on';

            if (!title || !startDateStr || !endDateStr) {
                alert('필수 항목을 입력해주세요.');
                setIsSubmitting(false);
                return;
            }

            // Explicit New Date construction
            const start = new Date(startDateStr);
            const end = new Date(endDateStr);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                alert('날짜 형식이 올바르지 않습니다.');
                setIsSubmitting(false);
                return;
            }

            const payload: AdminMissionInput = {
                title,
                description,
                mission_type: missionType,
                start_date: start.toISOString(),
                end_date: end.toISOString(),
                reward_xp: Number(rewardXp) || 0,
                reward_point: Number(rewardPoint) || 0,
                is_active: isActive
            };

            await adminMissionService.createMission(payload);
            alert('미션이 생성되었습니다.');
            router.push('/admin/mission');
        } catch (error: unknown) {
            console.error('Submission error:', error);
            const message = error instanceof Error ? error.message : '알 수 없는 오류';
            alert(`미션 생성 실패: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/admin/mission">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <h2 className="text-2xl font-bold text-gray-800">새 미션 만들기</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>미션 정보 입력</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">미션 제목</Label>
                            <Input
                                id="title"
                                name="title"
                                placeholder="예: 분리수거 인증하기"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">설명</Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="미션에 대한 자세한 설명을 적어주세요."
                                rows={4}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>미션 타입</Label>
                                <Select value={missionType} onValueChange={(v: 'PHOTO' | 'CHECKIN' | 'COMMUNITY') => setMissionType(v)}>
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
                                        defaultChecked={true}
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
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end_date">종료일</Label>
                                <Input
                                    id="end_date"
                                    name="end_date"
                                    type="datetime-local"
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
                                    defaultValue="100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reward_point">보상 포인트</Label>
                                <Input
                                    id="reward_point"
                                    name="reward_point"
                                    type="number"
                                    defaultValue="50"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" className="bg-green-700 hover:bg-green-800 w-full md:w-auto" disabled={isSubmitting}>
                                <Save className="w-4 h-4 mr-2" />
                                {isSubmitting ? '저장 중...' : '미션 생성하기'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
