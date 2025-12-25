import { createClient } from '@/lib/supabase-client';
import { Database } from '@/types/supabase';
import { useEffect, useState } from 'react';

type SiteConfig = Database['public']['Tables']['site_config']['Row'];

export function useSiteConfig() {
    const [config, setConfig] = useState<SiteConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('site_config')
                .select('*')
                .eq('id', 1)
                .single();

            if (error) {
                console.warn('Failed to fetch site config:', error.message);
                return;
            }
            if (data) setConfig(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return { config, loading, refetch: fetchConfig };
}
