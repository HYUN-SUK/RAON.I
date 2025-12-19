'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

// Check Admin Logic (Should match middleware/other admin actions)
async function checkAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    return (
        user.user_metadata?.role === 'admin' ||
        user.email === 'admin@raon.ai'
    );
}

export async function fetchGroupsAdminAction() {
    const isAdmin = await checkAdmin();
    if (!isAdmin) throw new Error('Unauthorized');

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('groups')
        .select(`
            *,
            group_members (count)
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data;
}

export async function deleteGroupAdminAction(groupId: string) {
    const isAdmin = await checkAdmin();
    if (!isAdmin) throw new Error('Unauthorized');

    const supabase = await createClient();
    const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

    if (error) throw error;

    revalidatePath('/admin/groups');
    revalidatePath('/community');
    return { success: true };
}
