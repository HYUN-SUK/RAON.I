'use client';

import { SITES } from '@/constants/sites';
import { useReservationStore } from '@/store/useReservationStore';
import Image from 'next/image';

export default function SiteList() {
    const { selectedSite, setSelectedSite } = useReservationStore();

    return (
        <div className="space-y-4 pb-20">
            {SITES.map((site) => (
                <div
                    key={site.id}
                    onClick={() => setSelectedSite(site)}
                    className={`
            relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer group
            ${selectedSite?.id === site.id
                            ? 'border-[#2F5233] ring-2 ring-[#2F5233]/50 bg-white/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'}
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
                        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-xs text-white border border-white/10">
                            {site.type}
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
            ))}
        </div>
    );
}
