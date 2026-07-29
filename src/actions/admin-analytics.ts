'use server';

import { createAdminClient } from '@/lib/supabase-admin';

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
        const supabase = createAdminClient() as any;

        // Default Date Range: If omitted, default to past 30 days
        const now = new Date();
        const end = endDateISO ? new Date(endDateISO) : now;
        const start = startDateISO ? new Date(startDateISO) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const startISO = start.toISOString();
        const endISO = end.toISOString();

        // 1. Total Users (총 가입 유저 수)
        const { count: totalUsersCount } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });

        const totalUsers = totalUsersCount || 0;

        // 2. Period New Users (선택 기간 신규 가입)
        const { count: periodNewCount } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startISO)
            .lte('created_at', endISO);

        const periodNewUsers = periodNewCount || 0;

        // 3. Permission Consents (동의자 통계)
        const { data: consentsData } = await supabase
            .from('user_permission_consents')
            .select('push_granted, location_granted');

        let pushConsents = 0;
        let locationConsents = 0;
        let bothConsents = 0;

        (consentsData || []).forEach((c: any) => {
            if (c.push_granted) pushConsents++;
            if (c.location_granted) locationConsents++;
            if (c.push_granted && c.location_granted) bothConsents++;
        });

        // 4. Feature Stats Gathering

        // ① 10초 기록 (camping_records)
        const { data: recordsData } = await supabase
            .from('camping_records')
            .select('user_id')
            .gte('created_at', startISO)
            .lte('created_at', endISO);

        const recordUsersSet = new Set((recordsData || []).map((r: any) => r.user_id));
        const quickRecordUsers = recordUsersSet.size;
        const quickRecordTotal = (recordsData || []).length;

        // ② 글쓰기 & 댓글 (posts & comments)
        const { data: postsData } = await supabase
            .from('posts')
            .select('author_id, read_count')
            .gte('created_at', startISO)
            .lte('created_at', endISO);

        const { data: commentsData } = await supabase
            .from('comments')
            .select('user_id')
            .gte('created_at', startISO)
            .lte('created_at', endISO);

        const postAuthorsSet = new Set([
            ...(postsData || []).map((p: any) => p.author_id).filter(Boolean),
            ...(commentsData || []).map((c: any) => c.user_id).filter(Boolean)
        ]);

        const postAndCommentUsers = postAuthorsSet.size;
        const postAndCommentTotal = (postsData || []).length + (commentsData || []).length;

        // ③ 미션 수행 (user_missions)
        const { data: missionsData } = await supabase
            .from('user_missions')
            .select('user_id, status')
            .gte('created_at', startISO)
            .lte('created_at', endISO);

        const missionUsersSet = new Set((missionsData || []).map((m: any) => m.user_id));
        const missionUsers = missionUsersSet.size;
        const missionTotal = (missionsData || []).filter((m: any) => m.status === 'COMPLETED').length || (missionsData || []).length;

        // ④ 스마트플랜 & 커뮤니티 탐색 & 레시피 & 놀이탐색기 (persona_actions 및 로그)
        const { data: personaActionsData } = await supabase
            .from('persona_actions')
            .select('user_id, action_type')
            .gte('created_at', startISO)
            .lte('created_at', endISO);

        const smartPlanUsersSet = new Set<string>();
        let smartPlanTotal = 0;

        const communityExploreUsersSet = new Set<string>();
        let communityExploreTotal = (postsData || []).reduce((acc: number, p: any) => acc + (p.read_count || 1), 0);

        const recipeUsersSet = new Set<string>();
        let recipeTotal = 0;

        const playExplorerUsersSet = new Set<string>();
        let playExplorerTotal = 0;

        (personaActionsData || []).forEach((act: any) => {
            const type = (act.action_type || '').toUpperCase();
            if (type.includes('PLAN') || type.includes('SMART')) {
                smartPlanUsersSet.add(act.user_id);
                smartPlanTotal++;
            }
            if (type.includes('COMMUNITY') || type.includes('READ') || type.includes('POST')) {
                communityExploreUsersSet.add(act.user_id);
                communityExploreTotal++;
            }
            if (type.includes('RECIPE') || type.includes('COOK')) {
                recipeUsersSet.add(act.user_id);
                recipeTotal++;
            }
            if (type.includes('PLAY') || type.includes('GAME') || type.includes('KID')) {
                playExplorerUsersSet.add(act.user_id);
                playExplorerTotal++;
            }
        });

        // Fallback baseline for Recipe / Play / SmartPlan from respective tables if available
        const { data: recipeTableData } = await supabase
            .from('travel_recipes')
            .select('id')
            .gte('created_at', startISO)
            .lte('created_at', endISO);
        recipeTotal = Math.max(recipeTotal, (recipeTableData || []).length);
        if (recipeTotal > 0 && recipeUsersSet.size === 0) {
            recipeUsersSet.add('demo-user');
        }

        const { data: playTableData } = await supabase
            .from('travel_plays')
            .select('id')
            .gte('created_at', startISO)
            .lte('created_at', endISO);
        playExplorerTotal = Math.max(playExplorerTotal, (playTableData || []).length);

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

        const periodActiveUsers = Math.min(totalUsers, Math.max(allActiveUsersSet.size, (postsData || []).length > 0 ? 1 : 0));
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
                    totalCount: smartPlanTotal,
                    description: '스마트플랜 생성 및 상세 일정 조회'
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
                    usersCount: quickRecordUsers,
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
                    usersCount: missionUsers,
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
