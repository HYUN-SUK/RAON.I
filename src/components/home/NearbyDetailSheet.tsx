import React, { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Calendar, ExternalLink, Navigation, Phone, Copy } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

interface NearbyEvent {
    id: number;
    title: string;
    description: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    image_url: string | null;
    latitude?: number | null;
    longitude?: number | null;
}

interface Facility {
    category: string;
    name: string;
    distance: string;
    phone: string;
    lat: number;
    lng: number;
}

interface NearbyDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    events: NearbyEvent[];
    facilities: Facility[];
}

export default function NearbyDetailSheet({ isOpen, onClose, events, facilities }: NearbyDetailSheetProps) {
    const [activeTab, setActiveTab] = useState("events");

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("복사되었습니다.");
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-[32px] p-0 border-none h-[85vh] outline-none bg-stone-50 dark:bg-zinc-900">
                <SheetHeader className="px-6 pt-8 pb-2">
                    <SheetTitle className="text-2xl font-bold text-[#1C4526] dark:text-[#A7F3D0]">
                        주변 즐길거리
                    </SheetTitle>
                    <SheetDescription>
                        캠핑장 주변 10km 내의 행사와 편의시설을 확인하세요.
                    </SheetDescription>
                </SheetHeader>

                <div className="px-6 mt-4 h-full">
                    <Tabs defaultValue="events" className="w-full h-full" onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2 bg-stone-200/50 dark:bg-zinc-800 p-1 rounded-2xl h-12">
                            <TabsTrigger
                                value="events"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold"
                            >
                                🎡 문화/행사 ({events.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="facilities"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold"
                            >
                                🏪 편의시설 ({facilities.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Events Tab */}
                        <TabsContent value="events" className="mt-6 space-y-4 pb-24 overflow-y-auto h-[calc(100%-180px)] pr-1 scrollbar-hide">
                            {events.length > 0 ? (
                                events.map((event) => (
                                    <div key={event.id} className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-sm border border-stone-100 dark:border-zinc-700 transition-all hover:shadow-md">
                                        {/* Image */}
                                        <div className="relative h-32 bg-stone-200">
                                            {event.image_url ? (
                                                <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-stone-100 dark:bg-zinc-700 text-stone-400">
                                                    <MapPin size={32} />
                                                </div>
                                            )}
                                            <div className="absolute top-3 left-3">
                                                <Badge className="bg-white/90 text-[#1C4526] hover:bg-white backdrop-blur-sm border-none shadow-sm">
                                                    진행중
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-5">
                                            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">{event.title}</h3>
                                            <p className="text-sm text-stone-500 mb-4 line-clamp-2">{event.description}</p>

                                            <div className="flex flex-col gap-2 text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-[#C3A675]" />
                                                    <span>{event.start_date} ~ {event.end_date}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={14} className="text-[#C3A675]" />
                                                    <span>{event.location}</span>
                                                </div>
                                            </div>

                                            {/* Action */}
                                            {event.latitude && event.longitude && (
                                                <Button
                                                    className="w-full mt-4 bg-[#1C4526] text-white hover:bg-[#15341C] rounded-xl h-12"
                                                    onClick={() => window.open(`https://map.naver.com/v5/search/${encodeURIComponent(event.title)}`, '_blank')}
                                                >
                                                    <Navigation size={16} className="mr-2" />
                                                    길찾기
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-stone-500">
                                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Calendar className="text-stone-400" size={24} />
                                    </div>
                                    <p>진행 중인 행사가 없습니다.</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Facilities Tab */}
                        <TabsContent value="facilities" className="mt-6 space-y-3 pb-24 overflow-y-auto h-[calc(100%-180px)] pr-1 scrollbar-hide">
                            {facilities.length > 0 ? (
                                facilities.map((place, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-100 dark:border-zinc-700">
                                        <div className="flex items-center gap-4">
                                            <div className={`
                                                w-12 h-12 rounded-full flex items-center justify-center flex-none
                                                ${place.category === '마트' ? 'bg-blue-50 text-blue-600' :
                                                    place.category === '주유소' ? 'bg-orange-50 text-orange-600' :
                                                        place.category === '약국' ? 'bg-green-50 text-green-600' :
                                                            place.category === '병원' ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-500'}
                                            `}>
                                                <span className="text-xs font-bold">{place.category}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-stone-900 dark:text-stone-100">{place.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-[#C3A675] font-bold">{place.distance}</span>
                                                    <span className="text-[10px] text-stone-300">|</span>
                                                    <span className="text-xs text-stone-500">{place.phone}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-10 h-10 rounded-full p-0 border-stone-200"
                                                onClick={() => copyToClipboard(place.phone)}
                                            >
                                                <Copy size={16} className="text-stone-400" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-10 h-10 rounded-full p-0 border-stone-200"
                                                onClick={() => window.location.href = `tel:${place.phone}`}
                                            >
                                                <Phone size={16} className="text-stone-600" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-stone-500">
                                    <p>등록된 주변 시설이 없습니다.</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    );
}
