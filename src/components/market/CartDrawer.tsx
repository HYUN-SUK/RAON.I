'use client';

import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { useCartUIStore } from '@/store/useCartUIStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';

export function CartDrawer() {
    const router = useRouter();
    const { items, updateQuantity, removeItem, getTotalPrice } = useCartStore();
    const { isOpen, closeCart } = useCartUIStore();

    const formatPrice = (p: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(p);

    const handleCheckout = () => {
        closeCart();
        router.push('/market/checkout');
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
            <SheetContent className="w-full sm:max-w-md flex flex-col h-full bg-white p-0">
                <SheetHeader className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
                    <SheetTitle className="text-left flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5" />
                        장바구니 <span className="text-[#1C4526] font-bold">{items.length}</span>
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {items.length > 0 ? (
                        <div className="space-y-6">
                            {items.map((item) => (
                                <div key={item.id} className="flex gap-4">
                                    <div className="w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                        {item.product?.images?.[0] && (
                                            <img
                                                src={item.product.images[0]}
                                                alt={item.product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between py-0.5">
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{item.product?.name}</h4>
                                            <p className="text-sm font-bold text-gray-900 mt-1">{formatPrice(item.product?.price || 0)}</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center bg-gray-50 rounded-md h-7 px-1">
                                                <button
                                                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                                    className="w-6 h-full flex items-center justify-center text-gray-500 hover:text-gray-800"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="text-xs font-medium w-6 text-center text-gray-700">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    className="w-6 h-full flex items-center justify-center text-gray-500 hover:text-gray-800"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="text-gray-400 hover:text-red-500 p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3 pb-20">
                            <ShoppingBag className="w-12 h-12 opacity-20" />
                            <p className="text-sm">장바구니가 비어있습니다</p>
                            <Button
                                variant="outline"
                                onClick={closeCart}
                                className="mt-2"
                            >
                                쇼핑 계속하기
                            </Button>
                        </div>
                    )}
                </div>

                {items.length > 0 && (
                    <div className="p-5 border-t border-gray-100 bg-white safe-area-bottom">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm text-gray-500">총 결제 금액</span>
                            <span className="text-lg font-bold text-[#1C4526]">{formatPrice(getTotalPrice())}</span>
                        </div>
                        <Button
                            className="w-full h-12 bg-[#1C4526] hover:bg-[#16331F] text-white text-base rounded-xl font-medium"
                            onClick={handleCheckout}
                        >
                            주문하기
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
