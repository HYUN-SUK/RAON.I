'use client';

import { Product } from '@/types/market';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
    product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(price);
    };

    return (
        <Link href={`/market/products/${product.id}`} className="group block">
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
                {product.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold border border-white px-3 py-1">SOLD OUT</span>
                    </div>
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
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-red-200 text-red-500">BEST</Badge>
                    )}
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">{product.category}</p>
            </div>
        </Link>
    );
}
