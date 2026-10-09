'use client';

/**
 * 빈자리 알림 신청 버튼
 * 사용자가 특정 날짜에 빈자리 알림을 신청
 */

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePushNotification } from '@/hooks/usePushNotification';
import PushPermissionPrompt from '@/components/permission/PushPermissionPrompt';
import {
    checkWaitlistStatusAction,
    registerWaitlistAction,
    cancelWaitlistAction
} from '@/actions/waitlist-actions';

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

    // 초기 상태 확인 (Server Action을 통한 안전 조회)
    useEffect(() => {
        let isMounted = true;
        const checkRegistration = async () => {
            const res = await checkWaitlistStatusAction(targetDate, siteId);
            if (isMounted) {
                setIsRegistered(res.isRegistered);
            }
        };

        checkRegistration();
        return () => { isMounted = false; };
    }, [targetDate, siteId]);

    // 대기 신청 실제 처리 로직 (Server Action: Service Role 기반 100% 안전 Upsert)
    const executeRegister = async () => {
        setLoading(true);
        try {
            const res = await registerWaitlistAction(targetDate, siteId);
            if (res.success) {
                setIsRegistered(true);
                toast.success('빈자리가 나면 알려드릴게요!');
            } else {
                toast.error(res.error || '알림 신청에 실패했습니다.');
            }
        } catch (err: any) {
            console.error('[Waitlist] Exception:', err);
            toast.error(err?.message || '오류가 발생했습니다.');
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

    // 대기 취소 (Server Action을 통한 안전 삭제)
    const handleCancel = async () => {
        setLoading(true);
        try {
            const res = await cancelWaitlistAction(targetDate, siteId);
            if (res.success) {
                setIsRegistered(false);
                toast.success('빈자리 알림이 취소되었습니다.');
            } else {
                toast.error(res.error || '알림 취소에 실패했습니다.');
            }
        } catch (err: any) {
            console.error('[Waitlist] Cancel exception:', err);
            toast.error(err?.message || '취소 처리에 실패했습니다.');
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
                className="gap-1.5 bg-[#388E5A] text-white shadow-md hover:bg-[#2F774B] hover:shadow-lg transition-all duration-300 animate-pulse hover:animate-none text-xs px-3 py-1.5"
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
