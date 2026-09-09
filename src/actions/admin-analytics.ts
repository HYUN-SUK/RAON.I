'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { assertAdmin } from '@/lib/auth-guard';

export interface FeatureStat {
    name: string;
    iconKey: string;
    usersCount: number;  // 이용 유저 수 (명)
    totalCount: number;  // 누적 사용/생성 횟수 (건/회)
    description: string;
}

export interface InstantPlanStat extends FeatureStat {
    nearbyCount: number;       // 내 주변 생성 수
    destCount: number;         // 목적지 생성 수
    guestCount: number;        // 비로그인 이용 건수
    memberCount: number;       // 회원 이용 건수
    convertedCount: number;    // 내 일정 저장(전환) 건수
    conversionRate: number;    // 전환율 (%)
}

export interface SiteVisitStat {
    totalPv: number;           // 총 페이지뷰 (PV)
    totalUv: number;           // 순 방문자 (UV)
}

export interface AdminAnalyticsData {
    totalUsers: number;             // 총 가입 유저 수
    periodNewUsers: number;         // 선택 기간 신규 가입 유저 수
    periodActiveUsers: number;      // 선택 기간 접속/활동 유저 수
    inactiveUsers: number;          // 선택 기간 기능 미활용/휴면 유저 수
    pushConsents: number;           // 푸시 동의자 수
    locationConsents: number;       // 위치 동의자 수
    bothConsents: number;           // 푸시+위치 100% 동의자 수
    siteVisits: SiteVisitStat;      // [신설] 사이트 방문 현황 (PV / UV)
    features: {
        instantPlan: InstantPlanStat;  // [신설] 즉시 여행계획 (내 주변 / 목적지)
        smartPlan: FeatureStat;        // [정규화] 정밀 스마트플랜 (허수 박멸)
        quickRecord: FeatureStat;      // [유지] 10초 기록 (나만의 지도)
        postAndComment: FeatureStat;   // [유지] 글쓰기 & 댓글 소통
        mission: FeatureStat;          // [유지] 오늘의 미션 수행
    };
}

export async function getAdminAnalyticsAction(
    startDateISO?: string,
    endDateISO?: string
): Promise<{ success: boolean; data?: AdminAnalyticsData; error?: string }> {
    try {
        await assertAdmin();
        const supabase = createAdminClient() as any;

        // Default Date Range: If omitted, default to past 30 days
        const now = new Date();
        const end = endDateISO ? new Date(endDateISO) : now;
        const start = startDateISO ? new Date(startDateISO) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const startISO = start.toISOString();
        const endISO = end.toISOString();

        // 1. Total Users & Period New Users (profiles)
        let totalUsers = 0;
        let periodNewUsers = 0;
        try {
            const { count: tCount } = await supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true });
            totalUsers = tCount || 0;

            const { count: pCount } = await supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', startISO)
                .lte('created_at', endISO);
            periodNewUsers = pCount || 0;
        } catch (e) {
            console.error('[Analytics] profiles query failed:', e);
        }

        // 2. Permission Consents (user_permission_consents)
        let pushConsents = 0;
        let locationConsents = 0;
        let bothConsents = 0;
        try {
            const { data: consentsData } = await supabase
                .from('user_permission_consents')
                .select('push_granted, location_granted');

            (consentsData || []).forEach((c: any) => {
                if (c.push_granted) pushConsents++;
                if (c.location_granted) locationConsents++;
                if (c.push_granted && c.location_granted) bothConsents++;
            });
        } catch (e) {
            console.error('[Analytics] consents query failed:', e);
        }

        // 2.5 Internal Accounts Detection (Exclude internal test accounts: tootg, wlgustns19, admin)
        const internalUserIds = new Set<string>();
        try {
            const { data: internalProfiles } = await supabase
                .from('profiles')
                .select('id')
                .or('email.ilike.%tootg%,email.ilike.%wlgustns%,email.ilike.%admin%,is_admin.eq.true');
            (internalProfiles || []).forEach((p: any) => {
                if (p.id) internalUserIds.add(p.id);
            });
        } catch (e) {
            console.warn('[Analytics] Failed to fetch internal profiles:', e);
        }

        // 3. Feature Stats (Independent Safe Queries)

        // ★ [신설] 사이트 방문 현황 (PV / UV) (user_action_log where action_type = 'SITE_VISIT')
        let totalPv = 0;
        const uvSet = new Set<string>();
        try {
            const { data: visitLogs } = await supabase
                .from('user_action_log')
                .select('entity_id, user_id')
                .eq('action_type', 'SITE_VISIT')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (visitLogs || []).forEach((v: any) => {
                totalPv++;
                const key = v.entity_id || v.user_id;
                if (key) uvSet.add(key);
            });
        } catch (e) {
            console.warn('[Analytics] site_visit logs query warning:', e);
        }

        // ① [신설] 즉시 여행계획 (user_action_log: INSTANT_PLAN_GENERATE & INSTANT_PLAN_CONVERT)
        let instantPlanTotal = 0;
        let instantNearbyCount = 0;
        let instantDestCount = 0;
        let instantGuestCount = 0;
        const instantMemberUsersSet = new Set<string>();
        let instantConvertedCount = 0;

        try {
            // 1) 플랜 생성 로그
            const { data: genLogs } = await supabase
                .from('user_action_log')
                .select('user_id, raw_metadata')
                .eq('action_type', 'INSTANT_PLAN_GENERATE')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (genLogs || []).forEach((g: any) => {
                instantPlanTotal++;
                const mode = g.raw_metadata?.mode;
                if (mode === 'nearby') instantNearbyCount++;
                else instantDestCount++;

                if (g.user_id && !internalUserIds.has(g.user_id)) {
                    instantMemberUsersSet.add(g.user_id);
                } else if (!g.user_id) {
                    instantGuestCount++;
                }
            });

            // 2) 내 일정 저장(전환) 로그
            const { data: convLogs } = await supabase
                .from('user_action_log')
                .select('entity_id, user_id')
                .eq('action_type', 'INSTANT_PLAN_CONVERT')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (convLogs || []).forEach((c: any) => {
                if (!c.user_id || !internalUserIds.has(c.user_id)) {
                    instantConvertedCount++;
                }
            });
        } catch (e) {
            console.warn('[Analytics] instant plan logs query warning:', e);
        }

        const instantConversionRate = instantPlanTotal > 0
            ? Math.min(100, Math.round((instantConvertedCount / instantPlanTotal) * 1000) / 10)
            : 0;

        // ② [정규화] 정밀 스마트플랜 (순수 user_schedules.smart_plan_data IS NOT NULL만 집계 - 허수 완전 박멸!)
        const smartPlanUsersSet = new Set<string>();
        let smartPlanTotal = 0;
        try {
            const { data: schedData } = await supabase
                .from('user_schedules')
                .select('user_id, smart_plan_data')
                .not('smart_plan_data', 'is', null)
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (schedData || []).forEach((s: any) => {
                if (s.user_id && !internalUserIds.has(s.user_id)) {
                    smartPlanUsersSet.add(s.user_id);
                    smartPlanTotal++;
                }
            });
        } catch (e) {
            console.error('[Analytics] smartPlan query failed:', e);
        }

        // ③ [유지] 10초 기록 (camping_records 실데이터 - 피드백 장소 혼입 없음)
        const recordUsersSet = new Set<string>();
        let quickRecordTotal = 0;
        try {
            const { data: recordsData } = await supabase
                .from('camping_records')
                .select('user_id')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (recordsData || []).forEach((r: any) => {
                if (r.user_id && !internalUserIds.has(r.user_id)) {
                    recordUsersSet.add(r.user_id);
                    quickRecordTotal++;
                }
            });
        } catch (e) {
            console.error('[Analytics] camping_records query failed:', e);
        }

        // ④ [유지] 글쓰기 & 댓글 소통 (posts + comments)
        let postsData: any[] = [];
        let commentsData: any[] = [];
        try {
            const { data: pData } = await supabase
                .from('posts')
                .select('author_id')
                .gte('created_at', startISO)
                .lte('created_at', endISO);
            postsData = (pData || []).filter((p: any) => !internalUserIds.has(p.author_id));

            const { data: cData } = await supabase
                .from('comments')
                .select('user_id')
                .gte('created_at', startISO)
                .lte('created_at', endISO);
            commentsData = (cData || []).filter((c: any) => !internalUserIds.has(c.user_id));
        } catch (e) {
            console.error('[Analytics] posts/comments query failed:', e);
        }

        const postAuthorsSet = new Set([
            ...postsData.map((p: any) => p.author_id).filter(Boolean),
            ...commentsData.map((c: any) => c.user_id).filter(Boolean)
        ]);
        const postAndCommentUsers = postAuthorsSet.size;
        const postAndCommentTotal = postsData.length + commentsData.length;

        // ⑤ [유지] 오늘의 미션 수행 (user_missions)
        const missionUsersSet = new Set<string>();
        let missionTotal = 0;
        try {
            const { data: missionsData } = await supabase
                .from('user_missions')
                .select('user_id, status')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (missionsData || []).forEach((m: any) => {
                if (m.user_id && !internalUserIds.has(m.user_id)) {
                    missionUsersSet.add(m.user_id);
                    if (m.status === 'COMPLETED') missionTotal++;
                }
            });
            if (missionTotal === 0 && missionsData) {
                missionTotal = (missionsData || []).filter((m: any) => !internalUserIds.has(m.user_id)).length;
            }
        } catch (e) {
            console.error('[Analytics] user_missions query failed:', e);
        }

        // Overall active users in period (정규화된 실활동 유저 합산)
        const allActiveUsersSet = new Set([
            ...recordUsersSet,
            ...postAuthorsSet,
            ...missionUsersSet,
            ...smartPlanUsersSet,
            ...instantMemberUsersSet,
        ]);

        const periodActiveUsers = Math.min(totalUsers, Math.max(allActiveUsersSet.size, periodNewUsers > 0 ? Math.min(periodNewUsers, totalUsers) : 0));
        const inactiveUsers = Math.max(0, totalUsers - periodActiveUsers);

        const analyticsData: AdminAnalyticsData = {
            totalUsers,
            periodNewUsers,
            periodActiveUsers,
            inactiveUsers,
            pushConsents,
            locationConsents,
            bothConsents,
            siteVisits: {
                totalPv,
                totalUv: uvSet.size,
            },
            features: {
                instantPlan: {
                    name: '즉시 여행계획',
                    iconKey: 'Zap',
                    usersCount: instantMemberUsersSet.size,
                    totalCount: instantPlanTotal,
                    nearbyCount: instantNearbyCount,
                    destCount: instantDestCount,
                    guestCount: instantGuestCount,
                    memberCount: instantPlanTotal - instantGuestCount,
                    convertedCount: instantConvertedCount,
                    conversionRate: instantConversionRate,
                    description: '내 주변 및 목적지 즉시 여행계획 생성 및 내 일정 전환'
                },
                smartPlan: {
                    name: '정밀 스마트플랜',
                    iconKey: 'Map',
                    usersCount: smartPlanUsersSet.size,
                    totalCount: smartPlanTotal,
                    description: '내 일정에 등록된 정밀 스마트플랜 자동 생성'
                },
                quickRecord: {
                    name: '10초 기록 (나만의 지도)',
                    iconKey: 'Camera',
                    usersCount: recordUsersSet.size,
                    totalCount: quickRecordTotal,
                    description: '캠핑 다녀온 소중한 추억 핀 등록 (피드백 장소 미포함 순수 기록)'
                },
                postAndComment: {
                    name: '글쓰기 & 댓글 소통',
                    iconKey: 'MessageSquare',
                    usersCount: postAndCommentUsers,
                    totalCount: postAndCommentTotal,
                    description: '커뮤니티 게시글 및 댓글 작성으로 소통'
                },
                mission: {
                    name: '오늘의 미션 수행',
                    iconKey: 'Flag',
                    usersCount: missionUsersSet.size,
                    totalCount: missionTotal,
                    description: '주간 미션 및 특별 미션 인증 완료'
                },
            }
        };

        return { success: true, data: analyticsData };
    } catch (err: any) {
        console.error('[getAdminAnalyticsAction] Error:', err);
        return { success: false, error: err.message || '통계 수집 중 오류가 발생했습니다.' };
    }
}

export interface OpsStatsData {
    todayCheckIns: number;
    pendingCount: number;
    refundPendingCount: number;
    todayPaidAmount: number;
    todayPaidCount: number;
    marketOrders: number;
}

export async function getOpsStatsAction(): Promise<{ success: boolean; data?: OpsStatsData; error?: string }> {
    try {
        await assertAdmin();
        const supabase = createAdminClient() as any;

        // KST 기준 오늘 날짜 (YYYY-MM-DD)
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

        // 1. 오늘 입실 예약 수
        const { count: todayCheckIns } = await supabase
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('check_in_date', todayStr)
            .not('status', 'in', '("CANCELLED","REFUNDED")');

        // 2. 입금 대기 예약 수
        const { count: pendingCount } = await supabase
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'PENDING');

        // 3. 환불 대기 예약 수
        const { count: refundPendingCount } = await supabase
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'REFUND_PENDING');

        // 4. 오늘 결제 완료 건수 및 금액
        const { data: todayPaidList } = await supabase
            .from('reservations')
            .select('total_price')
            .eq('status', 'CONFIRMED')
            .gte('created_at', `${todayStr}T00:00:00.000Z`);

        const todayPaidCount = todayPaidList?.length || 0;
        const todayPaidAmount = (todayPaidList || []).reduce((sum: number, r: any) => sum + (r.total_price || 0), 0);

        // 5. 마켓 주문 대기 수
        const { count: marketOrders } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'PENDING');

        return {
            success: true,
            data: {
                todayCheckIns: todayCheckIns || 0,
                pendingCount: pendingCount || 0,
                refundPendingCount: refundPendingCount || 0,
                todayPaidAmount: todayPaidAmount || 0,
                todayPaidCount: todayPaidCount || 0,
                marketOrders: marketOrders || 0
            }
        };
    } catch (err: any) {
        console.error('[admin-analytics] getOpsStatsAction error:', err);
        return { success: false, error: err?.message || '통계 조회 실패' };
    }
}
