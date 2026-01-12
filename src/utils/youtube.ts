/**
 * YouTube/Instagram/TikTok 영상 URL 파싱 유틸리티
 * 데이터 비용 절감을 위한 외부 플랫폼 임베드 지원
 */

import { VideoType } from '@/types/market';

// YouTube 영상 ID 추출 패턴
const YOUTUBE_PATTERNS = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

// Instagram 영상 ID 추출 패턴
const INSTAGRAM_PATTERN = /instagram\.com\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/;

// TikTok 영상 ID 추출 패턴
const TIKTOK_PATTERN = /tiktok\.com\/@[^/]+\/video\/(\d+)/;

/**
 * YouTube 영상 ID 추출
 */
export function extractYouTubeId(url: string): string | null {
    if (!url) return null;

    for (const pattern of YOUTUBE_PATTERNS) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

/**
 * Instagram 영상 ID 추출
 */
export function extractInstagramId(url: string): string | null {
    if (!url) return null;
    const match = url.match(INSTAGRAM_PATTERN);
    return match ? match[1] : null;
}

/**
 * TikTok 영상 ID 추출
 */
export function extractTikTokId(url: string): string | null {
    if (!url) return null;
    const match = url.match(TIKTOK_PATTERN);
    return match ? match[1] : null;
}

/**
 * 영상 플랫폼 타입 감지
 */
export function detectVideoType(url: string): VideoType {
    if (!url) return null;

    // YouTube Shorts 먼저 체크
    if (url.includes('youtube.com/shorts/')) {
        return 'youtube_shorts';
    }

    // 일반 YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return 'youtube';
    }

    // Instagram
    if (url.includes('instagram.com')) {
        return 'instagram';
    }

    // TikTok
    if (url.includes('tiktok.com')) {
        return 'tiktok';
    }

    return null;
}

/**
 * YouTube 임베드 URL 생성
 * 자동재생 비활성화, 관련 영상 숨김
 */
export function getYouTubeEmbedUrl(url: string): string | null {
    const videoId = extractYouTubeId(url);
    if (!videoId) return null;

    // 임베드 URL 생성 (관련영상 비활성화, 모바일 최적화)
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/**
 * YouTube 썸네일 URL 생성 (Lazy Load용)
 * maxresdefault: 최고 해상도 (1280x720)
 * hqdefault: 고해상도 (480x360)
 * mqdefault: 중간 해상도 (320x180)
 */
export function getYouTubeThumbnail(
    url: string,
    quality: 'maxres' | 'hq' | 'mq' = 'hq'
): string | null {
    const videoId = extractYouTubeId(url);
    if (!videoId) return null;

    const qualityMap = {
        maxres: 'maxresdefault',
        hq: 'hqdefault',
        mq: 'mqdefault'
    };

    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Instagram 임베드 URL 생성
 */
export function getInstagramEmbedUrl(url: string): string | null {
    const postId = extractInstagramId(url);
    if (!postId) return null;

    return `https://www.instagram.com/p/${postId}/embed`;
}

/**
 * TikTok 임베드 URL 생성
 */
export function getTikTokEmbedUrl(url: string): string | null {
    const videoId = extractTikTokId(url);
    if (!videoId) return null;

    return `https://www.tiktok.com/embed/v2/${videoId}`;
}

/**
 * 통합 임베드 URL 생성
 */
export function getEmbedUrl(url: string): string | null {
    const videoType = detectVideoType(url);

    switch (videoType) {
        case 'youtube':
        case 'youtube_shorts':
            return getYouTubeEmbedUrl(url);
        case 'instagram':
            return getInstagramEmbedUrl(url);
        case 'tiktok':
            return getTikTokEmbedUrl(url);
        default:
            return null;
    }
}

/**
 * 통합 썸네일 URL 생성
 * Instagram/TikTok은 썸네일 직접 접근이 어려워 null 반환
 */
export function getThumbnailUrl(url: string): string | null {
    const videoType = detectVideoType(url);

    if (videoType === 'youtube' || videoType === 'youtube_shorts') {
        return getYouTubeThumbnail(url);
    }

    // Instagram/TikTok은 API 없이 썸네일 접근 불가
    return null;
}

/**
 * URL 유효성 검사
 */
export function isValidVideoUrl(url: string): boolean {
    return detectVideoType(url) !== null;
}

/**
 * 플랫폼별 한글 이름
 */
export function getVideoPlatformName(videoType: VideoType): string {
    switch (videoType) {
        case 'youtube':
            return 'YouTube';
        case 'youtube_shorts':
            return 'YouTube 쇼츠';
        case 'instagram':
            return 'Instagram 릴스';
        case 'tiktok':
            return 'TikTok';
        default:
            return '영상';
    }
}
