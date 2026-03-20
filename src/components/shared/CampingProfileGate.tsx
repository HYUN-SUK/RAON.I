'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    MapPin,
    Users,
    Dog,
    ChevronDown,
    ChevronUp,
    Loader2,
    Check,
    Pencil,
    Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CampingProfile, getCampingProfile, saveCampingProfile, searchAddressAction } from '@/actions/camping-profile';

interface CampingProfileGateProps {
    /** 프로필 확인/입력 완료 시 호출 */
    onComplete: (profile: CampingProfile) => void;
    /** 출발지 입력 필요 여부 (예약에서는 false, 추천/플랜에서는 true) */
    requireOrigin?: boolean;
    /** 제목 텍스트 커스터마이즈 */
    title?: string;
    /** 컴팩트 모드 (예약 폼 내부용: 카드 스타일) */
    compact?: boolean;
}

/**
 * 공용 캠핑 프로필 확인/입력 게이트
 * - 프로필 없음 → "첫 입력" 모드 (폼 표시)
 * - 프로필 있음 → "확인" 모드 (요약 카드 + 1탭 통과 or 수정)
 */
export default function CampingProfileGate({
    onComplete,
    requireOrigin = false,
    title = '캠핑 기본 정보',
    compact = false,
}: CampingProfileGateProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [existingProfile, setExistingProfile] = useState<CampingProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [originLabel, setOriginLabel] = useState('');
    const [originLat, setOriginLat] = useState<number | null>(null);
    const [originLng, setOriginLng] = useState<number | null>(null);
    const [adults, setAdults] = useState(2);
    const [kidsPreschool, setKidsPreschool] = useState(0);
    const [kidsElementary, setKidsElementary] = useState(0);
    const [kidsTeen, setKidsTeen] = useState(0);
    const [hasPet, setHasPet] = useState(false);

    // 주소 검색 관련
    const [addressQuery, setAddressQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // 프로필 로딩
    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true);
            const profile = await getCampingProfile();
            if (profile) {
                setExistingProfile(profile);
                setOriginLabel(profile.originLabel || '');
                setOriginLat(profile.originLat);
                setOriginLng(profile.originLng);
                setAdults(profile.adults);
                setKidsPreschool(profile.kidsPreschool);
                setKidsElementary(profile.kidsElementary);
                setKidsTeen(profile.kidsTeen);
                setHasPet(profile.hasPet);
            }
            setLoading(false);
        };
        loadProfile();
    }, []);

    // 카카오 맵 로드 체크 (이미 프로젝트에서 사용 중이므로 window.kakao 활용)
    const searchAddress = useCallback(async (query: string) => {
        if (!query.trim()) return;
        setIsSearching(true);
        setSearchResults([]);

        try {
            const results = await searchAddressAction(query);
            setSearchResults(results);

            if (results.length === 0) {
                toast.info('검색 결과가 없습니다. 다른 키워드로 시도해보세요.');
            }
        } catch (err) {
            console.error('[AddressSearch] Error:', err);
            toast.error('주소 검색 중 오류가 발생했습니다');
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSelectAddress = (result: { label: string; lat: number; lng: number }) => {
        setOriginLabel(result.label);
        setOriginLat(result.lat);
        setOriginLng(result.lng);
        setSearchResults([]);
        setAddressQuery('');
    };

    const buildProfile = (): CampingProfile => ({
        originLabel: originLabel || null,
        originLat,
        originLng,
        adults,
        kidsPreschool,
        kidsElementary,
        kidsTeen,
        hasPet,
    });

    const handleSaveAndContinue = async () => {
        // 출발지 필수 검증
        if (requireOrigin && !originLat) {
            toast.error('출발지를 선택해주세요');
            return;
        }

        setSaving(true);
        const profile = buildProfile();
        const result = await saveCampingProfile(profile);

        if (result.success) {
            setExistingProfile(profile);
            setIsEditing(false);
            toast.success('캠핑 프로필이 저장되었어요!');
            onComplete(profile);
        } else {
            toast.error(result.error || '저장에 실패했습니다');
        }
        setSaving(false);
    };

    const handleConfirmExisting = () => {
        if (existingProfile) {
            if (requireOrigin && !existingProfile.originLat) {
                // 출발지가 필요한데 없으면 수정 모드로
                setIsEditing(true);
                toast.info('출발지 정보를 입력해주세요');
                return;
            }
            onComplete(existingProfile);
        }
    };

    // ── 로딩 ──
    if (loading) {
        return (
            <div className={`flex items-center justify-center ${compact ? 'py-4' : 'py-8'}`}>
                <Loader2 className="w-5 h-5 animate-spin text-[#224732]" />
                <span className="ml-2 text-sm text-gray-500">프로필 확인 중...</span>
            </div>
        );
    }

    // ── 카운터 UI 헬퍼 ──
    const Counter = ({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) => (
        <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{label}</span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, value - 1))}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center border border-gray-200 hover:bg-gray-200 transition-colors text-sm"
                >
                    -
                </button>
                <span className="w-8 text-center text-sm font-medium text-gray-900">{value}</span>
                <button
                    type="button"
                    onClick={() => onChange(value + 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center border border-gray-200 hover:bg-gray-200 transition-colors text-sm"
                >
                    +
                </button>
            </div>
        </div>
    );

    // ── 기존 프로필 있음 → 확인 모드 ──
    if (existingProfile && !isEditing) {
        const totalKids = existingProfile.kidsPreschool + existingProfile.kidsElementary + existingProfile.kidsTeen;
        return (
            <div className={`bg-white rounded-2xl ${compact ? 'p-3' : 'p-4'} shadow-sm border border-gray-100`}>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#224732]" />
                        {title}
                    </h4>
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-xs text-[#224732] hover:underline flex items-center gap-1"
                    >
                        <Pencil className="w-3 h-3" />
                        수정
                    </button>
                </div>

                {/* 요약 카드 */}
                <div className="space-y-2 mb-3">
                    {requireOrigin && !existingProfile.originLat ? (
                        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 px-2 py-1 rounded-md">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>출발지: <strong className="font-bold">미설정 (필수)</strong></span>
                        </div>
                    ) : existingProfile.originLabel && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            <span>출발: <strong className="text-gray-800">{existingProfile.originLabel}</strong></span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                            성인 {existingProfile.adults}명
                            {totalKids > 0 && `, 아이 ${totalKids}명`}
                        </span>
                    </div>
                    {existingProfile.hasPet && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Dog className="w-3.5 h-3.5 text-gray-400" />
                            <span>반려견 동반</span>
                        </div>
                    )}
                </div>

                <Button
                    onClick={handleConfirmExisting}
                    className={`w-full h-10 rounded-xl text-sm font-medium ${
                        requireOrigin && !existingProfile.originLat 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                        : 'bg-[#224732] hover:bg-[#1a3626] text-white'
                    }`}
                >
                    {requireOrigin && !existingProfile.originLat ? (
                        <>
                            <Search className="w-4 h-4 mr-1" />
                            출발지 입력하고 진행하기
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4 mr-1" />
                            이대로 진행
                        </>
                    )}
                </Button>
            </div>
        );
    }

    // ── 프로필 없음 OR 수정 모드 → 입력 폼 ──
    return (
        <div className={`bg-white rounded-2xl ${compact ? 'p-3' : 'p-4'} shadow-sm border border-gray-100`}>
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
                <Users className="w-4 h-4 text-[#224732]" />
                {existingProfile ? `${title} 수정` : `${title} 입력`}
            </h4>

            <div className="space-y-4">
                {/* 출발지 입력 (requireOrigin이거나 수정 모드) */}
                {(requireOrigin || isEditing) && (
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                            <MapPin className="w-4 h-4 text-[#224732]" />
                            출발 장소 {requireOrigin && <span className="text-red-400 text-xs">*필수</span>}
                        </label>

                        {/* 선택된 출발지 표시 */}
                        {originLabel && (
                            <div className="flex items-center justify-between bg-[#224732]/5 rounded-lg px-3 py-2 mb-2">
                                <span className="text-sm font-medium text-[#224732]">{originLabel}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOriginLabel('');
                                        setOriginLat(null);
                                        setOriginLng(null);
                                    }}
                                    className="text-xs text-gray-400 hover:text-red-400"
                                >
                                    삭제
                                </button>
                            </div>
                        )}

                        {/* 주소 검색 */}
                        <div className="relative">
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    placeholder="출발 장소 검색 (예: 강남역, 서울시청)"
                                    value={addressQuery}
                                    onChange={(e) => setAddressQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchAddress(addressQuery))}
                                    className="flex-1 text-sm"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => searchAddress(addressQuery)}
                                    disabled={isSearching || !addressQuery.trim()}
                                    className="shrink-0"
                                >
                                    {isSearching ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Search className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>

                            {/* 검색 결과 드롭다운 */}
                            {searchResults.length > 0 && (
                                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {searchResults.map((r, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => handleSelectAddress(r)}
                                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors"
                                        >
                                            <span className="text-gray-800">{r.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 인원 구성 */}
                <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-3">
                        <Users className="w-4 h-4 text-[#224732]" />
                        인원 구성
                    </label>
                    <div className="space-y-3 bg-gray-50 rounded-xl p-3">
                        <Counter label="성인" value={adults} onChange={setAdults} min={1} />
                        <Counter label="미취학 아동" value={kidsPreschool} onChange={setKidsPreschool} />
                        <Counter label="초등학생" value={kidsElementary} onChange={setKidsElementary} />
                        <Counter label="청소년" value={kidsTeen} onChange={setKidsTeen} />
                    </div>
                </div>

                {/* 반려견 */}
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl">
                    <input
                        type="checkbox"
                        id="campingProfilePet"
                        checked={hasPet}
                        onChange={(e) => setHasPet(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#224732] focus:ring-[#224732] cursor-pointer"
                    />
                    <label htmlFor="campingProfilePet" className="text-sm text-gray-700 cursor-pointer select-none flex items-center gap-1.5">
                        <Dog className="w-4 h-4 text-gray-500" />
                        반려견과 함께 방문합니다
                    </label>
                </div>

                {/* 저장 버튼 */}
                <div className="flex gap-2 pt-1">
                    {isEditing && existingProfile && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                // 원래 값으로 복원
                                setOriginLabel(existingProfile.originLabel || '');
                                setOriginLat(existingProfile.originLat);
                                setOriginLng(existingProfile.originLng);
                                setAdults(existingProfile.adults);
                                setKidsPreschool(existingProfile.kidsPreschool);
                                setKidsElementary(existingProfile.kidsElementary);
                                setKidsTeen(existingProfile.kidsTeen);
                                setHasPet(existingProfile.hasPet);
                                setIsEditing(false);
                            }}
                            className="flex-1"
                        >
                            취소
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={handleSaveAndContinue}
                        disabled={saving}
                        className={`${isEditing && existingProfile ? 'flex-1' : 'w-full'} h-10 bg-[#224732] hover:bg-[#1a3626] text-white rounded-xl text-sm font-medium`}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                저장 중...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-1" />
                                {existingProfile ? '수정 후 진행' : '저장 후 진행하기'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
