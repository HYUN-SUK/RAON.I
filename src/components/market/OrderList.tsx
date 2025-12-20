import React, { useEffect } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Package, ChevronRight, ShoppingBag } from 'lucide-react';
import Image from 'next/image';

export const OrderList: React.FC = () => {
    const { orders, fetchMyOrders, isLoading } = useMarketStore();

    useEffect(() => {
        fetchMyOrders();
    }, [fetchMyOrders]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-gray-100 text-gray-600';
            case 'PAID': return 'bg-blue-50 text-blue-700';
            case 'SHIPPED': return 'bg-purple-50 text-purple-700';
            case 'COMPLETED': return 'bg-green-50 text-green-700';
            case 'CANCELLED': return 'bg-red-50 text-red-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PENDING': return '결제 대기';
            case 'PAID': return '결제 완료';
            case 'SHIPPED': return '배송 중';
            case 'COMPLETED': return '배송 완료';
            case 'CANCELLED': return '취소됨';
            case 'REFUNDED': return '환불됨';
            default: return status;
        }
    };

    if (isLoading && orders.length === 0) {
        return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
    }

    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                <ShoppingBag size={48} className="opacity-20" />
                <p>주문 내역이 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {orders.map((order) => {
                // Parse items from JSONB
                const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items as any || '[]');
                const firstItem = items[0];
                const otherCount = items.length - 1;

                return (
                    <div key={order.id} className="bg-white rounded-xl border border-[var(--color-surface-2)] p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-gray-500">
                                {format(new Date(order.created_at), 'yyyy.MM.dd HH:mm')}
                            </span>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className={`${getStatusColor(order.status)} font-normal`}>
                                    {getStatusLabel(order.status)}
                                </Badge>
                                <ChevronRight size={16} className="text-gray-300" />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                                {firstItem?.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={firstItem.image_url} alt={firstItem.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Package size={24} className="text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-[var(--color-text-1)] truncate">
                                    {firstItem ? firstItem.name : '알 수 없는 상품'}
                                </h4>
                                <p className="text-sm text-[var(--color-text-2)] mt-0.5">
                                    {otherCount > 0 ? `외 ${otherCount}건` : `${firstItem?.quantity || 1}개`}
                                </p>
                                <div className="mt-2 text-right">
                                    <span className="font-bold text-[var(--color-brand-1)]">
                                        {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(order.total_price)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
