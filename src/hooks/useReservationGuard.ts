'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
    IS_RESERVATION_LOCKED,
    ALLOWED_RESERVATION_EMAILS,
    RESERVATION_LOCK_MESSAGE
} from '@/constants/reservationGuard';

export function useReservationGuard() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAllowed, setIsAllowed] = useState(false);
    const hasAlertedRef = useRef(false);

    useEffect(() => {
        // 1. 방어 스위치가 꺼져있으면 즉시 모든 사용자 허용
        if (!IS_RESERVATION_LOCKED) {
            setIsAllowed(true);
            setIsLoading(false);
            return;
        }

        const checkPermission = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user && user.email) {
                    const userEmail = user.email.toLowerCase().trim();
                    const isExplicitAllowed = ALLOWED_RESERVATION_EMAILS.some(
                        email => email.toLowerCase().trim() === userEmail
                    );

                    if (isExplicitAllowed) {
                        setIsAllowed(true);
                        setIsLoading(false);
                        return;
                    }

                    // 관리자(admin) 여부 DB 프로필 확인
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (profile && (profile.role === 'admin' || (profile as Record<string, unknown>).is_admin === true)) {
                        setIsAllowed(true);
                        setIsLoading(false);
                        return;
                    }
                }

                // 허용 대상이 아닌 경우 차단 처리
                if (!hasAlertedRef.current) {
                    hasAlertedRef.current = true;
                    alert(RESERVATION_LOCK_MESSAGE);
                    router.replace('/');
                }
                setIsAllowed(false);
            } catch (error) {
                console.error('Reservation guard check failed:', error);
                if (!hasAlertedRef.current) {
                    hasAlertedRef.current = true;
                    alert(RESERVATION_LOCK_MESSAGE);
                    router.replace('/');
                }
                setIsAllowed(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkPermission();
    }, [router]);

    return { isLoading, isAllowed };
}
