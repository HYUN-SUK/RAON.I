import { create } from 'zustand';
import { communityService, Comment, supabase } from '@/services/communityService';

export type BoardType = 'NOTICE' | 'REVIEW' | 'STORY' | 'QNA' | 'GROUP' | 'CONTENT';

export interface Post {
    id: string;
    type: BoardType;
    title: string;
    content: string;
    author: string;
    authorId?: string; // 작성자 ID (UUID) for ember support
    date: string;
    readCount?: number;
    likeCount: number;
    commentCount: number;
    images?: string[];
    isHot?: boolean;
    // For specialized types
    status?: 'OPEN' | 'CLOSED';
    groupName?: string;
    groupId?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
}

interface CommunityState {
    activeTab: BoardType;
    posts: Post[];
    isLoading: boolean;
    error: string | null;

    // Pagination
    page: number;
    hasMore: boolean;

    // Auth (Mock)
    currentUser: {
        id: string;
        name: string;
        role: 'USER' | 'ADMIN';
    };

    // Actions
    setActiveTab: (tab: BoardType) => void;
    loadPosts: (type: BoardType, page?: number) => Promise<void>;
    createPost: (post: Partial<Post>) => Promise<void>;
    updatePost: (id: string, updates: Partial<Post>) => Promise<void>;
    deletePost: (id: string) => Promise<void>;

    // Interaction Actions
    // toggleLike: (postId: string) => Promise<void>; // Can be local only
    loadComments: (postId: string) => Promise<Comment[]>;
    addComment: (postId: string, content: string, author: string, imageUrl?: string) => Promise<Comment>;
    removeComment: (postId: string, commentId: string) => Promise<void>;
    toggleCommentLike: (commentId: string) => Promise<void>;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Computed
    getPostsByType: (type: BoardType) => Post[];
    getMyPosts: () => Post[];
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
    // State
    activeTab: 'NOTICE',
    posts: [],
    isLoading: false,
    error: null,

    // Pagination
    page: 1,
    hasMore: true,

    // Auth (Mock)
    currentUser: {
        id: 'user-1',
        name: '홍길동',
        role: 'USER', // Change to 'ADMIN' to test admin features
    },

    setActiveTab: (tab) => {
        set({ activeTab: tab, page: 1, hasMore: true, posts: [] }); // Reset on tab change
        get().loadPosts(tab, 1);
    },

    loadPosts: async (type, page = 1) => {
        set({ isLoading: true, error: null });
        try {
            // Simulate pagination with mock service or real param
            // Note: service.getPosts might need update to accept page, or we slice client side if mock
            const { data } = await communityService.getPosts(type); // TODO: Pass page to service

            // For now, since backend might not support pagination yet, we just simulate 'hasMore' false
            // Real implementation: const { data, hasNext } = await communityService.getPosts(type, page);

            // Hybrid Pagination Logic:
            // STORY, REVIEW, CONTENT -> Infinite Scroll (Append)
            // NOTICE, QNA, GROUP -> Numbered Pagination (Replace)
            const INFINITE_SCROLL_TYPES: BoardType[] = ['STORY', 'REVIEW', 'CONTENT'];
            const isInfinite = INFINITE_SCROLL_TYPES.includes(type as BoardType);

            if (page === 1 || !isInfinite) {
                // Replace content for first page OR paged views
                set({ posts: data, page, hasMore: false, isLoading: false }); // hasMore false for mock
            } else {
                // Append for Infinite Scroll (Page > 1)
                set((state) => ({
                    posts: [...state.posts, ...data],
                    page,
                    hasMore: false,
                    isLoading: false
                }));
            }
        } catch (err: unknown) {
            console.error(err);
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    createPost: async (post) => {
        set({ isLoading: true, error: null });
        try {
            // Inject current user author
            const { currentUser } = get();
            const postWithAuthor = { ...post, author: currentUser.name }; // TODO: Use ID in real backend

            await communityService.createPost(postWithAuthor);

            const { activeTab } = get();
            if (activeTab === post.type) {
                await get().loadPosts(activeTab, 1);
            }
            set({ isLoading: false });
        } catch (err: unknown) {
            console.error(err);
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    updatePost: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
            await communityService.updatePost(id, updates);

            // Optimistic update
            set((state) => ({
                posts: state.posts.map(p => p.id === id ? { ...p, ...updates } : p),
                isLoading: false
            }));

            // Sync
            const { activeTab } = get();
            await get().loadPosts(activeTab, 1);

        } catch (err: unknown) {
            console.error(err);
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    deletePost: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await communityService.deletePost(id);

            // Optimistic update
            set((state) => ({
                posts: state.posts.filter(p => p.id !== id),
                isLoading: false
            }));

            // Sync
            const { activeTab } = get();
            await get().loadPosts(activeTab, 1);
        } catch (err: unknown) {
            console.error(err);
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    loadComments: async (postId) => {
        return await communityService.getComments(postId);
    },

    addComment: async (postId, content, author, imageUrl) => {
        // Get real authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        const newComment = await communityService.createComment(postId, content, author, userId, imageUrl);

        // Fix Optimistic isMine logic
        if (userId && newComment.authorId === userId) {
            newComment.isMine = true;
        }

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
        set((state) => ({
            posts: state.posts.map(p =>
                p.id === postId
                    ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) }
                    : p
            )
        }));
    },

    toggleCommentLike: async (commentId: string) => {
        // Optimistic UI update could be tricky if we don't have local *comments* state in store.
        // But comments are returned by loadComments and usually managed by component state.
        // Store only manages Posts usually.
        // Wait, CommentSection uses local state `comments`. 
        // So the store action should just call service, and the component updates local state.
        // However, for consistency, let's expose the service call via store.
        await communityService.toggleCommentLike(commentId);
    },

    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),

    getPostsByType: (type: BoardType) => {
        const { posts, currentUser, searchQuery } = get();

        // 1. Filter by Board Type if needed (Though currently we reload on tab change, safer to filter)
        // const typeFiltered = posts.filter(p => p.type === type); 

        // 2. Filter by Search Query
        let filtered = posts;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(query) ||
                p.content.toLowerCase().includes(query)
            );
        }

        // 3. Privacy Filter (Client-side)
        return filtered.filter(post => {
            // Author always sees their own posts
            if (post.author === currentUser.name) return true;

            // Admin sees everything
            if (currentUser.role === 'ADMIN') return true;

            // Visibility Checks
            if ((post as any).visibility === 'PRIVATE') return false;
            // if ((post as any).visibility === 'FRIENDS') return true; 

            return true; // PUBLIC
        });
    },

    getMyPosts: () => {
        const { posts, currentUser } = get();
        // Return all posts authored by current user, regardless of type
        return posts.filter(post => post.author === currentUser.name);
    }
}));
