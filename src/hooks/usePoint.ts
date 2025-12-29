import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { pointService, UserWallet } from '@/services/pointService';

export const usePoint = (userId?: string) => {
    const [wallet, setWallet] = useState<UserWallet | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const [history, setHistory] = useState<any[]>([]); // Use PointHistory type if available, using any to avoid import cycles for now

    const fetchWallet = async () => {
        if (!userId) return;
        try {
            setLoading(true);
            const [walletData, historyData] = await Promise.all([
                pointService.getWallet(userId),
                pointService.getHistory(userId)
            ]);
            setWallet(walletData);
            setHistory(historyData);
        } catch (err) {
            console.error('Failed to fetch wallet/history:', err);
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchWallet();
        } else {
            setLoading(false);
        }
    }, [userId]);

    // Simple listener for point updates (could be improved with realtime subscription later)
    const refresh = () => {
        fetchWallet();
    };

    return { wallet, history, loading, error, refresh };
};
export type UsePointResult = ReturnType<typeof usePoint>;
