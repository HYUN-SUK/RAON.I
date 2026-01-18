'use client';

import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { XCircle, Loader2 } from 'lucide-react';
import { useReservationStore } from '@/store/useReservationStore';
import { toast } from 'sonner';

interface CancelReservationDialogProps {
    reservationId: string;
    trigger?: React.ReactNode;
}

export default function CancelReservationDialog({ reservationId, trigger }: CancelReservationDialogProps) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const { updateReservationStatus } = useReservationStore();

    const predefinedReasons = [
        '기상 악화로 인한 운영 중단',
        '시설 보수 및 안전 점검',
        '예약 정보 불일치',
        '입금 기한 만료',
        '중복 예약 발생',
        '고객 요청에 의한 취소'
    ];

    const handleCancel = async () => {
        if (!reason.trim()) {
            toast.error('취소 사유를 입력해주세요.');
            return;
        }

        try {
            setLoading(true);
            // Call store action with reason
            await updateReservationStatus(reservationId, 'CANCELLED', reason);
            toast.success('예약이 취소되었습니다.');
            setOpen(false);
        } catch (error) {
            console.error('Cancel failed:', error);
            toast.error('취소 처리에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <XCircle className="w-4 h-4 mr-1" />
                        취소
                    </Button>
                )}
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle>예약 취소 (관리자)</AlertDialogTitle>
                    <AlertDialogDescription>
                        이 예약을 강제로 취소합니다. 취소 사유는 사용자에게 알림으로 전송됩니다.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex flex-wrap gap-2">
                        {predefinedReasons.map((r) => (
                            <button
                                key={r}
                                onClick={() => setReason(r)}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${reason === r
                                        ? 'bg-red-50 border-red-200 text-red-700'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    <Textarea
                        placeholder="취소 사유를 상세히 입력하세요..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="min-h-[100px]"
                    />
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>닫기</AlertDialogCancel>
                    <Button
                        onClick={handleCancel}
                        disabled={loading || !reason.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        취소 확정 및 알림 발송
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
