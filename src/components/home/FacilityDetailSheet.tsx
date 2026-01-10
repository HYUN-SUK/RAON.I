import React, { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from 'next/image';
import { Map, Bath, Warehouse } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface FacilityDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    layoutImage?: string | null;
    bathroomImages?: string[] | null;
    siteImages?: string[] | null;
    description?: string | null;
}

export default function FacilityDetailSheet({
    isOpen,
    onClose,
    layoutImage,
    bathroomImages,
    siteImages,
    description
}: FacilityDetailSheetProps) {
    const [activeTab, setActiveTab] = useState("info");

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-[32px] p-0 border-none h-[85vh] outline-none bg-stone-50 dark:bg-zinc-900">
                <SheetHeader className="px-6 pt-8 pb-2">
                    <SheetTitle className="text-2xl font-bold text-[#1C4526] dark:text-[#A7F3D0]">
                        시설 현황
                    </SheetTitle>
                    <SheetDescription>
                        편리하고 쾌적한 라온아이 시설을 둘러보세요.
                    </SheetDescription>
                </SheetHeader>

                <div className="px-6 mt-4 h-full">
                    <Tabs defaultValue="info" className="w-full h-full" onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-3 bg-stone-200/50 dark:bg-zinc-800 p-1 rounded-2xl h-12">
                            <TabsTrigger
                                value="info"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold text-xs"
                            >
                                <Map className="w-4 h-4 mr-2" />
                                배치/설명
                            </TabsTrigger>
                            <TabsTrigger
                                value="bathroom"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold text-xs"
                            >
                                <Bath className="w-4 h-4 mr-2" />
                                욕실/개수대
                            </TabsTrigger>
                            <TabsTrigger
                                value="site"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold text-xs"
                            >
                                <Warehouse className="w-4 h-4 mr-2" />
                                사이트 전경
                            </TabsTrigger>
                        </TabsList>

                        {/* Info Tab: Description + Layout Image */}
                        <TabsContent value="info" className="mt-6 space-y-6 pb-32 overflow-y-auto h-[calc(100%-120px)] scrollbar-hide">
                            {/* Description Block */}
                            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-sm border border-stone-100 dark:border-zinc-700">
                                <h3 className="font-bold text-stone-900 dark:text-stone-100 mb-4 text-lg">라온아이 시설 안내</h3>
                                <p className="text-stone-600 dark:text-stone-400 whitespace-pre-wrap leading-relaxed">
                                    {description || "시설 설명이 등록되지 않았습니다."}
                                </p>
                            </div>

                            {/* Layout Image */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-stone-900 dark:text-stone-100 px-1">전체 배치도</h4>
                                {layoutImage ? (
                                    <div className="rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 bg-white shadow-sm">
                                        <AspectRatio ratio={16 / 9}>
                                            <Image
                                                src={layoutImage}
                                                alt="Layout Map"
                                                fill
                                                className="object-contain"
                                                sizes="(max-width: 768px) 100vw, 800px"
                                            />
                                        </AspectRatio>
                                    </div>
                                ) : (
                                    <div className="h-40 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400 text-sm">
                                        배치도 이미지가 없습니다.
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Bathroom Tab */}
                        <TabsContent value="bathroom" className="mt-6 space-y-4 pb-32 overflow-y-auto h-[calc(100%-120px)] scrollbar-hide">
                            <div className="space-y-4">
                                {bathroomImages && bathroomImages.length > 0 ? (
                                    bathroomImages.map((img, idx) => (
                                        <div key={idx} className="rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 shadow-sm bg-white">
                                            <AspectRatio ratio={4 / 3}>
                                                <Image
                                                    src={img}
                                                    alt={`Bathroom ${idx + 1}`}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </AspectRatio>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 text-stone-500">
                                        <p>등록된 욕실/개수대 사진이 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Site Tab */}
                        <TabsContent value="site" className="mt-6 space-y-4 pb-32 overflow-y-auto h-[calc(100%-120px)] scrollbar-hide">
                            <div className="space-y-4">
                                {siteImages && siteImages.length > 0 ? (
                                    siteImages.map((img, idx) => (
                                        <div key={idx} className="rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 shadow-sm bg-white">
                                            <AspectRatio ratio={4 / 3}>
                                                <Image
                                                    src={img}
                                                    alt={`Site ${idx + 1}`}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </AspectRatio>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 text-stone-500">
                                        <p>등록된 사이트 전경 사진이 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    );
}
