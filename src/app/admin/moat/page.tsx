'use client';

import React, { useState, useEffect } from 'react';
import { getMoatMetrics, runMoatAutomatedLoop, type MoatMetricsData } from '@/actions/moat-operations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
    Navigation, 
    ArrowRightLeft, 
    CheckCircle2, 
    ShieldCheck, 
    AlertTriangle, 
    RotateCcw, 
    Zap, 
    Sparkles,
    Eye,
    TrendingUp,
    Store,
    Clock,
    Check
} from 'lucide-react';

export default function AdminMoatDashboardPage() {
    const [metrics, setMetrics] = useState<MoatMetricsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunningLoop, setIsRunningLoop] = useState(false);

    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        setIsLoading(true);
        const res = await getMoatMetrics();
        if (res.success && res.data) {
            setMetrics(res.data);
        } else {
            toast.error(res.error || '지표 데이터를 불러오지 못했습니다.');
        }
        setIsLoading(false);
    };

    const handleRunLoop = async () => {
        setIsRunningLoop(true);
        const res = await runMoatAutomatedLoop();
        if (res.success) {
            toast.success(res.message || '자동화 루프가 성공적으로 완료되었습니다!');
            loadMetrics();
        } else {
            toast.error(res.error || '루프 실행 중 오류가 발생했습니다.');
        }
        setIsRunningLoop(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            {/* 1. Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#224732] text-white p-6 rounded-3xl shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-[#1C3B29] text-emerald-200 border-none px-2.5 py-1 text-xs">
                            라온아이 데이터 해자 (Data Moat)
                        </Badge>
                        <span className="text-xs text-emerald-100 font-medium">실시간 수집 현황 & 피드백 엔진</span>
                    </div>
                    <h1 className="text-2xl font-bold mt-2">해자 데이터 자산 대시보드</h1>
                    <p className="text-sm text-emerald-100 mt-1">
                        어떤 대기업 지도앱도 갖지 못한 <strong>실제 캠퍼들의 현장 관측 사실과 행동 데이터</strong>가 실시간으로 축적됩니다.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        onClick={loadMetrics}
                        disabled={isLoading}
                        className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-xl"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> 새로고침
                    </Button>
                    <Button
                        onClick={handleRunLoop}
                        disabled={isRunningLoop}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        {isRunningLoop ? '루프 실행 중...' : '자동 폐업/구제 루프 실행'}
                    </Button>
                </div>
            </div>

            {/* 2. 6대 핵심 지표 카드 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* 1. 길안내 실행 */}
                <Card className="rounded-3xl border-stone-200 shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-stone-600">
                            1. 길안내 실행 로그
                        </CardTitle>
                        <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700">
                            <Navigation className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-3xl font-black text-stone-900">
                            {metrics ? metrics.navIntentCount.toLocaleString() : '-'} <span className="text-sm font-semibold text-stone-400">건</span>
                        </div>
                        <p className="text-xs text-stone-500">
                            내비 앱 실행 최강 방문 의도 신호 (0.7 가중치)
                        </p>
                    </CardContent>
                </Card>

                {/* 2. 장소 교체 / 대안 유지 */}
                <Card className="rounded-3xl border-stone-200 shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-stone-600">
                            2. 스마트플랜 거절/유지
                        </CardTitle>
                        <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-700">
                            <ArrowRightLeft className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-3xl font-black text-stone-900 flex items-baseline gap-2">
                            <span>{metrics ? metrics.planSwapCount.toLocaleString() : '-'}</span>
                            <span className="text-sm font-semibold text-stone-400">교체</span>
                            <span className="text-stone-300">/</span>
                            <span className="text-emerald-700">{metrics ? metrics.viewedNoSwapCount.toLocaleString() : '-'}</span>
                            <span className="text-sm font-semibold text-stone-400">유지</span>
                        </div>
                        <p className="text-xs text-stone-500">
                            대안 15개 열람 후 유지한 긍정 신호 분리 적재
                        </p>
                    </CardContent>
                </Card>

                {/* 3. 총 팩트 검증 */}
                <Card className="rounded-3xl border-stone-200 shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-stone-600">
                            3. 수집된 팩트 검증
                        </CardTitle>
                        <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-3xl font-black text-stone-900">
                            {metrics ? metrics.verificationCount.toLocaleString() : '-'} <span className="text-sm font-semibold text-stone-400">건</span>
                        </div>
                        <p className="text-xs text-stone-500">
                            방문/미방문 및 영업 현황 실측 검증 완료
                        </p>
                    </CardContent>
                </Card>

                {/* 4. 1.0 정답 셋 (Ground Truth) */}
                <Card className="rounded-3xl border-stone-200 shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-stone-600">
                            4. 1.0 정답 셋 (Ground Truth)
                        </CardTitle>
                        <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-3xl font-black text-amber-900">
                            {metrics ? metrics.groundTruthCount.toLocaleString() : '-'} <span className="text-sm font-semibold text-stone-400">건</span>
                        </div>
                        <p className="text-xs text-stone-500">
                            사업주 대면 검증 기반 최고 신뢰도 기준선 데이터
                        </p>
                    </CardContent>
                </Card>

                {/* 5. 자동 격리/폐업 장소 */}
                <Card className="rounded-3xl border-stone-200 shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-stone-600">
                            5. 폐업/격리 처리 장소
                        </CardTitle>
                        <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-700">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-3xl font-black text-rose-800">
                            {metrics ? metrics.deactivatedPlacesCount.toLocaleString() : '-'} <span className="text-sm font-semibold text-stone-400">곳</span>
                        </div>
                        <p className="text-xs text-stone-500">
                            2스트라이크 및 폐업 신고 누적으로 추천 배제됨
                        </p>
                    </CardContent>
                </Card>

                {/* 6. 공공 누락 ➔ 현장 생존 구제 */}
                <Card className="rounded-3xl border-stone-200 shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-stone-600">
                            6. 공공 누락 ➔ 현장 구제
                        </CardTitle>
                        <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-700">
                            <Sparkles className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-3xl font-black text-teal-800">
                            {metrics ? metrics.rescuedPlacesCount.toLocaleString() : '-'} <span className="text-sm font-semibold text-stone-400">곳</span>
                        </div>
                        <p className="text-xs text-stone-500">
                            공공데이터 오판을 현장 방문 신호로 바로잡음
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* 3. 최근 실시간 검증 피드 */}
            <Card className="rounded-3xl border-stone-200 shadow-xs overflow-hidden">
                <CardHeader className="border-b border-stone-100 bg-stone-50/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-bold text-stone-900">
                                최근 수집된 팩트 검증 피드
                            </CardTitle>
                            <CardDescription className="text-xs text-stone-500">
                                사용자와 사업주를 통해 실시간으로 들어오는 최신 검증 데이터 10건입니다.
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="text-xs font-semibold">
                            실시간 연동
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-12 text-center text-xs text-stone-400">피드 불러오는 중...</div>
                    ) : !metrics?.recentVerifications || metrics.recentVerifications.length === 0 ? (
                        <div className="p-12 text-center text-xs text-stone-400">수집된 검증 내역이 없습니다.</div>
                    ) : (
                        <div className="divide-y divide-stone-100">
                            {metrics.recentVerifications.map(item => (
                                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-stone-50/60 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-stone-100 text-stone-700">
                                            <Store className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-stone-900 flex items-center gap-2">
                                                <span>{item.placeName}</span>
                                                <Badge className={`text-[10px] px-1.5 py-0 border-none ${
                                                    item.source === 'OWNER_INTERVIEW' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                                                }`}>
                                                    {item.source === 'OWNER_INTERVIEW' ? '사업주 대면' : '캠퍼 참여'}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-stone-500 mt-0.5">
                                                관측 사실: <span className="font-semibold text-stone-700">{item.factStatus}</span> · {item.verifiedAt}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-stone-800">
                                                가중치 {item.reporterWeight.toFixed(1)}
                                            </div>
                                            <div className="text-[10px] text-stone-400">
                                                상태: {item.reviewState}
                                            </div>
                                        </div>
                                        {item.reviewState === 'APPLIED' ? (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-none text-[11px]">
                                                <Check className="w-3 h-3 mr-0.5" /> 반영됨
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-700 border-amber-300 text-[11px]">
                                                <Clock className="w-3 h-3 mr-0.5" /> 대기중
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
