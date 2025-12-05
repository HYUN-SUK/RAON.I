import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 앨범 아이템 인터페이스 (Album Item Interface)
export interface AlbumItem {
    id: string;
    imageUrl: string;
    description: string;
    date: string;
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
                const exists = state.mapItems.some(i => i.siteName === item.siteName && i.visitedDate === item.visitedDate);
                if (exists) return state;
                return { mapItems: [...state.mapItems, item] };
            }),
            updateMapItem: (id, updates) => set((state) => ({
                mapItems: state.mapItems.map(item =>
                    item.id === id ? { ...item, ...updates } : item
                )
            })),
            toggleMapFavorite: (id) => set((state) => ({
                mapItems: state.mapItems.map(item =>
                    item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
                )
            })),
        }),
        {
            name: 'myspace-storage',
        }
    )
);
