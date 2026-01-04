'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Plus, Edit2, MapPin } from 'lucide-react';

type Site = Database['public']['Tables']['sites']['Row'];

export default function AdminSitesPage() {
    const supabase = createClient();
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSites = async () => {
        try {
            const { data, error } = await supabase
                .from('sites')
                .select('*')
                .order('id', { ascending: true }); // A1, A2... assuming string sort works ok for now

            if (error) throw error;
            if (data) setSites(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">사이트 관리</h1>
                    <p className="text-gray-500 text-sm">사이트별 이미지, 소개글, 세부 정보를 관리합니다.</p>
                </div>
                {/* Adding new sites might not be needed if ID is fixed, but let's hide it for now or just allow it if needed */}
                {/* <Button><Plus className="w-4 h-4 mr-2" /> 새 사이트 추가</Button> */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sites.map((site) => (
                    <div key={site.id} className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="relative h-48 bg-gray-100">
                            {site.image_url ? (
                                <Image
                                    src={site.image_url}
                                    alt={site.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    이미지 없음
                                </div>
                            )}
                            <div className="absolute top-2 right-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${site.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {site.is_active ? '운영중' : '운영중단'}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{site.name}</h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {site.id}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">{site.price.toLocaleString()}원</p>
                                    <p className="text-xs text-gray-500">기준 {site.base_price.toLocaleString()}원</p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-600 line-clamp-2 min-h-[40px]">
                                {site.description || '소개글이 없습니다.'}
                            </p>

                            <div className="pt-2">
                                <Link href={`/admin/sites/${site.id}`}>
                                    <Button variant="outline" className="w-full">
                                        <Edit2 className="w-4 h-4 mr-2" /> 수정하기
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}

                {sites.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        등록된 사이트가 없습니다. (Migration이 실행되었나요?)
                    </div>
                )}
            </div>
        </div>
    );
}
