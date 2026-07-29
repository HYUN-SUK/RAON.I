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
            return { success: true, data: DEFAULT_PRICE_CONFIG };
        }

        // If DB pricing_config exists and is not null, return it
        if (data && data.pricing_config) {
            const config = data.pricing_config as unknown as PricingConfig;
            return { success: true, data: config };
        }

        // If null or empty, seed DEFAULT_PRICE_CONFIG into DB
        await updatePricingConfigAction(DEFAULT_PRICE_CONFIG);
        return { success: true, data: DEFAULT_PRICE_CONFIG };
    } catch (err: any) {
        console.error('[getPricingConfigAction] Exception:', err);
        return { success: true, data: DEFAULT_PRICE_CONFIG };
    }
}

export async function updatePricingConfigAction(config: PricingConfig): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createClient();
        
        // Ensure month/day values are proper numbers before saving
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
                    pricing_config: sanitizedConfig as any,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);
            error = updateErr;
        } else {
            const { error: insertErr } = await supabase
                .from('site_config')
                .insert({
                    id: 1,
                    pricing_config: sanitizedConfig as any
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
