import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Camera } from 'lucide-react';
import { CreateReviewDTO } from '@/types/market';
import { useMarketStore } from '@/store/useMarketStore';

interface ReviewWriteSheetProps {
    productId: string;
    onClose?: () => void;
    children?: React.ReactNode;
}

export const ReviewWriteSheet: React.FC<ReviewWriteSheetProps> = ({ productId, onClose, children }) => {
    const [open, setOpen] = useState(false);
    const [rating, setRating] = useState(5);
    const [content, setContent] = useState('');
    const { createReview, isLoading } = useMarketStore();

    const handleSubmit = async () => {
        if (!content.trim()) return;

        try {
            const dto: CreateReviewDTO = {
                product_id: productId,
                rating,
                content: content.trim(),
                images: [] // Image upload implementation pending
            };
            await createReview(dto);
            setOpen(false);
            setContent('');
            setRating(5);
            if (onClose) onClose();
        } catch (error) {
            console.error(error);
            alert('리뷰 등록에 실패했습니다.');
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {children || <Button>리뷰 작성</Button>}
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[20px] h-[80vh] flex flex-col p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-left text-xl font-bold text-[var(--color-brand-1)]">
                        리뷰 작성
                    </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col gap-6 flex-1 overflow-y-auto">
                    {/* Rating */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-[var(--color-text-1)]">별점</label>
                        <div className="flex gap-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setRating(i + 1)}
                                    className="focus:outline-none transition-transform active:scale-95"
                                >
                                    <Star
                                        size={32}
                                        className={`${i < rating
                                                ? "fill-[var(--color-accent-1)] text-[var(--color-accent-1)]"
                                                : "text-gray-300 stroke-gray-300"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col gap-2 flex-1">
                        <label className="text-sm font-semibold text-[var(--color-text-1)]">내용</label>
                        <Textarea
                            placeholder="사용 경험을 솔직하게 들려주세요."
                            className="flex-1 resize-none bg-[var(--color-surface-1)] border-none focus:ring-1 focus:ring-[var(--color-brand-2)]"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>

                    {/* Photo Placeholder */}
                    <div>
                        <Button
                            variant="outline"
                            className="w-full h-12 border-dashed border-2 flex gap-2 text-[var(--color-text-2)]"
                            onClick={() => alert('사진 업로드 기능은 준비 중입니다.')}
                        >
                            <Camera size={20} />
                            <span>사진 추가하기</span>
                        </Button>
                    </div>
                </div>

                <div className="mt-4 pb-4">
                    <Button
                        className="w-full h-14 text-lg font-bold bg-[var(--color-brand-1)] hover:bg-[var(--color-brand-2)] text-white rounded-xl"
                        onClick={handleSubmit}
                        disabled={isLoading || !content.trim()}
                    >
                        {isLoading ? '등록 중...' : '등록하기'}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
};
