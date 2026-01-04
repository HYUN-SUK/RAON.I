export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            site_config: {
                Row: {
                    id: number
                    camp_name: string
                    address_main: string
                    address_detail?: string
                    phone_number: string
                    layout_image_url?: string
                    guide_map_url?: string
                    pricing_guide_text: string | null
                    rules_guide_text: string | null
                    beginner_chips: Json
                    nearby_places: Json
                    created_at: string
                    updated_at: string
                    hero_image_url?: string | null
                    bank_name?: string | null
                    bank_account?: string | null
                    bank_holder?: string | null
                }
                Insert: {
                    id?: number
                    camp_name?: string | null
                    address_main?: string | null
                    address_detail?: string | null
                    phone_number?: string | null
                    layout_image_url?: string | null
                    guide_map_url?: string | null
                    nearby_places?: Json
                    pricing_guide_text?: string | null
                    rules_guide_text?: string | null
                    beginner_chips?: Json
                    created_at?: string
                    updated_at?: string
                    hero_image_url?: string | null
                    bank_name?: string | null
                    bank_account?: string | null
                    bank_holder?: string | null
                }
                Update: {
                    id?: number
                    camp_name?: string | null
                    address_main?: string | null
                    address_detail?: string | null
                    phone_number?: string | null
                    layout_image_url?: string | null
                    guide_map_url?: string | null
                    nearby_places?: Json
                    pricing_guide_text?: string | null
                    rules_guide_text?: string | null
                    beginner_chips?: Json
                    created_at?: string
                    updated_at?: string
                    hero_image_url?: string | null
                    bank_name?: string | null
                    bank_account?: string | null
                    bank_holder?: string | null
                }
            }
            blocked_dates: {
                Row: {
                    id: string
                    site_id: string
                    start_date: string
                    end_date: string
                    memo: string | null
                    is_paid: boolean
                    guest_name: string | null
                    contact: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    site_id: string
                    start_date: string
                    end_date: string
                    memo?: string | null
                    is_paid?: boolean
                    guest_name?: string | null
                    contact?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    site_id?: string
                    start_date?: string
                    end_date?: string
                    memo?: string | null
                    is_paid?: boolean
                    guest_name?: string | null
                    contact?: string | null
                    created_at?: string
                }
                Relationships: []
            }
            sites: {
                Row: {
                    id: string
                    name: string
                    type: string | null
                    description: string | null
                    price: number
                    base_price: number
                    max_occupancy: number
                    image_url: string | null
                    features: string[] | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    name: string
                    type?: string | null
                    description?: string | null
                    price?: number
                    base_price?: number
                    max_occupancy?: number
                    image_url?: string | null
                    features?: string[] | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    type?: string | null
                    description?: string | null
                    price?: number
                    base_price?: number
                    max_occupancy?: number
                    image_url?: string | null
                    features?: string[] | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            recommendation_pool: {
                Row: {
                    id: number
                    category: string
                    title: string
                    description: string | null
                    image_url: string | null
                    tags: Json
                    content_url: string | null
                    metadata: Json
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    // V2 Fields
                    difficulty: number | null
                    time_required: number | null
                    min_participants: number | null
                    max_participants: number | null
                    materials: Json
                    ingredients: Json
                    process_steps: Json

                    tips: string | null
                    // V2.1 Fields
                    servings: string | null
                    calories: number | null
                    age_group: string | null
                    location_type: string | null
                }
                Insert: {
                    id?: number
                    category: string
                    title: string
                    description?: string | null
                    image_url?: string | null
                    tags?: Json
                    content_url?: string | null
                    metadata?: Json
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    // V2 Fields
                    difficulty?: number | null
                    time_required?: number | null
                    min_participants?: number | null
                    max_participants?: number | null

                    materials?: Json
                    ingredients?: Json
                    process_steps?: Json

                    tips?: string | null
                    // V2.1 Fields
                    servings?: string | null
                    calories?: number | null
                    age_group?: string | null
                    location_type?: string | null
                }
                Update: {
                    id?: number
                    category?: string
                    title?: string
                    description?: string | null
                    image_url?: string | null
                    tags?: Json
                    content_url?: string | null
                    metadata?: Json
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    // V2 Fields
                    difficulty?: number | null
                    time_required?: number | null
                    min_participants?: number | null
                    max_participants?: number | null
                    materials?: Json
                    ingredients?: Json
                    process_steps?: Json

                    tips?: string | null
                    // V2.1 Fields
                    servings?: string | null
                    calories?: number | null
                    age_group?: string | null
                    location_type?: string | null
                }
            }
            nearby_events: {
                Row: {
                    id: number
                    title: string
                    description: string | null
                    location: string | null
                    latitude: number | null
                    longitude: number | null
                    start_date: string | null
                    end_date: string | null
                    image_url: string | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    title: string
                    description?: string | null
                    location?: string | null
                    latitude?: number | null
                    longitude?: number | null
                    start_date?: string | null
                    end_date?: string | null
                    image_url?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    title?: string
                    description?: string | null
                    location?: string | null
                    latitude?: number | null
                    longitude?: number | null
                    start_date?: string | null
                    end_date?: string | null
                    image_url?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            posts: {
                Row: {
                    id: string
                    created_at: string
                    type: string
                    title: string
                    content: string
                    author_name: string
                    like_count: number
                    comment_count: number
                    images: string[]
                    is_hot: boolean
                    meta_data: Json
                    group_id?: string // Added manually to match migration
                }
                Insert: {
                    id?: string
                    created_at?: string
                    type: string
                    title: string
                    content: string
                    author_name: string
                    like_count?: number
                    comment_count?: number
                    images?: string[]
                    is_hot?: boolean
                    meta_data?: Json
                    group_id?: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    type?: string
                    title?: string
                    content?: string
                    author_name?: string
                    like_count?: number
                    comment_count?: number
                    images?: string[]
                    is_hot?: boolean
                    meta_data?: Json
                    group_id?: string
                }
            }
            likes: {
                Row: {
                    id: string
                    created_at: string
                    post_id: string
                    user_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    post_id: string
                    user_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    post_id?: string
                    user_id?: string
                }
            }
            comments: {
                Row: {
                    id: string
                    created_at: string
                    post_id: string
                    user_id: string // Optional if anonymous allowed, but standardizing
                    author_name: string
                    content: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    post_id: string
                    user_id?: string
                    author_name: string
                    content: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    post_id?: string
                    user_id?: string
                    author_name?: string
                    content?: string
                }
            }
        }
    }
}
