'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { ArrowLeft, Heart, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface WishlistItem {
    campground: {
        id: string;
        name: string;
        address: string;
        image_url: string | null;
        rating?: number; // Optional if not in DB schema yet
    };
    created_at: string;
}

export default function WishlistPage() {
    const router = useRouter();
    const supabase = createClient();
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWishlist();
    }, []);

    const fetchWishlist = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('로그인이 필요합니다');
                router.push('/login');
                return;
            }

            const { data, error } = await supabase
                .from('user_campground_hearts')
                .select(`
                    created_at,
                    campgrounds(
                        id,
                        name,
                        address,
                        image_url
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Type assertion for the joined data
            const formattedData = (data as any[]).map(item => ({
                campground: item.campgrounds, // Supabase returns the joined table name as property
                created_at: item.created_at
            }));

            setItems(formattedData);
        } catch (error) {
            console.error('Error fetching wishlist:', error);
            toast.error('위시리스트를 불러오지 못했어요');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (campgroundId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('user_campground_hearts')
                .delete()
                .eq('user_id', user.id)
                .eq('campground_id', campgroundId);

            if (error) throw error;

            setItems(prev => prev.filter(item => item.campground.id !== campgroundId));
            toast.success('찜 목록에서 삭제했어요');
        } catch (error) {
            console.error('Error removing favorite:', error);
            toast.error('삭제에 실패했어요');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <div className="flex items-center px-4 h-14 gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-gray-100"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900">나의 위시리스트</h1>
                </div>
            </header>

            {/* List */}
            <main className="p-4">
                {loading ? (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white p-3 rounded-2xl flex gap-4">
                                <Skeleton className="w-24 h-24 rounded-xl" />
                                <div className="flex-1 space-y-2 py-2">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : items.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {items.map((item) => (
                            <div
                                key={item.campground.id}
                                onClick={() => {/* Navigate to detail if available */ }}
                                className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex gap-4 active:scale-[0.98] transition-all"
                            >
                                {/* Thumbnail */}
                                <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
                                    {item.campground.image_url ? (
                                        <img
                                            src={item.campground.image_url}
                                            alt={item.campground.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <MapPin className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-gray-900 line-clamp-1">
                                                {item.campground.name}
                                            </h3>
                                            <button
                                                onClick={(e) => handleRemove(item.campground.id, e)}
                                                className="text-red-500 p-1 -mr-2 -mt-2 hover:bg-red-50 rounded-full"
                                            >
                                                <Heart className="w-5 h-5 fill-current" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                            {item.campground.address}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1 text-xs text-brand-1 font-medium bg-brand-1/5 w-fit px-2 py-1 rounded-md">
                                        <Star className="w-3 h-3 fill-current" />
                                        <span>추천 캠핑장</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <Heart className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">찜한 캠핑장이 없어요</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            마음에 드는 캠핑장을 발견하면<br />
                            하트 버튼을 눌러 찜해보세요!
                        </p>
                        <Button
                            onClick={() => router.back()}
                            variant="outline"
                            className="rounded-full px-6"
                        >
                            캠핑장 둘러보기
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
