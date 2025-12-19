'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export interface GroupPost {
    id: string;
    content: string;
    created_at: string;
    author_name: string;
    user_id?: string; // If we join with users
    images?: string[];
    like_count: number;
    comment_count: number;
    is_liked: boolean;
}

export async function createGroupPostAction(groupId: string, content: string, images: string[] = []) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    // Fetch user profile for author_name if needed, or use metadata
    // For now assuming we have a way to get name, or just use email/placeholder
    // Actually posts table demands author_name.
    // Let's try to get it from public.users
    const { data: userData } = await supabase.from('users').select('display_name').eq('id', user.id).single();
    const authorName = userData?.display_name || user.email?.split('@')[0] || 'Unknown';

    const { error } = await supabase
        .from('posts')
        .insert({
            group_id: groupId,
            author_name: authorName, // This should probably be a relation, but sticking to flat table for now
            title: 'Group Post', // Placeholder title for strict schema
            content: content,
            type: 'STORY', // Using UPPERCASE 'STORY' to match CommunityWriteForm convention
            images: images,
            like_count: 0,
            comment_count: 0
        });

    if (error) {
        console.error('Create Post Error:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/community/groups/${groupId}`);
    return { success: true };
}

export async function getGroupPostsAction(groupId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Group Posts Error:', error);
        return [];
    }

    // Check user likes
    const { data: { user } } = await supabase.auth.getUser();
    let likedPostIds = new Set<string>();

    if (user && data.length > 0) {
        const { data: likes } = await supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', data.map(p => p.id));

        if (likes) {
            likes.forEach(l => likedPostIds.add(l.post_id));
        }
    }

    return data.map(post => ({
        ...post,
        is_liked: likedPostIds.has(post.id)
    })) as GroupPost[];
}
