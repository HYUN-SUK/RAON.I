"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Camera, Plus, Trash2, Calendar, ArrowLeft } from 'lucide-react';
import { useMySpaceStore, AlbumItem } from '@/store/useMySpaceStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button'; // Assuming Button exists

interface AlbumModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AlbumModal({ isOpen, onClose }: AlbumModalProps) {
    const { album, addAlbumItem, removeAlbumItem } = useMySpaceStore();
    const [isAdding, setIsAdding] = useState(false);
    const [newImage, setNewImage] = useState<string | null>(null);
    const [description, setDescription] = useState('');

    // 파일 선택 핸들러
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // 저장 핸들러
    const handleSave = () => {
        if (!newImage) return;

        const newItem: AlbumItem = {
            id: Date.now().toString(),
            imageUrl: newImage,
            description,
            date: new Date().toISOString(),
        };

        addAlbumItem(newItem);
        resetForm();
    };

    const resetForm = () => {
        setIsAdding(false);
        setNewImage(null);
        setDescription('');
    };

    return (
        <Modal isOpen={isOpen} onClose={() => { onClose(); resetForm(); }} title={isAdding ? "새 기록 남기기" : "나의 캠핑 앨범"}>
            {isAdding ? (
                <div className="space-y-4">
                    {/* 이미지 미리보기 및 업로드 */}
                    <div className="relative aspect-video w-full bg-gray-100 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center group">
                        {newImage ? (
                            <Image src={newImage} alt="Preview" fill className="object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                <Camera size={32} />
                                <span className="text-sm">사진을 선택해주세요</span>
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>

                    {/* 설명 입력 */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">어떤 추억인가요?</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="이날의 분위기, 즐거웠던 일들을 기록해보세요."
                            className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-2 min-h-[100px] resize-none text-sm"
                        />
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!newImage}
                            className={`flex-1 py-3 px-4 rounded-xl font-medium text-white transition-colors ${newImage ? 'bg-brand-1 hover:bg-brand-2' : 'bg-gray-300 cursor-not-allowed'
                                }`}
                        >
                            기록 저장
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {album.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Camera size={48} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm">아직 기록된 추억이 없어요.</p>
                            <p className="text-xs mt-1">첫 번째 캠핑을 기록해보세요!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {album.map((item) => (
                                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden group shadow-sm">
                                    <Image src={item.imageUrl} alt={item.description} fill className="object-cover" />

                                    {/* 호버 오버레이 */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-white text-xs line-clamp-2 mb-2">{item.description}</p>
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] text-white/70">
                                                {new Date(item.date).toLocaleDateString()}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('이 추억을 삭제하시겠습니까?')) removeAlbumItem(item.id);
                                                }}
                                                className="p-1.5 bg-white/20 hover:bg-red-500/80 rounded-full text-white transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-full py-4 rounded-xl border-2 border-dashed border-brand-2/30 text-brand-2 font-medium hover:bg-brand-2/5 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        <span>추억 추가하기</span>
                    </button>
                </div>
            )}
        </Modal>
    );
}
