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

    // 실제 지도 좌표 (카카오맵)
    lat?: number;
    lng?: number;

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
    heroImage: string | null; // User custom hero image

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
    fetchProfile: (userId?: string) => Promise<void>;
    setHeroImage: (url: string) => void;
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
            heroImage: null,

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
                return { mapItems: [item, ...state.mapItems] }; // Prepend new item
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
                    missionId: m.mission_id, // 미션 상세 페이지 이동용
                    missionPoints: m.mission?.reward_xp,
                    images: m.image_url ? [m.image_url] : []
                }));

                const allItems = [...postItems, ...missionItems].sort((a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                set({ timelineItems: allItems });
            },
            fetchAlbum: async () => {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    set({ album: [] });
                    return;
                }

                try {
                    // 1. 게시글에서 이미지가 있는 항목 가져오기
                    const { data: posts } = await supabase
                        .from('posts')
                        .select('id, title, images, created_at')
                        .eq('author_id', user.id)
                        .not('images', 'is', null)
                        .order('created_at', { ascending: false });

                    // 2. 미션 인증 사진 가져오기
                    const { data: missions } = await supabase
                        .from('user_missions')
                        .select('id, image_url, created_at, mission:missions(title)')
                        .eq('user_id', user.id)
                        .not('image_url', 'is', null)
                        .order('created_at', { ascending: false });

                    // 3. 게시글 이미지를 AlbumItem으로 변환
                    const postAlbumItems: AlbumItem[] = [];
                    (posts || []).forEach(post => {
                        const images = post.images as string[] | null;
                        if (images && Array.isArray(images)) {
                            images.forEach((imgUrl, idx) => {
                                postAlbumItems.push({
                                    id: `post-${post.id}-${idx}`,
                                    imageUrl: imgUrl,
                                    description: post.title || '게시글 사진',
                                    date: post.created_at,
                                    tags: ['#게시글']
                                });
                            });
                        }
                    });

                    // 4. 미션 인증 사진을 AlbumItem으로 변환
                    const missionAlbumItems: AlbumItem[] = (missions || []).map(m => ({
                        id: `mission-${m.id}`,
                        imageUrl: m.image_url as string,
                        description: `미션 인증: ${(m.mission as { title?: string })?.title || '미션'}`,
                        date: m.created_at,
                        tags: ['#미션', '#인증']
                    }));

                    // 5. 날짜순 정렬 후 합치기
                    const allItems = [...postAlbumItems, ...missionAlbumItems].sort((a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );

                    set({ album: allItems });
                } catch (error) {
                    console.error('앨범 로드 실패:', error);
                    set({ album: [] });
                }
            },
            setHeroImage: (url) => set({ heroImage: url }),
            fetchProfile: async (userId) => {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                const targetUserId = userId || user?.id;

                if (!targetUserId) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('hero_image_url')
                    .eq('id', targetUserId)
                    .single();

                if (profile?.hero_image_url) {
                    set({ heroImage: profile.hero_image_url });
                }
            },
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
