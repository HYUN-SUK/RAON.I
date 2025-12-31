"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { creatorService } from '@/services/creatorService';
import { CreatorContent, Creator, CreatorEpisode } from '@/types/creator';
import { Loader2, ArrowLeft, Heart, Share2, PlayCircle, BookOpen, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { CreatorCommentSection } from './CreatorCommentSection';
import { HeartIcon } from 'lucide-react'; // Original Heart is generic, we might want fillable svg but lucide Heart is fine.
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';

const supabase = createClient();

interface ContentDetailViewProps {
    contentId: string;
}

export function ContentDetailView({ contentId }: ContentDetailViewProps) {
    const router = useRouter();
    const [content, setContent] = useState<(CreatorContent & { creators: Creator }) | null>(null);
    const [episodes, setEpisodes] = useState<CreatorEpisode[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingEpisode, setViewingEpisode] = useState<CreatorEpisode | null>(null);

    // Interactions
    const [isLiked, setIsLiked] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [commentCount, setCommentCount] = useState(0);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [contentId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [c, e, liked, following] = await Promise.all([
                creatorService.getContentById(contentId),
                creatorService.getEpisodes(contentId),
                creatorService.getLikeStatus(contentId),
                creatorService.getContentById(contentId).then(res => creatorService.getFollowStatus(res.creator_id)) // Chained cause we need creator_id
            ]);

            setContent(c);
            setEpisodes(e);
            setIsLiked(liked);
            setIsFollowing(following);
            setLikeCount(c.like_count || 0); // Assuming DB column or manually fetch
            setCommentCount(c.comment_count || 0);
            setFollowerCount(c.creators.follower_count || 0);

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

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);
        };
        getUser();
    }, []);

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

    const handleToggleLike = async () => {
        if (!content) return;
        const prev = isLiked;
        const prevCount = likeCount;

        // Optimistic
        setIsLiked(!prev);
        setLikeCount(prev ? prevCount - 1 : prevCount + 1);

        try {
            await creatorService.toggleLike(content.id);
        } catch (e) {
            // Revert
            setIsLiked(prev);
            setLikeCount(prevCount);
            alert('로그인이 필요하거나 오류가 발생했습니다.');
        }
    };

    // Local state for follower count
    const [followerCount, setFollowerCount] = useState(0);



    // ... handleToggleFollow ...
    const handleToggleFollow = async () => {
        if (!content) return;
        if (currentUserId === content.creator_id) {
            alert('본인의 콘텐츠는 구독할 수 없습니다.');
            return;
        }

        const prev = isFollowing;
        const prevCount = followerCount;

        // Optimistic
        setIsFollowing(!prev);
        setFollowerCount(prev ? prevCount - 1 : prevCount + 1);

        try {
            await creatorService.toggleFollow(content.creator_id);
        } catch (e: unknown) {
            const err = e as Error;
            setIsFollowing(prev);
            setFollowerCount(prevCount); // Revert
            alert(err.message || '오류가 발생했습니다.');
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
                                <div key={idx} className="relative w-full h-auto min-h-[500px]">
                                    <Image
                                        src={img}
                                        alt={`Scene ${idx}`}
                                        fill
                                        className="object-contain"
                                        unoptimized // Webtoon often external
                                    />
                                </div>
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
                <Image
                    src={content.cover_image_url || ''}
                    alt={content.title}
                    fill
                    className="object-cover"
                    unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F7F5EF] via-transparent to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <Badge className="bg-[#1C4526] text-white hover:bg-[#1C4526] mb-3">{content.type}</Badge>
                    <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2 shadow-sm">{content.title}</h1>
                    <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6 border bg-white">
                            <AvatarImage src={content.creators?.profile_image_url || undefined} />
                            <AvatarFallback className="text-[10px]">CR</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-gray-700">
                            {content.creators?.nickname || content.creators?.bio || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">• 구독자 {followerCount}명</span>
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="px-6 py-4">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{content.description}</p>
                <div className="flex gap-2 mt-4 text-[#1C4526]">
                    <Button
                        size="sm"
                        variant={currentUserId === content.creator_id ? "outline" : (isFollowing ? "secondary" : "outline")}
                        className={cn("rounded-full transition-all",
                            currentUserId === content.creator_id ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400" :
                                (isFollowing ? "bg-gray-100 text-gray-600" : "border-[#1C4526] text-[#1C4526]")
                        )}
                        onClick={handleToggleFollow}
                        disabled={currentUserId === content.creator_id}
                    >
                        {currentUserId === content.creator_id ? '본인' : (isFollowing ? '구독중' : '구독하기')}
                    </Button>

                    <Button
                        size="sm"
                        variant="ghost"
                        className={cn("rounded-full flex items-center gap-1", isLiked ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-gray-600")}
                        onClick={handleToggleLike}
                    >
                        <Heart className={cn("w-5 h-5", isLiked ? "fill-current" : "")} />
                        <span className="text-sm font-medium">{likeCount}</span>
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
                                {(ep.thumbnail_url || content.cover_image_url) ? (
                                    <Image
                                        src={ep.thumbnail_url || content.cover_image_url || ''}
                                        className="object-cover"
                                        alt=""
                                        fill
                                        unoptimized
                                    />
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
            {/* Comment Section (Interaction) */}
            <div className="px-4 pb-10">
                <CreatorCommentSection contentId={contentId} onCommentChange={setCommentCount} />
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
