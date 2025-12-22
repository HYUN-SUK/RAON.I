export type MissionType = 'PHOTO' | 'CHECKIN' | 'COMMUNITY';
export type MissionStatus = 'PARTICIPATING' | 'COMPLETED' | 'CLAIMED';

export interface Mission {
    id: string;
    title: string;
    description: string;
    mission_type: MissionType;
    start_date: string;
    end_date: string;
    reward_xp: number;
    reward_point: number;
    is_active: boolean;
    community_post_id?: string;
    created_at: string;
}

export interface UserMission {
    id: string;
    user_id: string;
    mission_id: string;
    content?: string;
    image_url?: string;
    status: MissionStatus;
    completed_at?: string;
    created_at: string;
}

export interface MissionWithStatus extends Mission {
    user_status?: MissionStatus;
}
