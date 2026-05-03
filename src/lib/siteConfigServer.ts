import { createClient } from './supabase-server';
import { Database } from '@/types/supabase';

type SiteConfig = Database['public']['Tables']['site_config']['Row'];

/**
 * 서버 측에서 site_config 정보를 가져오는 유틸리티
 * 캐싱을 고려하여 설계하거나, 필요한 시점에 실시간 조회합니다.
 */
export async function getSiteConfigServer(): Promise<SiteConfig | null> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('site_config')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('[siteConfigServer] Failed to fetch site config:', error.message);
            return null;
        }

        return data;
    } catch (err) {
        console.error('[siteConfigServer] Error:', err);
        return null;
    }
}
