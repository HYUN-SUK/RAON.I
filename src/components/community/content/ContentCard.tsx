"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Youtube, BookOpen, Image as ImageIcon, Music, AlignLeft, Heart, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CreatorContent, Creator } from '@/types/creator';

interface ContentCardProps {
    content: CreatorContent & { creators: Creator };
}

export function ContentCard({ content }: ContentCardProps) {
    const getTypeIcon = (t: string) => {
        switch (t) {
            case 'LIVE': return <Youtube className="w-3 h-3 text-white" />;
            case 'NOVEL': return <BookOpen className="w-3 h-3 text-white" />;
            case 'WEBTOON': return <ImageIcon className="w-3 h-3 text-white" />;
            case 'ESSAY': return <AlignLeft className="w-3 h-3 text-white" />;
            case 'ALBUM': return <Music className="w-3 h-3 text-white" />;
            default: return null;
        }
    };

    const getLabel = (t: string) => {
        switch (t) {
            case 'LIVE': return '라이브';
            case 'NOVEL': return '웹소설';
            case 'WEBTOON': return '웹툰';
            case 'ESSAY': return '에세이';
            case 'ALBUM': return '앨범';
            default: return '';
        }
    };

    return (
        <Link href={`/community/content/${content.id}`} className="block group">
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 shadow-sm border border-gray-100">
                {content.cover_image_url ? (
                    <Image
                        src={content.cover_image_url}
                        alt={content.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                        <ImageIcon className="w-8 h-8" />
                    </div>
                )}

                {/* Type Badge */}
                <div className="absolute top-2 left-2">
                    <Badge className="bg-black/60 hover:bg-black/70 backdrop-blur-sm border-0 gap-1 pl-1.5 pr-2.5 py-0.5 text-[10px] font-medium text-white">
                        {getTypeIcon(content.type)}
                        {getLabel(content.type)}
                    </Badge>
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

                {/* Info */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="text-sm font-bold line-clamp-2 leading-tight mb-1">{content.title}</h3>
                    <div className="flex items-center text-[10px] text-gray-300">
                        <span className="truncate max-w-[80px]">{content.creators?.bio || 'Creator'}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
