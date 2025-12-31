'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function deleteNoticeAction(id: string, _formData?: FormData) {
    try {
        const supabase = await createClient()

        // 1. Verify Session
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            throw new Error('Unauthorized: No user session found')
        }

        // 2. Authorization Check (Defense in Depth)
        const isAdmin =
            user.user_metadata?.role === 'admin' ||
            user.email === 'admin@raon.ai'

        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required')
        }

        // 2. Perform Delete
        const { error, count } = await supabase
            .from('posts')
            .delete({ count: 'exact' })
            .eq('id', id)

        if (error) {
            console.error('Delete Action Error:', error)
            throw new Error(error.message)
        }

        if (count === 0) {
            throw new Error('Not Found or Permission Denied (0 rows deleted)')
        }

        // 3. Revalidate
        revalidatePath('/admin/notice')
    } catch (err: unknown) {
        console.error('Delete Action Fatal Error:', err)
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`DELETE_ERROR: ${message}`);
    }
}
