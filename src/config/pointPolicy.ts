export const POINT_POLICY = {
    // Actions
    ACTIONS: {
        LOGIN: { xp: 10, token: 1 },
        WRITE_POST: { xp: 50, token: 5 },
        UPLOAD_PHOTO: { xp: 30, token: 3 },
        // MISSION_COMPLETE is dynamic based on database configuration
    },

    // Leveling (Simple formula or table)
    LEVELS: [
        { level: 1, minXp: 0, title: '초보 캠퍼' },
        { level: 2, minXp: 100, title: '설레는 캠퍼' },
        { level: 3, minXp: 300, title: '익숙한 캠퍼' },
        { level: 4, minXp: 600, title: '즐기는 캠퍼' },
        { level: 5, minXp: 1000, title: '숙련된 캠퍼' },
        { level: 6, minXp: 1500, title: '프로 캠퍼' },
        { level: 7, minXp: 2100, title: '마스터 캠퍼' },
        { level: 8, minXp: 2800, title: '레전드 캠퍼' },
        { level: 9, minXp: 3600, title: '자연의 친구' },
        { level: 10, minXp: 5000, title: '라온의 수호자' },
    ],

    // Token Usage Costs
    USAGE: {
        UNLOCK_PREMIUM_THEME: 100,
        UNLOCK_SEASON_ARCHIVE: 50,
    }
} as const;

export type PointActionType = keyof typeof POINT_POLICY.ACTIONS | 'MISSION_COMPLETE';

export function getLevelInfo(xp: number) {
    const levels = POINT_POLICY.LEVELS;
    for (let i = levels.length - 1; i >= 0; i--) {
        if (xp >= levels[i].minXp) {
            const current = levels[i];
            const next = levels[i + 1] || null;
            return {
                currentLevel: current.level,
                currentTitle: current.title,
                nextLevelXp: next ? next.minXp : null,
                progress: next
                    ? Math.min(100, Math.max(0, ((xp - current.minXp) / (next.minXp - current.minXp)) * 100))
                    : 100
            };
        }
    }
    return { currentLevel: 1, currentTitle: '초보 캠퍼', nextLevelXp: 100, progress: 0 };
}
