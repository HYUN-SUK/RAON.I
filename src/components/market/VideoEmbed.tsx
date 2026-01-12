'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import {
    getEmbedUrl,
    getThumbnailUrl,
    detectVideoType,
    getVideoPlatformName
} from '@/utils/youtube';

interface VideoEmbedProps {
    url: string;
    className?: string;
    aspectRatio?: 'video' | 'square' | 'shorts';
    showPlatformBadge?: boolean;
}

/**
 * 영상 임베드 컴포넌트 (Lazy Load 지원)
 * 썸네일 먼저 표시 → 클릭 시 영상 로드
 * 데이터 비용 0원! (YouTube/Instagram/TikTok이 호스팅)
 */
export default function VideoEmbed({
    url,
    className = '',
    aspectRatio = 'video',
    showPlatformBadge = true
}: VideoEmbedProps) {
    const [isPlaying, setIsPlaying] = useState(false);

    const embedUrl = getEmbedUrl(url);
    const thumbnailUrl = getThumbnailUrl(url);
    const videoType = detectVideoType(url);
    const platformName = getVideoPlatformName(videoType);

    if (!embedUrl) {
        return null;
    }

    // 비율에 따른 클래스
    const aspectClasses = {
        video: 'aspect-video',      // 16:9
        square: 'aspect-square',    // 1:1
        shorts: 'aspect-[9/16]'     // 9:16 (쇼츠/릴스)
    };

    // 쇼츠 자동 감지
    const finalAspectRatio = videoType === 'youtube_shorts' ? 'shorts' : aspectRatio;

    return (
        <div className={`relative w-full ${aspectClasses[finalAspectRatio]} bg-gray-900 rounded-xl overflow-hidden ${className}`}>
            {!isPlaying ? (
                // 썸네일 상태 (Lazy Load - 클릭 전)
                <button
                    onClick={() => setIsPlaying(true)}
                    className="absolute inset-0 w-full h-full group"
                    aria-label={`${platformName} 영상 재생`}
                >
                    {/* 썸네일 이미지 */}
                    {thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt="영상 썸네일"
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        // 썸네일 없는 경우 (Instagram/TikTok)
                        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <span className="text-white/60 text-sm">{platformName}</span>
                        </div>
                    )}

                    {/* 어두운 오버레이 */}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

                    {/* 재생 버튼 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-7 h-7 text-gray-900 ml-1" fill="currentColor" />
                        </div>
                    </div>

                    {/* 플랫폼 배지 */}
                    {showPlatformBadge && (
                        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md">
                            {platformName}
                        </div>
                    )}

                    {/* 데이터 비용 0원 배지 */}
                    <div className="absolute top-3 right-3 bg-green-500/90 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                        💰 데이터 비용 0원
                    </div>
                </button>
            ) : (
                // 재생 상태 (iframe 로드)
                <iframe
                    src={`${embedUrl}&autoplay=1`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={`${platformName} 영상`}
                />
            )}
        </div>
    );
}
