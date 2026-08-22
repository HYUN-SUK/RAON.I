'use client';

import React, { useState, useEffect } from 'react';
import { 
    getSchedulesForVerification, 
    getScheduleFactCards, 
    submitOwnerVerifications,
    type VerificationScheduleItem,
    type FactCardForVerification,
    type VerificationInputItem
} from '@/actions/admin-verification';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    Clock, 
    MapPin, 
    Check, 
    Search, 
    RotateCcw, 
    Sparkles, 
    HelpCircle,
    Store,
    Calendar,
    User,
    ChevronRight
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, string> = {
    'ROUTE_CAFE': '☕',
    'ROUTE_RESTAURANT': '🍲',
    'ROUTE_SPOT': '📸',
    'HOSPITAL': '🏥',
    'MART': '🛒',
    'GAS_STATION': '⛽',
    'RESTAURANT': '🍽️',
    'SPOT': '🏞️',
    'FESTIVAL': '🎪'
};

const FACT_STATUS_OPTIONS = [
    { value: 'OK', label: '정상 영업', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
    { value: 'TEMP_CLOSED', label: '문 닫음 (임시휴무)', icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
    { value: 'GONE', label: '간판 없음 / 폐업', icon: XCircle, color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
    { value: 'HOURS_WRONG', label: '영업시간 다름', icon: AlertTriangle, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
    { value: 'NOT_FOUND', label: '위치 없음 / 이전', icon: HelpCircle, color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
] as const;

const SKIP_REASON_OPTIONS = [
    { value: 'TOO_FAR', label: '거리가 멀어서' },
    { value: 'NOT_INTERESTED', label: '관심 없어서' },
    { value: 'ALREADY_KNOWN', label: '이미 아는 곳이라' },
    { value: 'WEATHER', label: '날씨 때문에' },
    { value: 'NO_TIME', label: '시간이 없어서' },
    { value: 'OTHER', label: '기타 사유' },
] as const;

export default function AdminVerificationsPage() {
    const [schedules, setSchedules] = useState<VerificationScheduleItem[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isLoadingSchedules, setIsLoadingSchedules] = useState<boolean>(true);

    const [cards, setCards] = useState<FactCardForVerification[]>([]);
    const [isLoadingCards, setIsLoadingCards] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // 각 카드별 검증 입력 상태 Map: key = `${placeId}_${stage}`
    const [verifState, setVerifState] = useState<Record<string, {
        visited?: boolean;
        factStatus?: 'OK' | 'TEMP_CLOSED' | 'GONE' | 'HOURS_WRONG' | 'NOT_FOUND' | null;
        skipReason?: 'TOO_FAR' | 'NOT_INTERESTED' | 'ALREADY_KNOWN' | 'WEATHER' | 'NO_TIME' | 'OTHER' | null;
        factNote?: string;
    }>>({});

    const [filterPriority, setFilterPriority] = useState<'ALL' | 'STRIKE' | 'MISSING_INFO'>('ALL');

    // 1. 초기 일정 목록 로드
    useEffect(() => {
        loadSchedules();
    }, []);

    const loadSchedules = async () => {
        setIsLoadingSchedules(true);
        const res = await getSchedulesForVerification();
        if (res.success && res.data) {
            setSchedules(res.data);
            // 스마트플랜이 있는 첫 번째 일정 자동 선택
            const firstWithPlan = res.data.find(s => s.hasPlan);
            if (firstWithPlan) {
                setSelectedScheduleId(firstWithPlan.id);
            }
        } else {
            toast.error(res.error || '일정 목록을 불러오지 못했습니다.');
        }
        setIsLoadingSchedules(false);
    };

    // 2. 선택된 일정 변경 시 11개 활성 카드 로드
    useEffect(() => {
        if (!selectedScheduleId) {
            setCards([]);
            setVerifState({});
            return;
        }
        loadCards(selectedScheduleId);
    }, [selectedScheduleId]);

    const loadCards = async (schedId: string) => {
        setIsLoadingCards(true);
        const res = await getScheduleFactCards(schedId);
        if (res.success && res.data) {
            setCards(res.data);

            // 기존 검증 내역이 있으면 폼 상태로 초기 복원
            const initialMap: typeof verifState = {};
            res.data.forEach(c => {
                const key = `${c.id}_${c.stage}`;
                if (c.existingVerification) {
                    initialMap[key] = {
                        visited: c.existingVerification.visited,
                        factStatus: c.existingVerification.factStatus as any,
                        skipReason: c.existingVerification.skipReason as any,
                        factNote: c.existingVerification.factNote || '',
                    };
                }
            });
            setVerifState(initialMap);
        } else {
            toast.error(res.error || '활성 카드를 불러오지 못했습니다.');
            setCards([]);
        }
        setIsLoadingCards(false);
    };

    // 핸들러: 방문함/미방문 토글
    const handleToggleVisited = (key: string, visited: boolean) => {
        setVerifState(prev => {
            const current = prev[key] || {};
            if (current.visited === visited) {
                // 한 번 더 누르면 선택 해제 (NULL 유지)
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return {
                ...prev,
                [key]: {
                    ...current,
                    visited,
                    factStatus: visited ? (current.factStatus || 'OK') : null,
                    skipReason: !visited ? (current.skipReason || 'TOO_FAR') : null,
                }
            };
        });
    };

    // 핸들러: 관측 사실 선택
    const handleSelectFactStatus = (key: string, factStatus: any) => {
        setVerifState(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { visited: true }),
                visited: true,
                factStatus: prev[key]?.factStatus === factStatus ? null : factStatus,
                skipReason: null,
            }
        }));
    };

    // 핸들러: 미방문 사유 선택
    const handleSelectSkipReason = (key: string, skipReason: any) => {
        setVerifState(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { visited: false }),
                visited: false,
                factStatus: null,
                skipReason: prev[key]?.skipReason === skipReason ? null : skipReason,
            }
        }));
    };

    // 핸들러: 메모 변경
    const handleNoteChange = (key: string, factNote: string) => {
        setVerifState(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                factNote,
            }
        }));
    };

    // 핸들러: 최종 제출
    const handleSubmit = async () => {
        if (!selectedScheduleId) return;

        const inputList: VerificationInputItem[] = [];
        cards.forEach(c => {
            const key = `${c.id}_${c.stage}`;
            const state = verifState[key];
            if (state && state.visited !== undefined) {
                inputList.push({
                    placeId: c.id,
                    stage: c.stage,
                    visited: state.visited,
                    factStatus: state.factStatus,
                    skipReason: state.skipReason,
                    factNote: state.factNote,
                    distanceKm: c.distanceKm,
                });
            }
        });

        if (inputList.length === 0) {
            toast.warning('검증할 장소를 1개 이상 선택해 주세요.');
            return;
        }

        setIsSubmitting(true);
        const res = await submitOwnerVerifications(selectedScheduleId, inputList);
        if (res.success) {
            toast.success(res.message || '팩트 검증이 즉시 반영되었습니다!');
            // 일정 목록 및 카드 재로드
            loadSchedules();
            loadCards(selectedScheduleId);
        } else {
            toast.error(res.error || '검증 저장에 실패했습니다.');
        }
        setIsSubmitting(false);
    };

    // 검색 및 우선순위 필터링된 일정 및 카드
    const filteredSchedules = schedules.filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            s.userName?.toLowerCase().includes(q) ||
            s.title?.toLowerCase().includes(q) ||
            s.siteName?.toLowerCase().includes(q) ||
            s.userPhone?.includes(q)
        );
    });

    const filteredCards = cards.filter(c => {
        if (filterPriority === 'STRIKE') {
            return (c.missCount || 0) > 0;
        }
        if (filterPriority === 'MISSING_INFO') {
            return !c.description || !c.hours;
        }
        return true;
    });

    const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);
    const answeredCount = Object.values(verifState).filter(s => s.visited !== undefined).length;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-28">
            {/* 1. Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#224732] text-white p-6 rounded-3xl shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-[#1C3B29] text-emerald-200 border-none px-2.5 py-1 text-xs">
                            A. 팩트 검증 (Ground Truth)
                        </Badge>
                        <span className="text-xs text-emerald-100 font-medium">1단계 · 사업주 대면 입력</span>
                    </div>
                    <h1 className="text-2xl font-bold mt-2">현장 팩트 검증 관리</h1>
                    <p className="text-sm text-emerald-100 mt-1">
                        체크아웃 손님과 5분 대화하며 확인한 사실을 기록하세요. <strong>1.0 가중치 정답 데이터</strong>로 즉시 동기화됩니다.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        onClick={loadSchedules}
                        disabled={isLoadingSchedules}
                        className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-xl"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> 새로고침
                    </Button>
                </div>
            </div>

            {/* 2. Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Col: 일정 선택 목록 (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                    <Card className="rounded-3xl border-stone-200 shadow-sm overflow-hidden">
                        <CardHeader className="pb-3 border-b border-stone-100">
                            <CardTitle className="text-base font-bold text-stone-900 flex items-center justify-between">
                                <span>방문/이용 일정 선택</span>
                                <Badge variant="secondary" className="text-xs font-semibold">
                                    {filteredSchedules.length}건
                                </Badge>
                            </CardTitle>
                            <CardDescription className="text-xs text-stone-500">
                                팩트 검증을 진행할 손님의 일정을 선택하세요.
                            </CardDescription>

                            {/* Search Input */}
                            <div className="relative mt-2">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                <Input 
                                    placeholder="예약자명, 사이트명, 전화번호..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 text-xs rounded-xl h-9 border-stone-200"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-2 max-h-[680px] overflow-y-auto space-y-1.5">
                            {isLoadingSchedules ? (
                                <div className="p-8 text-center text-xs text-stone-400">일정 목록 불러오는 중...</div>
                            ) : filteredSchedules.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-400">검색된 일정이 없습니다.</div>
                            ) : (
                                filteredSchedules.map(sched => {
                                    const isSelected = sched.id === selectedScheduleId;
                                    return (
                                        <button
                                            key={sched.id}
                                            onClick={() => setSelectedScheduleId(sched.id)}
                                            className={`w-full text-left p-3.5 rounded-2xl transition-all border ${
                                                isSelected 
                                                    ? 'bg-[#224732]/5 border-[#224732] ring-1 ring-[#224732]' 
                                                    : 'bg-white hover:bg-stone-50 border-stone-100'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="font-bold text-sm text-stone-900 flex items-center gap-1.5 truncate">
                                                    <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                                    <span className="truncate">{sched.userName}</span>
                                                    {sched.siteName && (
                                                        <span className="text-[11px] font-semibold text-[#224732] bg-[#224732]/10 px-1.5 py-0.5 rounded">
                                                            {sched.siteName}
                                                        </span>
                                                    )}
                                                </div>
                                                {sched.hasPlan ? (
                                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] shrink-0 border-none">
                                                        플랜 11개
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] text-stone-400 shrink-0">
                                                        플랜 없음
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mt-1.5 text-xs text-stone-500">
                                                <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                                <span>{sched.checkInDate} ~ {sched.checkOutDate}</span>
                                            </div>

                                            {sched.verificationCount > 0 && (
                                                <div className="mt-2 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> 이미 {sched.verificationCount}개 장소 검증 완료
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Col: 11개 활성 카드 검증 폼 (8 cols) */}
                <div className="lg:col-span-8 space-y-4">
                    {selectedSchedule ? (
                        <Card className="rounded-3xl border-stone-200 shadow-sm overflow-hidden">
                            <CardHeader className="pb-3 border-b border-stone-100 bg-stone-50/50">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-lg font-bold text-stone-900 flex items-center gap-2">
                                            <span>{selectedSchedule.userName} 님의 스마트플랜 검증</span>
                                            <span className="text-xs text-stone-500 font-normal">({selectedSchedule.checkInDate})</span>
                                        </CardTitle>
                                        <CardDescription className="text-xs text-stone-500 mt-0.5">
                                            손님이 실제로 들고 다닌 <strong>11개 활성 카드</strong>의 방문 및 영업 여부를 체크하세요.
                                        </CardDescription>
                                    </div>

                                    {/* Priority Filters */}
                                    <div className="flex items-center gap-1 bg-stone-200/50 p-1 rounded-xl text-xs">
                                        <button
                                            onClick={() => setFilterPriority('ALL')}
                                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                                                filterPriority === 'ALL' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                                            }`}
                                        >
                                            전체 11개
                                        </button>
                                        <button
                                            onClick={() => setFilterPriority('STRIKE')}
                                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                                                filterPriority === 'STRIKE' ? 'bg-amber-500 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                                            }`}
                                        >
                                            <AlertTriangle className="w-3 h-3" /> 스트라이크 매장
                                        </button>
                                        <button
                                            onClick={() => setFilterPriority('MISSING_INFO')}
                                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                                                filterPriority === 'MISSING_INFO' ? 'bg-blue-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                                            }`}
                                        >
                                            정보 결측 매장
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-4 space-y-4">
                                {isLoadingCards ? (
                                    <div className="p-12 text-center text-sm text-stone-400">활성 11개 카드 불러오는 중...</div>
                                ) : cards.length === 0 ? (
                                    <div className="p-12 text-center text-sm text-stone-400">
                                        이 일정에는 생성된 스마트플랜 카드가 없습니다.
                                    </div>
                                ) : filteredCards.length === 0 ? (
                                    <div className="p-12 text-center text-sm text-stone-400">
                                        해당 필터 조건에 일치하는 카드가 없습니다.
                                    </div>
                                ) : (
                                    filteredCards.map((card, idx) => {
                                        const key = `${card.id}_${card.stage}`;
                                        const current = verifState[key] || {};
                                        const isAnswered = current.visited !== undefined;

                                        return (
                                            <div 
                                                key={key}
                                                className={`p-4 rounded-2xl border transition-all ${
                                                    isAnswered 
                                                        ? 'bg-white border-stone-300 shadow-xs' 
                                                        : 'bg-stone-50/70 border-stone-200'
                                                }`}
                                            >
                                                {/* Header info */}
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <div className="flex items-start gap-2.5">
                                                        <span className="text-xl shrink-0 mt-0.5">
                                                            {CATEGORY_ICONS[card.category] || '📍'}
                                                        </span>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                                                                    {card.stageName}
                                                                </span>
                                                                <h4 className="font-bold text-stone-900 text-sm">{card.name}</h4>
                                                                {card.missCount && card.missCount > 0 ? (
                                                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                                        공공 {card.missCount}스트라이크
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                            <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">
                                                                {card.distanceKm ? `${card.distanceKm}km · ` : ''}{card.address || '주소 정보 없음'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Primary Toggle: 방문함 vs 미방문 */}
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={current.visited === true ? 'default' : 'outline'}
                                                            onClick={() => handleToggleVisited(key, true)}
                                                            className={`text-xs rounded-xl h-8 px-3 ${
                                                                current.visited === true ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'border-stone-200 text-stone-700'
                                                            }`}
                                                        >
                                                            <Check className="w-3.5 h-3.5 mr-1" /> 방문함
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={current.visited === false ? 'default' : 'outline'}
                                                            onClick={() => handleToggleVisited(key, false)}
                                                            className={`text-xs rounded-xl h-8 px-3 ${
                                                                current.visited === false ? 'bg-stone-700 hover:bg-stone-800 text-white' : 'border-stone-200 text-stone-700'
                                                            }`}
                                                        >
                                                            <XCircle className="w-3.5 h-3.5 mr-1" /> 미방문
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Sub Options (Visited === true -> Fact Status 5종) */}
                                                {current.visited === true && (
                                                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2.5 animate-fadeIn">
                                                        <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                                                            <Sparkles className="w-3 h-3" /> 현장 관측 사실 선택 (1탭 완결)
                                                        </span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {FACT_STATUS_OPTIONS.map(opt => {
                                                                const isSelected = current.factStatus === opt.value;
                                                                const Icon = opt.icon;
                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        type="button"
                                                                        onClick={() => handleSelectFactStatus(key, opt.value)}
                                                                        className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all ${
                                                                            isSelected 
                                                                                ? `${opt.color} ring-2 ring-emerald-600 font-bold shadow-xs` 
                                                                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                                                        }`}
                                                                    >
                                                                        <Icon className="w-3.5 h-3.5" />
                                                                        {opt.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Fact Note Input */}
                                                        <Input
                                                            placeholder="추가 관측 메모 (예: 화요일 정기휴무로 바뀜, 신축 이전함 등)..."
                                                            value={current.factNote || ''}
                                                            onChange={(e) => handleNoteChange(key, e.target.value)}
                                                            className="text-xs h-8 rounded-xl border-stone-200 bg-white"
                                                        />
                                                    </div>
                                                )}

                                                {/* Sub Options (Visited === false -> Skip Reason 6종) */}
                                                {current.visited === false && (
                                                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2 animate-fadeIn">
                                                        <span className="text-[11px] font-bold text-stone-600">
                                                            미방문 사유 선택
                                                        </span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {SKIP_REASON_OPTIONS.map(opt => {
                                                                const isSelected = current.skipReason === opt.value;
                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        type="button"
                                                                        onClick={() => handleSelectSkipReason(key, opt.value)}
                                                                        className={`text-xs px-2.5 py-1 rounded-xl border transition-all ${
                                                                            isSelected 
                                                                                ? 'bg-stone-800 text-white border-stone-800 font-bold shadow-xs' 
                                                                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                                                        }`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="p-16 text-center text-stone-400 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                            좌측에서 일정을 먼저 선택해 주세요.
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Sticky Bottom CTA Bar */}
            {selectedSchedule && cards.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-lg z-40">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="text-xs text-stone-600">
                            <strong>{selectedSchedule.userName}</strong> 님의 일정 · 
                            <span className="ml-1 text-emerald-700 font-bold">
                                {answeredCount} / {cards.length}개 장소 입력됨
                            </span>
                        </div>

                        <Button
                            size="lg"
                            disabled={answeredCount === 0 || isSubmitting}
                            onClick={handleSubmit}
                            className="bg-[#224732] hover:bg-[#1C3B29] text-white font-bold text-sm px-6 rounded-2xl shadow-md transition-all"
                        >
                            {isSubmitting ? '저장 및 마스터 동기화 중...' : `[ ${answeredCount}개 장소 검증 완료 및 즉시 반영 ]`}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
