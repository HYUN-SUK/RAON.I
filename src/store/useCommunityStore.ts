import { create } from 'zustand';
import { communityService, Comment } from '@/services/communityService';

export type BoardType = 'NOTICE' | 'REVIEW' | 'STORY' | 'QNA' | 'GROUP' | 'CONTENT';

export interface Post {
    id: string;
    type: BoardType;
    title: string;
    content: string;
    author: string;
    date: string;
    readCount?: number;
    likeCount: number;
    commentCount: number;
    images?: string[];
    isHot?: boolean;
    // For specialized types
    status?: 'OPEN' | 'CLOSED';
    groupName?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
}

interface CommunityState {
    activeTab: BoardType;
    posts: Post[];
    isLoading: boolean;
    error: string | null;

    // Actions
    setActiveTab: (tab: BoardType) => void;
    loadPosts: (type: BoardType) => Promise<void>;
    createPost: (post: Partial<Post>) => Promise<void>;

    // Interaction Actions
    // toggleLike: (postId: string) => Promise<void>; // Can be local only
    loadComments: (postId: string) => Promise<Comment[]>;
    addComment: (postId: string, content: string, author: string) => Promise<Comment>;
    removeComment: (postId: string, commentId: string) => Promise<void>;

    // Computed
    getPostsByType: (type: BoardType) => Post[];
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
    activeTab: 'NOTICE',
    posts: [],
    isLoading: false,
    error: null,

    setActiveTab: (tab) => {
        set({ activeTab: tab });
        get().loadPosts(tab); // Auto load on tab change
    },

    loadPosts: async (type) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await communityService.getPosts(type);
            set({ posts: data, isLoading: false });
        } catch (err: any) {
            console.error(err);
            set({ error: err.message, isLoading: false, posts: [] });
        }
    },

    createPost: async (post) => {
        set({ isLoading: true, error: null });
        try {
            await communityService.createPost(post);
            // Reload posts for the current tab to show the new one
            // We assume the new post matches the current tab or we might switch tab? 
            // For now, reload current tab if it matches, or just reload.
            const { activeTab } = get();
            if (activeTab === post.type) {
                await get().loadPosts(activeTab);
            }
            set({ isLoading: false });
        } catch (err: any) {
            console.error(err);
            set({ error: err.message, isLoading: false });
            throw err; // Re-throw to let component know
        }
    },

    loadComments: async (postId) => {
        return await communityService.getComments(postId);
    },

    addComment: async (postId, content, author) => {
        // Optimistic update could happen here, but since it returns the real ID, we wait slightly
        // or we return the real comment
        const newComment = await communityService.createComment(postId, content, author);

        // Update local post comment count if exists
        set((state) => ({
            posts: state.posts.map(p =>
                p.id === postId
                    ? { ...p, commentCount: (p.commentCount || 0) + 1 }
                    : p
            )
        }));

        return newComment;
    },

    removeComment: async (postId, commentId) => {
        await communityService.deleteComment(commentId, postId);
        // Update local post comment count
        set((state) => ({
            posts: state.posts.map(p =>
                p.id === postId
                    ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) }
                    : p
            )
        }));
    },

    getPostsByType: (type: BoardType) => {
        const { posts } = get();
        // Robust check: Ensure posts exists and filter by type if needed
        // Since we currently reload all posts on tab switch, filtering might be redundant 
        // if 'posts' only contains current tab's data. But for safety:
        if (!posts) return [];
        return posts;
    }
}));
