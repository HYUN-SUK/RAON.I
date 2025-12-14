import { create } from 'zustand';

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
    status?: 'OPEN' | 'CLOSED'; // QnA
    groupName?: string; // Group
    thumbnailUrl?: string; // Content
    videoUrl?: string; // Content
}

interface CommunityState {
    activeTab: BoardType;
    posts: Post[];
    setActiveTab: (tab: BoardType) => void;
    getPostsByType: (type: BoardType) => Post[];
}

// Mock Data Generator
const generateMockPosts = (): Post[] => [
    // NOTICE
    {
        id: 'n1',
        type: 'NOTICE',
        title: '🎅 크리스마스 시즌 예약 오픈 안내',
        content: '12월 24일, 25일 예약이 이번 주 금요일 오후 2시에 오픈됩니다.',
        author: 'RAON Manager',
        date: '2025-12-10',
        likeCount: 45,
        commentCount: 12,
        isHot: true,
    },
    {
        id: 'n2',
        type: 'NOTICE',
        title: '❄️ 동계 캠핑 안전 수칙 (난로 사용법)',
        content: '일산화탄소 경보기 지참 필수! 안전한 겨울 캠핑을 위해 꼭 읽어주세요.',
        author: 'Safety Team',
        date: '2025-12-01',
        likeCount: 120,
        commentCount: 5,
    },

    // REVIEW
    {
        id: 'r1',
        type: 'REVIEW',
        title: '별이 쏟아지는 밤, 철수네 사이트 후기',
        content: '처음 방문했는데 관리 상태가 너무 좋았습니다. 특히 개별 화장실 최고!',
        author: 'CampLover',
        date: '2025-12-13',
        likeCount: 28,
        commentCount: 3,
        images: ['/images/tent_view_day.png'], // Placeholder
    },
    {
        id: 'r2',
        type: 'REVIEW',
        title: '아이들과 함께한 주말, 정이네 사이트',
        content: '사이트 간격이 넓어서 아이들이 뛰어놀기 좋았어요.',
        author: 'HappyFamily',
        date: '2025-12-12',
        likeCount: 15,
        commentCount: 0,
    },

    // STORY
    {
        id: 's1',
        type: 'STORY',
        title: '오늘 저녁은 그리들 삼겹살 🥩',
        content: '역시 캠핑은 먹는 게 남는 거죠. 다들 저녁 뭐 드시나요?',
        author: 'MeatMaster',
        date: '2025-12-14',
        likeCount: 56,
        commentCount: 22,
        images: ['/images/tent_view_day.png'],
    },
    {
        id: 's2',
        type: 'STORY',
        title: '불멍하기 딱 좋은 날씨네요',
        content: '바람도 없고 고요하니 너무 좋습니다. 힐링하고 가세요.',
        author: 'HealingStar',
        date: '2025-12-14',
        likeCount: 89,
        commentCount: 10,
    },

    // QNA
    {
        id: 'q1',
        type: 'QNA',
        title: '혹시 장작 현장에서 구매 가능한가요?',
        content: '급하게 오느라 장작을 못 사서요 ㅠㅠ',
        author: 'NewbieCamper',
        date: '2025-12-14',
        likeCount: 2,
        commentCount: 1,
        status: 'OPEN',
    },
    {
        id: 'q2',
        type: 'QNA',
        title: '입실 시간 조금 늦어질 것 같은데...',
        content: '차가 너무 막히네요. 3시쯤 도착해도 되나요?',
        author: 'LateBird',
        date: '2025-12-14',
        likeCount: 1,
        commentCount: 2,
        status: 'CLOSED',
    },

    // GROUP
    {
        id: 'g1',
        type: 'GROUP',
        title: '📸 캠핑 사진 소모임 "찰칵"',
        content: '함께 별 사진 찍으러 다니실 분 구합니다. 초보 환영!',
        author: 'PhotoGrapher',
        date: '2025-12-05',
        likeCount: 15,
        commentCount: 8,
        groupName: '찰칵',
        isHot: true,
    },
    {
        id: 'g2',
        type: 'GROUP',
        title: '🍷 와인 & 재즈',
        content: '조용히 와인 한 잔 하며 재즈 듣는 모임입니다.',
        author: 'WineLover',
        date: '2025-11-20',
        likeCount: 42,
        commentCount: 15,
        groupName: 'W&J',
    },

    // CONTENT
    {
        id: 'c1',
        type: 'CONTENT',
        title: '겨울 캠핑 필수템 BEST 5',
        content: '이거 없으면 얼어 죽습니다. 내돈내산 찐템 추천!',
        author: 'CamperTV',
        date: '2025-12-10',
        likeCount: 230,
        commentCount: 45,
        thumbnailUrl: '/images/tent_view_day.png', // Placeholder
        videoUrl: 'https://youtube.com/pk492j',
    },
    {
        id: 'c2',
        type: 'CONTENT',
        title: '감성 캠핑 요리 : 토마호크 스테이크',
        content: '비주얼 폭발! 맛도 폭발! 레시피 공개합니다.',
        author: 'ChefCamp',
        date: '2025-12-08',
        likeCount: 150,
        commentCount: 30,
        thumbnailUrl: '/images/tent_view_day.png', // Placeholder
    },
];

export const useCommunityStore = create<CommunityState>((set, get) => ({
    activeTab: 'NOTICE',
    posts: generateMockPosts(),
    setActiveTab: (tab) => set({ activeTab: tab }),
    getPostsByType: (type) => get().posts.filter((post) => post.type === type),
}));
