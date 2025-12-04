'use client';

import { useReservationStore } from '@/store/useReservationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function OverdueReservations() {
    const { reservations, cancelOverdueReservations } = useReservationStore();

    // Calculate overdue locally for reactivity
    const overdueList = reservations.filter((r) => {
        if (r.status !== 'PENDING') return false;
        // Handle legacy data where createdAt might be missing
        if (!r.createdAt) return false;

        const createdAt = new Date(r.createdAt);
        const now = new Date();
        const DEADLINE_MS = 24 * 60 * 60 * 1000; // 24 hours
        return now.getTime() - createdAt.getTime() > DEADLINE_MS;
    });

    const handleCancelAll = () => {
        if (confirm('모든 기한 만료 예약을 취소하시겠습니까?')) {
            cancelOverdueReservations();
        }
    };

    if (overdueList.length === 0) return null;

    return (
        <Card className="border-red-200 bg-red-50 mt-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <CardTitle className="text-lg font-bold text-red-700">
                        입금 기한 만료 ({overdueList.length}건)
                    </CardTitle>
                </div>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelAll}
                    className="flex items-center gap-2"
                >
                    <Trash2 className="h-4 w-4" />
                    일괄 취소
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {overdueList.map((res) => (
                        <div key={res.id} className="flex justify-between items-center p-3 bg-white rounded-md border border-red-100 shadow-sm">
                            <div>
                                <p className="font-semibold text-gray-800">
                                    {res.siteId} / {new Date(res.checkInDate).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-gray-500">
                                    예약시각: {new Date(res.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <div className="text-red-600 font-medium">
                                ₩{res.totalPrice.toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
