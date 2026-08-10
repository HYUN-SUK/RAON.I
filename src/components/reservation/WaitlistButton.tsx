'use client';

/**
 * 빈자리 알림 신청 버튼
 * 사용자가 특정 날짜에 빈자리 알림을 신청
 */

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { usePushNotification } from '@/hooks/usePushNotification';
import PushPermissionPrompt from '@/components/permission/PushPermissionPrompt';

interface WaitlistButtonProps {
    targetDate: string; // YYYY-MM-DD
    siteId?: string;    // 특정 사이트만 원할 경우
    siteName?: string;
}

export default function WaitlistButton({ targetDate, siteId, siteName }: WaitlistButtonProps) {
    const [loading, setLoading] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [showPushPrompt, setShowPushPrompt] = useState(false);
    const { requestPermission } = usePushNotification();
    const supabase = createClient();

    // 초기 상태 확인
    useEffect(() => {
        const checkRegistration = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const query = supabase
                .from('waitlist')
                .select('id')
                .eq('user_id', user.id)
                .eq('target_date', targetDate);

            if (siteId) {
                query.eq('site_id', siteId);
            } else {
                query.is('site_id', null);
            }

            const { data } = await query.maybeSingle();
            if (data) {
                setIsRegistered(true);
            }
        };

        checkRegistration();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetDate, siteId]);

    // 대기 신청 실제 처리 로직
    const executeRegister = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('로그인이 필요합니다.');
                return;
            }

            const { error } = await supabase.from('waitlist').insert({
                user_id: user.id,
                target_date: targetDate,
                site_id: siteId || null,
            });

            if (error) {
                if (error.code === '23505') {
                    // Unique constraint violation - 이미 등록됨
                    toast.info('이미 빈자리 알림을 신청하셨어요.');
                    setIsRegistered(true);
                } else {
                    console.error('[Waitlist] Insert error:', error);
                    toast.error('알림 신청에 실패했습니다.');
                }
                return;
            }

            setIsRegistered(true);
            toast.success('빈자리가 나면 알려드릴게요!');
        } catch (err) {
            console.error('[Waitlist] Exception:', err);
            toast.error('오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 대기 신청 분기 핸들러
    const handleRegister = async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted') {
                setShowPushPrompt(true);
                return;
            }
        }
        await executeRegister();
    };

    // 대기 취소
    const handleCancel = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const query = supabase
                .from('waitlist')
                .delete()
                .eq('user_id', user.id)
                .eq('target_date', targetDate);

            if (siteId) {
                query.eq('site_id', siteId);
            }

            await query;

            setIsRegistered(false);
            toast.success('빈자리 알림이 취소되었습니다.');
        } catch (err) {
            console.error('[Waitlist] Cancel exception:', err);
        } finally {
            setLoading(false);
        }
    };

    if (isRegistered) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={loading}
                className="gap-2 bg-stone-100 text-stone-500 border-stone-300"
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <BellOff className="w-4 h-4" />
                )}
                알림 신청됨
            </Button>
        );
    }

    return (
        <>
            <Button
                size="sm"
                onClick={handleRegister}
                disabled={loading}
                className="gap-1.5 bg-[#1C4526] text-white shadow-md hover:bg-[#153d1f] hover:shadow-lg transition-all duration-300 animate-pulse hover:animate-none text-xs px-3 py-1.5"
            >
                {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <Bell className="w-3.5 h-3.5" />
                )}
                빈자리 알림
            </Button>

            <PushPermissionPrompt
                isOpen={showPushPrompt}
                onAccept={async () => {
                    setShowPushPrompt(false);
                    await requestPermission();
                    await executeRegister();
                }}
                onDismiss={async () => {
                    setShowPushPrompt(false);
                    toast.info('알림이 거부되어 빈자리가 발생해도 알림 메시지를 수신하지 못할 수 있습니다.');
                    await executeRegister();
                }}
            />
        </>
    );
}
