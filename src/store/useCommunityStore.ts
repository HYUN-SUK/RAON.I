import { create } from 'zustand';
import { communityService } from '@/services/communityService';

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

    // Computed (Helper for backward compatibility/easy access, but mainly we rely on 'posts' which is current tab data)
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

    getPostsByType: (type) => {
        // Since we now load only the active tab's posts into 'posts',
        // if the requested type matches activeTab, return posts.
        // Otherwise return empty (or we could cache, but Keep It Simple for now).
        const { activeTab, posts } = get();
        return activeTab === type ? posts : [];
    }
}));
