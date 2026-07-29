'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-client';
import { PricingConfig } from '@/types/reservation';

const DEFAULT_PRICE_CONFIG: PricingConfig = {
    weekday: 40000,
    weekend: 70000,
    peakWeekday: 50000,
    peakWeekend: 70000,
    extraFamily: 35000,
    visitor: 10000,
    longStayDiscount: 10000,
    seasons: [
        { name: 'Summer Peak', startMonth: 6, startDay: 1, endMonth: 8, endDay: 30 }
    ]
};

export async function getPricingConfigAction(): Promise<{ success: boolean; data?: PricingConfig; error?: string }> {
    try {
        const supabase = createClient();
        const { data, error } = await (supabase as any)
            .from('site_config')
            .select('pricing_config')
            .eq('id', 1)
            .maybeSingle();

        if (error) {
            console.error('[getPricingConfigAction] DB Error:', error);
            return { success: true, data: DEFAULT_PRICE_CONFIG };
        }

        if (data && data.pricing_config) {
            const config = data.pricing_config as unknown as PricingConfig;
            return { success: true, data: config };
        }

        // If null or empty, seed DEFAULT_PRICE_CONFIG into DB using Admin Client
        await updatePricingConfigAction(DEFAULT_PRICE_CONFIG);
        return { success: true, data: DEFAULT_PRICE_CONFIG };
    } catch (err: any) {
        console.error('[getPricingConfigAction] Exception:', err);
        return { success: true, data: DEFAULT_PRICE_CONFIG };
    }
}

export async function updatePricingConfigAction(config: PricingConfig): Promise<{ success: boolean; error?: string }> {
    try {
        // Use createAdminClient with type cast to bypass RLS restrictions and TS generic constraints for site_config updates
        const adminSupabase = createAdminClient() as any;
        
        // Ensure month/day/price values are proper numbers before saving
        const sanitizedConfig: PricingConfig = {
            ...config,
            weekday: Number(config.weekday),
            weekend: Number(config.weekend),
            peakWeekday: Number(config.peakWeekday),
            peakWeekend: Number(config.peakWeekend),
            extraFamily: Number(config.extraFamily),
            visitor: Number(config.visitor),
            longStayDiscount: Number(config.longStayDiscount),
            seasons: (config.seasons || []).map(s => ({
                name: s.name || 'Peak Season',
                startMonth: Number(s.startMonth),
                startDay: Number(s.startDay),
                endMonth: Number(s.endMonth),
                endDay: Number(s.endDay)
            }))
        };

        // Check if row 1 exists
        const { data: existing } = await adminSupabase
            .from('site_config')
            .select('id')
            .eq('id', 1)
            .maybeSingle();

        let updateResult: any = null;

        if (existing) {
            updateResult = await adminSupabase
                .from('site_config')
                .update({ 
                    pricing_config: sanitizedConfig as any,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1)
                .select();
        } else {
            updateResult = await adminSupabase
                .from('site_config')
                .insert({
                    id: 1,
                    pricing_config: sanitizedConfig as any
                })
                .select();
        }

        if (updateResult.error) {
            console.error('[updatePricingConfigAction] Error:', updateResult.error);
            return { success: false, error: updateResult.error.message };
        }

        if (!updateResult.data || updateResult.data.length === 0) {
            console.error('[updatePricingConfigAction] 0 rows updated');
            return { success: false, error: 'DB 업데이트 권한 오류로 저장에 실패했습니다. (0 rows affected)' };
        }

        return { success: true };
    } catch (err: any) {
        console.error('[updatePricingConfigAction] Exception:', err);
        return { success: false, error: err.message || '서버 오류가 발생했습니다.' };
    }
}
