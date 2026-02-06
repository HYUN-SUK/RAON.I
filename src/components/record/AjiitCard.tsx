'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Share2, Download, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { CampingRecord } from '@/actions/record';

interface AjiitCardProps {
    record: CampingRecord & {
        campground_name?: string;
        campground_address?: string;
    };
    onShare?: () => void;
    onDownload?: () => void;
}

export default function AjiitCard({ record, onShare, onDownload }: AjiitCardProps) {
    const formattedDate = format(new Date(record.created_at), 'yyyy.MM.dd', { locale: ko });

    // 공유 기능
    const handleShare = async () => {
        if (onShare) {
            onShare();
            return;
        }

        try {
            if (navigator.share) {
                await navigator.share({
                    title: '나의 캠핑 기록',
                    text: `${record.campground_name || '캠핑장'} - ${record.tags.map(t => `#${t}`).join(' ')}`,
                    url: window.location.href,
                });
            } else {
                // 클립보드에 복사
                await navigator.clipboard.writeText(
                    `🏕️ ${record.campground_name || '캠핑 기록'}\n${record.content}\n${record.tags.map(t => `#${t}`).join(' ')}`
                );
                toast.success('클립보드에 복사되었어요!');
            }
        } catch (err) {
            console.error('Share error:', err);
        }
    };

    // 이미지 다운로드
    const handleDownload = async () => {
        if (onDownload) {
            onDownload();
            return;
        }

        if (!record.photo_url) {
            toast.error('저장할 이미지가 없어요');
            return;
        }

        try {
            const response = await fetch(record.photo_url);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `camping-${formattedDate}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('이미지가 저장되었어요!');
        } catch (err) {
            console.error('Download error:', err);
            toast.error('다운로드에 실패했어요');
        }
    };

    return (
        <div className="bg-gradient-to-br from-[#f0f7f2] to-[#e8f5eb] rounded-2xl shadow-lg overflow-hidden max-w-sm mx-auto">
            {/* 헤더 */}
            <div className="bg-[#224732] text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🌲</span>
                    <span className="font-medium">나의 캠핑 기록</span>
                    <span className="text-lg">🌲</span>
                </div>
                <span className="text-sm opacity-80">{formattedDate}</span>
            </div>

            {/* 캠핑장 정보 */}
            {(record.campground_name || record.campground_address) && (
                <div className="px-4 py-2 bg-white/50 border-b border-[#224732]/10">
                    {record.campground_name && (
                        <div className="flex items-center gap-1.5 text-[#224732]">
                            <MapPin className="w-4 h-4" />
                            <span className="font-medium">{record.campground_name}</span>
                        </div>
                    )}
                    {record.campground_address && (
                        <p className="text-xs text-gray-500 ml-5.5 truncate">
                            {record.campground_address}
                        </p>
                    )}
                </div>
            )}

            {/* 이미지 */}
            {record.photo_url && (
                <div className="aspect-[4/3] w-full">
                    <img
                        src={record.photo_url}
                        alt="캠핑 사진"
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* 메모 */}
            {record.content && (
                <div className="px-4 py-3 bg-white/70">
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                        {record.content}
                    </p>
                </div>
            )}

            {/* 태그 */}
            {record.tags.length > 0 && (
                <div className="px-4 py-2 bg-white/50 flex flex-wrap gap-1.5">
                    {record.tags.map((tag, idx) => (
                        <span
                            key={idx}
                            className="px-2 py-0.5 bg-[#224732]/10 text-[#224732] rounded-full text-xs font-medium"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* 액션 버튼 */}
            <div className="px-4 py-3 flex gap-2 bg-white/30">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="flex-1 border-[#224732] text-[#224732] hover:bg-[#224732]/10"
                >
                    <Share2 className="w-4 h-4 mr-1.5" />
                    공유하기
                </Button>
                {record.photo_url && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        className="flex-1 border-[#224732] text-[#224732] hover:bg-[#224732]/10"
                    >
                        <Download className="w-4 h-4 mr-1.5" />
                        저장하기
                    </Button>
                )}
            </div>

            {/* 푸터 */}
            <div className="px-4 py-2 bg-[#224732]/5 text-center">
                <p className="text-xs text-[#224732]/60">
                    ⛺ 라온아이 캠핑 기록
                </p>
            </div>
        </div>
    );
}
