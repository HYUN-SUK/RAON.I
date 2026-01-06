'use client';

/**
 * 인앱 배지 관리 훅
 * 탭별 알림 배지 개수 조회 및 읽음 처리
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';

export interface BadgeCounts {
    home: number;
    reservation: number;
    community: number;
    myspace: number;
    total: number;
}

const DEFAULT_BADGES: BadgeCounts = {
    home: 0,
    reservation: 0,
    community: 0,
    myspace: 0,
    total: 0,
};

export function useInAppBadge() {
    const [badges, setBadges] = useState<BadgeCounts>(DEFAULT_BADGES);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    // 배지 개수 조회
    const fetchBadges = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setBadges(DEFAULT_BADGES);
                setLoading(false);
                return;
            }

            // RPC 함수 호출
            const { data, error } = await supabase.rpc('get_badge_counts', {
                p_user_id: user.id,
            });

            if (error) {
                console.error('[useInAppBadge] Fetch error:', error);
                // RPC가 없으면 직접 쿼리
                await fetchBadgesDirect(user.id);
                return;
            }

            if (data) {
                setBadges({
                    home: data.home || 0,
                    reservation: data.reservation || 0,
                    community: data.community || 0,
                    myspace: data.myspace || 0,
                    total: data.total || 0,
                });
            }
        } catch (err) {
            console.error('[useInAppBadge] Exception:', err);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    // RPC 없을 때 직접 쿼리 (폴백)
    const fetchBadgesDirect = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('in_app_badges')
                .select('badge_target')
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) {
                console.error('[useInAppBadge] Direct query error:', error);
                return;
            }

            const counts: BadgeCounts = { ...DEFAULT_BADGES };
            data?.forEach((badge) => {
                const target = badge.badge_target as keyof Omit<BadgeCounts, 'total'>;
                if (counts[target] !== undefined) {
                    counts[target]++;
                    counts.total++;
                }
            });

            setBadges(counts);
        } catch (err) {
            console.error('[useInAppBadge] Direct query exception:', err);
        }
    };

    // 특정 탭 배지 읽음 처리
    const markAsRead = useCallback(async (target: 'home' | 'reservation' | 'community' | 'myspace') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // RPC 함수 호출
            const { error } = await supabase.rpc('mark_badges_as_read', {
                p_user_id: user.id,
                p_target: target,
            });

            if (error) {
                // RPC 없으면 직접 업데이트
                await supabase
                    .from('in_app_badges')
                    .update({ is_read: true })
                    .eq('user_id', user.id)
                    .eq('badge_target', target)
                    .eq('is_read', false);
            }

            // 로컬 상태 즉시 업데이트
            setBadges((prev) => ({
                ...prev,
                [target]: 0,
                total: Math.max(0, prev.total - prev[target]),
            }));
        } catch (err) {
            console.error('[useInAppBadge] Mark as read exception:', err);
        }
    }, [supabase]);

    // 초기 로드
    useEffect(() => {
        fetchBadges();
    }, [fetchBadges]);

    // 실시간 구독 (선택 사항)
    useEffect(() => {
        const channel = supabase
            .channel('badge-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'in_app_badges',
                },
                () => {
                    // 변경 시 배지 다시 조회
                    fetchBadges();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchBadges]);

    return {
        badges,
        loading,
        fetchBadges,
        markAsRead,
    };
}
