
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

    // Type assertion after validation
    const post = rawPost as Record<string, any>;
    // 1. Author Sanitization
    let safeAuthor = '익명';
    if (typeof post.author === 'string') {
        safeAuthor = post.author;
    } else if (typeof post.author === 'object' && post.author !== null) {
        // Try to extract useful name from object
        const authorObj = post.author as Record<string, any>;
        safeAuthor = authorObj.name || authorObj.nickname || authorObj.username || '알 수 없음';
    }

    // 2. Images Sanitization
    let safeImages: string[] = [];
    if (Array.isArray(post.images)) {
        safeImages = post.images.filter((img: unknown) => typeof img === 'string' && img.length > 0);
    }

    // 3. Date Sanitization
    let safeDate = new Date().toISOString().split('T')[0];
    if (typeof post.date === 'string') {
        safeDate = post.date;
    }

    // 4. Return Safe Object
    return {
        ...post,
        id: post.id || `temp-${Math.random()}`,
        type: post.type || 'STORY',
        title: typeof post.title === 'string' ? post.title : '제목 없음',
        content: typeof post.content === 'string' ? post.content : '',
        author: safeAuthor,
        date: safeDate,
        likeCount: typeof post.likeCount === 'number' ? post.likeCount : 0,
        commentCount: typeof post.commentCount === 'number' ? post.commentCount : 0,
        readCount: typeof post.readCount === 'number' ? post.readCount : 0,
        images: safeImages,
        thumbnailUrl: typeof post.thumbnailUrl === 'string' ? post.thumbnailUrl : undefined,
        // Preserve other fields but ensure they exist if optional fields are critical
        isHot: !!post.isHot,
    };
}
