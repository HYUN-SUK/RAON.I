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
