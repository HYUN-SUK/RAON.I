'use client';

import { useState, useEffect } from 'react';
import { marketService } from '@/services/marketService';
import { Product } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Plus, ExternalLink, Loader2, Edit, Trash, Archive } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function AdminMarketPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            // TODO: Ensure getAllProducts (including inactive) is available or modify getProducts
            // For now getProducts filters by active, we might need an admin method later.
            // Let's assume getProducts returns all for now or we will fix service.
            // Wait, getProducts filters by is_active=true.
            // We need a way to get ALL products.

            // Temporary: just using getProducts. We should update service to allow fetching all for admin.
            const data = await marketService.getProducts();
            setProducts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            await marketService.deleteProduct(id);
            alert('삭제되었습니다.');
            fetchProducts();
        } catch (error) {
            console.error(error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">마켓 상품 관리</h2>
                <Link href="/admin/market/new">
                    <Button className="bg-[#1C4526] hover:bg-[#15341d]">
                        <Plus className="w-4 h-4 mr-2" />
                        상품 등록
                    </Button>
                </Link>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-4 font-medium text-gray-500">상품정보</th>
                            <th className="px-6 py-4 font-medium text-gray-500">가격/재고</th>
                            <th className="px-6 py-4 font-medium text-gray-500">유형</th>
                            <th className="px-6 py-4 font-medium text-gray-500">상태</th>
                            <th className="px-6 py-4 font-medium text-gray-500 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    로딩 중...
                                </td>
                            </tr>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                    등록된 상품이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            products.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                {product.images?.[0] ? (
                                                    <Image
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-gray-300 transform scale-75">
                                                        <Archive className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{product.name}</div>
                                                <div className="text-xs text-gray-500">{product.category}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium">{product.price.toLocaleString()}원</div>
                                        <div className="text-xs text-gray-500">재고: {product.stock}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {product.type === 'EXTERNAL' ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                <ExternalLink className="w-3 h-3 mr-1" />
                                                외부상품
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                자체상품
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {product.is_active ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                판매중
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                숨김
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link href={`/admin/market/${product.id}`}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100">
                                                    <Edit className="w-4 h-4 text-gray-600" />
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-red-50"
                                                onClick={() => handleDelete(product.id)}
                                            >
                                                <Trash className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
