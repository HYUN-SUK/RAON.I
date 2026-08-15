'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth-guard';

export async function fetchGroupsAdminAction() {
    await assertAdmin();
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
    await assertAdmin();
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
