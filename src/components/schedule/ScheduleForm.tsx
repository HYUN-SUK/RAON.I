'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    Calendar,
    MapPin,
    Tent,
    FileText,
    X,
    Loader2,
    Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScheduleFormData, createSchedule } from '@/actions/schedule';
import { toast } from 'sonner';
import MyMapModal from '@/components/myspace/MyMapModal';

interface ScheduleFormProps {
    onSuccess?: (scheduleId: string) => void;
    onCancel?: () => void;
    // 외부에서 캠핑장 정보 전달 (지도 검색 등)
    initialData?: Partial<ScheduleFormData>;
}

export default function ScheduleForm({
    onSuccess,
    onCancel,
    initialData,
}: ScheduleFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ScheduleFormData>>({
        source: 'external',
        campgroundName: '',
        campgroundAddress: '',
        checkIn: '',
        checkOut: '',
        memo: '',
        ...initialData,
    });

    // 날짜 최소값 (오늘)
    const today = format(new Date(), 'yyyy-MM-dd');

    // 지도에서 장소 선택 시 호출
    const handlePlaceSelect = (place: { name: string; address: string; lat: number; lng: number }) => {
        setFormData({
            ...formData,
            campgroundName: place.name,
            campgroundAddress: place.address,
            campgroundLat: place.lat,
            campgroundLng: place.lng,
        });
        toast.success('캠핑장이 선택되었어요!');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.campgroundName?.trim()) {
            toast.error('캠핑장 이름을 입력해주세요');
            return;
        }
        if (!formData.checkIn || !formData.checkOut) {
            toast.error('일정을 선택해주세요');
            return;
        }
        if (formData.checkIn > formData.checkOut) {
            toast.error('퇴실일은 입실일 이후여야 합니다');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await createSchedule(formData as ScheduleFormData);

            if (result.success && result.id) {
                toast.success('일정이 등록되었어요!');
                onSuccess?.(result.id);
            } else {
                toast.error(result.error || '일정 등록에 실패했어요');
            }
        } catch (error) {
            console.error('Schedule submit error:', error);
            toast.error('오류가 발생했어요. 다시 시도해주세요');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* 캠핑장 이름 */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Tent className="w-4 h-4 text-[#224732]" />
                        캠핑장 이름
                    </label>
                    <div className="relative">
                        <Input
                            type="text"
                            placeholder="예: 라온아이 캠핑장"
                            value={formData.campgroundName || ''}
                            onChange={(e) => setFormData({ ...formData, campgroundName: e.target.value })}
                            className="pr-10"
                            required
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#224732] transition-colors"
                            onClick={() => setIsMapOpen(true)}
                            title="지도에서 캠핑장 찾기"
                        >
                            <Search className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 주소 */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 text-[#224732]" />
                        주소 (선택)
                    </label>
                    <Input
                        type="text"
                        placeholder="캠핑장 주소를 입력해주세요"
                        value={formData.campgroundAddress || ''}
                        onChange={(e) => setFormData({ ...formData, campgroundAddress: e.target.value })}
                    />
                </div>

                {/* 일정 */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="w-4 h-4 text-[#224732]" />
                            입실일
                        </label>
                        <Input
                            type="date"
                            min={today}
                            value={formData.checkIn || ''}
                            onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            퇴실일
                        </label>
                        <Input
                            type="date"
                            min={formData.checkIn || today}
                            value={formData.checkOut || ''}
                            onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                            required
                        />
                    </div>
                </div>

                {/* 메모 */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 text-[#224732]" />
                        메모 (선택)
                    </label>
                    <Textarea
                        placeholder="특별히 기억하고 싶은 것, 준비물 등을 메모해보세요"
                        value={formData.memo || ''}
                        onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                        rows={3}
                        className="resize-none"
                    />
                </div>

                {/* 버튼 */}
                <div className="flex gap-3 pt-2">
                    {onCancel && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            className="flex-1"
                            disabled={isSubmitting}
                        >
                            <X className="w-4 h-4 mr-1" />
                            취소
                        </Button>
                    )}
                    <Button
                        type="submit"
                        className="flex-1 bg-[#224732] hover:bg-[#1a3626]"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                등록 중...
                            </>
                        ) : (
                            '일정 등록하기'
                        )}
                    </Button>
                </div>
            </form>

            {/* 캠핑장 검색용 지도 모달 */}
            <MyMapModal
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                mode="schedule"
                onPlaceSelect={handlePlaceSelect}
            />
        </>
    );
}
