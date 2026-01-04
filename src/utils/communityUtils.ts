
import { Post } from '@/store/useCommunityStore';

/**
 * Sanitizes raw post data to ensure it conforms to the Post interface
 * and doesn't contain malformed fields that could crash UI components.
 */
export function sanitizePost(rawPost: unknown): Post {
    // 0. Null check
    if (!rawPost || typeof rawPost !== 'object') {
        return {
            id: `error-${Math.random()}`,
            type: 'STORY',
            title: 'Invalid Data',
            content: 'This post could not be loaded.',
            author: 'System',
            date: new Date().toISOString().split('T')[0],
            likeCount: 0,
            commentCount: 0,
            readCount: 0,
            images: [],
            isHot: false
        };
    }

    // 1. Author Sanitization
    let safeAuthor = '익명';
    if (typeof rawPost.author === 'string') {
        safeAuthor = rawPost.author;
    } else if (typeof rawPost.author === 'object' && rawPost.author !== null) {
        // Try to extract useful name from object
        safeAuthor = rawPost.author.name || rawPost.author.nickname || rawPost.author.username || '알 수 없음';
    }

    // 2. Images Sanitization
    let safeImages: string[] = [];
    if (Array.isArray(rawPost.images)) {
        safeImages = rawPost.images.filter((img: unknown) => typeof img === 'string' && img.length > 0);
    }

    // 3. Date Sanitization
    let safeDate = new Date().toISOString().split('T')[0];
    if (typeof rawPost.date === 'string') {
        safeDate = rawPost.date;
    }

    // 4. Return Safe Object
    return {
        ...rawPost,
        id: rawPost.id || `temp-${Math.random()}`,
        type: rawPost.type || 'STORY',
        title: typeof rawPost.title === 'string' ? rawPost.title : '제목 없음',
        content: typeof rawPost.content === 'string' ? rawPost.content : '',
        author: safeAuthor,
        date: safeDate,
        likeCount: typeof rawPost.likeCount === 'number' ? rawPost.likeCount : 0,
        commentCount: typeof rawPost.commentCount === 'number' ? rawPost.commentCount : 0,
        readCount: typeof rawPost.readCount === 'number' ? rawPost.readCount : 0,
        images: safeImages,
        thumbnailUrl: typeof rawPost.thumbnailUrl === 'string' ? rawPost.thumbnailUrl : undefined,
        // Preserve other fields but ensure they exist if optional fields are critical
        isHot: !!rawPost.isHot,
    };
}
