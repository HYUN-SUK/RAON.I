"use client";

import React, { useState, useEffect } from 'react';
import { X, Star, Heart, Camera, MapPin, Calendar, Edit2 } from 'lucide-react';
import { useMySpaceStore, MapItem } from '@/store/useMySpaceStore';

interface PlaceDetailSheetProps {
    item: MapItem | null;
    isOpen: boolean;
    onClose: () => void;
    isNew?: boolean; // New prop to indicate "Add Mode"
    onSaveNew?: (item: MapItem) => void; // Callback when saving a new item
}

export default function PlaceDetailSheet({ item, isOpen, onClose, isNew = false, onSaveNew }: PlaceDetailSheetProps) {
    const { updateMapItem, toggleMapFavorite } = useMySpaceStore();
    const [isEditing, setIsEditing] = useState(isNew);

    // State variables
    const [memo, setMemo] = useState('');
    const [rating, setRating] = useState(0);
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [visitedDate, setVisitedDate] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);

    // Reset state when item changes
    useEffect(() => {
        if (item) {
            setMemo(item.memo || '');
            setRating(item.rating || 0);
            setName(item.siteName);
            setAddress(item.address || '');
            setPhotos(item.photos || []);

            // Safer Date Initialization
            try {
                const date = new Date(item.visitedDate);
                if (!isNaN(date.getTime())) {
                    setVisitedDate(date.toISOString().split('T')[0]);
                } else {
                    setVisitedDate(new Date().toISOString().split('T')[0]); // Fallback
                }
            } catch (e) {
                setVisitedDate(new Date().toISOString().split('T')[0]); // Fallback
            }

            setIsEditing(isNew); // Reset to new/view mode based on context
        }
    }, [item, isNew]);

    const handleSave = () => {
        if (!item) return;

        if (isNew) {
            const newItem: MapItem = {
                ...item,
                siteName: name,
                address: address,
                x: item.x,
                y: item.y,
                visitedDate: new Date(visitedDate).toISOString(),
                memo,
                rating,
                photos,
                isFavorite: false,
            };
            if (onSaveNew) onSaveNew(newItem);
        } else {
            console.log('PlaceDetailSheet saving:', item.id, { memo });
            // Update existing
            updateMapItem(item.id, {
                siteName: name, // Allow name update
                address: address, // Allow address update
                visitedDate: new Date(visitedDate).toISOString(), // Allow date update
                memo,
                rating,
                photos
            });
            setIsEditing(false); // Switch back to view mode
        }
    };

    if (!isOpen || !item) return null;

    return (
        <div className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-500 ease-spring ${isOpen ? 'translate-y-0' : 'translate-y-full'} max-w-md mx-auto overflow-hidden`} style={{ maxHeight: '85vh' }}>
            {/* Handle Bar */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0" onClick={onClose}>
                <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-80px)] px-6 pt-2 pb-32">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 pr-4">
                        {isEditing ? (
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="캠핑장 이름을 입력하세요"
                                className="text-2xl font-bold text-gray-900 placeholder:text-gray-300 w-full border-none focus:ring-0 p-0 bg-transparent"
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{name || "이름 없는 캠핑장"}</h2>
                        )}

                        <div className="flex flex-col gap-1 mt-2 text-sm text-gray-500">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-gray-400" />
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={visitedDate}
                                        onChange={(e) => setVisitedDate(e.target.value)}
                                        className="bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-brand-1"
                                    />
                                ) : (
                                    <span>{visitedDate && !isNaN(new Date(visitedDate).getTime()) ? new Date(visitedDate).toLocaleDateString() : '날짜 미입력'}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin size={14} className="text-gray-400" />
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="주소 입력"
                                        className="bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs w-full focus:outline-none focus:border-brand-1"
                                    />
                                ) : (
                                    <span>{address || '주소 미입력'}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Right Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                        {!isNew && !isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors text-gray-600"
                                aria-label="수정하기"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Rating - Post Style */}
                {!isEditing && rating > 0 && (
                    <div className="mb-6 flex items-center gap-2">
                        <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    size={20}
                                    className={`${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                                    strokeWidth={1.5}
                                />
                            ))}
                        </div>
                        <span className="text-amber-600 font-bold text-sm bg-amber-50 px-2 py-0.5 rounded-full">{rating}.0</span>
                    </div>
                )}

                {isEditing && (
                    <div className="mb-6 bg-gray-50 p-4 rounded-xl flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-2">별점 등록</span>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="focus:outline-none active:scale-90 transition-transform"
                                >
                                    <Star
                                        size={28}
                                        className={`${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} transition-colors`}
                                        strokeWidth={1.5}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Divider for View Mode */}
                {!isEditing && <hr className="border-gray-100 my-6" />}

                {/* Memo / Content Body */}
                <div className="space-y-3 mb-8">
                    {isEditing ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">기록 남기기</label>
                            <textarea
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                placeholder="이곳에서의 추억을 기록해보세요..."
                                className="w-full h-40 p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-2/20 bg-gray-50 resize-none text-sm leading-relaxed"
                            />
                        </div>
                    ) : (
                        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-line font-light">
                            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <span className="w-1 h-4 bg-brand-1 rounded-full"></span> 나만의 기록
                            </h3>
                            {memo ? memo : <span className="text-gray-400 italic">작성된 기록이 없습니다.</span>}
                        </div>
                    )}
                </div>

                {/* Photos Section */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Camera size={16} className="text-brand-1" /> 갤러리
                    </h3>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {/* Add Photo Button (Edit Mode Only) */}
                        {isEditing && (
                            <label className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-brand-1/50 hover:text-brand-1 transition-all cursor-pointer active:scale-95">
                                <Camera size={24} className="mb-1" />
                                <span className="text-[10px] font-medium">사진 추가</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    multiple
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            Array.from(e.target.files).forEach(file => {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setPhotos(prev => [...prev, reader.result as string]);
                                                };
                                                reader.readAsDataURL(file);
                                            });
                                        }
                                    }}
                                />
                            </label>
                        )}

                        {/* Photo List */}
                        {photos.length > 0 ? (
                            photos.map((photo, index) => (
                                <div key={index} className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden shadow-sm border border-gray-100 group">
                                    <img src={photo} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                                    {isEditing && (
                                        <button
                                            onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            !isEditing && <span className="text-gray-400 text-xs italic p-2">등록된 사진이 없습니다.</span>
                        )}
                    </div>
                </div>

            </div>

            {/* Sticky Bottom Actions - Only for Edit Mode */}
            {isEditing && (
                <div className="absolute inset-x-0 bottom-0 p-4 bg-white border-t border-gray-100 flex gap-3 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    {!isNew && (
                        <button
                            onClick={() => {
                                setIsEditing(false); // Cancel edit
                            }}
                            className="flex-1 py-3.5 rounded-xl font-bold bg-gray-100 text-gray-600 active:scale-95 transition-transform"
                        >
                            취소
                        </button>
                    )}
                    <button
                        id="save-map-item-button"
                        onClick={handleSave}
                        className="flex-1 py-3.5 rounded-xl font-bold bg-brand-1 text-white shadow-lg shadow-brand-1/30 active:scale-95 transition-transform"
                    >
                        저장하기
                    </button>
                </div>
            )}
        </div>
    );
}
