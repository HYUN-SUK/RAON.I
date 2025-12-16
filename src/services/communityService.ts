import { supabase } from '@/lib/supabase';
import { Post, BoardType } from '@/store/useCommunityStore';

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

    // 4. Toggle Like (Simple version)
    // Note: Optimistic update usually handled in store/component
};

// Helper: Map DB shape to App shape
function mapDbToPost(db: any): Post {
    return {
        id: db.id,
        type: db.type,
        title: db.title,
        content: db.content,
        author: db.author_name || 'Anonymous', // Fallback
        date: new Date(db.created_at).toISOString().split('T')[0],
        likeCount: db.like_count,
        commentCount: db.comment_count,
        images: db.images,
        isHot: db.is_hot,
        // Flatten metadata
        status: db.meta_data?.status,
        groupName: db.meta_data?.group_name,
        thumbnailUrl: db.meta_data?.thumbnail_url,
        videoUrl: db.meta_data?.video_url,
    };
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
        },
    };
}
