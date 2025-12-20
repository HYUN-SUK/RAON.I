import { createClient } from '@/lib/supabase-client';
import { Product, CartItem, Order, CreateOrderDTO } from '@/types/market';

const supabase = createClient();

export const marketService = {
    // --- Products ---
    async getProducts(category?: string) {
        let query = supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Product[];
    },

    async getProductById(id: string) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Product;
    },

    // --- Cart ---
    async getCartItems() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('cart_items')
            .select(`
                *,
                product:products(*)
            `)
            .eq('user_id', user.id);

        if (error) throw error;
        // Transform to ensure strict type matching if needed, or rely on naming convention
        return data as CartItem[];
    },

    async addToCart(productId: string, quantity: number = 1) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Login required');

        // Upsert logic: if exists, increment quantity? 
        // Supabase upsert requires specifying conflict columns. 
        // But incrementing requires reading first or using a stored proc. 
        // For MVP, simple read-update or insert.

        const { data: existing } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .maybeSingle();

        if (existing) {
            const { error } = await supabase
                .from('cart_items')
                .update({ quantity: existing.quantity + quantity })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('cart_items')
                .insert({
                    user_id: user.id,
                    product_id: productId,
                    quantity: quantity
                });
            if (error) throw error;
        }
    },

    async updateCartItemQuantity(itemId: string, quantity: number) {
        if (quantity < 1) return; // or Delete?
        const { error } = await supabase
            .from('cart_items')
            .update({ quantity })
            .eq('id', itemId);

        if (error) throw error;
    },

    async removeCartItem(itemId: string) {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemId);

        if (error) throw error;
    },

    async clearCart() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', user.id);

        if (error) throw error;
    },

    // --- Orders ---
    async createOrder(dto: CreateOrderDTO) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Login required');

        const payload = {
            user_id: user.id,
            ...dto,
            status: 'PENDING'
        };

        const { data, error } = await supabase
            .from('orders')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data as Order;
    },

    async getMyOrders() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Order[];
    }
};
