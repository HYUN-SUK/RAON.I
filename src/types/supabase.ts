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
            profiles: {
                Row: {
                    id: string
                    email: string | null
                    nickname: string | null
                    avatar_url: string | null
                    role: string
                    raon_token: number
                    xp: number
                    level: number
                    family_type: string | null
                    interests: string[] | null
                    created_at: string
                }
                Insert: {
                    id: string
                    email?: string | null
                    nickname?: string | null
                    avatar_url?: string | null
                    role?: string
                    raon_token?: number
                    xp?: number
                    level?: number
                    family_type?: string | null
                    interests?: string[] | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    email?: string | null
                    nickname?: string | null
                    avatar_url?: string | null
                    role?: string
                    raon_token?: number
                    xp?: number
                    level?: number
                    family_type?: string | null
                    interests?: string[] | null
                    created_at?: string
                }
            }
            reservations: {
                Row: {
                    id: string
                    created_at: string
                    user_id: string
                    site_id: string
                    check_in_date: string
                    check_out_date: string
                    adult_count: number
                    child_count: number
                    visitor_count: number
                    vehicle_count: number
                    total_price: number
                    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED' | 'COMPLETED'
                    payment_status: string
                    depositor_name: string
                    phone: string
                    request_text: string | null
                    admin_memo: string | null
                    refund_bank: string | null
                    refund_account: string | null
                    refund_holder: string | null
                    cancel_reason: string | null
                    cancelled_at: string | null
                    refunded_at: string | null
                    refund_amount: number
                    refund_rate: number
                }
                Insert: {
                    id?: string
                    created_at?: string
                    user_id: string
                    site_id: string
                    check_in_date: string
                    check_out_date: string
                    adult_count?: number
                    child_count?: number
                    visitor_count?: number
                    vehicle_count?: number
                    total_price: number
                    status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED' | 'COMPLETED'
                    payment_status?: string
                    depositor_name: string
                    phone: string
                    request_text?: string | null
                    admin_memo?: string | null
                    refund_bank?: string | null
                    refund_account?: string | null
                    refund_holder?: string | null
                    cancel_reason?: string | null
                    cancelled_at?: string | null
                    refunded_at?: string | null
                    refund_amount?: number
                    refund_rate?: number
                }
                Update: {
                    id?: string
                    created_at?: string
                    user_id?: string
                    site_id?: string
                    check_in_date?: string
                    check_out_date?: string
                    adult_count?: number
                    child_count?: number
                    visitor_count?: number
                    vehicle_count?: number
                    total_price?: number
                    status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED' | 'COMPLETED'
                    payment_status?: string
                    depositor_name?: string
                    phone?: string
                    request_text?: string | null
                    admin_memo?: string | null
                    refund_bank?: string | null
                    refund_account?: string | null
                    refund_holder?: string | null
                    cancel_reason?: string | null
                    cancelled_at?: string | null
                    refunded_at?: string | null
                    refund_amount?: number
                    refund_rate?: number
                }
            }
            sites: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    base_price: number
                    capacity: number
                    image_url: string | null
                    created_at: string
                    site_type: string | null
                    features: string[] | null
                    is_active: boolean
                    price: number | null
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    base_price: number
                    capacity: number
                    image_url?: string | null
                    created_at?: string
                    site_type?: string | null
                    features?: string[] | null
                    is_active?: boolean
                    price?: number | null
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    base_price?: number
                    capacity?: number
                    image_url?: string | null
                    created_at?: string
                    site_type?: string | null
                    features?: string[] | null
                    is_active?: boolean
                    price?: number | null
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
            }
            site_config: {
                Row: {
                    id: string
                    camp_name: string | null
                    address_main: string | null
                    address_detail: string | null
                    phone_number: string | null
                    layout_image_url: string | null
                    guide_map_url: string | null
                    pricing_guide_text: string | null
                    rules_guide_text: string | null
                    hero_image_url: string | null
                    bank_name: string | null
                    bank_account: string | null
                    bank_holder: string | null

                    facilities_description: string | null
                    bathroom_images: string[] | null
                    site_images: string[] | null
                    nearby_places: Json | null
                    market_categories: Json | null

                    mission_reward_1st_xp: number | null
                    mission_reward_1st_token: number | null
                    mission_reward_2nd_xp: number | null
                    mission_reward_2nd_token: number | null
                    mission_reward_3rd_xp: number | null
                    mission_reward_3rd_token: number | null

                    refund_policy: Json | null
                    refund_rules_text: string | null

                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    camp_name?: string | null
                    address_main?: string | null
                    address_detail?: string | null
                    phone_number?: string | null
                    layout_image_url?: string | null
                    guide_map_url?: string | null
                    pricing_guide_text?: string | null
                    rules_guide_text?: string | null
                    hero_image_url?: string | null
                    bank_name?: string | null
                    bank_account?: string | null
                    bank_holder?: string | null

                    facilities_description?: string | null
                    bathroom_images?: string[] | null
                    site_images?: string[] | null
                    nearby_places?: Json | null
                    market_categories?: Json | null

                    mission_reward_1st_xp?: number | null
                    mission_reward_1st_token?: number | null
                    mission_reward_2nd_xp?: number | null
                    mission_reward_2nd_token?: number | null
                    mission_reward_3rd_xp?: number | null
                    mission_reward_3rd_token?: number | null

                    refund_policy?: Json | null
                    refund_rules_text?: string | null

                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    camp_name?: string | null
                    address_main?: string | null
                    address_detail?: string | null
                    phone_number?: string | null
                    layout_image_url?: string | null
                    guide_map_url?: string | null
                    pricing_guide_text?: string | null
                    rules_guide_text?: string | null
                    hero_image_url?: string | null
                    bank_name?: string | null
                    bank_account?: string | null
                    bank_holder?: string | null

                    facilities_description?: string | null
                    bathroom_images?: string[] | null
                    site_images?: string[] | null
                    nearby_places?: Json | null
                    market_categories?: Json | null

                    mission_reward_1st_xp?: number | null
                    mission_reward_1st_token?: number | null
                    mission_reward_2nd_xp?: number | null
                    mission_reward_2nd_token?: number | null
                    mission_reward_3rd_xp?: number | null
                    mission_reward_3rd_token?: number | null

                    refund_policy?: Json | null
                    refund_rules_text?: string | null

                    created_at?: string
                    updated_at?: string
                }
            }
            nearby_events: {
                Row: {
                    id: string
                    title: string
                    addr1: string | null
                    mapx: number | null
                    mapy: number | null
                    firstimage: string | null
                    contentid: string | null
                    contenttypeid: string | null
                    tel: string | null
                    eventstartdate: string | null
                    eventenddate: string | null
                    created_at: string
                    // Admin UI friendly aliases
                    location?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    image_url?: string | null
                }
                Insert: {
                    id?: string
                    title: string
                    addr1?: string | null
                    mapx?: number | null
                    mapy?: number | null
                    firstimage?: string | null
                    contentid?: string | null
                    contenttypeid?: string | null
                    tel?: string | null
                    eventstartdate?: string | null
                    eventenddate?: string | null
                    created_at?: string
                    location?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    image_url?: string | null
                }
                Update: {
                    id?: string
                    title?: string
                    addr1?: string | null
                    mapx?: number | null
                    mapy?: number | null
                    firstimage?: string | null
                    contentid?: string | null
                    contenttypeid?: string | null
                    tel?: string | null
                    eventstartdate?: string | null
                    eventenddate?: string | null
                    created_at?: string
                    location?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    image_url?: string | null
                }
            }
            recommendation_pool: {
                Row: {
                    id: string
                    category: 'cooking' | 'play'
                    title: string
                    description: string | null
                    image_url: string | null
                    tags: string[] | null
                    weather_condition: string[] | null
                    time_condition: string[] | null
                    season_condition: string[] | null
                    min_temp: number | null
                    max_temp: number | null

                    // Enhanced fields
                    ingredients: Json | null
                    process_steps: Json | null
                    tips: string | null
                    time_required: number | null
                    difficulty: number | null
                    servings: string | null
                    calories: number | null
                    age_group: string | null
                    location_type: string | null

                    min_participants: number | null
                    max_participants: number | null
                    materials: string[] | null

                    created_at: string
                }
                Insert: {
                    id?: string
                    category: 'cooking' | 'play'
                    title: string
                    description?: string | null
                    image_url?: string | null
                    tags?: string[] | null
                    weather_condition?: string[] | null
                    time_condition?: string[] | null
                    season_condition?: string[] | null
                    min_temp?: number | null
                    max_temp?: number | null
                    ingredients?: Json | null
                    process_steps?: Json | null
                    tips?: string | null
                    time_required?: number | null
                    difficulty?: number | null
                    servings?: string | null
                    calories?: number | null
                    age_group?: string | null
                    location_type?: string | null
                    min_participants?: number | null
                    max_participants?: number | null
                    materials?: string[] | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    category?: 'cooking' | 'play'
                    title?: string
                    description?: string | null
                    image_url?: string | null
                    tags?: string[] | null
                    weather_condition?: string[] | null
                    time_condition?: string[] | null
                    season_condition?: string[] | null
                    min_temp?: number | null
                    max_temp?: number | null
                    ingredients?: Json | null
                    process_steps?: Json | null
                    tips?: string | null
                    time_required?: number | null
                    difficulty?: number | null
                    servings?: string | null
                    calories?: number | null
                    age_group?: string | null
                    location_type?: string | null
                    min_participants?: number | null
                    max_participants?: number | null
                    materials?: string[] | null
                    created_at?: string
                }
            }
            missions: {
                Row: {
                    id: string
                    title: string
                    description: string | null
                    reward_xp: number
                    reward_point: number
                    start_date: string
                    end_date: string
                    is_active: boolean
                    mission_type: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    description?: string | null
                    reward_xp: number
                    reward_point: number
                    start_date: string
                    end_date: string
                    is_active?: boolean
                    mission_type?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    description?: string | null
                    reward_xp?: number
                    reward_point?: number
                    start_date?: string
                    end_date?: string
                    is_active?: boolean
                    mission_type?: string
                    created_at?: string
                }
            }
            user_missions: {
                Row: {
                    id: string
                    user_id: string
                    mission_id: string
                    status: 'JOINED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMED'
                    progress: number
                    completed_at: string | null
                    joined_at: string
                    proof_image_url: string | null
                    proof_text: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    mission_id: string
                    status?: 'JOINED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMED'
                    progress?: number
                    completed_at?: string | null
                    joined_at?: string
                    proof_image_url?: string | null
                    proof_text?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    mission_id?: string
                    status?: 'JOINED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMED'
                    progress?: number
                    completed_at?: string | null
                    joined_at?: string
                    proof_image_url?: string | null
                    proof_text?: string | null
                }
            }
            ember_supports: {
                Row: {
                    id: string
                    sender_id: string | null
                    receiver_id: string | null
                    target_type: string
                    target_id: string
                    message: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    sender_id?: string | null
                    receiver_id?: string | null
                    target_type?: string
                    target_id: string
                    message?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    sender_id?: string | null
                    receiver_id?: string | null
                    target_type?: string
                    target_id?: string
                    message?: string | null
                    created_at?: string
                }
            }
            point_history: {
                Row: {
                    id: string
                    user_id: string
                    type: string
                    xp_delta: number
                    token_delta: number
                    gold_delta: number
                    reason: string | null
                    related_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    type: string
                    xp_delta?: number
                    token_delta?: number
                    gold_delta?: number
                    reason?: string | null
                    related_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    type?: string
                    xp_delta?: number
                    token_delta?: number
                    gold_delta?: number
                    reason?: string | null
                    related_id?: string | null
                    created_at?: string
                }
            }
            posts: {
                Row: {
                    id: string
                    author_id: string
                    author_name: string | null
                    type: string
                    title: string
                    content: string
                    images: string[] | null
                    meta_data: Json | null
                    like_count: number
                    comment_count: number
                    read_count: number
                    is_hot: boolean
                    group_id: string | null
                    created_at: string
                    updated_at: string | null
                    // Legacy/Others (keeping for safety if used elsewhere)
                    user_id?: string
                    category?: string
                    view_count?: number
                    image_urls?: string[] | null
                    is_notice?: boolean
                }
                Insert: {
                    id?: string
                    author_id?: string
                    author_name?: string | null
                    type?: string
                    title: string
                    content: string
                    images?: string[] | null
                    meta_data?: Json | null
                    like_count?: number
                    comment_count?: number
                    read_count?: number
                    is_hot?: boolean
                    group_id?: string | null
                    created_at?: string
                    updated_at?: string | null
                    user_id?: string
                    category?: string
                    view_count?: number
                    image_urls?: string[] | null
                    is_notice?: boolean
                }
                Update: {
                    id?: string
                    author_id?: string
                    author_name?: string | null
                    type?: string
                    title?: string
                    content?: string
                    images?: string[] | null
                    meta_data?: Json | null
                    like_count?: number
                    comment_count?: number
                    read_count?: number
                    is_hot?: boolean
                    group_id?: string | null
                    created_at?: string
                    updated_at?: string | null
                    user_id?: string
                    category?: string
                    view_count?: number
                    image_urls?: string[] | null
                    is_notice?: boolean
                }
            }
            comments: {
                Row: {
                    id: string
                    post_id: string
                    user_id: string
                    author_name: string | null
                    content: string
                    image_url: string | null
                    created_at: string
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    post_id: string
                    user_id: string
                    author_name?: string | null
                    content: string
                    image_url?: string | null
                    created_at?: string
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    post_id?: string
                    user_id?: string
                    author_name?: string | null
                    content?: string
                    image_url?: string | null
                    created_at?: string
                    updated_at?: string | null
                }
            }
            likes: {
                Row: {
                    id: string
                    post_id: string
                    user_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    post_id: string
                    user_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    post_id?: string
                    user_id?: string
                    created_at?: string
                }
            }
            market_products: {
                Row: {
                    id: string
                    name: string
                    description: string
                    price: number
                    image_url: string | null
                    category: string
                    created_at: string
                    status: string
                    stock: number
                    seller_id: string | null

                    // v2 Fields
                    video_url: string | null
                    video_type: string | null
                    badges: string[] | null
                }
                Insert: {
                    id?: string
                    name: string
                    description: string
                    price: number
                    image_url?: string | null
                    category: string
                    created_at?: string
                    status?: string
                    stock?: number
                    seller_id?: string | null
                    video_url?: string | null
                    video_type?: string | null
                    badges?: string[] | null
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string
                    price?: number
                    image_url?: string | null
                    category?: string
                    created_at?: string
                    status?: string
                    stock?: number
                    seller_id?: string | null
                    video_url?: string | null
                    video_type?: string | null
                    badges?: string[] | null
                }
            }
            // Add more tables as needed for full build safety
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_my_ember_stats: {
                Args: Record<PropertyKey, never>
                Returns: Json
            }
            send_ember: {
                Args: {
                    p_receiver_id: string
                    p_target_id: string
                    p_target_type?: string
                    p_message?: string
                }
                Returns: Json
            }
            get_ember_count: {
                Args: { p_user_id: string }
                Returns: number
            }
            get_target_ember_count: {
                Args: { p_target_type: string, p_target_id: string }
                Returns: number
            }
            calculate_refund_rate: {
                Args: { p_check_in_date: string }
                Returns: number
            }
            request_reservation_cancel: {
                Args: {
                    p_reservation_id: string
                    p_refund_bank: string
                    p_refund_account: string
                    p_refund_holder: string
                    p_cancel_reason?: string
                }
                Returns: Json
            }
            complete_reservation_refund: {
                Args: { p_reservation_id: string }
                Returns: Json
            }
            get_my_reservations: {
                Args: Record<PropertyKey, never>
                Returns: Database['public']['Tables']['reservations']['Row'][]
            }
        }
        Enums: {
            [_ in never]: never
        }
    }
}
