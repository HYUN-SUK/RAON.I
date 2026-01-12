export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

export type VideoType = 'youtube' | 'youtube_shorts' | 'instagram' | 'tiktok' | null;
export type ProductBadge = 'free_shipping' | 'quality_guarantee' | 'limited_stock' | 'gift_included' | 'best_seller' | 'new_arrival';

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
    type: 'INTERNAL' | 'EXTERNAL';
    link: string | null;
    // 데이터 최적화 필드
    video_url?: string | null;      // YouTube/쇼츠/릴스 임베드 URL
    video_type?: VideoType;         // 영상 플랫폼 유형
    badges?: ProductBadge[];        // 혜택 배지
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
    payment_info: Record<string, any>; // JSONB
    delivery_info: Record<string, any>; // JSONB
    created_at: string;
    updated_at: string;
}

export interface CreateOrderDTO {
    items: OrderItem[];
    total_price: number;
    payment_info: Record<string, any>;
    delivery_info: Record<string, any>;
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

export interface CreateProductDTO {
    name: string;
    price: number;
    description?: string;
    category: string;
    stock: number;
    images: string[];
    tags: string[];
    is_active: boolean;
    type: 'INTERNAL' | 'EXTERNAL';
    link?: string;
    // 데이터 최적화 필드
    video_url?: string;
    video_type?: VideoType;
    badges?: ProductBadge[];
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {
    id: string;
}
