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
                    hero_image_url?: string
                    bank_name?: string
                    bank_account?: string
                    bank_holder?: string
                    pricing_guide_text: string | null
                    rules_guide_text: string | null
                    beginner_chips: Json
                    nearby_places: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    camp_name?: string | null
                    address_main?: string | null
                    address_detail?: string | null
                    phone_number?: string | null
                    layout_image_url?: string | null
                    guide_map_url?: string | null
                    hero_image_url?: string | null
                    bank_name?: string | null
                    bank_account?: string | null
                    bank_holder?: string | null
                    nearby_places?: Json
                    pricing_guide_text?: string | null
                    rules_guide_text?: string | null
                    beginner_chips?: Json
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    camp_name?: string | null
                    address_main?: string | null
                    address_detail?: string | null
                    phone_number?: string | null
                    layout_image_url?: string | null
                    guide_map_url?: string | null
                    hero_image_url?: string | null
                    bank_name?: string | null
                    bank_account?: string | null
                    bank_holder?: string | null
                    nearby_places?: Json
                    pricing_guide_text?: string | null
                    rules_guide_text?: string | null
                    beginner_chips?: Json
                    created_at?: string
                    updated_at?: string
                }
            }
            sites: {
                Row: {
                    id: number
                    name: string
                    type: string | null
                    description: string | null
                    capacity: number
                    base_price: number
                    weekend_price: number
                    price: number | null
                    max_occupancy: number | null
                    image_url: string | null
                    features: Json
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    name: string
                    type?: string | null
                    description?: string | null
                    capacity?: number
                    base_price?: number
                    weekend_price?: number
                    price?: number | null
                    max_occupancy?: number | null
                    image_url?: string | null
                    features?: Json
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    name?: string
                    type?: string | null
                    description?: string | null
                    capacity?: number
                    base_price?: number
                    weekend_price?: number
                    price?: number | null
                    max_occupancy?: number | null
                    image_url?: string | null
                    features?: Json
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            blocked_dates: {
                Row: {
                    id: number
                    site_id: number
                    date: string
                    start_date: string | null
                    end_date: string | null
                    reason: string | null
                    memo: string | null
                    guest_name: string | null
                    contact: string | null
                    is_paid: boolean
                    created_at: string
                }
                Insert: {
                    id?: number
                    site_id: number
                    date?: string
                    start_date?: string
                    end_date?: string
                    reason?: string | null
                    memo?: string | null
                    guest_name?: string | null
                    contact?: string | null
                    is_paid?: boolean
                    created_at?: string
                }
                Update: {
                    id?: number
                    site_id?: number
                    date?: string
                    start_date?: string
                    end_date?: string
                    reason?: string | null
                    memo?: string | null
                    guest_name?: string | null
                    contact?: string | null
                    is_paid?: boolean
                    created_at?: string
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
                    read_count: number
                    images: string[]
                    is_hot: boolean
                    meta_data: Json
                    group_id?: string
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
                    read_count?: number
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
                    read_count?: number
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
            system_config: {
                Row: {
                    id: number
                    maintenance_mode: boolean
                    reservation_enabled: boolean
                    notification_enabled: boolean
                    maintenance_message: string | null
                    updated_at: string
                    updated_by: string | null
                }
                Insert: {
                    id?: number
                    maintenance_mode?: boolean
                    reservation_enabled?: boolean
                    notification_enabled?: boolean
                    maintenance_message?: string | null
                    updated_at?: string
                    updated_by?: string | null
                }
                Update: {
                    id?: number
                    maintenance_mode?: boolean
                    reservation_enabled?: boolean
                    notification_enabled?: boolean
                    maintenance_message?: string | null
                    updated_at?: string
                    updated_by?: string | null
                }
            }
            operation_logs: {
                Row: {
                    id: number
                    action: string
                    previous_state: Json
                    new_state: Json
                    actor: string
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: number
                    action: string
                    previous_state?: Json
                    new_state?: Json
                    actor?: string
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: number
                    action?: string
                    previous_state?: Json
                    new_state?: Json
                    actor?: string
                    description?: string | null
                    created_at?: string
                }
            }
        }
    }
}

