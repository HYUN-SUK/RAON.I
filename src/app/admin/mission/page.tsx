'use client';

import { adminMissionService, BulkMissionInput } from '@/services/adminMissionService';
import { Mission } from '@/types/mission';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Upload, Target, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function AdminMissionList() {
    // const router = useRouter(); // unused
    const [missions, setMissions] = useState<Mission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Bulk Import State
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkJson, setBulkJson] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);

    useEffect(() => {
        fetchMissions();
    }, []);

    const fetchMissions = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminMissionService.getAllMissions();
            setMissions(data);
        } catch (err) {
            setError('미션 목록을 불러오는데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 이 미션을 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) return;

        try {
            await adminMissionService.deleteMission(id);
            toast.success('미션이 삭제되었습니다.');
            fetchMissions();
        } catch (error) {
            console.error(error);
            toast.error('삭제 중 오류가 발생했습니다.');
        }
    };

    const handleBulkImport = async () => {
        if (!bulkJson.trim()) {
            toast.error('JSON 데이터를 입력해주세요.');
            return;
        }

        try {
            setBulkLoading(true);
            let parsed: BulkMissionInput[];
            try {
                parsed = JSON.parse(bulkJson);
                if (!Array.isArray(parsed)) throw new Error('데이터 형식이 배열이 아닙니다.');
            } catch (e) {
                toast.error('JSON 형식이 올바르지 않습니다.');
                return;
            }

            await adminMissionService.createBulkMissions(parsed);
            toast.success(`${parsed.length}개의 미션이 일괄 등록되었습니다!`);
            setIsBulkOpen(false);
            setBulkJson('');
            fetchMissions();
        } catch (error) {
            console.error(error);
            toast.error('일괄 등록 중 오류가 발생했습니다.');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleExport = () => {
        const exportData: BulkMissionInput[] = missions.map(m => ({
            title: m.title,
            description: m.description,
            mission_type: m.mission_type,
            start_date: m.start_date,
            end_date: m.end_date,
            reward_xp: m.reward_xp,
            reward_point: m.reward_point,
            is_active: m.is_active
        }));

        const jsonString = JSON.stringify(exportData, null, 2);
        navigator.clipboard.writeText(jsonString);
        toast.success(`${exportData.length}개의 미션 데이터가 클립보드에 복사되었습니다!`);
    };

    const getStatusColor = (status: boolean, start: string, end: string) => {
        if (!status) return 'bg-gray-400';
        const now = new Date();
        const s = new Date(start);
        const e = new Date(end);
        if (now < s) return 'bg-blue-500'; // Upcoming
        if (now >= s && now <= e) return 'bg-green-500'; // Active
        return 'bg-red-500'; // Ended
    };

    const getStatusText = (status: boolean, start: string, end: string) => {
        if (!status) return '비활성';
        const now = new Date();
        const s = new Date(start);
        const e = new Date(end);
        if (now < s) return '예정됨';
        if (now >= s && now <= e) return '진행중';
        return '종료됨';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Target className="w-6 h-6" />
                    미션 관리
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={handleExport}>
                        <Download className="w-4 h-4" />
                        내보내기
                    </Button>

                    <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Upload className="w-4 h-4" />
                                AI 일괄 등록
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>AI 미션 데이터 일괄 등록</DialogTitle>
                                <DialogDescription>
                                    &apos;MISSION_GENERATION_PROMPT.md&apos; 양식을 통해 생성된 JSON 코드를 아래에 붙여넣으세요.
                                    입력된 주차(week_offset)에 따라 날짜가 자동 계산되어 등록됩니다.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 py-4">
                                <Label htmlFor="json-input" className="sr-only">JSON 입력</Label>
                                <Textarea
                                    id="json-input"
                                    placeholder='[
  {
    "title": "예시 미션",
    "description": "설명...",
    "mission_type": "PHOTO",
    "week_offset": 0,
    "reward_xp": 100,
    "reward_point": 50
  }
]'
                                    className="h-full font-mono text-xs"
                                    value={bulkJson}
                                    onChange={(e) => setBulkJson(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsBulkOpen(false)}>취소</Button>
                                <Button onClick={handleBulkImport} disabled={bulkLoading}>
                                    {bulkLoading ? "등록 중..." : "일괄 등록하기"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Link href="/admin/mission/create">
                        <Button className="flex items-center gap-2 bg-green-700 hover:bg-green-800">
                            <Plus size={18} />
                            미션 등록
                        </Button>
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10">로딩 중...</div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>전체 미션 ({missions.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-gray-500">제목</th>
                                        <th className="px-4 py-3 font-medium text-gray-500">기간</th>
                                        <th className="px-4 py-3 font-medium text-gray-500">보상(XP/P)</th>
                                        <th className="px-4 py-3 font-medium text-gray-500">상태</th>
                                        <th className="px-4 py-3 font-medium text-gray-500 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {missions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-400">
                                                등록된 미션이 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        missions.map((mission) => (
                                            <tr key={mission.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                    {mission.title}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    <div className="flex flex-col text-xs">
                                                        <span>{mission.start_date.split('T')[0]}</span>
                                                        <span className="text-gray-400">~ {mission.end_date.split('T')[0]}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {mission.reward_xp} XP / {mission.reward_point} P
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge className={`${getStatusColor(mission.is_active, mission.start_date, mission.end_date)} text-white border-0`}>
                                                        {getStatusText(mission.is_active, mission.start_date, mission.end_date)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right space-x-2">
                                                    <Link href={`/admin/mission/${mission.id}`}>
                                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                                            <Pencil size={14} />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDelete(mission.id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
