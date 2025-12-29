import { createClient } from '@/lib/supabase-client';

export type PointTransactionType = 'MISSION_REWARD' | 'EVENT' | 'PURCHASE' | 'USAGE' | 'ADMIN_ADJUST';

export interface UserWallet {
    xp: number;
    point: number; // For backward compatibility in UI types if needed, but mapped to raon_token
    level: number;
    raonToken: number; // Explicit name
    goldPoint: number; // New currency
}

export const pointService = {
    /**
     * Get current user's wallet (XP, Token, Gold, Level)
     */
    getWallet: async (userId: string): Promise<UserWallet | null> => {
        const supabase = createClient();
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('xp, raon_token, gold_point, level')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching wallet:', error);
            return null;
        }

        return {
            xp: profile.xp,
            level: profile.level,
            raonToken: profile.raon_token,
            goldPoint: profile.gold_point,
            point: profile.raon_token // Map token to point for legacy support if needed
        } as UserWallet;
    },

    /**
     * Grant Reward (XP + Token + Gold)
     */
    grantReward: async (
        userId: string,
        xpAmount: number,
        tokenAmount: number,
        goldAmount: number = 0,
        reason: PointTransactionType,
        relatedId?: string
    ) => {
        const supabase = createClient();

        // RPC call
        const { error } = await supabase.rpc('grant_user_reward', {
            p_user_id: userId,
            p_xp_amount: xpAmount,
            p_token_amount: tokenAmount,
            p_gold_amount: goldAmount,
            p_reason: reason,
            p_related_id: relatedId
        });

        if (error) {
            console.error("Reward RPC failed:", error);
            throw error;
        }

        return { success: true };
    },

    /**
     * Use Points (Spend Token)
     */
    usePoint: async (userId: string, amount: number, reason: PointTransactionType) => {
        const supabase = createClient();

        const { error } = await supabase.rpc('use_user_point', {
            p_user_id: userId,
            p_amount: amount,
            p_reason: reason
        });

        if (error) throw error;
        return { success: true };
    },

    /**
     * Get Point History
     */
    getHistory: async (userId: string): Promise<PointHistory[]> => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('point_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching point history:', error);
            return [];
        }
        return data as PointHistory[];
    }
};

export interface PointHistory {
    id: string;
    user_id: string;
    amount: number;
    reason: string;
    related_mission_id?: string;
    created_at: string;
}
