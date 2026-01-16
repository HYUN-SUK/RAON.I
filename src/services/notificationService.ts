/**
 * 알림 발송 서비스
 * 조용시간 로직 + 푸시/배지 분기 처리
 */

import { createClient } from '@/lib/supabase-client';
import {
    NotificationEventType,
    NotificationEventConfig,
    NOTIFICATION_EVENT_CONFIGS,
    renderTemplate,
    BadgeTarget,
} from '@/types/notificationEvents';

// ========================================
// 알림 서비스 클래스
// ========================================
export class NotificationService {
    private supabase = createClient();

    // ========================================
    // 조용시간 체크 (22:00 ~ 08:00 KST)
    // ========================================
    isQuietHours(): boolean {
        const now = new Date();
        // KST = UTC + 9
        const kstHours = (now.getUTCHours() + 9) % 24;
        return kstHours >= 22 || kstHours < 8;
    }

    // ========================================
    // 메인 알림 발송 로직
    // ========================================
    async dispatchNotification(
        eventType: NotificationEventType,
        userId: string,
        data: Record<string, string> = {},
        relatedId?: string
    ): Promise<{ success: boolean; method: 'push' | 'badge' | 'none'; message?: string }> {
        const config = NOTIFICATION_EVENT_CONFIGS[eventType];

        if (!config) {
            console.error(`[NotificationService] Unknown event type: ${eventType}`);
            return { success: false, method: 'none', message: 'Unknown event type' };
        }

        const title = renderTemplate(config.title_template, data);
        const body = renderTemplate(config.body_template, data);

        // 1. 푸시 금지 이벤트 → 배지만 생성
        if (!config.requires_push) {
            await this.createInAppBadge(userId, config.badge_target, eventType, title, body, relatedId);
            return { success: true, method: 'badge' };
        }

        // 2. 조용시간 체크
        if (this.isQuietHours() && !config.quiet_hours_override) {
            // 조용시간 + 예외 아님 → 배지로 대체
            await this.createInAppBadge(userId, config.badge_target, eventType, title, body, relatedId);
            return { success: true, method: 'badge', message: 'Quiet hours - badge fallback' };
        }

        // 3. 푸시 발송 시도
        // userId가 UUID 형식이 아닌 경우(게스트) 푸시 발송 스킵
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            console.warn(`[NotificationService] userId is not a UUID (Guest?): ${userId} - Skip Push`);
            return { success: false, method: 'none', message: 'Guest user (No UUID)' };
        }

        const pushResult = await this.sendPush(userId, config, title, body, data);

        // 4. 푸시 성공 여부와 관계없이 fallback 배지 생성
        if (config.fallback_badge) {
            await this.createInAppBadge(userId, config.badge_target, eventType, title, body, relatedId);
        }

        return {
            success: pushResult.success,
            method: 'push',
            message: pushResult.message,
        };
    }

    // ========================================
    // 푸시 발송 (notifications 테이블에 큐잉 + Edge Function 호출)
    // ========================================
    private async sendPush(
        userId: string,
        config: NotificationEventConfig,
        title: string,
        body: string,
        data: Record<string, string>
    ): Promise<{ success: boolean; message?: string }> {
        try {
            // 1. DB Insert (Queue)
            const { data: insertedData, error } = await this.supabase
                .from('notifications')
                .insert({
                    user_id: userId,
                    category: this.getCategoryFromEvent(config.type),
                    event_type: config.type,
                    title,
                    body,
                    data,
                    quiet_hours_override: config.quiet_hours_override,
                    status: 'queued',
                })
                .select()
                .single();

            if (error) {
                console.error('[NotificationService] Push queue error:', error);
                return { success: false, message: error.message };
            }

            // 2. Edge Function 직접 호출 (Webhook 대용)
            // Fire & Forget 방식으로 호출하여 클라이언트 응답 속도 저하 방지
            // 단, 에러 로깅을 위해 catch 블록 추가
            this.supabase.functions.invoke('push-notification', {
                body: { record: insertedData }
            }).then(({ data: funcData, error: funcError }) => {
                if (funcError) {
                    console.error('[NotificationService] Edge Function error:', funcError);
                }
            });

            return { success: true };
        } catch (err) {
            console.error('[NotificationService] Push exception:', err);
            return { success: false, message: 'Exception occurred' };
        }
    }

    // ========================================
    // 인앱 배지 생성
    // ========================================
    async createInAppBadge(
        userId: string,
        target: BadgeTarget,
        eventType: NotificationEventType,
        title: string,
        body: string,
        relatedId?: string
    ): Promise<boolean> {
        if (!target) return false;

        try {
            const { error } = await this.supabase.from('in_app_badges').insert({
                user_id: userId,
                badge_target: target,
                event_type: eventType,
                title,
                body,
                related_id: relatedId || null,
                is_read: false,
            });

            if (error) {
                console.error('[NotificationService] Badge creation error:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('[NotificationService] Badge exception:', err);
            return false;
        }
    }

    // ========================================
    // 이벤트 타입 → 카테고리 매핑
    // ========================================
    private getCategoryFromEvent(eventType: NotificationEventType): string {
        if (eventType.startsWith('reservation') || eventType.startsWith('deposit') || eventType.startsWith('upcoming') || eventType.startsWith('waitlist')) {
            return 'reservation';
        }
        if (eventType.startsWith('community')) {
            return 'community';
        }
        if (eventType.startsWith('mission')) {
            return 'mission';
        }
        if (eventType.startsWith('order')) {
            return 'market';
        }
        if (eventType.startsWith('ember')) {
            return 'ember';
        }
        return 'system';
    }
}

// ========================================
// 싱글톤 인스턴스
// ========================================
export const notificationService = new NotificationService();
