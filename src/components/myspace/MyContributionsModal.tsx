'use client';

import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { createClient } from '@/lib/supabase-client';
import { Badge } from '@/components/ui/badge';
import { Sparkles, CheckCircle2, Clock, Check, Store } from 'lucide-react';

interface ContributionItem {
    id: number;
    place_name: string;
    stage?: string;
    liked?: boolean;
    fact_status?: string;
    review_state?: string;
    verified_at: string;
}

interface MyContributionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId?: string;
}

export default function MyContributionsModal({ isOpen, onClose, userId }: MyContributionsModalProps) {
    const [items, setItems] = useState<ContributionItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadContributions();
        }
    }, [isOpen]);

    const loadContributions = async () => {
        setIsLoading(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            const targetUser = userId || user?.id;

            if (!targetUser) {
                setItems([]);
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('place_verifications')
                .select(`
                    id,
                    place_id,
                    stage,
                    liked,
                    fact_status,
                    review_state,
                    verified_at,
                    master_places:place_id ( name )
                `)
                .eq('user_id', targetUser)
                .order('verified_at', { ascending: false });

            if (error) {
                console.warn('loadContributions error:', error);
                setItems([]);
            } else {
                const list: ContributionItem[] = (data || []).map(d => {
                    const mp = Array.isArray(d.master_places) ? d.master_places[0] : d.master_places;
                    return {
                        id: d.id,
                        place_name: mp?.name || '기록된 장소',
                        stage: d.stage,
                        liked: d.liked,
                        fact_status: d.fact_status,
                        review_state: d.review_state,
                        verified_at: d.verified_at ? d.verified_at.split('T')[0] : '',
                    };
                });
                setItems(list);
            }
        } catch (e) {
            console.error('loadContributions unexpected error:', e);
        }
        setIsLoading(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto bg-[#F7F5EF] px-5 pb-8">
                <SheetHeader className="pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-900 text-emerald-200 border-none text-[10px]">
                            나의 기여
                        </Badge>
                    </div>
                    <SheetTitle className="text-left text-lg font-bold text-stone-900 mt-1">
                        내가 확인한 장소 ({items.length}곳)
                    </SheetTitle>
                    <SheetDescription className="text-left text-xs text-stone-500">
                        회원님의 소중한 확인으로 라온아이 장소 정보가 더욱 정확해집니다.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-4 space-y-2.5">
                    {isLoading ? (
                        <div className="p-8 text-center text-xs text-stone-400">
                            기여 내역을 불러오는 중...
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-8 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
                            아직 확인한 장소가 없습니다. 길안내나 캠핑 기록 후 확인해 보세요 🌿
                        </div>
                    ) : (
                        items.map(item => {
                            const isLiked = item.liked === true;
                            const isApplied = item.review_state === 'APPLIED';

                            return (
                                <div
                                    key={item.id}
                                    className="p-3.5 bg-white rounded-2xl border border-stone-200 flex items-center justify-between shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${
                                            isLiked ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                        }`}>
                                            <Store className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-stone-900">
                                                {item.place_name}
                                            </div>
                                            <div className="text-[11px] text-stone-400 mt-0.5">
                                                {isLiked ? '좋았어요' : (item.fact_status || '정보 수정')} · {item.verified_at}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        {isApplied ? (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] flex items-center gap-0.5">
                                                <Check className="w-3 h-3" /> 반영됨
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px] flex items-center gap-0.5">
                                                <Clock className="w-3 h-3" /> 확인 중 ⏳
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
