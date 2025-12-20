import { create } from 'zustand';
import { marketService } from '@/services/marketService';
import { Review, Order, CreateReviewDTO } from '@/types/market';

interface MarketStore {
    reviews: Record<string, Review[]>; // productId -> reviews mapping
    orders: Order[];
    isLoading: boolean;
    error: string | null;

    fetchReviews: (productId: string) => Promise<void>;
    createReview: (dto: CreateReviewDTO) => Promise<void>;

    fetchMyOrders: () => Promise<void>;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
    reviews: {},
    orders: [],
    isLoading: false,
    error: null,

    fetchReviews: async (productId: string) => {
        set({ isLoading: true, error: null });
        try {
            const data = await marketService.getReviews(productId);
            set((state) => ({
                reviews: {
                    ...state.reviews,
                    [productId]: data
                },
                isLoading: false
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    createReview: async (dto: CreateReviewDTO) => {
        set({ isLoading: true, error: null });
        try {
            const newReview = await marketService.createReview(dto);
            const productId = dto.product_id;

            set((state) => {
                const currentReviews = state.reviews[productId] || [];
                return {
                    reviews: {
                        ...state.reviews,
                        [productId]: [newReview, ...currentReviews]
                    },
                    isLoading: false
                };
            });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    fetchMyOrders: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await marketService.getMyOrders();
            set({ orders: data, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    }
}));
