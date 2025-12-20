import { createClient } from '@/lib/supabase-client';
import {
    Creator, CreatorContent, CreatorEpisode, CreatorComment,
    CreateContentDTO, CreateEpisodeDTO,
    CreatorContentType, CreatorContentStatus
} from '@/types/creator';

const supabase = createClient();

export const creatorService = {
    // --- Creator Profile ---
    async getCreatorProfile(userId: string) {
        const { data, error } = await supabase
            .from('creators')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
        return data as Creator | null;
    },

    async createCreatorProfile(profile: Partial<Creator>) {
        const { data, error } = await supabase
            .from('creators')
            .insert(profile)
            .select()
            .single();

        if (error) throw error;
        return data as Creator;
    },

    async upsertCreatorProfile(profile: Partial<Creator> & { id: string }) {
        const { data, error } = await supabase
            .from('creators')
            .upsert(profile, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;
        return data as Creator;
    },

    async updateCreatorProfile(userId: string, updates: Partial<Creator>) {
        // Use upsert to handle both creation and update
        return this.upsertCreatorProfile({ ...updates, id: userId });
    },

    async checkNicknameAvailability(nickname: string): Promise<boolean> {
        const { count, error } = await supabase
            .from('creators')
            .select('id', { count: 'exact', head: true })
            .eq('nickname', nickname);

        if (error) throw error;
        return count === 0;
    },

    // --- Content (Series) ---
    async getContents(status: CreatorContentStatus = 'PUBLISHED') {
        const { data, error } = await supabase
            .from('creator_contents')
            .select(`
        *,
        creators (
            id,
            bio,
            region,
            follower_count
        )
      `)
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as (CreatorContent & { creators: Creator })[];
    },

    async getMyContents(userId: string) {
        const { data, error } = await supabase
            .from('creator_contents')
            .select('*')
            .eq('creator_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as CreatorContent[];
    },

    async getContentById(id: string) {
        const { data, error } = await supabase
            .from('creator_contents')
            .select(`
        *,
        creators (
          *
        )
      `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as (CreatorContent & { creators: Creator });
    },

    async createContent(dto: CreateContentDTO) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const payload = {
            creator_id: user.id,
            ...dto,
            status: 'DRAFT', // Default to DRAFT
            published_at: null
        };

        const { data, error } = await supabase
            .from('creator_contents')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data as CreatorContent;
    },

    async updateContent(id: string, updates: Partial<CreatorContent>) {
        const { data, error } = await supabase
            .from('creator_contents')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as CreatorContent;
    },

    // --- Episodes ---
    async getEpisodes(contentId: string) {
        const { data, error } = await supabase
            .from('creator_episodes')
            .select('*')
            .eq('content_id', contentId)
            .order('episode_no', { ascending: true });

        if (error) throw error;
        return data as CreatorEpisode[];
    },

    async createEpisode(dto: CreateEpisodeDTO) {
        const payload = {
            ...dto,
            status: 'DRAFT'
        };

        const { data, error } = await supabase
            .from('creator_episodes')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data as CreatorEpisode;
    },

    async updateEpisodeStatus(contentId: string, status: CreatorContentStatus) {
        const { error } = await supabase
            .from('creator_episodes')
            .update({ status })
            .eq('content_id', contentId);

        if (error) throw error;
    },

    // --- Request Approval ---
    async requestApproval(contentId: string) {
        // 1. Update Content Status
        const { error: contentError } = await supabase
            .from('creator_contents')
            .update({ status: 'PENDING_REVIEW' })
            .eq('id', contentId);

        if (contentError) throw contentError;

        // 2. Update Episodes Status (Optional: Logic depends on if we review series or episodes. Usually Series level approval implies checking episodes)
        // For now, let's just mark content as Pending Review.
        return true;
    },

    // --- Interactions (Phase 2) ---

    // 1. Like
    async toggleLike(contentId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');

        // Check if already liked
        const { data: existing } = await supabase
            .from('creator_content_likes')
            .select('id')
            .eq('content_id', contentId)
            .eq('user_id', user.id)
            .eq('user_id', user.id)
            .maybeSingle();

        let isLiked = false;

        if (existing) {
            // Unlike
            await supabase.from('creator_content_likes').delete().eq('id', existing.id);
            isLiked = false;
        } else {
            // Like
            await supabase.from('creator_content_likes').insert({
                content_id: contentId,
                user_id: user.id
            });
            isLiked = true;
        }
        return isLiked;
    },

    async getLikeStatus(contentId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data } = await supabase
            .from('creator_content_likes')
            .select('id')
            .eq('content_id', contentId)
            .eq('user_id', user.id)
            .eq('user_id', user.id)
            .maybeSingle();

        return !!data;
    },

    // 2. Comments
    async getComments(contentId: string): Promise<CreatorComment[]> {
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;

        const { data, error } = await supabase
            .from('creator_content_comments')
            .select('*')
            .eq('content_id', contentId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map to include pseudo-info (We don't have user profiles joined yet)
        return data.map((c: any) => ({
            ...c,
            is_mine: currentUserId === c.user_id,
            user_email: c.user_id ? `user-${c.user_id.substring(0, 4)}...` : '익명' // Temporary masking
        }));
    },

    async createComment(contentId: string, content: string): Promise<CreatorComment> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');

        const { data, error } = await supabase
            .from('creator_content_comments')
            .insert({
                content_id: contentId,
                user_id: user.id,
                content
            })
            .select()
            .single();

        if (error) throw error;

        return {
            ...data,
            is_mine: true,
            user_email: user.email /* We know the current user's email */
        } as CreatorComment;
    },

    async deleteComment(commentId: string, contentId: string) {
        const { error } = await supabase
            .from('creator_content_comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;
    },

    // 3. Follow
    async toggleFollow(creatorId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        if (user.id === creatorId) throw new Error('자기 자신을 구독할 수 없습니다.');

        const { data: existing } = await supabase
            .from('creator_follows')
            .select('id')
            .eq('creator_id', creatorId)
            .eq('follower_id', user.id)
            .maybeSingle();

        let isFollowing = false;

        if (existing) {
            const { error: deleteError } = await supabase.from('creator_follows').delete().eq('id', existing.id);
            if (deleteError) throw deleteError;
            isFollowing = false;
        } else {
            const { error: insertError } = await supabase.from('creator_follows').insert({
                creator_id: creatorId,
                follower_id: user.id
            });

            if (insertError) throw insertError;
            isFollowing = true;
        }
        return isFollowing;
    },

    async getFollowStatus(creatorId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data } = await supabase
            .from('creator_follows')
            .select('id')
            .eq('creator_id', creatorId)
            .eq('follower_id', user.id)
            .eq('follower_id', user.id)
            .maybeSingle();

        return !!data;
    },

    // --- Utils ---
    async uploadImage(file: File, bucket: string = 'creator-assets'): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file); // Will fail if bucket doesn't exist, need to ensure bucket exists or use 'community-images' for now if lazy.

        if (uploadError) {
            // Fallback to community-images if creator-assets doesn't exist
            if (uploadError.message.includes('Bucket not found')) {
                const { error: retryError } = await supabase.storage
                    .from('community-images')
                    .upload(filePath, file);

                if (retryError) throw retryError;

                const { data } = supabase.storage.from('community-images').getPublicUrl(filePath);
                return data.publicUrl;
            }
            throw uploadError;
        }

        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
};
