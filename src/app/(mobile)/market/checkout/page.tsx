'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { marketService } from '@/services/marketService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CreditCard, Receipt } from 'lucide-react';
import { OrderItem } from '@/types/market';

export default function CheckoutPage() {
    const router = useRouter();
    const { items, getTotalPrice, clearCartLocal } = useCartStore();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    const [isOrderComplete, setIsOrderComplete] = useState(false);

    // 유효성 검사 및 리다이렉트
    useEffect(() => {
        if (!isOrderComplete && items.length === 0) {
            router.replace('/market');
        }
    }, [items, router, isOrderComplete]);

    const handleOrder = async () => {
        if (!name || !phone || !address) {
            alert('배송 정보를 모두 입력해주세요.');
            return;
        }

        try {
            const orderItems: OrderItem[] = items.map(item => ({
                product_id: item.product_id,
                name: item.product?.name || 'Unknown',
                price: item.product?.price || 0,
                quantity: item.quantity,
                image_url: item.product?.images?.[0]
            }));

            await marketService.createOrder({
                items: orderItems,
                total_price: getTotalPrice(),
                payment_info: { method: 'card', pg: 'toss' },
                delivery_info: { recipient: name, phone, address }
            });

            setIsOrderComplete(true);
            await marketService.clearCart();
            clearCartLocal();
            router.replace('/market/orders');
        } catch (error) {
            console.error(error);
        }
    };

    const formatPrice = (p: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(p);

    if (items.length === 0) return null;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-32">
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center">
                <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-800" />
                </button>
                <h1 className="text-lg font-bold text-gray-900 ml-2">주문서 작성</h1>
            </header>

            <main className="p-5 space-y-6 max-w-[430px] mx-auto">
                {/* 주문 상품 요약 */}
                <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4 text-[#1C4526]">
                        <Receipt className="w-5 h-5" />
                        <h2 className="font-bold text-gray-900">주문 내역</h2>
                    </div>

                    <div className="space-y-3">
                        {items.map(item => (
                            <div key={item.id} className="flex justify-between items-start text-sm group">
                                <span className="text-gray-600 truncate flex-1 pr-4 group-hover:text-gray-900 transition-colors">
                                    {item.product?.name} <span className="text-xs text-gray-400">x {item.quantity}</span>
                                </span>
                                <span className="font-medium whitespace-nowrap">{formatPrice((item.product?.price || 0) * item.quantity)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="my-4 border-t border-dashed border-gray-200" />

                    <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-medium">총 결제 금액</span>
                        <span className="text-xl font-bold text-[#1C4526]">{formatPrice(getTotalPrice())}</span>
                    </div>
                </section>

                {/* 배송지 정보 입력 */}
                <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-900 mb-4">배송 정보</h2>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 ml-1">받는 분</Label>
                            <Input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="이름을 입력하세요"
                                className="bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 ml-1">연락처</Label>
                            <Input
                                value={phone}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    let formatted = raw;
                                    if (raw.length > 3 && raw.length <= 7) {
                                        formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
                                    } else if (raw.length > 7) {
                                        formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
                                    }
                                    setPhone(formatted);
                                }}
                                placeholder="010-0000-0000"
                                maxLength={13}
                                className="bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 ml-1">주소</Label>
                            <Input
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder="상세 주소를 입력하세요"
                                className="bg-gray-50 border-gray-200 focus:bg-white transition-all h-11"
                            />
                        </div>
                    </div>
                </section>

                {/* 결제 수단 */}
                <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-900 mb-4">결제 수단</h2>
                    <div className="p-4 border border-[#1C4526]/20 bg-[#1C4526]/5 rounded-xl flex flex-col items-center justify-center gap-2 text-[#1C4526] transition-all hover:bg-[#1C4526]/10 cursor-pointer">
                        <CreditCard className="w-6 h-6 mb-1" />
                        <span className="text-sm font-bold">신용/체크카드</span>
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-3">
                        안전한 결제를 위해 PG사 결제창으로 이동합니다.
                    </p>
                </section>
            </main>

            {/* 하단 결제 버튼 */}
            <div className="fixed bottom-[80px] left-0 right-0 max-w-[430px] mx-auto bg-white/90 backdrop-blur-md border-t border-gray-100 p-4 safe-area-bottom z-30">
                <Button
                    className="w-full h-12 text-base bg-[#1C4526] hover:bg-[#16331F] text-white rounded-xl shadow-lg shadow-[#1C4526]/20 transition-all active:scale-[0.98]"
                    onClick={handleOrder}
                >
                    {formatPrice(getTotalPrice())} 결제하기
                </Button>
            </div>
        </div>
    );
}
