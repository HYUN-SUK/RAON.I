'use client';

import { useEffect } from 'react';

import { useReservationStore } from '@/store/useReservationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function OverdueReservations() {
    const { getOverdueReservations, cancelOverdueReservations, deadlineHours, setDeadlineHours } = useReservationStore();

    // Use store logic for consistency
    const { overdue, warning } = getOverdueReservations();

    // Auto-cancel on mount (SSOT 6.3: Automatic Cancellation)
    useEffect(() => {
        if (overdue.length > 0) {
            cancelOverdueReservations();
            // In a real app, use a Toast component here
            alert(`${overdue.length}건의 기한 만료 예약이 자동 취소되었습니다.`);
        }
    }, [overdue.length, cancelOverdueReservations]);

    const handleCancelAll = () => {
        if (confirm(`기한 만료된 ${overdue.length}건의 예약을 취소하시겠습니까?`)) {
            cancelOverdueReservations();
        }
    };

    if (overdue.length === 0 && warning.length === 0) return null;

    return (
        <div className="space-y-4 mt-6">
            {/* Config Panel */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <span className="text-sm font-medium text-gray-700">입금 마감 설정:</span>
                {[3, 6, 9, 12].map(h => (
                    <button
                        key={h}
                        onClick={() => setDeadlineHours(h)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${deadlineHours === h
                            ? 'bg-[#2F5233] text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        {h}시간
                    </button>
                ))}
            </div>

            {/* Warning Card (Grace Period) */}
            {warning.length > 0 && (
                <Card className="border-orange-200 bg-orange-50 animate-pulse">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            <CardTitle className="text-lg font-bold text-orange-700">
                                입금 마감 경과 / 유예 중 ({warning.length}건)
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {warning.map((res) => (
                                <div key={res.id} className="flex justify-between items-center p-3 bg-white rounded-md border border-orange-100 shadow-sm">
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            {res.siteId} / {new Date(res.checkInDate).toLocaleDateString()}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            예약: {new Date(res.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-orange-600 font-medium text-sm">
                                        유예 중 (자동 취소 대기)
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Overdue Card (Action Required) */}
            {overdue.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <CardTitle className="text-lg font-bold text-red-700">
                                취소 대상 ({overdue.length}건)
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
                            {overdue.map((res) => (
                                <div key={res.id} className="flex justify-between items-center p-3 bg-white rounded-md border border-red-100 shadow-sm">
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            {res.siteId} / {new Date(res.checkInDate).toLocaleDateString()}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            예약: {new Date(res.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-red-600 font-medium">
                                        취소 필요
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
