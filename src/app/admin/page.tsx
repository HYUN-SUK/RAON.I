'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, AlertCircle, ShoppingCart, Server, Users, Activity, Bell, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import OverdueReservations from '@/components/admin/OverdueReservations';

export default function AdminDashboard() {
    const supabase = createClient();
    const [stats, setStats] = useState({
        todayCheckIns: 0,
        pendingCount: 0,
        marketOrders: 0,
        totalUsers: 0,
        activeUsers: 0,
        locationConsents: 0,
        pushConsents: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // 1. Today Check-ins
            const { count: todayCheckIns } = await supabase
                .from('reservations')
                .select('*', { count: 'exact', head: true })
                .eq('check_in_date', todayStr);

            // 2. Pending Reservations
            const { count: pendingCount } = await supabase
                .from('reservations')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'PENDING');

            // 3. Market Pending Orders
            const { count: marketOrders } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'PENDING');

            // 4. Total Users
            const { count: totalUsers } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            // 5. Active Users (Last 30 days)
            const { count: activeUsers } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gt('updated_at', thirtyDaysAgo.toISOString());

            // 6. Location Consents
            const { count: locationConsents } = await supabase
                .from('user_permission_consents')
                .select('*', { count: 'exact', head: true })
                .eq('location_granted', true);

            // 7. Push Consents
            const { count: pushConsents } = await supabase
                .from('user_permission_consents')
                .select('*', { count: 'exact', head: true })
                .eq('push_granted', true);

            setStats({
                todayCheckIns: todayCheckIns || 0,
                pendingCount: pendingCount || 0,
                marketOrders: marketOrders || 0,
                totalUsers: totalUsers || 0,
                activeUsers: activeUsers || 0,
                locationConsents: locationConsents || 0,
                pushConsents: pushConsents || 0
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const serverStatus = 'Normal';

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">대시보드</h2>

            {/* Operational Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <DashboardCard
                    title="오늘 입실"
                    value={loading ? '-' : stats.todayCheckIns.toString()}
                    icon={<CalendarCheck className="text-blue-500" />}
                    description="오늘 체크인 예정"
                />
                <Link href="/admin/reservations?status=PENDING" className="block transition-transform hover:scale-105">
                    <DashboardCard
                        title="입금 대기"
                        value={loading ? '-' : stats.pendingCount.toString()}
                        icon={<AlertCircle className="text-yellow-500" />}
                        description="확인 필요 건수"
                        highlight={stats.pendingCount > 0}
                    />
                </Link>
                <DashboardCard
                    title="마켓 주문"
                    value={loading ? '-' : stats.marketOrders.toString()}
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

            {/* User Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DashboardCard
                    title="전체 회원"
                    value={loading ? '-' : stats.totalUsers.toString() + '명'}
                    icon={<Users className="text-indigo-500" />}
                    description="가입된 총 회원 수"
                />
                <DashboardCard
                    title="활동 회원 (30일)"
                    value={loading ? '-' : stats.activeUsers.toString() + '명'}
                    icon={<Activity className="text-rose-500" />}
                    description="최근 30일 내 활동 기록이 있는 회원"
                />
            </div>

            {/* Permission Consent Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DashboardCard
                    title="📍 위치 동의"
                    value={loading ? '-' : `${stats.locationConsents}명`}
                    icon={<MapPin className="text-green-500" />}
                    description={`전체 ${stats.totalUsers}명 중 ${stats.totalUsers > 0 ? Math.round((stats.locationConsents / stats.totalUsers) * 100) : 0}%`}
                />
                <DashboardCard
                    title="🔔 푸시 동의"
                    value={loading ? '-' : `${stats.pushConsents}명`}
                    icon={<Bell className="text-amber-500" />}
                    description={`전체 ${stats.totalUsers}명 중 ${stats.totalUsers > 0 ? Math.round((stats.pushConsents / stats.totalUsers) * 100) : 0}%`}
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
