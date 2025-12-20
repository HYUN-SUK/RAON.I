'use client';

// Force rebuild (moved to mobile layout group)

import { useState, useEffect } from 'react';
import { Product } from '@/types/market';
import { marketService } from '@/services/marketService';
import { ProductCard } from '@/components/market/ProductCard';
import { Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
    { id: 'all', label: '전체' },
    { id: 'lantern', label: '조명/랜턴' },
    { id: 'tableware', label: '식기/키친' },
    { id: 'furniture', label: '가구/체어' },
    { id: 'goods', label: '굿즈' },
];

export default function MarketPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');

    useEffect(() => {
        fetchProducts();
    }, [selectedCategory]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const category = selectedCategory === 'all' ? undefined : selectedCategory;
            const data = await marketService.getProducts(category);
            setProducts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pb-24 bg-white min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <h1 className="text-xl font-bold text-[#1C4526] font-serif">Market</h1>
                <div className="flex gap-2">
                    <button className="p-2"><Search className="w-5 h-5 text-gray-600" /></button>
                </div>
            </header>

            {/* Categories */}
            <div className="px-4 py-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                                ${selectedCategory === cat.id
                                    ? 'bg-[#1C4526] text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <main className="px-4 pb-8">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-gray-400" />
                    </div>
                ) : products.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        등록된 상품이 없습니다.
                    </div>
                )}
            </main>
        </div>
    );
}
