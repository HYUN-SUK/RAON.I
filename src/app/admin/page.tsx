'use client';

import { useReservationStore } from '@/store/useReservationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, AlertCircle, ShoppingCart, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

import OverdueReservations from '@/components/admin/OverdueReservations';

export default function AdminDashboard() {
    const { reservations } = useReservationStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    if (!mounted) return <div className="p-4">Loading...</div>;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const pendingCount = reservations.filter(r => r.status === 'PENDING').length;
    const todayCheckIns = reservations.filter(r => new Date(r.checkInDate).toISOString().split('T')[0] === todayStr).length;

    // Mock data for now
    const marketOrders = 0;
    const serverStatus = 'Normal';

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">대시보드</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <DashboardCard
                    title="오늘 입실"
                    value={todayCheckIns.toString()}
                    icon={<CalendarCheck className="text-blue-500" />}
                    description="오늘 체크인 예정"
                />
                <Link href="/admin/reservations?status=PENDING" className="block transition-transform hover:scale-105">
                    <DashboardCard
                        title="입금 대기"
                        value={pendingCount.toString()}
                        icon={<AlertCircle className="text-yellow-500" />}
                        description="확인 필요 건수"
                        highlight={pendingCount > 0}
                    />
                </Link>
                <DashboardCard
                    title="마켓 주문"
                    value={marketOrders.toString()}
                    icon={<ShoppingCart className="text-green-500" />}
                    description="배송 준비 중"
                />
                <DashboardCard
                    title="서버 상태"
                    value={serverStatus}
                    icon={<Server className="text-gray-500" />}
                    description="DB 연결 정상"
                />
            </div>

            <OverdueReservations />

            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold mb-4">최근 활동 로그</h3>
                <div className="text-gray-500 text-sm">
                    <p>아직 기록된 활동이 없습니다.</p>
                </div>
            </div>
        </div>
    );
}

function DashboardCard({ title, value, icon, description, highlight }: { title: string, value: string, icon: React.ReactNode, description: string, highlight?: boolean }) {
    return (
        <Card className={`${highlight ? 'border-yellow-400 bg-yellow-50' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}
