export type CreatorContentType = 'LIVE' | 'NOVEL' | 'WEBTOON' | 'ESSAY' | 'ALBUM';
export type CreatorContentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN';
export type CreatorContentVisibility = 'PUBLIC' | 'PRIVATE';

export interface Creator {
    id: string; // matches auth.users.id
    nickname: string | null;
    profile_image_url: string | null;
    bio: string | null;
    region: string | null;
    portfolio_links: any[]; // JSONB
    follower_count: number;
    created_at: string;
    updated_at: string;
    is_followed?: boolean; // UI helper
}

export interface CreatorContent {
    id: string;
    creator_id: string;
    type: CreatorContentType;
    title: string;
    cover_image_url: string | null;
    description: string | null;
    tags: string[];
    status: CreatorContentStatus;
    visibility: CreatorContentVisibility;
    published_at: string | null;

    // Counts (from DB triggers/columns)
    like_count: number;
    comment_count: number;

    created_at: string;
    updated_at: string;

    // UI helpers (fetched separately or joined)
    is_liked?: boolean;
}

export interface CreatorEpisode {
    id: string;
    content_id: string;
    episode_no: number;
    title: string;
    thumbnail_url: string | null;
    body_ref: any; // JSONB
    status: CreatorContentStatus;
    visibility: CreatorContentVisibility;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreatorComment {
    id: string;
    content_id: string;
    user_id: string;
    content: string;
    created_at: string;

    // Join / UI helpers
    user_email?: string; // from auth.users join (needs view or rpc) or client side fetch
    is_mine?: boolean;
}

export interface CreateContentDTO {
    type: CreatorContentType;
    title: string;
    cover_image_url?: string;
    description?: string;
    tags?: string[];
    visibility?: CreatorContentVisibility;
}

export interface CreateEpisodeDTO {
    content_id: string;
    episode_no: number;
    title: string;
    thumbnail_url?: string;
    body_ref: any;
    visibility?: CreatorContentVisibility;
}
