'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    getScheduleVerifyCards, 
    submitUserVerifyPicks, 
    submitUserVerifyReport,
    type UserVerifyCardItem 
} from '@/actions/user-verification';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
    Sparkles, 
    Check, 
    MapPin, 
    Navigation, 
    Heart, 
    ArrowRight, 
    AlertCircle, 
    RotateCcw,
    X,
    ChevronRight,
    DoorClosed,
    Store,
    Clock,
    MapPinOff
} from 'lucide-react';

export default function UserVerifyPage({ params }: { params: Promise<{ scheduleId: string }> }) {
    const resolvedParams = use(params);
    const scheduleId = resolvedParams.scheduleId;
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromQuery = searchParams.get('from') || 'timeline';

    // Steps: 'SCREEN_A' (좋았던 곳 담기) | 'SCREEN_B' (완료) | 'SCREEN_D' (문 닫은 곳 신고)
    const [step, setStep] = useState<'SCREEN_A' | 'SCREEN_B' | 'SCREEN_D'>('SCREEN_A');

    const [cards, setCards] = useState<UserVerifyCardItem[]>([]);
    const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Screen D: 신고 모달 상태
    const [reportingCard, setReportingCard] = useState<UserVerifyCardItem | null>(null);

    useEffect(() => {
        loadCards();
    }, [scheduleId]);

    const loadCards = async () => {
        setIsLoading(true);
        const res = await getScheduleVerifyCards(scheduleId);
        if (res.success && res.data) {
            setCards(res.data);
            // 길안내 실행했던 장소는 기본 선택 편의 제공
            const navIds = res.data.filter(c => c.hasNavLaunched).map(c => c.id);
            setSelectedPlaceIds(navIds.slice(0, 5));
        } else {
            toast.error(res.error || '장소 목록을 불러오지 못했습니다.');
        }
        setIsLoading(false);
    };

    // 장소 선택/해제 토글 (최대 5개)
    const handleTogglePlace = (placeId: string) => {
        setSelectedPlaceIds(prev => {
            if (prev.includes(placeId)) {
                return prev.filter(id => id !== placeId);
            }
            if (prev.length >= 5) {
                toast.info('최대 5곳까지 선택할 수 있어요.');
                return prev;
            }
            return [...prev, placeId];
        });
    };

    // 화면 A 완료 제출
    const handleSubmitPicks = async () => {
        setIsSubmitting(true);
        const res = await submitUserVerifyPicks(scheduleId, selectedPlaceIds, fromQuery);
        if (res.success) {
            setStep('SCREEN_B');
        } else {
            toast.error(res.error || '저장에 실패했습니다.');
        }
        setIsSubmitting(false);
    };

    // 건너뛰기
    const handleSkip = () => {
        router.push('/myspace');
    };

    // 화면 D: 관측 사실 신고
    const handleReportFact = async (factStatus: string) => {
        if (!reportingCard) return;
        setIsSubmitting(true);

        const res = await submitUserVerifyReport(scheduleId, reportingCard.id, factStatus);
        if (res.success) {
            toast.success('알려주셔서 고마워요. 확인해서 반영할게요 🌿', { duration: 4000 });
            setReportingCard(null);
        } else {
            toast.error(res.error || '신고 전송에 실패했습니다.');
        }
        setIsSubmitting(false);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-stone-500">
                추천 장소 목록을 불러오고 있어요...
            </div>
        );
    }

    // ==========================================
    // 화면 B: 내 지도에 담기 완료 화면
    // ==========================================
    if (step === 'SCREEN_B') {
        return (
            <div className="min-h-screen bg-[#F7F5EF] p-6 flex flex-col justify-between animate-fadeIn">
                <div className="space-y-6 pt-8">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-[#224732] flex items-center justify-center mx-auto shadow-sm">
                        <Sparkles className="w-8 h-8" />
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-stone-900">
                            내 지도에 {selectedPlaceIds.length}곳이 담겼어요!
                        </h2>
                        <p className="text-sm text-stone-600 leading-relaxed font-medium">
                            '나의 공간 &gt; 나만의 캠핑지도'에서 언제든 확인하고,
                            다음 캠핑 때 나만의 장소로 찾아갈 수 있어요.
                        </p>
                    </div>

                    {/* 화면 D 트리거 링크 */}
                    <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
                        <button
                            onClick={() => setStep('SCREEN_D')}
                            className="w-full flex items-center justify-between text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800">
                                        혹시 문 닫은 곳이나 정보가 다른 곳이 있었나요?
                                    </div>
                                    <div className="text-[11px] text-stone-400 mt-0.5">
                                        다른 캠퍼들을 위해 1초 만에 알려주세요
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-600" />
                        </button>
                    </div>
                </div>

                <div className="pt-8 pb-6">
                    <Button
                        size="lg"
                        onClick={() => router.push('/myspace')}
                        className="w-full py-4 bg-[#224732] hover:bg-[#1C3B29] text-white font-bold rounded-2xl shadow-md text-sm"
                    >
                        내 공간으로 이동하기
                    </Button>
                </div>
            </div>
        );
    }

    // ==========================================
    // 화면 D: 여행 후 문 닫은 곳 신고 화면
    // ==========================================
    if (step === 'SCREEN_D') {
        return (
            <div className="min-h-screen bg-[#F7F5EF] p-5 flex flex-col justify-between animate-fadeIn">
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setStep('SCREEN_B')}
                            className="text-xs text-stone-500 hover:text-stone-800 font-semibold"
                        >
                            ← 뒤로가기
                        </button>
                        <button
                            onClick={() => router.push('/myspace')}
                            className="text-xs text-stone-400 hover:text-stone-600"
                        >
                            완료
                        </button>
                    </div>

                    <div>
                        <Badge className="bg-amber-100 text-amber-800 border-none text-[11px]">
                            정보 바로잡기
                        </Badge>
                        <h2 className="text-xl font-bold text-stone-900 mt-1.5">
                            정보가 달랐던 곳을 골라주세요
                        </h2>
                        <p className="text-xs text-stone-500 mt-1">
                            장소를 누르면 관측 사실을 1초 만에 신고할 수 있어요.
                        </p>
                    </div>

                    {/* 장소 그리드 */}
                    <div className="space-y-2 pt-2 max-h-[60vh] overflow-y-auto pr-1">
                        {cards.map(card => (
                            <button
                                key={card.id}
                                onClick={() => setReportingCard(card)}
                                className="w-full p-3.5 rounded-2xl bg-white border border-stone-200 hover:border-amber-400 flex items-center justify-between text-left transition-all active:scale-[0.99] shadow-xs"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{card.categoryIcon}</span>
                                    <div>
                                        <div className="text-sm font-bold text-stone-900">{card.name}</div>
                                        <div className="text-xs text-stone-400 mt-0.5">{card.categoryName} · {card.address}</div>
                                    </div>
                                </div>
                                <span className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded-lg">
                                    신고 ›
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 신고 팝업 모달 */}
                {reportingCard && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b pb-3 border-stone-100">
                                <div>
                                    <h3 className="font-bold text-stone-900 text-base">{reportingCard.name}</h3>
                                    <p className="text-xs text-stone-400">무엇이 달랐나요?</p>
                                </div>
                                <button onClick={() => setReportingCard(null)} className="text-stone-400 p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                {[
                                    { status: 'TEMP_CLOSED', label: '문이 닫혀 있었어요 (임시휴무)', icon: DoorClosed, color: 'text-amber-600 bg-amber-50' },
                                    { status: 'GONE', label: '간판이 없거나 폐업했어요', icon: Store, color: 'text-rose-600 bg-rose-50' },
                                    { status: 'HOURS_WRONG', label: '영업시간이 달라요', icon: Clock, color: 'text-blue-600 bg-blue-50' },
                                    { status: 'NOT_FOUND', label: '이 위치에 없어요', icon: MapPinOff, color: 'text-purple-600 bg-purple-50' },
                                ].map(opt => {
                                    const Icon = opt.icon;
                                    return (
                                        <button
                                            key={opt.status}
                                            disabled={isSubmitting}
                                            onClick={() => handleReportFact(opt.status)}
                                            className="w-full p-3 rounded-xl border border-stone-200 hover:bg-stone-50 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
                                        >
                                            <div className={`p-2 rounded-lg ${opt.color}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold text-stone-800">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-4">
                    <Button
                        size="lg"
                        onClick={() => router.push('/myspace')}
                        className="w-full py-4 bg-[#224732] hover:bg-[#1C3B29] text-white font-bold rounded-2xl text-sm"
                    >
                        완료하고 나가기
                    </Button>
                </div>
            </div>
        );
    }

    // ==========================================
    // 화면 A: 좋았던 곳 내 지도에 담기 (기본)
    // ==========================================
    return (
        <div className="min-h-screen bg-[#F7F5EF] p-5 flex flex-col justify-between animate-fadeIn">
            <div className="space-y-4 pt-2">
                {/* 상단 Skip & Header */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#224732] bg-[#224732]/10 px-2 py-0.5 rounded-full">
                        캠핑 후 가벼운 기록
                    </span>
                    <button
                        onClick={handleSkip}
                        className="text-xs text-stone-400 hover:text-stone-600 font-semibold"
                    >
                        다음에 하기
                    </button>
                </div>

                {/* 의미 배너 (§6-4) */}
                <div className="p-3 bg-emerald-900 text-emerald-100 rounded-2xl flex items-center gap-2.5 text-xs shadow-xs">
                    <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>지난달 캠퍼들의 확인으로 <strong>12곳</strong>의 정보가 바로잡혔어요 🌿</span>
                </div>

                {/* Title */}
                <div>
                    <h1 className="text-xl font-black text-stone-900 leading-tight">
                        이번 캠핑에서 좋았던 곳을 골라보세요
                    </h1>
                    <p className="text-xs text-stone-500 mt-1 font-medium">
                        내 지도에 저장되어 다음 캠핑 때 바로 찾아볼 수 있어요. (최대 5곳)
                    </p>
                </div>

                {/* 8개 한정 칩 카드 그리드 */}
                <div className="space-y-2.5 pt-2 max-h-[58vh] overflow-y-auto pr-1">
                    {cards.length === 0 ? (
                        <div className="p-12 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
                            추천 장소 내역이 없습니다.
                        </div>
                    ) : (
                        cards.map(card => {
                            const isSelected = selectedPlaceIds.includes(card.id);

                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => handleTogglePlace(card.id)}
                                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-[0.99] ${
                                        isSelected
                                            ? 'bg-[#224732] text-white border-[#224732] shadow-sm ring-1 ring-[#224732]'
                                            : 'bg-white text-stone-900 border-stone-200 hover:border-stone-300'
                                    }`}
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <span className="text-2xl mt-0.5 shrink-0">{card.categoryIcon}</span>
                                        <div className="min-w-0 pr-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                                    isSelected ? 'bg-white/20 text-emerald-100' : 'bg-stone-100 text-stone-600'
                                                }`}>
                                                    {card.categoryName}
                                                </span>
                                                {card.hasNavLaunched && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 ${
                                                        isSelected ? 'bg-blue-400/30 text-blue-200' : 'bg-blue-50 text-blue-700'
                                                    }`}>
                                                        <Navigation className="w-2.5 h-2.5" /> 길안내 이용함
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className={`font-bold text-sm truncate mt-0.5 ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                                                {card.name}
                                            </h4>
                                            <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-emerald-100/70' : 'text-stone-400'}`}>
                                                {card.distanceKm ? `${card.distanceKm}km · ` : ''}{card.address || '주소 정보 없음'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                                        isSelected ? 'bg-white text-[#224732] border-white' : 'border-stone-300 bg-stone-50'
                                    }`}>
                                        {isSelected && <Check className="w-4 h-4 font-bold" />}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bottom CTA Bar */}
            <div className="pt-4 pb-2">
                <Button
                    size="lg"
                    disabled={isSubmitting}
                    onClick={handleSubmitPicks}
                    className="w-full py-4 bg-[#224732] hover:bg-[#1C3B29] text-white font-bold rounded-2xl shadow-md text-sm transition-all flex items-center justify-center gap-2"
                >
                    <Heart className="w-4 h-4 text-emerald-300" />
                    <span>
                        {selectedPlaceIds.length > 0
                            ? `${selectedPlaceIds.length}곳 내 지도에 담기`
                            : '선택 없이 넘어가기'}
                    </span>
                </Button>
            </div>
        </div>
    );
}
