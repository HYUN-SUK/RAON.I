import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 앨범 아이템 인터페이스 (Album Item Interface)
export interface AlbumItem {
    id: string;
    imageUrl: string;
    description: string;
    date: string;
    tags?: string[];
}

// 지도 아이템 인터페이스 (Map Item Interface)
export interface MapItem {
    id: string;
    siteId?: string;   // Optional (Raon internal sites only)
    siteName: string; // 방문한 사이트 이름 or 장소명

    // 좌표 (Relative Percentage 0-100)
    x: number;
    y: number;

    visitedDate: string;
    isStamped: boolean;
    address?: string; // New: Address string

    // SSOT 4.7 확장 데이터
    photos: string[];
    memo: string;
    rating: number;
    isFavorite: boolean;
    tags: string[];
}

// 타임라인 아이템 인터페이스 (Timeline Item Interface)
export interface TimelineItem {
    id: string;
    type: 'reservation' | 'photo' | 'mission';
    date: string; // ISO String (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    title: string;
    content?: string;
    images?: string[];

    // Additional Metadata
    siteId?: string;       // For reservation
    missionId?: string;    // For mission
    missionPoints?: number;
}

export interface MySpaceState {
    isNightMode: boolean;
    isFireOn: boolean;
    isStarOn: boolean;
    toggleNightMode: () => void;
    toggleFire: () => void;
    toggleStar: () => void;
    setNightMode: (isNight: boolean) => void;

    // 경험치 및 포인트 시스템
    xp: number;
    level: number;
    raonToken: number; // Renamed from points
    title: string;     // New

    // Actions to sync with server
    setWallet: (xp: number, level: number, token: number) => void;

    // Optimistic updates
    addXp: (amount: number) => void;
    addToken: (amount: number) => void;

    // 앨범 (Album)
    album: AlbumItem[];
    addAlbumItem: (item: AlbumItem) => void;
    removeAlbumItem: (id: string) => void;

    // 나만의 지도 (My Map)
    mapItems: MapItem[];
    addMapItem: (item: MapItem) => void;
    updateMapItem: (id: string, updates: Partial<MapItem>) => void;
    toggleMapFavorite: (id: string) => void;

    // 타임라인 (Timeline)
    timelineItems: TimelineItem[];
    fetchTimeline: (userId?: string) => void;
    fetchAlbum: () => void;
    reset: () => void;
}

import { getLevelInfo } from '@/config/pointPolicy';
import { createClient } from '@/lib/supabase-client';

export const useMySpaceStore = create<MySpaceState>()(
    persist(
        (set, get) => ({
            isNightMode: false,
            isFireOn: false,
            isStarOn: false,
            toggleNightMode: () => set((state) => ({ isNightMode: !state.isNightMode })),
            toggleFire: () => set((state) => ({ isFireOn: !state.isFireOn })),
            toggleStar: () => set((state) => ({ isStarOn: !state.isStarOn })),
            setNightMode: (isNight) => set({ isNightMode: isNight }),

            xp: 0,
            level: 1,
            raonToken: 0,
            title: '초보 캠퍼',

            setWallet: (xp, level, token) => {
                const info = getLevelInfo(xp);
                set({ xp, level, raonToken: token, title: info.currentTitle });
            },

            addXp: (amount) => set((state) => {
                const newXp = state.xp + amount;
                const info = getLevelInfo(newXp);
                return { xp: newXp, level: info.currentLevel, title: info.currentTitle };
            }),
            addToken: (amount) => set((state) => ({ raonToken: state.raonToken + amount })),

            // 앨범 초기값 및 액션
            album: [],
            addAlbumItem: (item) => set((state) => ({ album: [item, ...state.album] })),
            removeAlbumItem: (id) => set((state) => ({ album: state.album.filter((i) => i.id !== id) })),

            // 지도 초기값 및 액션
            mapItems: [],
            addMapItem: (item) => set((state) => {
                const exists = state.mapItems.some(i => i.id === item.id || (i.siteName === item.siteName && i.visitedDate === item.visitedDate));

                if (exists) return state;
                return { mapItems: [...state.mapItems, item] };
            }),
            updateMapItem: (id, updates) => set((state) => {

                return {
                    mapItems: state.mapItems.map(item =>
                        item.id === id ? { ...item, ...updates } : item
                    )
                };
            }),
            toggleMapFavorite: (id) => set((state) => ({
                mapItems: state.mapItems.map(item =>
                    item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
                )
            })),

            // 타임라인 초기값 및 액션 (Mock Data)
            timelineItems: [],
            fetchTimeline: async (userId) => {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                const targetUserId = userId || user?.id;

                if (!targetUserId) return;

                // 1. Fetch Posts (My Story) - Both Public and Private
                const { data: posts } = await supabase
                    .from('posts')
                    .select('*')
                    .eq('author_id', targetUserId)
                    .order('created_at', { ascending: false });

                // 2. Fetch Completed Missions
                const { data: missions } = await supabase
                    .from('user_missions')
                    .select('*, mission:missions(*)') // Join with mission details
                    .eq('user_id', targetUserId)
                    .eq('status', 'COMPLETED');

                // 3. Map to TimelineItems
                const postItems: TimelineItem[] = (posts || []).map(p => ({
                    id: `post-${p.id}`,
                    type: 'photo', // Treating posts as photo/story records
                    date: p.created_at,
                    title: p.title,
                    content: p.content,
                    images: p.images || (p.meta_data?.thumbnail_url ? [p.meta_data.thumbnail_url] : [])
                }));

                const missionItems: TimelineItem[] = (missions || []).map(m => ({
                    id: `mission-${m.id}`,
                    type: 'mission',
                    date: m.completed_at || m.created_at,
                    title: `미션 성공: ${m.mission?.title}`,
                    content: m.content || m.mission?.description,
                    missionPoints: m.mission?.reward_xp, // Display XP as points or Token? XP is better for timeline achievement
                    images: m.image_url ? [m.image_url] : []
                }));

                const allItems = [...postItems, ...missionItems].sort((a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                set({ timelineItems: allItems });
            },
            fetchAlbum: () => set({
                album: [
                    {
                        id: 'a-1',
                        imageUrl: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d',
                        description: '불멍 타임 🔥',
                        date: '2025-11-20',
                        tags: ['#불멍', '#밤', '#힐링']
                    },
                    {
                        id: 'a-2',
                        imageUrl: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7',
                        description: '텐트 설치 완료!',
                        date: '2025-10-05',
                        tags: ['#텐트', '#가을', '#첫캠핑']
                    },
                    {
                        id: 'a-3',
                        imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4',
                        description: '아침 숲 산책',
                        date: '2025-11-21',
                        tags: ['#숲', '#아침', '#산책']
                    },
                    {
                        id: 'a-4',
                        imageUrl: 'https://images.unsplash.com/photo-1537905569824-f89f14cceb68',
                        description: '맛있는 바베큐',
                        date: '2025-10-05',
                        tags: ['#요리', '#바베큐', '#먹방']
                    },
                    {
                        id: 'a-5',
                        imageUrl: 'https://images.unsplash.com/photo-1517824806704-9040b037703b',
                        description: '별이 쏟아지는 밤',
                        date: '2025-09-15',
                        tags: ['#별', '#밤하늘', '#감성']
                    }
                ] as any[] // Temporarily casting to any to bypass strict interface check if AlbumItem tag definition is missing
            }),
            reset: () => set({
                isNightMode: false,
                isFireOn: false,
                isStarOn: false,
                xp: 0,
                level: 1,
                raonToken: 0,
                title: '초보 캠퍼',
                album: [],
                mapItems: [],
                timelineItems: [],
            }),
        }),
        {
            name: 'myspace-storage',
        }
    )
);
