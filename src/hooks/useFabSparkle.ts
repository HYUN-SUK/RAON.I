'use client';

import { useEffect, useState, useCallback } from 'react';
import { hasUnwrittenScheduleRecord } from '@/actions/record';

interface UseFabSparkleResult {
    shouldSparkle: boolean;
    unwrittenScheduleIds: string[];
    refresh: () => Promise<void>;
}

/**
 * FAB 버튼 반짝임 상태를 관리하는 훅
 * - 이용중 또는 완료된 일정 중 1분기록이 미작성된 경우 반짝임
 */
export function useFabSparkle(): UseFabSparkleResult {
    const [shouldSparkle, setShouldSparkle] = useState(false);
    const [unwrittenScheduleIds, setUnwrittenScheduleIds] = useState<string[]>([]);

    const refresh = useCallback(async () => {
        try {
            const result = await hasUnwrittenScheduleRecord();
            setShouldSparkle(result.hasUnwritten);
            setUnwrittenScheduleIds(result.scheduleIds);
        } catch (err) {
            console.error('Failed to check unwritten schedules:', err);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        shouldSparkle,
        unwrittenScheduleIds,
        refresh,
    };
}
