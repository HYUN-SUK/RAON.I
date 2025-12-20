"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Youtube, BookOpen, Image as ImageIcon, Music, AlignLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { creatorService } from '@/services/creatorService';
import { CreatorContentType } from '@/types/creator';

export function ContentWriteForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form States
    const [type, setType] = useState<CreatorContentType>('LIVE');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);

    // Body Content States
    const [liveUrl, setLiveUrl] = useState('');
    const [novelText, setNovelText] = useState('');
    const [webtoonFiles, setWebtoonFiles] = useState<File[]>([]);

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCoverFile(file);
            // Preview
            const reader = new FileReader();
            reader.onload = (ev) => {
                setCoverImage(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const getTypeIcon = (t: CreatorContentType) => {
        switch (t) {
            case 'LIVE': return <Youtube className="w-4 h-4 mr-2" />;
            case 'NOVEL': return <BookOpen className="w-4 h-4 mr-2" />;
            case 'WEBTOON': return <ImageIcon className="w-4 h-4 mr-2" />;
            case 'ESSAY': return <AlignLeft className="w-4 h-4 mr-2" />;
            case 'ALBUM': return <Music className="w-4 h-4 mr-2" />;
            default: return null;
        }
    };

    const handleSubmit = async () => {
        if (!title) return alert('제목을 입력해주세요.');
        if (type === 'LIVE' && !liveUrl) return alert('방송 주소를 입력해주세요.');
        if (type === 'NOVEL' && !novelText) return alert('본문을 입력해주세요.');
        if (type === 'WEBTOON' && webtoonFiles.length === 0) return alert('이미지를 업로드해주세요.');

        try {
            setLoading(true);

            // 0. Ensure Creator Profile Exists
            const supabase = (await import('@/lib/supabase-client')).createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const profile = await creatorService.getCreatorProfile(user.id);
                if (!profile) {
                    await creatorService.createCreatorProfile({ id: user.id });
                }
            } else {
                throw new Error("로그인이 필요합니다.");
            }

            // 1. Upload Cover Image (if selected)
            let finalCoverUrl = coverImage;
            if (coverFile) {
                finalCoverUrl = await creatorService.uploadImage(coverFile);
            }

            // 2. Create Series (Content)
            const content = await creatorService.createContent({
                type,
                title,
                description,
                cover_image_url: finalCoverUrl || '',
                tags: [],
                visibility: 'PUBLIC'
            });

            // 3. Prepare Episode Body
            let bodyRef: any = {};
            if (type === 'LIVE') {
                bodyRef = { url: liveUrl };
            } else if (type === 'NOVEL' || type === 'ESSAY') {
                bodyRef = { text: novelText };
            } else if (type === 'WEBTOON') {
                // Upload all images
                const imageUrls = [];
                for (const file of webtoonFiles) {
                    const url = await creatorService.uploadImage(file);
                    imageUrls.push(url);
                }
                bodyRef = { images: imageUrls };
            }

            // 4. Create First Episode
            await creatorService.createEpisode({
                content_id: content.id,
                episode_no: 1,
                title: `${title} - 1화`, // Default first episode title
                body_ref: bodyRef,
                visibility: 'PUBLIC'
            });

            // 5. Request Approval (Move to PENDING_REVIEW)
            await creatorService.requestApproval(content.id);

            alert('콘텐츠가 등록되었으며, 운영자 승인 대기 처리되었습니다.');
            router.push('/community'); // Redirect to community or content board
        } catch (error) {
            console.error(error);
            alert('등록 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">

            {/* Type Selection */}
            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">콘텐츠 유형</label>
                    <Select value={type} onValueChange={(v: CreatorContentType) => setType(v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="유형 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="LIVE">
                                <div className="flex items-center"><Youtube className="w-4 h-4 mr-2 text-red-500" />라이브 (Youtube/Twitch)</div>
                            </SelectItem>
                            <SelectItem value="NOVEL">
                                <div className="flex items-center"><BookOpen className="w-4 h-4 mr-2 text-blue-500" />웹소설 (Text)</div>
                            </SelectItem>
                            <SelectItem value="WEBTOON">
                                <div className="flex items-center"><ImageIcon className="w-4 h-4 mr-2 text-green-500" />웹툰 (Image)</div>
                            </SelectItem>
                            <SelectItem value="ESSAY">
                                <div className="flex items-center"><AlignLeft className="w-4 h-4 mr-2 text-amber-500" />에세이</div>
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
                        {type === 'LIVE' && "유튜브나 트위치 라이브 주소를 공유합니다. 승인 후 라이브 탭에 노출됩니다."}
                        {type === 'NOVEL' && "텍스트 기반의 소설을 연재합니다. 편안한 뷰어가 제공됩니다."}
                        {type === 'WEBTOON' && "이미지 파일(세로 스크롤)을 업로드합니다."}
                        {type === 'ESSAY' && "감성적인 에세이나 칼럼을 작성합니다."}
                    </div>
                </CardContent>
            </Card>

            {/* Basic Info */}
            <div className="space-y-4 px-1">
                <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">제목</label>
                    <Input
                        placeholder="콘텐츠 제목을 입력하세요"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-white"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">소개 (선택)</label>
                    <Textarea
                        placeholder="작품에 대한 간단한 소개"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-white min-h-[80px]"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">커버 이미지</label>
                    <div
                        className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
                        onClick={() => document.getElementById('cover-upload')?.click()}
                    >
                        {coverImage ? (
                            <img src={coverImage} alt="Cover" className="h-40 object-cover rounded shadow-sm" />
                        ) : (
                            <div className="text-center py-4">
                                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <span className="text-xs text-gray-400">터치하여 이미지 업로드</span>
                            </div>
                        )}
                        <input
                            id="cover-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleCoverUpload}
                        />
                    </div>
                </div>
            </div>

            {/* Type Specific Inputs */}
            <div className="px-1 border-t pt-6 border-gray-100">
                <h3 className="text-sm font-semibold mb-4 flex items-center text-[#224732]">
                    {getTypeIcon(type)} 상세 내용 입력
                </h3>

                {type === 'LIVE' && (
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">방송 URL (Youtube, Twitch 등)</label>
                        <Input
                            placeholder="https://youtube.com/live/..."
                            value={liveUrl}
                            onChange={(e) => setLiveUrl(e.target.value)}
                        />
                    </div>
                )}

                {(type === 'NOVEL' || type === 'ESSAY') && (
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">본문 내용</label>
                        <Textarea
                            className="min-h-[300px] leading-relaxed p-4"
                            placeholder="내용을 작성해주세요..."
                            value={novelText}
                            onChange={(e) => setNovelText(e.target.value)}
                        />
                    </div>
                )}

                {type === 'WEBTOON' && (
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">원고 이미지 (순서대로 업로드)</label>
                        <Input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files) {
                                    setWebtoonFiles(Array.from(e.target.files));
                                }
                            }}
                        />
                        <div className="mt-2 text-xs text-gray-400">
                            {webtoonFiles.length > 0 ? `${webtoonFiles.length}개 파일 선택됨` : '선택된 파일 없음'}
                        </div>
                    </div>
                )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
                <Button
                    className="w-full bg-[#224732] hover:bg-[#1a3826] text-white py-6 text-lg font-medium shadow-lg"
                    onClick={handleSubmit}
                    disabled={loading}
                >
                    {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                    {loading ? '등록 중...' : '운영자 승인 요청하기'}
                </Button>
                <p className="text-center text-xs text-gray-400 mt-2">
                    등록 시 운영자의 검토를 거쳐 공개됩니다. (평균 1일 소요)
                </p>
            </div>

        </div>
    );
}
