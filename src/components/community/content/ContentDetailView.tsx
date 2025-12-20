"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { creatorService } from '@/services/creatorService';
import { CreatorContent, Creator, CreatorEpisode } from '@/types/creator';
import { Loader2, ArrowLeft, Heart, Share2, PlayCircle, BookOpen, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ContentDetailViewProps {
    contentId: string;
}

export function ContentDetailView({ contentId }: ContentDetailViewProps) {
    const router = useRouter();
    const [content, setContent] = useState<(CreatorContent & { creators: Creator }) | null>(null);
    const [episodes, setEpisodes] = useState<CreatorEpisode[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingEpisode, setViewingEpisode] = useState<CreatorEpisode | null>(null);

    useEffect(() => {
        fetchData();
    }, [contentId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [c, e] = await Promise.all([
                creatorService.getContentById(contentId),
                creatorService.getEpisodes(contentId)
            ]);
            setContent(c);
            setEpisodes(e);

            // If LIVE, auto-open the first episode
            if (c.type === 'LIVE' && e.length > 0) {
                setViewingEpisode(e[0]);
            }

        } catch (error) {
            console.error(error);
            alert('콘텐츠를 불러올 수 없습니다.');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleEpisodeClick = (ep: CreatorEpisode) => {
        setViewingEpisode(ep);
    };

    const closeViewer = () => {
        if (content?.type === 'LIVE') {
            router.back(); // Back from live page if it's live
        } else {
            setViewingEpisode(null);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#F7F5EF]"><Loader2 className="animate-spin text-[#1C4526]" /></div>;
    }

    if (!content) return null;

    // --- Viewer Mode ---
    if (viewingEpisode) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                {/* Viewer Header */}
                <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm text-white absolute top-0 left-0 right-0 z-10 transition-opacity hover:opacity-100 opacity-0 md:opacity-100">
                    <button onClick={() => setViewingEpisode(null)} className="p-2"><ArrowLeft /></button>
                    <span className="text-sm font-medium truncate px-4">{viewingEpisode.title}</span>
                    <div className="w-8" />
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto w-full h-full flex items-center justify-center">

                    {/* LIVE: Youtube Embed */}
                    {content.type === 'LIVE' && viewingEpisode.body_ref?.url && (
                        <div className="w-full h-full">
                            <iframe
                                width="100%"
                                height="100%"
                                src={getEmbedUrl(viewingEpisode.body_ref.url)}
                                title={viewingEpisode.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    )}

                    {/* NOVEL/ESSAY: Text Viewer */}
                    {(content.type === 'NOVEL' || content.type === 'ESSAY') && viewingEpisode.body_ref?.text && (
                        <div className="bg-[#F7F5EF] w-full min-h-full p-8 pt-20 max-w-2xl mx-auto text-gray-800 leading-relaxed text-lg font-serif">
                            <h1 className="text-2xl font-bold mb-8 text-[#1C4526]">{viewingEpisode.title}</h1>
                            <div className="whitespace-pre-wrap">
                                {viewingEpisode.body_ref.text}
                            </div>
                            <div className="h-20" />
                        </div>
                    )}

                    {/* WEBTOON: Image Scroll */}
                    {content.type === 'WEBTOON' && viewingEpisode.body_ref?.images && (
                        <div className="bg-black w-full min-h-full max-w-xl mx-auto flex flex-col pt-16">
                            {Array.isArray(viewingEpisode.body_ref.images) && viewingEpisode.body_ref.images.map((img: string, idx: number) => (
                                <img key={idx} src={img} alt={`Scene ${idx}`} className="w-full h-auto block" />
                            ))}
                        </div>
                    )}

                </div>
            </div>
        );
    }

    // --- Series Info Mode ---
    return (
        <div className="min-h-screen bg-[#F7F5EF] pb-10">

            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#F7F5EF]/80 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-[#ECE8DF]">
                <button onClick={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft className="w-6 h-6 text-[#1C4526]" />
                </button>
                <div className="flex gap-2">
                    <button className="p-2"><Share2 className="w-5 h-5 text-gray-600" /></button>
                </div>
            </header>

            {/* Hero Cover */}
            <div className="relative aspect-square md:aspect-[21/9] w-full bg-gray-200">
                <img src={content.cover_image_url || ''} alt={content.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F7F5EF] via-transparent to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <Badge className="bg-[#1C4526] text-white hover:bg-[#1C4526] mb-3">{content.type}</Badge>
                    <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2 shadow-sm">{content.title}</h1>
                    <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6 border bg-white">
                            <AvatarImage />
                            <AvatarFallback className="text-[10px]">CR</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-gray-700">{content.creators.bio || 'Creator'}</span>
                        <span className="text-xs text-gray-500">• {content.creators.region || 'Unknown'}</span>
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="px-6 py-4">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{content.description}</p>
                <div className="flex gap-2 mt-4 text-[#1C4526]">
                    <Button size="sm" variant="outline" className="rounded-full border-[#1C4526] text-[#1C4526]">
                        <Heart className="w-4 h-4 mr-2" /> 구독하기
                    </Button>
                </div>
            </div>

            <div className="h-2 bg-gray-100" />

            {/* Episodes List */}
            <div className="px-4 py-6">
                <h3 className="font-bold text-lg mb-4 flex items-center">
                    회차 <span className="ml-2 text-sm text-gray-500 font-normal">{episodes.length}개</span>
                </h3>

                <div className="space-y-3">
                    {episodes.map((ep) => (
                        <div
                            key={ep.id}
                            onClick={() => handleEpisodeClick(ep)}
                            className="flex gap-4 p-3 rounded-xl bg-white active:bg-gray-50 border border-transparent active:border-[#1C4526]/50 transition-all cursor-pointer shadow-sm"
                        >
                            <div className="relative w-24 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                {ep.thumbnail_url || content.cover_image_url ? (
                                    <img src={ep.thumbnail_url || content.cover_image_url || ''} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        {content.type === 'LIVE' ? <PlayCircle /> : <BookOpen />}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="font-medium text-sm text-gray-900 truncate mb-1">{ep.title}</h4>
                                <div className="flex items-center text-xs text-gray-400">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {new Date(ep.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                    {episodes.length === 0 && (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            등록된 에피소드가 아직 없습니다.
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}

// Helper for Youtube
function getEmbedUrl(url: string) {
    if (!url) return '';
    // Simple parser for youtube
    let videoId = '';
    if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('v=')[1];
        const ampersandPosition = videoId.indexOf('&');
        if (ampersandPosition !== -1) {
            videoId = videoId.substring(0, ampersandPosition);
        }
    } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1];
    } else if (url.includes('youtube.com/live/')) {
        const parts = url.split('/live/');
        if (parts.length > 1) {
            videoId = parts[1].split('?')[0];
        }
    }

    if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    return url; // Return original if not youtube (maybe they allow iframe)
}
