'use server';

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
        { name: 'Summer Peak', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 }
    ]
};

export async function getPricingConfigAction(): Promise<{ success: boolean; data?: PricingConfig; error?: string }> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('site_config')
            .select('pricing_config')
            .eq('id', 1)
            .maybeSingle();

        if (error) {
            console.error('[getPricingConfigAction] DB Error:', error);
            // 컬럼이 아직 존재하지 않는 경우 등 실패시 기본값 폴백
            return { success: true, data: DEFAULT_PRICE_CONFIG };
        }

        if (data && data.pricing_config) {
            const config = data.pricing_config as unknown as PricingConfig;
            return { success: true, data: config };
        }

        return { success: true, data: DEFAULT_PRICE_CONFIG };
    } catch (err: any) {
        console.error('[getPricingConfigAction] Exception:', err);
        return { success: true, data: DEFAULT_PRICE_CONFIG };
    }
}

export async function updatePricingConfigAction(config: PricingConfig): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createClient();
        
        // 1. Check if row 1 exists
        const { data: existing } = await supabase
            .from('site_config')
            .select('id')
            .eq('id', 1)
            .maybeSingle();

        let error = null;
        if (existing) {
            const { error: updateErr } = await supabase
                .from('site_config')
                .update({ 
                    pricing_config: config as any,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);
            error = updateErr;
        } else {
            const { error: insertErr } = await supabase
                .from('site_config')
                .insert({
                    id: 1,
                    pricing_config: config as any
                });
            error = insertErr;
        }

        if (error) {
            console.error('[updatePricingConfigAction] Error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('[updatePricingConfigAction] Exception:', err);
        return { success: false, error: err.message || '서버 오류가 발생했습니다.' };
    }
}
