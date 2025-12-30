"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Lock, Palette, Map, Calendar, Clock, Image as ImageIcon, Sparkles, Moon, CloudFog, Camera, Sticker, ChevronDown, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';

interface OptionItem {
    name: string;
    key: string;
    icon: React.ElementType;
    color: string;
    cost: number;
}

const VIEW_OPTIONS: OptionItem[] = [
    { name: '계절별 모아보기', key: 'SEASON_VIEW', icon: Palette, color: 'text-orange-500', cost: 10 },
    { name: '책으로 보기', key: 'BOOK_VIEW', icon: Map, color: 'text-emerald-600', cost: 20 },
    { name: '감정 캘린더', key: 'EMOTION_CALENDAR', icon: Calendar, color: 'text-rose-500', cost: 15 },
    { name: '타임라인', key: 'TIMELINE_VIEW', icon: Clock, color: 'text-blue-500', cost: 10 },
    { name: '사진 갤러리', key: 'PHOTO_GALLERY', icon: ImageIcon, color: 'text-purple-500', cost: 10 },
];

const EDIT_OPTIONS: OptionItem[] = [
    { name: '빈티지 필터', key: 'FILTER_VINTAGE', icon: Sparkles, color: 'text-amber-600', cost: 5 },
    { name: '폴라로이드', key: 'FRAME_POLAROID', icon: Camera, color: 'text-stone-600', cost: 5 },
    { name: '숲속의 밤', key: 'THEME_NIGHT', icon: Moon, color: 'text-indigo-400', cost: 30 },
    { name: '새벽 안개', key: 'THEME_FOG', icon: CloudFog, color: 'text-slate-400', cost: 30 },
    { name: '로그 스티커', key: 'STICKER_PACK_LOG', icon: Sticker, color: 'text-pink-500', cost: 5 },
];

export default function RecordTools() {
    const [isOpen, setIsOpen] = useState(false);
    const [userTokens, setUserTokens] = useState<number | null>(null);
    const [unlockedFeatures, setUnlockedFeatures] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    const supabase = createClient();

    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        // Fetch User Profile (Tokens)
        const { data: profile } = await supabase
            .from('profiles')
            .select('raon_token')
            .eq('id', user.id)
            .single();

        if (profile) setUserTokens(profile.raon_token);

        // Fetch Unlocked Features
        const { data: unlocks } = await supabase
            .from('user_unlocked_features')
            .select('feature_key')
            .eq('user_id', user.id);

        if (unlocks) {
            setUnlockedFeatures(new Set(unlocks.map(u => u.feature_key)));
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Subscribe to changes (Optional, for real-time token updates)
        const channel = supabase
            .channel('profile-changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
                if (payload.new && (payload.new as any).id === userId) {
                    setUserTokens((payload.new as any).raon_token);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchData, userId]);


    const handleFeatureClick = async (item: OptionItem) => {
        if (!userId) {
            toast.error("로그인이 필요합니다.");
            return;
        }

        // 1. If already unlocked, just selecting (Mock selection for now)
        if (unlockedFeatures.has(item.key)) {
            toast.success(`'${item.name}' 기능이 활성화되었습니다.`);
            // In future: set active view state store
            return;
        }

        // 2. Check Tokens
        if (userTokens !== null && userTokens < item.cost) {
            toast.error("라온 토큰이 부족합니다.", {
                description: `현재 보유: ${userTokens} T / 필요: ${item.cost} T`
            });
            return;
        }

        // 3. Purchase RPC
        if (isLoading) return;
        setIsLoading(true);

        try {
            const { data, error } = await supabase.rpc('purchase_feature', {
                p_feature_key: item.key,
                p_cost: item.cost
            });

            if (error) throw error;

            if (data && data.success) {
                toast.success(`'${item.name}' 잠금 해제 완료!`, {
                    description: `${item.cost} 토큰이 차감되었습니다.`
                });
                setUnlockedFeatures(prev => new Set(prev).add(item.key));
                // Update tokens display locally or wait for subscription
                if (userTokens !== null) setUserTokens(userTokens - item.cost);
            } else {
                toast.error(data?.message || "구매 실패");
            }
        } catch (err: any) {
            console.error(err);
            toast.error("기능 잠금 해제 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const renderOptionList = (title: string, options: OptionItem[]) => (
        <div className="mb-8 last:mb-0">
            <h4 className="text-[10px] font-bold text-[#1C4526]/70 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#1C4526] rounded-full inline-block"></span>
                {title}
            </h4>
            <div className="flex gap-4 overflow-x-auto pb-4 w-full px-1 scrollbar-hide snap-x">
                {options.map((opt) => {
                    const isUnlocked = unlockedFeatures.has(opt.key);
                    return (
                        <button
                            key={opt.key}
                            onClick={() => handleFeatureClick(opt)}
                            disabled={isLoading}
                            className="flex flex-col items-center gap-2.5 min-w-[70px] group snap-start relative shrink-0"
                        >
                            <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
                                {/* Icon Container */}
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl border flex items-center justify-center relative overflow-hidden transition-all duration-300",
                                    isUnlocked
                                        ? "bg-[#1C4526]/5 border-[#1C4526]/20 shadow-none"
                                        : "bg-white dark:bg-zinc-900 border-[#ECE8DF] dark:border-zinc-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]"
                                )}>
                                    <div className={cn(
                                        "absolute inset-0 transition-opacity",
                                        isUnlocked ? "opacity-0" : "bg-gradient-to-br from-[#F5F2EB]/50 to-transparent dark:from-zinc-800/50 opacity-100 group-hover:opacity-0"
                                    )} />

                                    <opt.icon
                                        size={20}
                                        className={cn(
                                            "transition-all duration-300",
                                            isUnlocked ? "text-[#1C4526] scale-100" : cn(opt.color, "group-hover:scale-110")
                                        )}
                                        strokeWidth={1.5}
                                    />

                                    {/* Cost or Check Badge */}
                                    <div className={cn(
                                        "absolute bottom-0 inset-x-0 h-4 flex items-center justify-center border-t transition-colors",
                                        isUnlocked
                                            ? "bg-[#1C4526] border-[#1C4526]"
                                            : "bg-[#F7F5EF] dark:bg-zinc-800 border-[#ECE8DF] dark:border-zinc-700"
                                    )}>
                                        {isUnlocked ? (
                                            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                        ) : (
                                            <span className="text-[8px] font-bold text-stone-500 dark:text-stone-400">{opt.cost} T</span>
                                        )}
                                    </div>
                                </div>

                                {/* Lock Badge (Only if locked) */}
                                {!isUnlocked && (
                                    <div className="absolute -top-1 -right-1 bg-[#1C4526] text-white p-0.5 rounded-full shadow-lg border-[1.5px] border-white dark:border-black z-10">
                                        <Lock className="w-2 h-2" strokeWidth={2.5} />
                                    </div>
                                )}
                            </div>

                            <span className={cn(
                                "text-[10px] font-semibold text-center leading-tight break-keep px-1 transition-colors",
                                isUnlocked ? "text-[#1C4526]" : "text-stone-600 dark:text-stone-300 group-hover:text-[#1C4526]"
                            )}>
                                {opt.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="bg-white/40 dark:bg-zinc-800/20 rounded-xl overflow-hidden border border-stone-200/50 dark:border-zinc-700/50 backdrop-blur-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-center gap-2 py-3 text-stone-600 bg-white/50 hover:bg-white/80 transition-colors relative"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-tight">보기, 편집 도구</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isOpen && "rotate-180")} />
                </div>
                {/* User Token Peek */}
                {userTokens !== null && (
                    <div className="absolute right-4 text-[10px] text-[#1C4526] font-bold bg-[#1C4526]/5 px-2 py-1 rounded-full border border-[#1C4526]/10">
                        {userTokens} T
                    </div>
                )}
            </button>

            <div className={cn(
                "transition-all duration-500 ease-in-out overflow-hidden bg-stone-50/50 dark:bg-zinc-900/50",
                isOpen ? "max-h-[500px] opacity-100 p-6" : "max-h-0 opacity-0 p-0"
            )}>
                <div className="min-w-0">
                    {renderOptionList('VIEW OPTIONS', VIEW_OPTIONS)}
                    {renderOptionList('EDIT TOOLS', EDIT_OPTIONS)}
                </div>
            </div>
        </div>
    );
}
