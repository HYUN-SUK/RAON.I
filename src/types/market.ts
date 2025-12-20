export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

export interface Product {
    id: string;
    name: string;
    price: number;
    description: string | null;
    category: string;
    stock: number;
    images: string[];
    tags: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CartItem {
    id: string;
    user_id: string;
    product_id: string;
    quantity: number;
    created_at: string;
    updated_at: string;

    // Join view
    product?: Product;
}

export interface OrderItem {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    image_url?: string;
}

export interface Order {
    id: string;
    user_id: string;
    items: OrderItem[];
    total_price: number;
    status: OrderStatus;
    payment_info: any; // JSONB
    delivery_info: any; // JSONB
    created_at: string;
    updated_at: string;
}

export interface CreateOrderDTO {
    items: OrderItem[];
    total_price: number;
    payment_info: any;
    delivery_info: any;
}

export interface Review {
    id: string;
    product_id: string;
    user_id: string;
    rating: number;
    content: string;
    images: string[];
    created_at: string;
    updated_at: string;
    user_email?: string; // Optional join field
}

export interface CreateReviewDTO {
    product_id: string;
    rating: number;
    content: string;
    images?: string[];
}
