'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { marketService } from '@/services/marketService';
import { Product, CreateProductDTO } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Upload, Loader2, Link as LinkIcon } from 'lucide-react';
import Image from 'next/image';

interface ProductFormProps {
    initialData?: Product;
    isEdit?: boolean;
}

const CATEGORIES = [
    { id: 'lantern', label: '조명/랜턴' },
    { id: 'tableware', label: '식기/키친' },
    { id: 'furniture', label: '가구/체어' },
    { id: 'goods', label: '굿즈' },
];

export default function ProductForm({ initialData, isEdit = false }: ProductFormProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState<CreateProductDTO>({
        name: '',
        price: 0,
        description: '',
        category: 'lantern',
        stock: 999,
        images: [],
        tags: [],
        is_active: true,
        type: 'INTERNAL',
        link: ''
    });

    const [imageUrlInput, setImageUrlInput] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                price: initialData.price,
                description: initialData.description || '',
                category: initialData.category,
                stock: initialData.stock,
                images: initialData.images || [],
                tags: initialData.tags || [],
                is_active: initialData.is_active,
                type: initialData.type || 'INTERNAL',
                link: initialData.link || ''
            });
        }
    }, [initialData]);

    const handleChange = (field: keyof CreateProductDTO, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddImage = () => {
        if (!imageUrlInput) return;
        setFormData(prev => ({ ...prev, images: [...prev.images, imageUrlInput] }));
        setImageUrlInput('');
    };

    const handleRemoveImage = (index: number) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (isEdit && initialData) {
                await marketService.updateProduct({
                    id: initialData.id,
                    ...formData
                });
            } else {
                await marketService.createProduct(formData);
            }
            router.push('/admin/market');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl bg-white p-6 rounded-lg border shadow-sm">
            <div className="grid grid-cols-2 gap-6">
                {/* Type Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">상품 유형</label>
                    <Select
                        value={formData.type}
                        onValueChange={(val: 'INTERNAL' | 'EXTERNAL') => handleChange('type', val)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="INTERNAL">자체상품 (직접 판매)</SelectItem>
                            <SelectItem value="EXTERNAL">외부상품 (링크 연결)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">판매 상태</label>
                    <Select
                        value={formData.is_active ? 'active' : 'inactive'}
                        onValueChange={(val) => handleChange('is_active', val === 'active')}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">판매중</SelectItem>
                            <SelectItem value="inactive">숨김 (판매중지)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* External Link Input */}
            {formData.type === 'EXTERNAL' && (
                <div className="space-y-2 bg-purple-50 p-4 rounded-md border border-purple-100">
                    <label className="text-sm font-medium text-purple-900 flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        외부 구매 링크
                    </label>
                    <Input
                        placeholder="https://coupang.com/..."
                        value={formData.link || ''}
                        onChange={(e) => handleChange('link', e.target.value)}
                        required
                        className="bg-white"
                    />
                    <p className="text-xs text-purple-600">사용자가 '구매하기' 버튼 클릭 시 이 링크로 이동합니다.</p>
                </div>
            )}

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">상품명</label>
                <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    placeholder="상품명을 입력하세요"
                />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">카테고리</label>
                    <Select
                        value={formData.category}
                        onValueChange={(val) => handleChange('category', val)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">가격</label>
                    <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleChange('price', parseInt(e.target.value) || 0)}
                        required
                        min={0}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">재고 수량</label>
                <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => handleChange('stock', parseInt(e.target.value) || 0)}
                    required
                    min={0}
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">상품 설명</label>
                <Textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="상품 상세 설명을 입력하세요"
                    className="h-32"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">이미지 (URL)</label>
                <div className="flex gap-2">
                    <Input
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://..."
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImage())}
                    />
                    <Button type="button" onClick={handleAddImage} variant="outline">
                        추가
                    </Button>
                </div>

                {/* Image Preview List */}
                {formData.images.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                        {formData.images.map((img, idx) => (
                            <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden group border">
                                <Image src={img} alt={`Preview ${idx}`} fill className="object-cover" />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage(idx)}
                                    className="absolute top-0 right-0 bg-black/50 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-4 gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                    취소
                </Button>
                <Button type="submit" disabled={submitting} className="bg-[#1C4526] hover:bg-[#15341d]">
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isEdit ? '수정 완료' : '상품 등록'}
                </Button>
            </div>
        </form>
    );
}
