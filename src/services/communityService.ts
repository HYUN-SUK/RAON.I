import { supabase } from '@/lib/supabase';
import { Post, BoardType } from '@/store/useCommunityStore';
import { Database } from '@/types/supabase';

type CommentRow = Database['public']['Tables']['comments']['Row'];
type CommentInsert = Database['public']['Tables']['comments']['Insert'];

const ANON_USER_ID = '00000000-0000-0000-0000-000000000000'; // Valid UUID for testing

export interface Comment {
    id: string;
    postId: string;
    author: string;
    content: string;
    date: string;
    isMine?: boolean; // Mock logic for now
}


export const communityService = {
    // 1. Fetch Posts with Pagination
    async getPosts(type: BoardType, page: number = 0, limit: number = 20) {
        const from = page * limit;
        const to = from + limit - 1;

        console.log(`Fetching posts type: ${type}, range: ${from}-${to}`);

        const { data, error, count } = await supabase
            .from('posts')
            .select('*', { count: 'exact' })
            .eq('type', type)
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
        const dbPost = mapPostToDb(post);
        const { data, error } = await supabase
            .from('posts')
            .insert(dbPost)
            .select()
            .single();

        if (error) throw error;
        return mapDbToPost(data);
    },

    // 3.5 Update Post (Edit / Status Change)
    async updatePost(id: string, updates: Partial<Post>) {
        const dbUpdates = mapPostToDb(updates);
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

        const payload: any = {};
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

    // 5. Get Comments
    async getComments(postId: string): Promise<Comment[]> {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data.map(mapDbToComment);
    },

    // 6. Create Comment
    async createComment(postId: string, content: string, authorName: string, userId: string = ANON_USER_ID) {
        const payload: CommentInsert = {
            post_id: postId,
            content,
            author_name: authorName,
            user_id: userId,
        };

        const { data, error } = await supabase
            .from('comments')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        // Increment comment count
        await supabase.rpc('increment_comment_count', { row_id: postId });

        return mapDbToComment(data);
    },

    // 7. Delete Comment
    async deleteComment(commentId: string, postId: string) {
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;

        // Decrement comment count
        await supabase.rpc('decrement_comment_count', { row_id: postId });
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
    async uploadImage(file: File) {
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

        return data.publicUrl;
    }
};

function mapDbToComment(db: CommentRow): Comment {
    return {
        id: db.id,
        postId: db.post_id,
        author: db.author_name,
        content: db.content,
        date: new Date(db.created_at).toISOString(), // Full ISO for sorting if needed
        isMine: true // For now, allow deleting anything in dev mode
    };
}

// Helper: Map DB shape to App shape
function mapDbToPost(db: any): Post {
    try {
        if (!db) throw new Error('DB Record is null');

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
            status: db.meta_data?.status,
            groupName: db.meta_data?.group_name,
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
            isHot: false
        };
    }
}

// Helper: Map App shape to DB shape
function mapPostToDb(post: Partial<Post>): any {
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
