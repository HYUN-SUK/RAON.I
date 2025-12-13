"use client";

import React, { useState } from 'react';
import { AlbumItem } from '@/store/useMySpaceStore';
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/Modal";

interface PhotoGridProps {
    photos: AlbumItem[];
}

export default function PhotoGrid({ photos }: PhotoGridProps) {
    const [selectedPhoto, setSelectedPhoto] = useState<AlbumItem | null>(null);

    if (!photos || photos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                <p>아직 사진이 없어요.</p>
                <p className="text-sm mt-1">첫 캠핑의 추억을 남겨보세요!</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                {photos.map((photo) => (
                    <div
                        key={photo.id}
                        className="relative aspect-square cursor-pointer overflow-hidden group"
                        onClick={() => setSelectedPhoto(photo)}
                    >
                        <img
                            src={photo.imageUrl}
                            alt={photo.description}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        {/* Simple Tag indicator */}
                        {photo.tags && photo.tags.length > 0 && (
                            <div className="absolute bottom-1 right-1">
                                <Badge variant="secondary" className="text-[10px] h-5 bg-black/50 text-white border-none backdrop-blur-sm">
                                    +{photo.tags.length}
                                </Badge>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedPhoto}
                onClose={() => setSelectedPhoto(null)}
                title={selectedPhoto?.description || "사진 상세"}
                className="max-w-[400px]"
            >
                {selectedPhoto && (
                    <div>
                        <div className="aspect-square relative rounded-lg overflow-hidden mb-4">
                            <img
                                src={selectedPhoto.imageUrl}
                                alt={selectedPhoto.description}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-stone-500">{selectedPhoto.date}</span>
                        </div>

                        {selectedPhoto.tags && (
                            <div className="flex flex-wrap gap-1">
                                {selectedPhoto.tags.map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs border-stone-200 text-stone-500">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}
