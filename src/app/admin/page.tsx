'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    CalendarCheck, AlertCircle, ShoppingCart, Server, Users, Activity, Bell, MapPin, 
    Compass, Camera, MessageSquare, Flag, Utensils, Gamepad2, Calendar as CalendarIcon,
    RefreshCw, CheckCircle2, UserX
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import OverdueReservations from '@/components/admin/OverdueReservations';
import { getAdminAnalyticsAction, AdminAnalyticsData } from '@/actions/admin-analytics';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';

type PeriodType = 'today' | '7days' | '30days' | 'month' | 'all' | 'custom';

export default function AdminDashboard() {
    const supabase = createClient();
    
    // Core Operational Stats
    const [opsStats, setOpsStats] = useState({
        todayCheckIns: 0,
        pendingCount: 0,
        marketOrders: 0
    });

    // Date Filter State
    const [period, setPeriod] = useState<PeriodType>('30days');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');

    // Analytics Data State
    const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    // Initial Date Setup & Load
    useEffect(() => {
        handlePeriodChange('30days');
        fetchOpsStats();
    }, []);

    const fetchOpsStats = async () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];

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

            setOpsStats({
                todayCheckIns: todayCheckIns || 0,
                pendingCount: pendingCount || 0,
                marketOrders: marketOrders || 0
            });
        } catch (err) {
            console.error('Ops stats error:', err);
        }
    };

    const loadAnalytics = async (sDate: string, eDate: string) => {
        setLoading(true);
        try {
            const res = await getAdminAnalyticsAction(sDate, eDate);
            if (res.success && res.data) {
                setAnalytics(res.data);
            }
        } catch (err) {
            console.error('Analytics load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePeriodChange = (selectedPeriod: PeriodType) => {
        setPeriod(selectedPeriod);
        const now = new Date();
        let start = new Date();
        let end = now;

        if (selectedPeriod === 'today') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        } else if (selectedPeriod === '7days') {
            start = subDays(now, 7);
        } else if (selectedPeriod === '30days') {
            start = subDays(now, 30);
        } else if (selectedPeriod === 'month') {
            start = startOfMonth(now);
            end = endOfMonth(now);
        } else if (selectedPeriod === 'all') {
            start = new Date(2025, 0, 1);
        } else if (selectedPeriod === 'custom') {
            if (customStart && customEnd) {
                start = new Date(customStart);
                end = new Date(customEnd);
            }
        }

        const sISO = start.toISOString();
        const eISO = end.toISOString();
        setStartDate(sISO);
        setEndDate(eISO);

        loadAnalytics(sISO, eISO);
    };

    const handleCustomApply = () => {
        if (!customStart || !customEnd) return;
        handlePeriodChange('custom');
    };

    const getIconComponent = (key: string) => {
        switch (key) {
            case 'Map': return <MapPin className="w-5 h-5 text-[#224732]" />;
            case 'Compass': return <Compass className="w-5 h-5 text-blue-600" />;
            case 'Camera': return <Camera className="w-5 h-5 text-rose-500" />;
            case 'MessageSquare': return <MessageSquare className="w-5 h-5 text-amber-500" />;
            case 'Flag': return <Flag className="w-5 h-5 text-emerald-600" />;
            case 'Utensils': return <Utensils className="w-5 h-5 text-orange-500" />;
            case 'Gamepad2': return <Gamepad2 className="w-5 h-5 text-purple-600" />;
            default: return <Activity className="w-5 h-5 text-gray-500" />;
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">라온아이 대시보드</h2>
                    <p className="text-xs text-gray-500 mt-1">캠핑장 운영 및 사용자 기능 활용 현황 분석</p>
                </div>
                <button
                    onClick={() => {
                        fetchOpsStats();
                        loadAnalytics(startDate, endDate);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm self-start sm:self-auto"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    새로고침
                </button>
            </div>

            {/* Quick Operations Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <DashboardCard
                    title="오늘 입실"
                    value={opsStats.todayCheckIns.toString()}
                    icon={<CalendarCheck className="text-blue-500" />}
                    description="오늘 체크인 예정"
                />
                <Link href="/admin/reservations?status=PENDING" className="block transition-transform hover:scale-105">
                    <DashboardCard
                        title="입금 대기"
                        value={opsStats.pendingCount.toString()}
                        icon={<AlertCircle className="text-yellow-500" />}
                        description="확인 필요 건수"
                        highlight={opsStats.pendingCount > 0}
                    />
                </Link>
                <DashboardCard
                    title="마켓 주문"
                    value={opsStats.marketOrders.toString()}
                    icon={<ShoppingCart className="text-green-500" />}
                    description="배송 준비 중"
                />
                <DashboardCard
                    title="서버 상태"
                    value="Normal"
                    icon={<Server className="text-gray-500" />}
                    description="DB 연결 정상"
                />
            </div>

            {/* Date Range Selector Section */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-[#224732]" />
                        <h3 className="font-bold text-gray-800 text-sm sm:text-base">기간별 데이터 조회 필터</h3>
                    </div>
                    <div className="text-xs text-gray-500 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 self-start sm:self-auto">
                        조회 범위: <span className="font-bold text-[#224732]">
                            {startDate ? format(new Date(startDate), 'yyyy.MM.dd', { locale: ko }) : ''} ~ {endDate ? format(new Date(endDate), 'yyyy.MM.dd', { locale: ko }) : ''}
                        </span>
                    </div>
                </div>

                {/* Period Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    {[
                        { id: 'today', label: '오늘' },
                        { id: '7days', label: '최근 7일' },
                        { id: '30days', label: '최근 30일' },
                        { id: 'month', label: '이번 달' },
                        { id: 'all', label: '전체 (누적)' },
                        { id: 'custom', label: '직접 지정' }
                    ].map((btn) => (
                        <button
                            key={btn.id}
                            onClick={() => handlePeriodChange(btn.id as PeriodType)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                period === btn.id
                                    ? 'bg-[#224732] text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Custom Date Inputs if 'custom' is selected */}
                {period === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 animate-in fade-in">
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="text-xs p-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#224732]"
                        />
                        <span className="text-xs text-gray-400">~</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="text-xs p-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#224732]"
                        />
                        <button
                            onClick={handleCustomApply}
                            className="px-3 py-2 bg-[#224732] text-white text-xs font-bold rounded-lg hover:bg-[#1a3626]"
                        >
                            조회 적용
                        </button>
                    </div>
                )}
            </div>

            {/* Header User Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Registered Users (총 가입 유저 수) */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-700">총 가입 유저 수</span>
                        <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="text-2xl font-black text-indigo-950">
                        {loading ? '-' : `${analytics?.totalUsers.toLocaleString()} 명`}
                    </div>
                    <p className="text-[11px] text-indigo-600/80 mt-1 font-medium">
                        라온아이 전체 회원 수
                    </p>
                </div>

                {/* 2. Active Users in Period (선택 기간 접속 유저) */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-700">선택 기간 접속 유저</span>
                        <Activity className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-emerald-950">
                        {loading ? '-' : `${analytics?.periodActiveUsers.toLocaleString()} 명`}
                    </div>
                    <p className="text-[11px] text-emerald-600/80 mt-1 font-medium">
                        전체의 {analytics && analytics.totalUsers > 0 ? Math.round((analytics.periodActiveUsers / analytics.totalUsers) * 100) : 0}% 활동 중
                    </p>
                </div>

                {/* 3. Inactive Users (기능 미활용 유저) */}
                <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 p-5 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-rose-700">기능 미활용 유저</span>
                        <UserX className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="text-2xl font-black text-rose-950">
                        {loading ? '-' : `${analytics?.inactiveUsers.toLocaleString()} 명`}
                    </div>
                    <p className="text-[11px] text-rose-600/80 mt-1 font-medium">
                        기간 중 7대 기능 이용 0회
                    </p>
                </div>

                {/* 4. Both Consents (100% 알림 도달 가능자) */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-800">🔔 100% 알림 도달 가능자</span>
                        <Bell className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="text-2xl font-black text-amber-950">
                        {loading ? '-' : `${analytics?.bothConsents.toLocaleString()} 명`}
                    </div>
                    <p className="text-[11px] text-amber-700/80 mt-1 font-medium">
                        위치 + 푸시 동의 완료 ({analytics && analytics.totalUsers > 0 ? Math.round((analytics.bothConsents / analytics.totalUsers) * 100) : 0}%)
                    </p>
                </div>
            </div>

            {/* Feature Engagement Grid Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span>🎮 라온아이 7대 대표 기능 기간별 활용 현황판</span>
                    </h3>
                    <span className="text-xs text-gray-400">선택 기간 데이터 실시간 반영</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analytics?.features && Object.values(analytics.features).map((feat, idx) => (
                        <div
                            key={idx}
                            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-[#224732]/30 transition-all flex flex-col justify-between space-y-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100">
                                        {getIconComponent(feat.iconKey)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm">{feat.name}</h4>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{feat.description}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 bg-stone-50/70 p-3 rounded-xl border border-stone-100 text-center">
                                <div>
                                    <span className="text-[10px] font-semibold text-stone-500 block">이용 캠퍼 수</span>
                                    <span className="text-base font-black text-[#224732]">
                                        {loading ? '-' : `${feat.usersCount.toLocaleString()} 명`}
                                    </span>
                                </div>
                                <div className="border-l border-stone-200">
                                    <span className="text-[10px] font-semibold text-stone-500 block">누적 사용/생성</span>
                                    <span className="text-base font-black text-indigo-900">
                                        {loading ? '-' : `${feat.totalCount.toLocaleString()} 회`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Overdue Reservations Section */}
            <OverdueReservations />
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
