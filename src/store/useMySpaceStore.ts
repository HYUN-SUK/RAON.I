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

interface MySpaceState {
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
    points: number;
    addXp: (amount: number) => void;
    addPoints: (amount: number) => void;

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
    fetchTimeline: () => void;
    fetchAlbum: () => void;
}

export const useMySpaceStore = create<MySpaceState>()(
    persist(
        (set) => ({
            isNightMode: false,
            isFireOn: false,
            isStarOn: false,
            toggleNightMode: () => set((state) => ({ isNightMode: !state.isNightMode })),
            toggleFire: () => set((state) => ({ isFireOn: !state.isFireOn })),
            toggleStar: () => set((state) => ({ isStarOn: !state.isStarOn })),
            setNightMode: (isNight) => set({ isNightMode: isNight }),

            xp: 0,
            level: 1,
            points: 0,
            addXp: (amount) => set((state) => {
                const newXp = state.xp + amount;
                const newLevel = Math.floor(newXp / 100) + 1;
                return { xp: newXp, level: newLevel };
            }),
            addPoints: (amount) => set((state) => ({ points: state.points + amount })),

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
            fetchTimeline: () => set({
                timelineItems: [
                    {
                        id: 't-1',
                        type: 'reservation',
                        date: '2025-11-20',
                        title: '가을 끝자락 캠핑',
                        content: 'A-7 구역 (파쇄석) | 성인 2, 아이 2',
                        siteId: 'site-7'
                    },
                    {
                        id: 't-2',
                        type: 'photo',
                        date: '2025-11-20T19:30:00',
                        title: '불멍 타임 🔥',
                        content: '오랜만에 불멍하니 잡생각이 사라진다.',
                        images: ['https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?q=80&w=1000&auto=format&fit=crop']
                    },
                    {
                        id: 't-3',
                        type: 'mission',
                        date: '2025-11-21T09:00:00',
                        title: '아침 산책 미션 달성',
                        content: '상쾌한 숲 공기 마시기 완료!',
                        missionPoints: 150
                    },
                    {
                        id: 't-4',
                        type: 'reservation',
                        date: '2025-10-05',
                        title: '첫 가족 캠핑',
                        content: 'B-2 구역 (데크) | 성인 2, 아이 1',
                        siteId: 'site-2'
                    },
                    {
                        id: 't-5',
                        type: 'photo',
                        date: '2025-10-05T14:20:00',
                        title: '텐트 설치 완료!',
                        content: '처음이라 오래 걸렸지만 뿌듯하다.',
                        images: ['https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=1000&auto=format&fit=crop']
                    },
                    {
                        id: 't-6',
                        type: 'mission',
                        date: '2025-10-06T11:00:00',
                        title: '뒷정리 깔끔왕',
                        content: 'LNT(Leave No Trace) 실천하기',
                        missionPoints: 100
                    },
                    {
                        id: 't-7',
                        type: 'reservation',
                        date: '2025-09-15',
                        title: '친구들과 글램핑',
                        content: 'G-1 구역 (글램핑) | 성인 4',
                        siteId: 'site-glamp-1'
                    }
                ]
            }),
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
        }),
        {
            name: 'myspace-storage',
        }
    )
);
