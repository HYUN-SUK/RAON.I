'use client';

import { useEffect, useState, useCallback } from 'react';
import { hasUnwrittenScheduleRecord, getScheduleForRecord } from '@/actions/record';

interface UnwrittenScheduleInfo {
    id: string;
    title: string;
    campgroundName?: string;
    campgroundAddress?: string;
    startDate: string;
    endDate: string;
    isRaonai: boolean;
}

interface UseFabSparkleResult {
    shouldSparkle: boolean;
    unwrittenScheduleIds: string[];
    unwrittenScheduleDetail: UnwrittenScheduleInfo | null;
    refresh: () => Promise<void>;
}

/**
 * FAB 버튼 반짝임 상태 및 미작성 리마인더를 관리하는 훅
 * - 이용중 또는 완료된 일정 중 1분기록이 미작성된 경우 반짝임 및 정보 제공
 */
export function useFabSparkle(): UseFabSparkleResult {
    const [shouldSparkle, setShouldSparkle] = useState(false);
    const [unwrittenScheduleIds, setUnwrittenScheduleIds] = useState<string[]>([]);
    const [unwrittenScheduleDetail, setUnwrittenScheduleDetail] = useState<UnwrittenScheduleInfo | null>(null);

    const refresh = useCallback(async () => {
        try {
            const result = await hasUnwrittenScheduleRecord();
            setShouldSparkle(result.hasUnwritten);
            setUnwrittenScheduleIds(result.scheduleIds);

            if (result.hasUnwritten && result.scheduleIds.length > 0) {
                const latestId = result.scheduleIds[0];
                const detail = await getScheduleForRecord(latestId);
                setUnwrittenScheduleDetail(detail);
            } else {
                setUnwrittenScheduleDetail(null);
            }
        } catch (err) {
            console.error('Failed to check unwritten schedules:', err);
            setUnwrittenScheduleDetail(null);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        shouldSparkle,
        unwrittenScheduleIds,
        unwrittenScheduleDetail,
        refresh,
    };
}
