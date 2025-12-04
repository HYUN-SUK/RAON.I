import { SITES } from '@/constants/sites';
import ReservationForm from '@/components/reservation/ReservationForm';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import SitePriceDisplay from '@/components/reservation/SitePriceDisplay';

// Correctly typing params for Next.js 15+ (if applicable, but safe for 14 too usually, though 15 requires awaiting params in some cases or just props)
// Assuming Next.js 14/15 standard
export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const site = SITES.find((s) => s.id === id);

    if (!site) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-[#1a1a1a] text-white pb-24">
            <div className="relative h-[40vh] w-full">
                <Image
                    src={site.imageUrl}
                    alt={site.name}
                    fill
                    className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#1a1a1a]" />
                <Link href="/reservation" className="absolute top-6 left-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
            </div>

            <div className="px-5 -mt-10 relative z-10">
                <div className="bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-t-3xl p-6 shadow-2xl">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="text-sm text-[#2F5233] font-bold tracking-wider bg-[#2F5233]/10 px-2 py-1 rounded-md border border-[#2F5233]/20">
                                {site.type}
                            </span>
                            <h1 className="text-3xl font-bold mt-2">{site.name}</h1>
                        </div>

                        <div className="text-right">
                            <SitePriceDisplay site={site} />
                            <p className="text-sm text-white/50">/ 1박</p>
                        </div>
                    </div>

                    <p className="text-white/70 leading-relaxed mb-6">
                        {site.description}
                    </p>

                    <div className="mb-8">
                        <h3 className="text-lg font-semibold mb-3">편의 시설</h3>
                        <div className="flex flex-wrap gap-2">
                            {site.features.map((feature, idx) => (
                                <span key={idx} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80">
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-8">
                        <ReservationForm site={site} />
                    </div>
                </div>
            </div>
        </main>
    );
}
