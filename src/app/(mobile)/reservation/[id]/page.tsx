import { createClient } from '@/lib/supabase-server';
import ReservationForm from '@/components/reservation/ReservationForm';
import { notFound } from 'next/navigation';
import SitePriceDisplay from '@/components/reservation/SitePriceDisplay';
import { Site } from '@/types/reservation';
import SiteImageSlider from '@/components/reservation/SiteImageSlider';

export const revalidate = 3600; // Cache and revalidate every hour

export async function generateStaticParams() {
    const { createAdminClient } = await import('@/lib/supabase-admin');
    const supabase = createAdminClient();
    const { data: sites } = await supabase.from('sites').select('id');
    const paramsList = sites ? (sites as any[]).map(site => ({ id: site.id })) : [];
    // 빌드 정적 생성 대상에 가상 에어컨 그룹 ID 추가
    paramsList.push({ id: 'air-group' });
    return paramsList;
}

// Assuming Next.js 14/15 standard
export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    const supabase = await createClient();
    // DB에서 사이트 정보 조회
    const { data: siteData, error } = await supabase
        .from('sites')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !siteData) {
        notFound();
    }

    // DB 데이터를 Site 타입으로 변환
    const raw = siteData as any;
    const site: Site = {
            id: siteData.id,
            name: siteData.name,
            type: (raw.type as any) || (raw.site_type as any) || 'AUTO',
            description: siteData.description || '',
            price: siteData.price || siteData.base_price,
            basePrice: siteData.base_price,
            maxOccupancy: raw.max_occupancy ?? raw.capacity ?? 4,
            imageUrl: siteData.image_url || '/images/tent_view_hero.png',
            imageUrls: siteData.image_urls || [],
            features: siteData.features || [],
            isActive: raw.is_active !== false,
            weekday: raw.weekday || undefined,
            weekend: raw.weekend || undefined,
            peakWeekday: raw.peak_weekday || undefined,
            peakWeekend: raw.peak_weekend || undefined
        };

    return (
        <main className="min-h-screen bg-[#F4F8F5] text-[#1E3A26] pb-24">
            <SiteImageSlider
                imageUrls={site.imageUrls || []}
                siteName={site.name}
                fallbackUrl={site.imageUrl}
            />

            <div className="px-5 -mt-10 relative z-10">
                <div className="bg-white border border-[#D2E5D7] rounded-3xl p-6 shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="text-sm text-[#2E7D47] font-bold tracking-wider bg-[#EDF5EE] px-2.5 py-1 rounded-md border border-[#C5DFC9]">
                                {site.type}
                            </span>
                            <h1 className="text-3xl font-extrabold text-[#1E4D2B] mt-2">{site.name}</h1>
                        </div>

                        <div className="text-right">
                            <SitePriceDisplay site={site} />
                            <p className="text-sm text-[#6B7E70] font-medium">/ 1박</p>
                        </div>
                    </div>

                    <p className="text-[#4A5D4E] leading-relaxed mb-6">
                        {site.description}
                    </p>

                    <div className="mb-8">
                        <h3 className="text-lg font-bold text-[#1E4D2B] mb-3">편의 시설</h3>
                        <div className="flex flex-wrap gap-2">
                            {site.features.map((feature, idx) => (
                                <span key={idx} className="px-3 py-1.5 rounded-lg bg-[#EDF5EE] border border-[#C5DFC9] text-sm font-semibold text-[#2D5A3C]">
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-[#E2EFE5] pt-8">
                        <ReservationForm site={site} />
                    </div>
                </div>
            </div>
        </main>
    );
}
