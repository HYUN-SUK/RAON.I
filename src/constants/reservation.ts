
import { addDays, setHours, setMinutes, setSeconds } from 'date-fns';

export const OPEN_DAY_CONFIG = {
    // 2024-2025 Winter Season
    seasonName: "2024-2025 윈터 시즌",
    openAt: new Date('2024-01-01T09:00:00'), // Already open for dev/testing
    // openAt: new Date('2025-01-01T09:00:00'), // Example for future
    closeAt: new Date('2025-12-31T23:59:59'),

    // Next Season Info (For UI Display)
    nextSeasonOpenAt: new Date('2026-01-01T09:00:00'),
    nextSeasonCloseAt: new Date('2026-12-31T23:59:59'),

    // UI Messages
    preOpenTitle: "예약 오픈 예정",
    preOpenMessage: "2024-2025 윈터 시즌 예약이 곧 시작됩니다.",
    closedTitle: "시즌 마감",
    closedMessage: "금번 시즌 예약이 종료되었습니다. 다음 시즌을 기대해주세요!"
};
