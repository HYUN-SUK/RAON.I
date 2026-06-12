'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { marketService } from '@/services/marketService';
import { Product, CreateProductDTO, ProductBadge } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2, Link as LinkIcon, Video, ImageIcon, Info, Sparkles, Check, Upload } from 'lucide-react';
import Image from 'next/image';
import { detectVideoType, getYouTubeThumbnail, isValidVideoUrl, getVideoPlatformName } from '@/utils/youtube';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { compressImage } from '@/utils/imageCompressor';

interface ProductFormProps {
    initialData?: Product;
    isEdit?: boolean;
}

// 기본 카테고리 (로딩 전 폴백)
const DEFAULT_CATEGORIES = [
    { id: 'lantern', label: '조명/랜턴' },
    { id: 'tableware', label: '식기/키친' },
    { id: 'furniture', label: '가구/체어' },
    { id: 'goods', label: '굿즈' },
];

// 혜택 배지 옵션
const BADGE_OPTIONS: { id: ProductBadge; label: string; icon: string }[] = [
    { id: 'free_shipping', label: '무료배송', icon: '🚚' },
    { id: 'quality_guarantee', label: '품질보증', icon: '✅' },
    { id: 'limited_stock', label: '한정수량', icon: '⏰' },
    { id: 'gift_included', label: '사은품', icon: '🎁' },
    { id: 'best_seller', label: '베스트', icon: '🔥' },
    { id: 'new_arrival', label: '신상품', icon: '✨' },
];

export default function ProductForm({ initialData, isEdit = false }: ProductFormProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState<CreateProductDTO>({
        name: '',
        price: 0,
        description: '',
        category: 'lantern',
        stock: 999,
        images: [],
        tags: [],
        is_active: true,
        type: 'INTERNAL',
        link: '',
        video_url: '',
        video_type: null,
        badges: []
    });

    const [imageUrlInput, setImageUrlInput] = useState('');
    const [videoUrlInput, setVideoUrlInput] = useState('');

    // 파일 업로드 상태
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 동적 카테고리
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                price: initialData.price,
                description: initialData.description || '',
                category: initialData.category,
                stock: initialData.stock,
                images: initialData.images || [],
                tags: initialData.tags || [],
                is_active: initialData.is_active,
                type: initialData.type || 'INTERNAL',
                link: initialData.link || '',
                video_url: initialData.video_url || '',
                video_type: initialData.video_type || null,
                badges: initialData.badges || []
            });
            setVideoUrlInput(initialData.video_url || '');
        }
    }, [initialData]);

    // 카테고리 DB에서 로드
    useEffect(() => {
        const loadCategories = async () => {
            const supabase = createClient();
            const { data } = await supabase
                .from('site_config')
                .select('market_categories')
                .eq('id', 1)
                .single();

            if (data?.market_categories && Array.isArray(data.market_categories)) {
                const cats = data.market_categories as { id: string; label: string }[];
                if (cats.length > 0) {
                    setCategories(cats);
                    // 기본 카테고리 설정 (상품 수정이 아닌 경우)
                    if (!initialData) {
                        setFormData(prev => ({ ...prev, category: cats[0].id }));
                    }
                }
            }
        };
        loadCategories();
    }, [initialData]);

    const handleChange = (field: keyof CreateProductDTO, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddImage = () => {
        if (!imageUrlInput) return;
        if (formData.images.length >= 3) {
            alert('이미지는 최대 3장까지 등록 가능합니다.');
            return;
        }
        setFormData(prev => ({ ...prev, images: [...prev.images, imageUrlInput] }));
        setImageUrlInput('');
    };

    const handleRemoveImage = (index: number) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    // 파일 업로드 핸들러
    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const remainingSlots = 3 - formData.images.length;
        if (remainingSlots <= 0) {
            toast.error('이미지는 최대 3장까지 등록 가능합니다.');
            return;
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots);
        setIsUploading(true);

        const supabase = createClient();
        const uploadedUrls: string[] = [];

        try {
            for (const file of filesToUpload) {
                // 파일 크기 검증 (5MB)
                if (file.size > 5 * 1024 * 1024) {
                    toast.error(`${file.name}: 파일 크기는 5MB 이하여야 합니다.`);
                    continue;
                }

                // 이미지 파일만 허용
                if (!file.type.startsWith('image/')) {
                    toast.error(`${file.name}: 이미지 파일만 업로드 가능합니다.`);
                    continue;
                }

                const compressedFile = await compressImage(file);
                const fileExt = compressedFile.name.split('.').pop()?.toLowerCase() || 'webp';
                const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `products/${fileName}`;

                // Supabase Storage에 업로드
                const { error: uploadError } = await supabase.storage
                    .from('product_images')
                    .upload(filePath, compressedFile, { upsert: true });

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    toast.error(`${file.name}: 업로드 실패`);
                    continue;
                }

                // Public URL 가져오기
                const { data: { publicUrl } } = supabase.storage
                    .from('product_images')
                    .getPublicUrl(filePath);

                uploadedUrls.push(publicUrl);
            }

            if (uploadedUrls.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    images: [...prev.images, ...uploadedUrls]
                }));
                toast.success(`${uploadedUrls.length}개 이미지 업로드 완료! 📸`);
            }
        } catch (error: any) {
            console.error('Upload failed:', error);
            toast.error('이미지 업로드 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // 드래그 이벤트 핸들러
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    };

    // 영상 URL 변경 핸들러
    const handleVideoUrlChange = (url: string) => {
        setVideoUrlInput(url);
        const videoType = detectVideoType(url);
        setFormData(prev => ({
            ...prev,
            video_url: url,
            video_type: videoType
        }));
    };

    // 배지 토글 핸들러
    const handleBadgeToggle = (badge: ProductBadge) => {
        const currentBadges = formData.badges || [];
        const newBadges = currentBadges.includes(badge)
            ? currentBadges.filter(b => b !== badge)
            : [...currentBadges, badge];
        handleChange('badges', newBadges);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (isEdit && initialData) {
                await marketService.updateProduct({
                    id: initialData.id,
                    ...formData
                });
            } else {
                await marketService.createProduct(formData);
            }
            router.push('/admin/market');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    // 영상 썸네일 미리보기
    const videoThumbnail = videoUrlInput ? getYouTubeThumbnail(videoUrlInput) : null;
    const detectedVideoType = videoUrlInput ? detectVideoType(videoUrlInput) : null;
    const isVideoValid = videoUrlInput ? isValidVideoUrl(videoUrlInput) : false;

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl bg-white p-6 rounded-lg border shadow-sm">
            <div className="grid grid-cols-2 gap-6">
                {/* Type Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">상품 유형</label>
                    <Select
                        value={formData.type}
                        onValueChange={(val: 'INTERNAL' | 'EXTERNAL') => handleChange('type', val)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="INTERNAL">자체상품 (직접 판매)</SelectItem>
                            <SelectItem value="EXTERNAL">외부상품 (링크 연결)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">판매 상태</label>
                    <Select
                        value={formData.is_active ? 'active' : 'inactive'}
                        onValueChange={(val) => handleChange('is_active', val === 'active')}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">판매중</SelectItem>
                            <SelectItem value="inactive">숨김 (판매중지)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* External Link Input */}
            {formData.type === 'EXTERNAL' && (
                <div className="space-y-2 bg-purple-50 p-4 rounded-md border border-purple-100">
                    <label className="text-sm font-medium text-purple-900 flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        외부 구매 링크
                    </label>
                    <Input
                        placeholder="https://coupang.com/..."
                        value={formData.link || ''}
                        onChange={(e) => handleChange('link', e.target.value)}
                        required
                        className="bg-white"
                    />
                    <p className="text-xs text-purple-600">사용자가 '구매하기' 버튼 클릭 시 이 링크로 이동합니다.</p>
                </div>
            )}

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">상품명</label>
                <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    placeholder="상품명을 입력하세요"
                />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">카테고리</label>
                    <Select
                        value={formData.category}
                        onValueChange={(val) => handleChange('category', val)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map((cat: { id: string; label: string }) => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">가격</label>
                    <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleChange('price', parseInt(e.target.value) || 0)}
                        required
                        min={0}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">재고 수량</label>
                <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => handleChange('stock', parseInt(e.target.value) || 0)}
                    required
                    min={0}
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">상품 설명</label>
                <Textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="🔥 캠핑 필수템!&#10;• 초경량 450g - 백패킹에 딱!&#10;• 방수 처리 완료 - 비 와도 OK&#10;• 30초 조립 - 누구나 쉽게"
                    className="h-32"
                />
                <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    핵심 혜택 3가지를 이모지와 함께 짧게 작성하세요
                </p>
            </div>

            {/* 이미지 섹션 (최적화 가이드 포함) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        이미지 (최대 3장)
                    </label>
                    <span className="text-xs text-gray-400">{formData.images.length}/3</span>
                </div>

                {/* 이미지 가이드라인 */}
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                    <p className="text-xs text-blue-700 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                            <strong>💡 이미지 최적화 팁</strong><br />
                            • 파일 크기: 최대 5MB<br />
                            • 권장 크기: 800x800px 이하<br />
                            • 지원 형식: JPG, PNG, WebP, GIF
                        </span>
                    </p>
                </div>

                {/* 파일 업로드 영역 */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${isDragging
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileUpload(e.target.files)}
                    />

                    {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                            <p className="text-sm text-gray-600">업로드 중...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-3 bg-gray-100 rounded-full">
                                <Upload className="w-6 h-6 text-gray-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700">
                                    클릭하여 이미지 선택 또는 드래그&드롭
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    최대 3장, 각 5MB 이하
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* URL 직접 입력 (대안) */}
                <div className="flex gap-2">
                    <Input
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="또는 이미지 URL 직접 입력: https://..."
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImage())}
                    />
                    <Button
                        type="button"
                        onClick={handleAddImage}
                        variant="outline"
                        disabled={formData.images.length >= 3}
                    >
                        추가
                    </Button>
                </div>

                {/* Image Preview List */}
                {formData.images.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                        {formData.images.map((img, idx) => (
                            <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden group border">
                                <Image src={img} alt={`Preview ${idx}`} fill className="object-cover" />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage(idx)}
                                    className="absolute top-0 right-0 bg-black/50 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 영상 섹션 (데이터 비용 절감 강조) */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    상품 소개 영상 (선택, 강력 추천!)
                </label>

                {/* 비용 절감 안내 */}
                <div className="bg-green-50 p-4 rounded-md border border-green-200">
                    <div className="flex items-start gap-3">
                        <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            💰 비용 0원
                        </div>
                        <div className="text-xs text-green-800 space-y-1">
                            <p className="font-medium">YouTube/쇼츠/릴스를 임베드하면:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-green-700">
                                <li>영상 호스팅 비용 <strong>0원</strong> (YouTube가 부담)</li>
                                <li>조회수도 YouTube에 쌓여 마케팅 효과까지!</li>
                                <li>전환율 30~50% 상승 효과</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <Input
                    value={videoUrlInput}
                    onChange={(e) => handleVideoUrlChange(e.target.value)}
                    placeholder="https://youtube.com/shorts/... 또는 https://youtu.be/..."
                />

                {/* 영상 유효성 피드백 */}
                {videoUrlInput && (
                    <div className={`flex items-center gap-2 text-xs ${isVideoValid ? 'text-green-600' : 'text-red-500'}`}>
                        {isVideoValid ? (
                            <>
                                <Check className="w-4 h-4" />
                                {getVideoPlatformName(detectedVideoType)} 영상이 감지되었습니다
                            </>
                        ) : (
                            <>
                                <X className="w-4 h-4" />
                                지원하지 않는 URL 형식입니다 (YouTube, Instagram, TikTok만 지원)
                            </>
                        )}
                    </div>
                )}

                {/* 영상 썸네일 미리보기 */}
                {videoThumbnail && isVideoValid && (
                    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
                        <Image
                            src={videoThumbnail}
                            alt="영상 썸네일"
                            fill
                            className="object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                <div className="w-0 h-0 border-l-[16px] border-l-gray-900 border-y-[10px] border-y-transparent ml-1" />
                            </div>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                            {getVideoPlatformName(detectedVideoType)}
                        </div>
                    </div>
                )}
            </div>

            {/* 혜택 배지 섹션 */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">혜택 배지 (선택)</label>
                <div className="flex flex-wrap gap-2">
                    {BADGE_OPTIONS.map((badge) => {
                        const isSelected = (formData.badges || []).includes(badge.id);
                        return (
                            <button
                                key={badge.id}
                                type="button"
                                onClick={() => handleBadgeToggle(badge.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm border transition-all ${isSelected
                                    ? 'bg-green-50 border-green-300 text-green-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <span>{badge.icon}</span>
                                <span>{badge.label}</span>
                                {isSelected && <Check className="w-3 h-3" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end pt-4 gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                    취소
                </Button>
                <Button type="submit" disabled={submitting} className="bg-[#1C4526] hover:bg-[#15341d]">
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isEdit ? '수정 완료' : '상품 등록'}
                </Button>
            </div>
        </form>
    );
}
