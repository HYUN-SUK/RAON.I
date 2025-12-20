'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { marketService } from '@/services/marketService';
import { Product } from '@/types/market';
import { useCartStore } from '@/store/useCartStore';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"; // Use Shadcn Sheet
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShoppingCart, Share2, Plus, Minus, ChevronRight, Heart } from 'lucide-react';
import Image from 'next/image';
import { ReviewList } from '@/components/market/ReviewList';

export default function ProductDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [isHeaderTransparent, setIsHeaderTransparent] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // Store
    const addToCart = useCartStore(state => state.addToCart);

    // Scroll Effect for Header
    useEffect(() => {
        const handleScroll = () => {
            setIsHeaderTransparent(window.scrollY < 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const load = async () => {
            if (!id) return;
            try {
                const data = await marketService.getProductById(id);
                setProduct(data);
            } catch (e: any) {
                console.error('Fetch Error:', e);
                alert(`상품을 불러오지 못했습니다: ${e.message}`);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handleAddToCart = async () => {
        if (!product) return;
        try {
            await addToCart(product.id, quantity);
            setIsSheetOpen(false); // Close sheet
            if (confirm('장바구니에 담았습니다. 바로 확인하시겠습니까?')) {
                router.push('/market/cart');
            }
        } catch (e) {
            alert('로그인이 필요하거나 오류가 발생했습니다.');
        }
    };

    const handleBuyNow = async () => {
        if (!product) return;
        try {
            await addToCart(product.id, quantity);
            setIsSheetOpen(false);
            router.push('/market/checkout');
        } catch (e) {
            alert('로그인이 필요하거나 오류가 발생했습니다.');
        }
    };

    if (loading) return <div className="min-h-screen bg-white" />;
    if (!product) return <div>Product Not Found (ID: {id})</div>;

    const formattedPrice = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(product.price);

    return (
        <div className="min-h-screen bg-white pb-32">
            {/* 1. Immersive Header */}
            <header
                className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 transition-all duration-300 max-w-[430px] mx-auto ${isHeaderTransparent ? 'bg-transparent' : 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
                    }`}
            >
                <button onClick={() => router.back()} className={`p-2 rounded-full ${isHeaderTransparent ? 'bg-black/20 text-white backdrop-blur-sm' : 'text-gray-900'}`}>
                    <ArrowLeft className="w-5 h-5" />
                </button>

                {/* Scroll Title (Visible when scrolled) */}
                <h1 className={`flex-1 text-center font-bold text-sm truncate px-4 transition-opacity duration-300 ${isHeaderTransparent ? 'opacity-0' : 'opacity-100'}`}>
                    {product.name}
                </h1>

                <div className="flex gap-2">
                    <button className={`p-2 rounded-full ${isHeaderTransparent ? 'bg-black/20 text-white backdrop-blur-sm' : 'text-gray-900'}`}>
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => router.push('/market/cart')}
                        className={`p-2 rounded-full ${isHeaderTransparent ? 'bg-black/20 text-white backdrop-blur-sm' : 'text-gray-900'}`}
                    >
                        <ShoppingCart className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* 2. Hero Section (Image Slider) */}
            <div className="relative w-full aspect-square bg-gray-100">
                <div className="flex overflow-x-auto snap-x snap-mandatory w-full h-full scrollbar-hide">
                    {(product.images?.length ? product.images : ['']).map((src, idx) => (
                        <div key={idx} className="flex-shrink-0 w-full h-full snap-center relative">
                            {src ? (
                                <img src={src} alt={`${product.name} - ${idx}`} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                            )}
                        </div>
                    ))}
                </div>
                {/* Dot Indicator (Simulated) */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                    {product.images?.map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/50'}`} />
                    ))}
                </div>
            </div>

            {/* 3. Product Info */}
            <div className="px-5 py-6 bg-white space-y-4">
                <div className="flex items-center gap-2 text-sm text-[#1C4526] font-medium opacity-80">
                    <span>{product.category}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span>RAON Pick</span>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 leading-snug">{product.name}</h1>

                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-[#1C4526]">{formattedPrice}</span>
                    {/* Fake Discount for MVP aesthetics */}
                    <span className="text-sm text-gray-400 line-through">₩{product.price * 1.1}</span>
                    <span className="text-sm text-red-500 font-bold">10%</span>
                </div>

                {/* Benefits / Badges */}
                <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-normal">무료배송</Badge>
                    <Badge variant="secondary" className="bg-green-50 text-green-700 font-normal">내일 도착 보장</Badge>
                </div>
            </div>

            <div className="h-2 bg-gray-50" />

            {/* 4. Creator / Cross-sell Section (Placeholder) */}
            <div className="px-5 py-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-900">이 상품을 사용한 캠퍼들</h3>
                    <span className="text-xs text-gray-400">더보기</span>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex-shrink-0 w-24 h-32 bg-gray-200 rounded-lg overflow-hidden relative">
                            <div className="absolute bottom-2 left-2 text-[10px] text-white font-bold drop-shadow-md">User{i}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="h-2 bg-gray-50" />

            {/* 5. Sticky Tabs */}
            <div className="sticky top-14 z-40 bg-white border-b border-gray-100 flex text-sm font-medium text-gray-500">
                <a href="#info" className="flex-1 py-3 text-center border-b-2 border-[#1C4526] text-[#1C4526]">상품설명</a>
                <a href="#specs" className="flex-1 py-3 text-center border-b-2 border-transparent">상세정보</a>
                <a href="#reviews" className="flex-1 py-3 text-center border-b-2 border-transparent">후기(0)</a>
                <a href="#qna" className="flex-1 py-3 text-center border-b-2 border-transparent">문의</a>
            </div>

            {/* Tab Contents */}
            <div className="min-h-[500px]">
                <section id="info" className="p-5 py-10 scroll-mt-28">
                    <h3 className="font-bold text-lg mb-4">상품 설명</h3>
                    <p className="whitespace-pre-wrap text-gray-600 leading-7">{product.description}</p>
                    <div className="mt-8 bg-gray-100 rounded-xl aspect-[4/5] flex items-center justify-center text-gray-400">
                        상세 이미지 영역
                    </div>
                </section>

                <div className="h-2 bg-gray-50" />

                <section id="specs" className="p-5 py-10 scroll-mt-28">
                    <h3 className="font-bold text-lg mb-4">제품 상세 정보</h3>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className="border-b">
                                <th className="py-3 text-left w-24 text-gray-500 font-normal">제품명</th>
                                <td className="py-3 text-gray-900">{product.name}</td>
                            </tr>
                            <tr className="border-b">
                                <th className="py-3 text-left text-gray-500 font-normal">카테고리</th>
                                <td className="py-3 text-gray-900">{product.category}</td>
                            </tr>
                            <tr className="border-b">
                                <th className="py-3 text-left text-gray-500 font-normal">재고</th>
                                <td className="py-3 text-gray-900">{product.stock}개</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <div className="h-2 bg-gray-50" />

                <section id="reviews" className="p-5 py-10 scroll-mt-28">
                    <ReviewList productId={product.id} />
                </section>

                <div className="h-2 bg-gray-50" />

                <section id="qna" className="p-5 py-10 scroll-mt-28">
                    <h3 className="font-bold text-lg mb-4">상품 문의</h3>
                    <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500 text-sm">
                        궁금한 점이 있으신가요?<br />문의하기 버튼을 눌러주세요.
                    </div>
                </section>
            </div>

            {/* 6. Bottom Action Bar */}
            <div className="fixed bottom-[80px] left-0 right-0 max-w-[430px] mx-auto p-4 bg-white border-t border-gray-100 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 flex gap-3 items-center">
                <button className="flex flex-col items-center justify-center gap-1 min-w-[50px] text-gray-400">
                    <Heart className="w-6 h-6" />
                    <span className="text-[10px]">62</span>
                </button>

                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button className="flex-1 bg-[#1C4526] hover:bg-[#16331F] text-white rounded-xl h-12 text-base font-bold">
                            구매하기
                        </Button>
                    </SheetTrigger>

                    {/* Bottom Sheet Content */}
                    <SheetContent side="bottom" className="max-w-[430px] mx-auto rounded-t-3xl">
                        <SheetHeader className="text-left mb-6">
                            <SheetTitle>옵션 선택</SheetTitle>
                            <SheetDescription>{product.name}</SheetDescription>
                        </SheetHeader>

                        <div className="space-y-6">
                            {/* Quantity */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <span className="font-medium text-gray-700">수량</span>
                                <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm">
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 hover:bg-gray-50"><Minus className="w-4 h-4" /></button>
                                    <span className="font-medium w-8 text-center">{quantity}</span>
                                    <button onClick={() => setQuantity(quantity + 1)} className="p-2 hover:bg-gray-50"><Plus className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {/* Total Price */}
                            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                <span className="text-gray-500 font-medium">총 상품 금액</span>
                                <span className="text-xl font-bold text-[#1C4526]">
                                    {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(product.price * quantity)}
                                </span>
                            </div>

                            {/* Real Action */}
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1 h-12 rounded-xl border-[#1C4526] text-[#1C4526] font-bold" onClick={handleAddToCart}>
                                    장바구니
                                </Button>
                                <Button className="flex-1 h-12 bg-[#1C4526] hover:bg-[#16331F] text-white rounded-xl font-bold" onClick={handleBuyNow}>
                                    바로구매
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
