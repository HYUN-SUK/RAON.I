'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';

export default function CartPage() {
    const router = useRouter();
    const { items, fetchCart, updateQuantity, removeItem, getTotalPrice, isLoading } = useCartStore();

    useEffect(() => {
        fetchCart();
    }, []);

    const formatPrice = (p: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(p);

    if (isLoading && items.length === 0) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">로딩 중...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 h-14 flex items-center">
                <button onClick={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft className="w-6 h-6 text-gray-800" />
                </button>
                <h1 className="text-lg font-bold text-gray-900 ml-2">장바구니</h1>
            </header>

            <main className="p-4 space-y-4">
                {items.length > 0 ? (
                    items.map(item => (
                        <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm flex gap-4">
                            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                {item.product?.images?.[0] && (
                                    <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className="font-medium text-gray-900 line-clamp-1">{item.product?.name}</h3>
                                    <p className="text-sm text-gray-500">{formatPrice(item.product?.price || 0)}</p>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center bg-gray-100 rounded-lg h-8">
                                        <button
                                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                            className="w-8 h-8 flex items-center justify-center text-gray-600"
                                        ><Minus className="w-3 h-3" /></button>
                                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                            className="w-8 h-8 flex items-center justify-center text-gray-600"
                                        ><Plus className="w-3 h-3" /></button>
                                    </div>
                                    <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 p-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <ShoppingBag className="w-12 h-12 mb-4 opacity-20" />
                        <p>장바구니가 비어있습니다.</p>
                        <Button
                            variant="outline"
                            className="mt-4 border-[#1C4526] text-[#1C4526]"
                            onClick={() => router.push('/market')}
                        >쇼핑하러 가기</Button>
                    </div>
                )}
            </main>

            {items.length > 0 && (
                <div className="fixed bottom-[80px] left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-100 p-4 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-between mb-4 text-sm">
                        <span className="text-gray-500">총 결제 금액</span>
                        <span className="font-bold text-xl text-[#1C4526]">{formatPrice(getTotalPrice())}</span>
                    </div>
                    <Button
                        className="w-full h-12 text-base bg-[#1C4526] hover:bg-[#16331F] text-white rounded-xl"
                        onClick={() => router.push('/market/checkout')}
                    >
                        주문하기
                    </Button>
                </div>
            )}
        </div>
    );
}
