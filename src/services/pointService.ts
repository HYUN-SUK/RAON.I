import { createClient } from '@/lib/supabase-client';
import { POINT_POLICY, PointActionType, getLevelInfo } from '@/config/pointPolicy';

export type PointTransactionType = PointActionType | 'EVENT' | 'PURCHASE' | 'USAGE' | 'ADMIN_ADJUST';

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
     * Grant Reward by Action Type (High Level)
     * Handles Daily Limit check for LOGIN automatically.
     */
    grantAction: async (userId: string, action: PointActionType, relatedId?: string) => {
        const supabase = createClient();

        // 1. Get Policy Values
        let xp = 0;
        let token = 0;

        if (action === 'MISSION_COMPLETE') {
            // For mission, values should be passed via grantReward direct call or we need to fetch mission. 
            // This method is for static policy actions.
            console.warn("Use grantReward for MISSION_COMPLETE to specify exact amounts.");
            return { success: false, reason: 'Use grantReward for dynamic mission rewards' };
        } else {
            const policy = POINT_POLICY.ACTIONS[action as keyof typeof POINT_POLICY.ACTIONS];
            if (!policy) return { success: false, reason: 'Invalid Action' };
            xp = policy.xp;
            token = policy.token;
        }

        // 2. Check Daily Limit for Login
        if (action === 'LOGIN') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { count } = await supabase
                .from('point_history')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('reason', 'LOGIN')
                .gte('created_at', today.toISOString());

            if (count && count > 0) {
                return { success: false, reason: 'Already rewarded today' };
            }
        }

        // 3. Grant
        return await pointService.grantReward(userId, xp, token, 0, action, relatedId);
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
