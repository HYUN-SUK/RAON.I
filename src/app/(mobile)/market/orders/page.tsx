'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { OrderList } from '@/components/market/OrderList';

export default function OrderHistoryPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 flex items-center h-14 px-4 bg-white border-b border-gray-100">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-900">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center text-lg font-bold text-gray-900 pr-10">
                    주문 내역
                </h1>
            </div>

            {/* Content */}
            <div className="p-5">
                <OrderList />
            </div>
        </div>
    );
}
