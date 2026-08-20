'use client';

import { useState } from 'react';
import {
    AlertDialog,
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
import { Label } from '@/components/ui/label';
import { XCircle, Loader2 } from 'lucide-react';
import { useReservationStore } from '@/store/useReservationStore';
import { toast } from 'sonner';

interface CancelReservationDialogProps {
    reservationId: string;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export default function CancelReservationDialog({ reservationId, trigger, onSuccess }: CancelReservationDialogProps) {
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
            toast.error('취소 사유를 직접 입력하거나 선택해주세요.');
            return;
        }

        try {
            setLoading(true);
            await updateReservationStatus(reservationId, 'CANCELLED', reason);
            toast.success('예약이 취소 처리되었습니다.');
            setOpen(false);
            setReason('');
            if (onSuccess) {
                onSuccess();
            }
        } catch (error: any) {
            console.error('Cancel failed:', error);
            toast.error(error?.message || '취소 처리에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                        <XCircle className="w-4 h-4 mr-1" />
                        예약 취소
                    </Button>
                )}
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md bg-white">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg font-bold text-red-600 flex items-center gap-1.5">
                        <XCircle className="w-5 h-5" /> 예약 취소 (관리자)
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs text-gray-500">
                        이 예약을 즉시 취소합니다. 입력하신 취소 사유는 고객에게 알림으로 전송되며, 해당 날짜의 사이트 잠금이 즉시 해제됩니다.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-3 py-2">
                    <div>
                        <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">자주 쓰는 사유 선택 (클릭 시 자동 입력)</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {predefinedReasons.map((r) => (
                                <button
                                    type="button"
                                    key={r}
                                    onClick={() => setReason(r)}
                                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                                        reason === r
                                            ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">취소 사유 직접 입력 / 수정</Label>
                        <Textarea
                            placeholder="취소 사유를 직접 입력하세요..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[90px] text-sm"
                        />
                    </div>
                </div>

                <AlertDialogFooter className="flex justify-end gap-2 pt-2 border-t">
                    <AlertDialogCancel disabled={loading} className="text-xs">닫기</AlertDialogCancel>
                    <Button
                        type="button"
                        onClick={handleCancel}
                        disabled={loading || !reason.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                    >
                        {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                        취소 확정 및 알림 발송
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
