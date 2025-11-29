'use client';

import { SITES } from '@/constants/sites';
import { useReservationStore } from '@/store/useReservationStore';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function SiteList() {
    const router = useRouter();
    const { selectedSite, setSelectedSite } = useReservationStore();

    // Mock availability (In real app, this would come from backend based on selected dates)
    // For now, let's assume 'site-3' (Glamping) is sold out for demonstration
    const isSiteAvailable = (siteId: string) => siteId !== 'site-3';

    const sortedSites = [...SITES].sort((a, b) => {
        const aAvailable = isSiteAvailable(a.id);
        const bAvailable = isSiteAvailable(b.id);
        if (aAvailable === bAvailable) return 0;
        return aAvailable ? -1 : 1;
    });

    const handleSiteClick = (site: any) => {
        if (!isSiteAvailable(site.id)) return;
        setSelectedSite(site);
        router.push(`/reservation/${site.id}`);
    };

    return (
        <div className="space-y-4 pb-20">
            {sortedSites.map((site) => {
                const available = isSiteAvailable(site.id);
                return (
                    <div
                        key={site.id}
                        onClick={() => handleSiteClick(site)}
                        className={`
            relative overflow-hidden rounded-2xl border transition-all duration-300 group
            ${available ? 'cursor-pointer hover:bg-white/10' : 'cursor-not-allowed opacity-60 grayscale'}
            ${selectedSite?.id === site.id
                                ? 'border-[#2F5233] ring-2 ring-[#2F5233]/50 bg-white/10'
                                : 'border-white/10 bg-white/5'}
          `}
                    >
                        <div className="relative h-48 w-full">
                            <Image
                                src={site.imageUrl}
                                alt={site.name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-3 left-4 text-white">
                                <h3 className="text-xl font-bold">{site.name}</h3>
                                <p className="text-sm text-white/80">{site.price.toLocaleString()}원 / 1박</p>
                            </div>
                            <div className="absolute top-3 right-3 flex gap-2">
                                {!available && (
                                    <span className="bg-red-500/80 backdrop-blur-md px-2 py-1 rounded-lg text-xs text-white border border-white/10 font-bold">
                                        마감
                                    </span>
                                )}
                                <span className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-xs text-white border border-white/10">
                                    {site.type}
                                </span>
                            </div>
                        </div>

                        <div className="p-4">
                            <p className="text-sm text-white/70 mb-3 line-clamp-2">{site.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {site.features.map((feature, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 rounded-md bg-white/5 text-white/60 border border-white/5">
                                        {feature}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
}
