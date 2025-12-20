'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { marketService } from '@/services/marketService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { OrderItem } from '@/types/market';

export default function CheckoutPage() {
    const router = useRouter();
    const { items, getTotalPrice, clearCartLocal } = useCartStore();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    const [isOrderComplete, setIsOrderComplete] = useState(false);

    // Check validation and redirect if empty cart (unless order just completed)
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

        // if (!confirm('주문하시겠습니까? (입금 대기 상태로 생성됩니다)')) return; // Confirms block automation

        try {
            // Transform cart items to order items snapshot
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
                payment_info: { method: 'card', pg: 'toss' }, // Updated to Card
                delivery_info: { recipient: name, phone, address }
            });

            setIsOrderComplete(true); // Prevent redirect effect

            // Clear Cart (DB + Local)
            await marketService.clearCart();
            clearCartLocal();

            // console.log('주문 완료: PG 결제 연동 예정');
            // alert('주문이 완료되었습니다! (PG 결제 연동 예정)');
            router.replace('/market/orders'); // Go directly to orders
        } catch (error) {
            console.error(error);
            // alert('주문 생성 실패. 다시 시도해주세요.');
        }
    };

    const formatPrice = (p: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(p);

    if (items.length === 0) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 h-14 flex items-center">
                <button onClick={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft className="w-6 h-6 text-gray-800" />
                </button>
                <h1 className="text-lg font-bold text-gray-900 ml-2">주문서 작성</h1>
            </header>

            <main className="p-4 space-y-6">
                {/* Order Summary */}
                <section className="bg-white p-4 rounded-xl shadow-sm">
                    <h2 className="font-bold text-gray-900 mb-3">주문 상품 ({items.length}개)</h2>
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-gray-600 truncate flex-1 pr-4">{item.product?.name} x {item.quantity}</span>
                                <span className="font-medium">{formatPrice((item.product?.price || 0) * item.quantity)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold text-lg">
                        <span>합계</span>
                        <span className="text-[#1C4526]">{formatPrice(getTotalPrice())}</span>
                    </div>
                </section>

                {/* Delivery Info Form */}
                <section className="bg-white p-4 rounded-xl shadow-sm space-y-4">
                    <h2 className="font-bold text-gray-900">배송지 정보</h2>

                    <div className="space-y-2">
                        <Label>받는 분</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="이름" />
                    </div>

                    <div className="space-y-2">
                        <Label>연락처</Label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" />
                    </div>

                    <div className="space-y-2">
                        <Label>주소</Label>
                        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="상세 주소 입력" />
                    </div>
                </section>

                {/* Payment Info (Card Only) */}
                <section className="bg-white p-4 rounded-xl shadow-sm space-y-2">
                    <h2 className="font-bold text-gray-900">결제 수단</h2>
                    <div className="p-3 border border-[#1C4526] bg-[#1C4526]/5 rounded-lg text-[#1C4526] text-sm font-medium text-center">
                        신용/체크카드 (PG)
                    </div>
                    <p className="text-xs text-gray-500 text-center">라온아이 상점은 카드 결제만 지원합니다. (예약과 별도 정산)</p>
                </section>
            </main>

            <div className="fixed bottom-[80px] left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-100 p-4 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <Button
                    className="w-full h-12 text-base bg-[#1C4526] hover:bg-[#16331F] text-white rounded-xl"
                    onClick={handleOrder}
                >
                    {formatPrice(getTotalPrice())} 결제하기
                </Button>
            </div>
        </div>
    );
}
