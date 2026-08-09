'use server';

import { createAdminClient } from '@/lib/supabase-admin';

/**
 * 관리자 권한(Service Role)으로 사이트 정보 및 운영상태 수정
 */
export async function updateSiteAdmin(id: string, updates: any) {
    try {
        const supabase = createAdminClient() as any;
        const { data, error } = await supabase
            .from('sites')
            .update({
                name: updates.name,
                description: updates.description,
                price: Number(updates.price),
                base_price: Number(updates.base_price),
                max_occupancy: isNaN(Number(updates.max_occupancy)) ? 4 : Number(updates.max_occupancy),
                image_url: updates.image_url,
                image_urls: updates.image_urls,
                features: updates.features,
                is_active: updates.is_active,
                weekday: updates.weekday !== undefined ? updates.weekday : null,
                weekend: updates.weekend !== undefined ? updates.weekend : null,
                peak_weekday: updates.peak_weekday !== undefined ? updates.peak_weekday : null,
                peak_weekend: updates.peak_weekend !== undefined ? updates.peak_weekend : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select();

        if (error) {
            console.error('[updateSiteAdmin] Supabase error:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('[updateSiteAdmin] Exception:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 관리자 권한(Service Role)으로 새 사이트 생성
 */
export async function insertSiteAdmin(siteData: any) {
    try {
        const supabase = createAdminClient() as any;
        const { data, error } = await supabase
            .from('sites')
            .insert({
                id: siteData.id,
                name: siteData.name,
                type: siteData.type,
                max_occupancy: isNaN(Number(siteData.max_occupancy)) ? 4 : Number(siteData.max_occupancy),
                base_price: Number(siteData.base_price),
                price: Number(siteData.price),
                description: siteData.description || null,
                features: siteData.features || [],
                is_active: siteData.is_active !== false,
                image_url: siteData.image_url || null,
                image_urls: siteData.image_urls || [],
                weekday: siteData.weekday !== undefined ? siteData.weekday : null,
                weekend: siteData.weekend !== undefined ? siteData.weekend : null,
                peak_weekday: siteData.peak_weekday !== undefined ? siteData.peak_weekday : null,
                peak_weekend: siteData.peak_weekend !== undefined ? siteData.peak_weekend : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select();

        if (error) {
            console.error('[insertSiteAdmin] Supabase error:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('[insertSiteAdmin] Exception:', err);
        return { success: false, error: err.message };
    }
}
