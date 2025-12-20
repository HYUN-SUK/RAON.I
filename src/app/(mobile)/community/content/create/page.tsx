"use client";

import { ContentWriteForm } from '@/components/community/content/ContentWriteForm';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function CreatorContentCreatePage() {
    const router = useRouter();

    return (
        <div className="pb-24 bg-[#F7F5EF] min-h-screen">
            {/* Simple Header for this sub-page */}
            <header className="sticky top-0 z-50 bg-[#F7F5EF]/80 backdrop-blur-md border-b border-[#ECE8DF] px-4 h-14 flex items-center">
                <button onClick={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft className="w-6 h-6 text-[#1C4526]" />
                </button>
                <h1 className="text-lg font-bold text-[#1C4526] ml-2">콘텐츠 발행</h1>
            </header>

            <main className="px-4 py-6">
                <ContentWriteForm />
            </main>
        </div>
    );
}
