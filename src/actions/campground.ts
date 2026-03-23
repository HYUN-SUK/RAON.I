'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

/**
 * 캠핑장 '찜' (좋아요) 상태 토글
 */
export async function toggleHeart(campgroundId: string) {
  try {
    const supabase = await createClient();
    
    // 1. 유저 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // 2. RPC 호출 (데드락 방지 및 원자성 확보)
    const { data, error } = await supabase.rpc('toggle_campground_heart', {
      p_campground_id: campgroundId
    });

    if (error) {
      console.error('Error toggling heart:', error);
      return { success: false, error: error.message };
    }

    // 3. 관련 페이지 캐시 무효화
    revalidatePath('/myspace/wishlist');
    revalidatePath(`/campgrounds/${campgroundId}`);
    
    return { success: true, isHearted: data };
  } catch (err) {
    console.error('Unexpected error in toggleHeart:', err);
    return { success: false, error: 'Internal Server Error' };
  }
}

/**
 * 특정 캠핑장의 찜 상태 조회
 */
export async function getHeartStatus(campgroundId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('user_campground_hearts')
      .select('id')
      .eq('user_id', user.id)
      .eq('campground_id', campgroundId)
      .single();

    if (error || !data) return false;
    return true;
  } catch (err) {
    return false;
  }
}
