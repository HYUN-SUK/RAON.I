'use client';

import { useState } from 'react';
import { Product } from '@/types/market';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Loader2 } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { useCartUIStore } from '@/store/useCartUIStore';

interface ProductCardProps {
    product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
    const { addToCart } = useCartStore();
    const { openCart } = useCartUIStore();
    const [isAdding, setIsAdding] = useState(false);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(price);
    };

    const handleAddToCart = async (e: React.MouseEvent) => {
        e.preventDefault(); // Link 이동 방지
        e.stopPropagation();

        setIsAdding(true);
        try {
            await addToCart(product.id, 1);
            openCart(); // 장바구니 Drawer 열기
        } catch (error) {
            console.error(error);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <Link href={`/market/products/${product.id}`} className="group block relative">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 mb-3">
                {product.images?.[0] ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                        No Image
                    </div>
                )}
                {product.stock <= 0 ? (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold border border-white px-3 py-1">SOLD OUT</span>
                    </div>
                ) : (
                    <button
                        onClick={handleAddToCart}
                        disabled={isAdding}
                        className="absolute bottom-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-[#1C4526] shadow-md opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 hover:bg-[#1C4526] hover:text-white"
                    >
                        {isAdding ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <ShoppingBag className="w-5 h-5" />
                        )}
                    </button>
                )}
            </div>

            <div className="space-y-1">
                <div className="flex items-start justify-between">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                        {product.name}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1C4526]">{formatPrice(product.price)}</span>
                    {product.tags && product.tags.length > 0 && product.tags.includes('best') && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-r-200 text-red-500">BEST</Badge>
                    )}
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">{product.category}</p>
            </div>
        </Link>
    );
}
