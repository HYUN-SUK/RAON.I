'use client';

import { useEffect, useState } from 'react';
import { Flame, ChevronLeft, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface EmberStats {
    received_count: number;
    sent_count: number;
    total_tokens_spent: number;
}

interface SentEmber {
    id: string;
    target_type: 'mission' | 'post' | 'comment';
    target_id: string;
    created_at: string;
    receiver_nickname: string;
    receiver_avatar: string | null;
}

export default function EmbersPage() {
    const router = useRouter();
    const supabase = createClient();

    const [stats, setStats] = useState<EmberStats | null>(null);
    const [sentEmbers, setSentEmbers] = useState<SentEmber[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 통계 조회
            const { data: statsData } = await supabase.rpc('get_my_ember_stats');
            if (statsData?.success) {
                setStats({
                    received_count: statsData.received_count,
                    sent_count: statsData.sent_count,
                    total_tokens_spent: statsData.total_tokens_spent
                });
            }

            // 보낸 불씨 내역 조회
            const { data: sentData } = await supabase.rpc('get_sent_embers', {
                p_limit: 50,
                p_offset: 0
            });
            if (sentData?.success && sentData.embers) {
                setSentEmbers(sentData.embers);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const getTargetTypeLabel = (type: string) => {
        switch (type) {
            case 'mission': return '미션';
            case 'post': return '게시글';
            case 'comment': return '댓글';
            default: return type;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-surface-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#388E5A]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-1">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-surface-1 border-b border-surface-2">
                <div className="flex items-start px-4 py-3 gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 hover:bg-surface-2 rounded-full transition-colors mt-0.5"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            <Flame className="w-5 h-5 text-orange-500" />
                            나의 불씨
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            조용히 전하는 따뜻한 응원
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            좋아요와 달리 누가 보냈는지 알 수 없어요. 랭킹에도 영향 없는 순수한 마음 한 조각입니다.
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            {stats && (
                <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-orange-600">{stats.received_count}</p>
                            <p className="text-xs text-gray-600">받은 불씨</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-orange-500">{stats.sent_count}</p>
                            <p className="text-xs text-gray-600">남긴 불씨</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-amber-600">{stats.total_tokens_spent}</p>
                            <p className="text-xs text-gray-600">사용 토큰</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-surface-2">
                <button
                    onClick={() => setActiveTab('received')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'received'
                        ? 'text-orange-600 border-b-2 border-orange-500'
                        : 'text-gray-500'
                        }`}
                >
                    받은 불씨
                </button>
                <button
                    onClick={() => setActiveTab('sent')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'sent'
                        ? 'text-orange-600 border-b-2 border-orange-500'
                        : 'text-gray-500'
                        }`}
                >
                    남긴 불씨
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {activeTab === 'received' ? (
                    <div className="space-y-4">
                        {stats && stats.received_count > 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🔥</div>
                                <p className="text-lg font-bold text-gray-800">
                                    지금까지 {stats.received_count}개의 불씨를 받았어요
                                </p>
                                <p className="text-sm text-gray-500 mt-2">
                                    누가 보냈는지는 비밀이에요 ✨
                                </p>
                                <div className="mt-6 p-4 bg-orange-50 rounded-xl text-sm text-gray-600 max-w-xs mx-auto">
                                    <p className="italic">
                                        &ldquo;숫자로 남지 않는 따뜻한 응원,<br />
                                        그것이 불씨입니다.&rdquo;
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <div className="text-4xl mb-4">🕯️</div>
                                <p>아직 받은 불씨가 없어요</p>
                                <p className="text-sm mt-2">
                                    멋진 기록을 남기면 누군가 응원해줄거예요!
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sentEmbers.length > 0 ? (
                            sentEmbers.map((ember) => (
                                <div
                                    key={ember.id}
                                    className="bg-white rounded-xl p-4 shadow-sm border border-surface-2"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                            <Flame className="w-5 h-5 text-orange-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">
                                                {ember.receiver_nickname || '익명'}님에게
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {getTargetTypeLabel(ember.target_type)}에 불씨를 남겼어요
                                            </p>
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {formatDistanceToNow(new Date(ember.created_at), {
                                                addSuffix: true,
                                                locale: ko
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <div className="text-4xl mb-4">✨</div>
                                <p>아직 남긴 불씨가 없어요</p>
                                <p className="text-sm mt-2">
                                    다른 캠퍼의 기록에 따뜻한 응원을 보내보세요!
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
