import { createClient } from '@/lib/supabase-client';
import {
    Creator, CreatorContent, CreatorEpisode,
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

    async updateCreatorProfile(userId: string, updates: Partial<Creator>) {
        const { data, error } = await supabase
            .from('creators')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        return data as Creator;
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
          region
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
