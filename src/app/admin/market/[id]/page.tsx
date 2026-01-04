'use client';

import ProductForm from '../components/ProductForm';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { marketService } from '@/services/marketService';
import { Product } from '@/types/market';

export default function EditProductPage() {
    const params = useParams();
    const id = params.id as string;
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            marketService.getProductById(id).then(data => {
                setProduct(data);
                setLoading(false);
            }).catch(err => {
                console.error(err);
                alert('상품을 불러올 수 없습니다.');
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-gray-400" />
            </div>
        );
    }

    if (!product) return <div>상품을 찾을 수 없습니다.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/market">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <h2 className="text-2xl font-bold text-gray-800">상품 수정</h2>
            </div>

            <ProductForm initialData={product} isEdit />
        </div>
    );
}
