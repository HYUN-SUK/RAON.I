import React from 'react';
import { TimelineItem } from '@/store/useMySpaceStore';
import { useRouter } from 'next/navigation';
import { Badge } from "@/components/ui/badge";
import { Tent, Camera, Flag, Clock } from 'lucide-react';

interface TimelineCardProps {
    item: TimelineItem;
}

export default function TimelineCard({ item }: TimelineCardProps) {
    const parsedDate = new Date(item.date);
    const timeString = parsedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    // Define icons and colors based on type
    const getTypeStyles = (type: TimelineItem['type']) => {
        switch (type) {
            case 'reservation':
                return {
                    icon: Tent,
                    bgClass: 'bg-[#F7F5EF] dark:bg-zinc-800',
                    borderClass: 'border-[#1C4526]/20',
                    iconColor: 'text-[#1C4526]'
                };
            case 'photo':
                return {
                    icon: Camera,
                    bgClass: 'bg-white dark:bg-zinc-900',
                    borderClass: 'border-stone-200 dark:border-zinc-700',
                    iconColor: 'text-blue-500'
                };
            case 'mission':
                return {
                    icon: Flag,
                    bgClass: 'bg-green-50 dark:bg-green-900/10',
                    borderClass: 'border-green-200 dark:border-green-800',
                    iconColor: 'text-green-600'
                };
            default:
                return {
                    icon: Clock,
                    bgClass: 'bg-stone-50',
                    borderClass: 'border-stone-200',
                    iconColor: 'text-stone-500'
                };
        }
    };

    const styles = getTypeStyles(item.type);
    const Icon = styles.icon;

    const router = useRouter();

    const handleCardClick = () => {
        if (item.type === 'reservation') {
            // Navigate to Reservation Detail (Placeholder ID)
            // Navigate to Reservation Detail (Placeholder ID)
            // router.push(`/reservation/${item.siteId}`)
            router.push('/myspace/history');
        } else if (item.type === 'photo') {
            router.push('/myspace/album');
        } else if (item.type === 'mission') {
            // alert("미션 달성 현황 화면으로 이동합니다.\n(获得 포인트: " + item.missionPoints + ")");
        }
    };

    return (
        <div className={`relative pl-8 pb-8 group`}>
            {/* Timeline Line & Dot */}
            <div className="absolute left-[11px] top-8 bottom-0 w-[2px] bg-stone-200 dark:bg-zinc-700 group-last:hidden" />
            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center bg-white dark:bg-zinc-900 border-2 ${styles.borderClass} z-10`}>
                <Icon className={`w-3 h-3 ${styles.iconColor}`} />
            </div>

            {/* Content Card */}
            <div
                onClick={handleCardClick}
                className={`rounded-xl p-4 border ${styles.borderClass} ${styles.bgClass} shadow-sm transition-transform active:scale-[0.99] cursor-pointer`}
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {item.type === 'mission' && (
                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    +{item.missionPoints} P
                                </Badge>
                            )}
                            <span className="text-xs text-stone-400 font-medium">{timeString}</span>
                        </div>
                        <h4 className="font-bold text-stone-800 dark:text-stone-100 text-sm md:text-base">
                            {item.title}
                        </h4>
                    </div>
                </div>

                {item.content && (
                    <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-3">
                        {item.content}
                    </p>
                )}

                {/* Image Grid (for Photo type) */}
                {item.images && item.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {item.images.map((img, idx) => (
                            <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-stone-200">
                                {/* Ideally use Next/Image but we need domain config, mock with standard img for now often works better in dev unless configured */}
                                <img src={img} alt="timeline-img" className="object-cover w-full h-full" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
