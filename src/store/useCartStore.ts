import { create } from 'zustand';
import { CartItem } from '@/types/market';
import { marketService } from '@/services/marketService';

interface CartState {
    items: CartItem[];
    isLoading: boolean;

    fetchCart: () => Promise<void>;
    addToCart: (productId: string, quantity?: number) => Promise<void>;
    updateQuantity: (itemId: string, quantity: number) => Promise<void>;
    removeItem: (itemId: string) => Promise<void>;
    clearCartLocal: () => void;

    // Computed helper
    getTotalPrice: () => number;
    getTotalCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    isLoading: false,

    fetchCart: async () => {
        set({ isLoading: true });
        try {
            const items = await marketService.getCartItems();
            set({ items });
        } catch (error) {
            console.error('Failed to fetch cart:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addToCart: async (productId: string, quantity = 1) => {
        // Optimistic UI could be added here, but for MVP we wait for server
        try {
            await marketService.addToCart(productId, quantity);
            await get().fetchCart(); // Refresh to get updated list/quantities
        } catch (error) {
            console.error('Failed to add to cart:', error);
            throw error;
        }
    },

    updateQuantity: async (itemId: string, quantity: number) => {
        const { items } = get();
        // Optimistic update
        set({
            items: items.map(item => item.id === itemId ? { ...item, quantity } : item)
        });

        try {
            await marketService.updateCartItemQuantity(itemId, quantity);
        } catch (error) {
            console.error('Failed to update quantity:', error);
            await get().fetchCart(); // Revert on error
        }
    },

    removeItem: async (itemId: string) => {
        const { items } = get();
        set({ items: items.filter(i => i.id !== itemId) });

        try {
            await marketService.removeCartItem(itemId);
        } catch (error) {
            console.error('Failed to remove item:', error);
            await get().fetchCart(); // Revert
        }
    },

    clearCartLocal: () => {
        set({ items: [] });
    },

    getTotalPrice: () => {
        const { items } = get();
        return items.reduce((total, item) => {
            return total + (item.product ? item.product.price * item.quantity : 0);
        }, 0);
    },

    getTotalCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
    }
}));
