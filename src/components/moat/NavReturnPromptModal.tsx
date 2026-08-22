'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import FactReportSheet from '@/components/plan/FactReportSheet';
import { Navigation, Smile, AlertCircle, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PendingNavIntent {
    id: number;
    place_id: string;
    place_name?: string;
    category?: string;
    stage?: string;
    schedule_id?: string;
    user_id?: string;
    launched_at: string;
}

export default function NavReturnPromptModal() {
    const [pendingIntent, setPendingIntent] = useState<PendingNavIntent | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        checkPendingNavIntent();
    }, []);

    const checkPendingNavIntent = async () => {
        try {
            // 이번 브라우저 세션에서 이미 프롬프트를 닫았거나 확인했으면 스킵
            const sessionChecked = sessionStorage.getItem('raon_nav_return_prompt_dismissed');
            if (sessionChecked) return;

            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 2시간 전 시각 계산
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

            // nav_intent_log에서 2시간 이상 경과하고 followed_up = false인 건 1건 조회
            const { data: intents, error } = await supabase
                .from('nav_intent_log')
                .select(`
                    id,
                    place_id,
                    category,
                    stage,
                    schedule_id,
                    user_id,
                    launched_at
                `)
                .eq('user_id', user.id)
                .eq('followed_up', false)
                .lte('launched_at', twoHoursAgo)
                .order('launched_at', { ascending: false })
                .limit(1);

            if (error || !intents || intents.length === 0) return;

            const targetIntent = intents[0];

            // 이미 place_verifications에 검증이 존재하는지 확인
            const { data: existingVerifs } = await supabase
                .from('place_verifications')
                .select('id')
                .eq('place_id', targetIntent.place_id)
                .eq('user_id', user.id)
                .limit(1);

            if (existingVerifs && existingVerifs.length > 0) {
                // 이미 검증했으면 followed_up = true로 정리
                await supabase
                    .from('nav_intent_log')
                    .update({ followed_up: true })
                    .eq('id', targetIntent.id);
                return;
            }

            // 장소명 조회 (master_places)
            const { data: placeData } = await supabase
                .from('master_places')
                .select('name')
                .eq('id', targetIntent.place_id)
                .single();

            setPendingIntent({
                ...targetIntent,
                place_name: placeData?.name || '추천 장소',
            });
            setIsOpen(true);
        } catch (e) {
            console.warn('[NavReturnPrompt] check error:', e);
        }
    };

    // 1. [😊 좋았어요] 탭 (1탭 완료)
    const handleLiked = async () => {
        if (!pendingIntent) return;
        setIsProcessing(true);

        try {
            const supabase = createClient();
            const now = new Date();

            // 1) 팩트 검증 레코드 생성 (NAV_LAUNCHED 증거, 0.7 가중치)
            await supabase.from('place_verifications').insert({
                partner_id: 'a0000000-0000-0000-0000-000000000001',
                schedule_id: pendingIntent.schedule_id || null,
                place_id: pendingIntent.place_id,
                user_id: pendingIntent.user_id || null,
                stage: pendingIntent.stage || 'DESTINATION',
                visited: true,
                liked: true,
                fact_status: 'OK',
                observed_at: now.toISOString().split('T')[0],
                observed_dow: now.getDay(),
                source: 'APP_USER',
                entry_point: 'nav_return',
                evidence: 'NAV_LAUNCHED',
                reporter_weight: 0.7,
                review_state: 'APPLIED', // 긍정 신호는 즉시 반영 및 miss_count 리셋 대상
                verified_at: now.toISOString(),
            });

            // 2) nav_intent_log follow_up 완료 처리
            await supabase
                .from('nav_intent_log')
                .update({ followed_up: true })
                .eq('id', pendingIntent.id);

            // 3) miss_count 리셋 트리거 (해당 장소가 2스트라이크 등일 경우 오판 구제)
            await supabase
                .from('master_places')
                .update({ miss_count: 0, updated_at: now.toISOString() })
                .eq('id', pendingIntent.place_id);

            toast.success(`좋은 경험을 나눠주셔서 고마워요 🌿`, { duration: 3500 });
            sessionStorage.setItem('raon_nav_return_prompt_dismissed', 'true');
            setIsOpen(false);
        } catch (e) {
            console.error('[NavReturnPrompt] handleLiked error:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    // 2. [ℹ️ 정보가 달랐어요] 탭 (화면 C 시트 이동)
    const handleReportIssue = async () => {
        if (!pendingIntent) return;
        setIsOpen(false);
        setIsReportOpen(true);
        // nav_intent_log follow_up 완료 처리
        const supabase = createClient();
        await supabase
            .from('nav_intent_log')
            .update({ followed_up: true })
            .eq('id', pendingIntent.id);
        sessionStorage.setItem('raon_nav_return_prompt_dismissed', 'true');
    };

    // 3. [🕐 아직 안 갔어요] 탭 (다음에 재노출)
    const handleNotYet = () => {
        sessionStorage.setItem('raon_nav_return_prompt_dismissed', 'true');
        setIsOpen(false);
    };

    if (!isOpen || !pendingIntent) {
        return (
            <>
                {isReportOpen && pendingIntent && (
                    <FactReportSheet
                        isOpen={isReportOpen}
                        onClose={() => {
                            setIsReportOpen(false);
                            setPendingIntent(null);
                        }}
                        placeId={pendingIntent.place_id}
                        placeName={pendingIntent.place_name || '추천 장소'}
                        stage={pendingIntent.stage}
                        scheduleId={pendingIntent.schedule_id}
                        userId={pendingIntent.user_id}
                    />
                )}
            </>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-5 text-center relative border border-stone-100">
                <button
                    onClick={handleNotYet}
                    className="absolute right-4 top-4 text-stone-400 hover:text-stone-600 p-1 rounded-full"
                    aria-label="닫기"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-[#224732] flex items-center justify-center shadow-inner">
                    <Navigation className="w-7 h-7" />
                </div>

                <div>
                    <h3 className="text-xl font-bold text-stone-900 leading-tight">
                        {pendingIntent.place_name}
                    </h3>
                    <p className="text-sm text-stone-600 mt-1 font-medium">
                        다녀오셨어요? 어떠셨는지 알려주세요 🌿
                    </p>
                </div>

                <div className="space-y-2.5 pt-1">
                    {/* 1. 좋았어요 (1탭 완료) */}
                    <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleLiked}
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
                    >
                        <Smile className="w-4 h-4 text-emerald-200" />
                        <span>좋았어요! 만족해요</span>
                    </button>

                    {/* 2. 정보가 달랐어요 */}
                    <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleReportIssue}
                        className="w-full py-3 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-amber-200/60"
                    >
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>정보가 달랐어요 (신고)</span>
                    </button>

                    {/* 3. 아직 안 갔어요 */}
                    <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleNotYet}
                        className="w-full py-2.5 px-4 rounded-xl text-stone-400 hover:text-stone-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>아직 안 갔어요 / 다음에요</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
