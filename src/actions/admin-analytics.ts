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

export interface AdminAnalyticsData {
    totalUsers: number;             // 총 가입 유저 수
    periodNewUsers: number;         // 선택 기간 신규 가입 유저 수
    periodActiveUsers: number;      // 선택 기간 접속/활동 유저 수
    inactiveUsers: number;          // 선택 기간 기능 미활용/휴면 유저 수
    pushConsents: number;           // 푸시 동의자 수
    locationConsents: number;       // 위치 동의자 수
    bothConsents: number;           // 푸시+위치 100% 동의자 수
    features: {
        smartPlan: FeatureStat;
        communityExplore: FeatureStat;
        quickRecord: FeatureStat;
        postAndComment: FeatureStat;
        mission: FeatureStat;
        recipe: FeatureStat;
        playExplorer: FeatureStat;
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

        // 3. Feature Stats (Independent Safe Queries)

        // ① 스마트플랜 (reservations + camping_records)
        const smartPlanUsersSet = new Set<string>();
        let smartPlanTotal = 0;
        try {
            const { data: resData } = await supabase
                .from('reservations')
                .select('user_id')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (resData || []).forEach((r: any) => {
                if (r.user_id) smartPlanUsersSet.add(r.user_id);
            });
            smartPlanTotal += (resData || []).length;
        } catch (e) {
            console.error('[Analytics] smartPlan query failed:', e);
        }

        // ② 커뮤니티 소식 탐색 (posts + comments)
        const communityExploreUsersSet = new Set<string>();
        let communityExploreTotal = 0;
        let postsData: any[] = [];
        let commentsData: any[] = [];
        try {
            const { data: pData } = await supabase
                .from('posts')
                .select('author_id, read_count')
                .gte('created_at', startISO)
                .lte('created_at', endISO);
            postsData = pData || [];

            (postsData || []).forEach((p: any) => {
                if (p.author_id) communityExploreUsersSet.add(p.author_id);
                communityExploreTotal += (p.read_count || 1);
            });

            const { data: cData } = await supabase
                .from('comments')
                .select('user_id')
                .gte('created_at', startISO)
                .lte('created_at', endISO);
            commentsData = cData || [];

            (commentsData || []).forEach((c: any) => {
                if (c.user_id) communityExploreUsersSet.add(c.user_id);
            });
        } catch (e) {
            console.error('[Analytics] communityExplore query failed:', e);
        }

        // ③ 10초 기록 (camping_records)
        const recordUsersSet = new Set<string>();
        let quickRecordTotal = 0;
        try {
            const { data: recordsData } = await supabase
                .from('camping_records')
                .select('user_id')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (recordsData || []).forEach((r: any) => {
                if (r.user_id) {
                    recordUsersSet.add(r.user_id);
                    smartPlanUsersSet.add(r.user_id); // Records also view smart plan facts
                }
            });
            quickRecordTotal = (recordsData || []).length;
        } catch (e) {
            console.error('[Analytics] camping_records query failed:', e);
        }

        // ④ 글쓰기 & 댓글 소통 (posts + comments)
        const postAuthorsSet = new Set([
            ...postsData.map((p: any) => p.author_id).filter(Boolean),
            ...commentsData.map((c: any) => c.user_id).filter(Boolean)
        ]);
        const postAndCommentUsers = postAuthorsSet.size;
        const postAndCommentTotal = postsData.length + commentsData.length;

        // ⑤ 미션 인증 수행 (user_missions)
        const missionUsersSet = new Set<string>();
        let missionTotal = 0;
        try {
            const { data: missionsData } = await supabase
                .from('user_missions')
                .select('user_id, status')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (missionsData || []).forEach((m: any) => {
                if (m.user_id) missionUsersSet.add(m.user_id);
            });
            missionTotal = (missionsData || []).filter((m: any) => m.status === 'COMPLETED').length || (missionsData || []).length;
        } catch (e) {
            console.error('[Analytics] user_missions query failed:', e);
        }

        // ⑥ 캠핑 요리 레시피 탐색 (travel_recipes)
        const recipeUsersSet = new Set<string>();
        let recipeTotal = 0;
        try {
            const { data: recipeData } = await supabase
                .from('travel_recipes')
                .select('author_id')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (recipeData || []).forEach((r: any) => {
                if (r.author_id) recipeUsersSet.add(r.author_id);
            });
            recipeTotal = (recipeData || []).length;
        } catch (e) {
            console.error('[Analytics] travel_recipes query failed:', e);
        }

        // ⑦ 아이 놀이 탐색기 이용 (travel_plays)
        const playExplorerUsersSet = new Set<string>();
        let playExplorerTotal = 0;
        try {
            const { data: playData } = await supabase
                .from('travel_plays')
                .select('author_id')
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            (playData || []).forEach((p: any) => {
                if (p.author_id) playExplorerUsersSet.add(p.author_id);
            });
            playExplorerTotal = (playData || []).length;
        } catch (e) {
            console.error('[Analytics] travel_plays query failed:', e);
        }

        // Overall active users in period
        const allActiveUsersSet = new Set([
            ...recordUsersSet,
            ...postAuthorsSet,
            ...missionUsersSet,
            ...smartPlanUsersSet,
            ...communityExploreUsersSet,
            ...recipeUsersSet,
            ...playExplorerUsersSet
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
            features: {
                smartPlan: {
                    name: '스마트플랜',
                    iconKey: 'Map',
                    usersCount: smartPlanUsersSet.size,
                    totalCount: Math.max(smartPlanTotal, smartPlanUsersSet.size),
                    description: '스마트플랜 자동 캐싱 및 일정 연동'
                },
                communityExplore: {
                    name: '커뮤니티 소식 탐색',
                    iconKey: 'Compass',
                    usersCount: communityExploreUsersSet.size,
                    totalCount: communityExploreTotal,
                    description: '캠핑장 소식 및 이야기 피드 읽기'
                },
                quickRecord: {
                    name: '10초 기록 (나만의 지도)',
                    iconKey: 'Camera',
                    usersCount: recordUsersSet.size,
                    totalCount: quickRecordTotal,
                    description: '캠핑 다녀온 소중한 추억 핀 등록'
                },
                postAndComment: {
                    name: '글쓰기 & 댓글 소통',
                    iconKey: 'MessageSquare',
                    usersCount: postAndCommentUsers,
                    totalCount: postAndCommentTotal,
                    description: '게시글 및 댓글 작성으로 소통'
                },
                mission: {
                    name: '미션 인증 수행',
                    iconKey: 'Flag',
                    usersCount: missionUsersSet.size,
                    totalCount: missionTotal,
                    description: '주간 미션 및 특별 미션 인증 완료'
                },
                recipe: {
                    name: '캠핑 요리 레시피 탐색',
                    iconKey: 'Utensils',
                    usersCount: recipeUsersSet.size,
                    totalCount: recipeTotal,
                    description: '맛있는 캠핑 레시피 검색 및 둘러보기'
                },
                playExplorer: {
                    name: '아이 놀이 탐색기 이용',
                    iconKey: 'Gamepad2',
                    usersCount: playExplorerUsersSet.size,
                    totalCount: playExplorerTotal,
                    description: '아이와 함께하는 놀이 콘텐츠 검색'
                }
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

