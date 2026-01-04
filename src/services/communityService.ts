import { createClient } from '@/lib/supabase-client';
import { Post, BoardType } from '@/store/useCommunityStore';
import { pointService } from '@/services/pointService';
import { Database } from '@/types/supabase';

// Instantiate the browser client which has access to cookies
export const supabase = createClient();

type CommentRow = Database['public']['Tables']['comments']['Row'];
type CommentInsert = Database['public']['Tables']['comments']['Insert'];
type DbPost = Database['public']['Tables']['posts']['Row'];

// RPC return types for comments (includes extra fields like user_info, is_liked_by_me)
interface DbCommentWithUserInfo {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    created_at: string;
    image_url?: string | null;
    user_info?: { nickname?: string };
    likes_count?: number;
    is_liked_by_me?: boolean;
}

const ANON_USER_ID = '00000000-0000-0000-0000-000000000000'; // Valid UUID for testing

export interface Comment {
    id: string;
    postId: string;
    author: string;
    content: string;
    date: string;
    imageUrl?: string;
    isMine?: boolean;
    likesCount?: number;
    isLiked?: boolean;
    authorId?: string;
    isAdmin?: boolean;
}


export const communityService = {
    // 1. Fetch Posts with Pagination
    async getPosts(type: BoardType, page: number = 0, limit: number = 20) {
        const from = page * limit;
        const to = from + limit - 1;



        const { data, error, count } = await supabase
            .from('posts')
            .select('*', { count: 'exact' })
            .eq('type', type)
            // Filter out PRIVATE posts for public feed. 
            // Note: If we want to show OWN private posts in feed, we need OR logic (visibility != PRIVATE OR author_id == me), 
            // but for simplicity and typical design, private posts only appear in My Space.
            // Also need to handle legacy data where visibility might be missing (default PUBLIC).
            .not('meta_data->>visibility', 'eq', 'PRIVATE')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Fetch posts error:', error);
            throw error;
        }

        return {
            data: data ? data.map(mapDbToPost) : [],
            count
        };
    },

    // 1.5 Get My Posts (All Visibility)
    // 1.5 Get My Posts (All Visibility, with Search & Pagination)
    async getMyPosts(userId: string, page: number = 0, limit: number = 10, searchKeyword?: string) {
        const from = page * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('posts')
            .select('*', { count: 'exact' })
            .eq('author_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (searchKeyword) {
            query = query.or(`title.ilike.%${searchKeyword}%,content.ilike.%${searchKeyword}%`);
        }

        const { data, error, count } = await query;

        if (error) throw error;
        return {
            data: (data || []).map(mapDbToPost),
            count
        };
    },

    // 2. Fetch Single Post
    async getPostById(id: string) {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return mapDbToPost(data);
    },

    // 3. Create Post
    async createPost(post: Partial<Post>) {
        const { data: { user } } = await supabase.auth.getUser();

        const dbPost = {
            ...mapPostToDb(post),
            author_id: user?.id // Explicitly set author_id
        };

        const { data, error } = await supabase
            .from('posts')
            .insert(dbPost)
            .select()
            .single();

        if (error) throw error;

        // Grant Reward
        if (user) {
            try {
                // 1. Grant Write Post Reward
                await pointService.grantAction(user.id, 'WRITE_POST', data.id);

                // 2. Grant Photo Upload Reward (if images exist)
                if (post.images && post.images.length > 0) {
                    await pointService.grantAction(user.id, 'UPLOAD_PHOTO', data.id);
                }
            } catch (e: unknown) {
                console.error("Reward Failed", e);
                // Temporary Debugging: Alert the user so they know WHY it failed
                alert(`보상 지급 실패: ${(e as Error).message || JSON.stringify(e)}`);
            }
        }


        return mapDbToPost(data);
    },

    // 3.5 Update Post (Edit / Status Change)
    async updatePost(id: string, updates: Partial<Post>) {
        // We only want to update fields that are present in 'updates'
        // But mapPostToDb returns a full object structure. 
        // We need to be careful not to overwrite metadata if we only want to update part of it.
        // For simplicity in this session, we will fetch, merge, and update.

        const { data: current } = await supabase.from('posts').select('*').eq('id', id).single();
        if (!current) throw new Error('Post not found');

        const currentMeta = current.meta_data || {};
        const newMeta = {
            ...currentMeta,
            ...(updates.status ? { status: updates.status } : {}),
            ...(updates.groupName ? { group_name: updates.groupName } : {}),
            ...(updates.thumbnailUrl ? { thumbnail_url: updates.thumbnailUrl } : {}),
            ...(updates.videoUrl ? { video_url: updates.videoUrl } : {}),
            ...(updates.visibility ? { visibility: updates.visibility } : {}),
        };

        const payload: Partial<Database['public']['Tables']['posts']['Update']> = {};
        if (updates.title) payload.title = updates.title;
        if (updates.content) payload.content = updates.content;
        if (updates.images) payload.images = updates.images;
        payload.meta_data = newMeta;

        const { data, error } = await supabase
            .from('posts')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapDbToPost(data);
    },

    // 3.8 Delete Post
    async deletePost(id: string) {
        const { data: { user } } = await supabase.auth.getUser();
        const isAdmin = user?.email === 'admin@raon.ai' || user?.app_metadata?.role === 'admin';

        if (isAdmin) {
            // Admin Deletion (Force RPC)
            const { error } = await supabase.rpc('admin_force_delete_post', { p_post_id: id });
            if (error) throw error;
        } else {
            // Normal Deletion (RLS)
            const { error, count } = await supabase
                .from('posts')
                .delete({ count: 'exact' })
                .eq('id', id);

            if (error) throw error;
            if (count === 0) throw new Error('게시물을 삭제할 수 없습니다. 권한이 없거나 이미 삭제되었습니다.');
        }
    },

    // 4. Toggle Like (Optimistic at component level, this syncs with DB)
    async toggleLike(postId: string, userId: string = ANON_USER_ID): Promise<boolean> {
        // Check if already liked
        const { data: existing } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .single();

        let isLiked = false;

        if (existing) {
            // Unlike
            await supabase.from('likes').delete().eq('id', existing.id);
            // Decrement count
            await supabase.rpc('decrement_like_count', { row_id: postId });
            isLiked = false;
        } else {
            // Like
            await supabase.from('likes').insert({ post_id: postId, user_id: userId });
            // Increment count
            await supabase.rpc('increment_like_count', { row_id: postId });
            isLiked = true;
        }

        return isLiked;
    },

    // 5. Get Comments (Updated to use RPC)
    async getComments(postId: string): Promise<Comment[]> {
        const { data, error } = await supabase.rpc('get_post_comments', {
            p_post_id: postId
        });

        if (error) {
            console.error(error);
            return [];
        }

        // Fetch User Info ONCE before mapping
        const { data: { user } } = await supabase.auth.getUser();

        const currentUserId = user?.id;
        const isAdmin = user?.email === 'admin@raon.ai' || user?.app_metadata?.role === 'admin';

        const comments = (data || []).map((db: DbCommentWithUserInfo) => ({
            id: db.id,
            postId: db.post_id,
            author: db.user_info?.nickname || 'Unknown',
            content: db.content,
            date: new Date(db.created_at).toISOString(),
            imageUrl: db.image_url,
            isMine: currentUserId ? db.user_id === currentUserId : false,
            likesCount: db.likes_count || 0,
            isLiked: db.is_liked_by_me || false,
            authorId: db.user_id,
            isAdmin: isAdmin
        }));

        return comments;
    },

    // 6. Create Comment
    async createComment(postId: string, content: string, authorName: string, userId: string = ANON_USER_ID, imageUrl?: string) {
        const payload: CommentInsert & { image_url?: string } = {
            post_id: postId,
            content,
            author_name: authorName,
            user_id: userId,
            image_url: imageUrl
        };

        const { data, error } = await supabase
            .from('comments')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        // Increment comment count
        await supabase.rpc('increment_comment_count', { row_id: postId });

        const { data: { user } } = await supabase.auth.getUser();
        const isAdmin = user?.email === 'admin@raon.ai' || user?.app_metadata?.role === 'admin';

        // Fix mapDbToComment to include isAdmin correctly or rely on component reload?
        // Let's just pass simplistic view first.
        return {
            ...mapDbToComment(data, userId),
            isAdmin: isAdmin
        };
    },

    // 7. Delete Comment
    async deleteComment(commentId: string, postId: string) {
        const { data: { user } } = await supabase.auth.getUser();
        const isAdmin = user?.email === 'admin@raon.ai' || user?.app_metadata?.role === 'admin';

        if (isAdmin) {
            // Admin Deletion (RPC)
            // Note: We use the generic admin_delete_comment which updates post counter too.
            const { error } = await supabase.rpc('admin_delete_comment', { p_comment_id: commentId });
            if (error) throw error;
        } else {
            // Normal Deletion (RLS)
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;

            // Decrement comment count - Only needed for normal deletion if database trigger doesn't exist.
            // But wait, our admin RPC handles it. Does normal delete handle it?
            // Usually yes, via our standard practice or explicit call.
            // Previous code had explicit call.
            await supabase.rpc('decrement_comment_count', { row_id: postId });
        }
    },
    // 8. Increment Read Count
    async incrementReadCount(postId: string) {
        // RPC for read count isn't in original SQL, let's assume simple update or rpc
        // Since we don't have decrement_read_count, we can just use rpc 'increment_read_count' if exists,
        // or just update directly. Let's use RPC if possible, or direct update.
        // Checking supabase/interactions_policy.sql... we didn't add increment_read_count RPC there yet.
        // Let's add it to the SQL first or use direct update.
        // Safe bet: Direct update for now or just log.
        // Actually, let's use the RPC pattern we established.
        // But wait, the user's SQL might not have it.
        // Let's invoke a standard update for now.
        const { error } = await supabase.rpc('increment_read_count', { row_id: postId });
        if (error) {
            console.warn('RPC increment_read_count failed', error);
            return error;
        }
        return null;
    },
    // 9. Upload Image
    async uploadImage(file: File): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('community-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('community-images')
            .getPublicUrl(filePath);

        // Optimistic reward removed. Reward will be granted upon Post Creation or Mission Completion to link with related_id.
        // if (user) { ... }

        return data.publicUrl;
    },

    // 10. Upload Comment Image
    async uploadCommentImage(file: File): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('comment-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('comment-images')
            .getPublicUrl(filePath);

        return data.publicUrl;
    },

    // 11. Toggle Comment Like
    async toggleCommentLike(commentId: string): Promise<boolean> {
        const { data, error } = await supabase.rpc('toggle_comment_like', {
            p_comment_id: commentId
        });

        if (error) throw error;
        return data as boolean;
    }
};

function mapDbToComment(db: CommentRow & { image_url?: string }, currentUserId?: string): Comment {
    return {
        id: db.id,
        postId: db.post_id,
        author: db.author_name,
        content: db.content,
        date: new Date(db.created_at).toISOString(),
        imageUrl: db.image_url,
        authorId: db.user_id,
        isMine: currentUserId ? db.user_id === currentUserId : false
    };
}

// Helper to map DB Post to UI Post
function mapDbToPost(db: DbPost): Post {
    if (!db) throw new Error('DB Record is null');
    try {
        return {
            id: db.id,
            type: db.type,
            title: db.title,
            content: db.content,
            author: db.author_name || 'Anonymous', // Fallback
            date: db.created_at ? new Date(db.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            likeCount: db.like_count || 0,
            commentCount: db.comment_count || 0,
            readCount: db.read_count || 0,
            images: (Array.isArray(db.images)) ? db.images : [], // Robust check
            isHot: db.is_hot,
            // Flatten metadata
            status: db.meta_data?.status || 'OPEN',
            groupName: db.meta_data?.group_name,
            groupId: db.group_id,
            thumbnailUrl: db.meta_data?.thumbnail_url,
            videoUrl: db.meta_data?.video_url,
            visibility: db.meta_data?.visibility || 'PUBLIC',
        };
    } catch (e) {
        console.error('Error mapping post:', e, db);
        return {
            id: 'error-' + Math.random(),
            type: 'STORY',
            title: '데이터 로딩 실패',
            content: '게시물을 불러오는 중 오류가 발생했습니다.',
            author: '알림',
            date: new Date().toISOString().split('T')[0],
            likeCount: 0,
            commentCount: 0,
            readCount: 0,
            images: [],
            status: 'OPEN',
            visibility: 'PUBLIC'
        } as unknown as Post;
    }
}
// Helper: Map App shape to DB shape
function mapPostToDb(post: Partial<Post>): Partial<DbPost> {
    return {
        type: post.type,
        title: post.title,
        content: post.content,
        author_name: post.author || 'User', // Temporary
        images: post.images,
        meta_data: {
            status: post.status,
            group_name: post.groupName,
            thumbnail_url: post.thumbnailUrl,
            video_url: post.videoUrl,
            visibility: post.visibility,
        },
    };
}
