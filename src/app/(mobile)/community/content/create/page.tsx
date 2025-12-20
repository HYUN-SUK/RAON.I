"use client";

import { ContentWriteForm } from '@/components/community/content/ContentWriteForm';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { creatorService } from '@/services/creatorService';
import { CreatorIdentityModal } from '@/components/creator/CreatorIdentityModal';

export default function CreatorContentCreatePage() {
    const router = useRouter();
    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [initialNickname, setInitialNickname] = useState<string | null>(null);
    const [initialImage, setInitialImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkIdentity();
    }, []);

    const checkIdentity = async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }
            setCurrentUserId(user.id);

            const profile = await creatorService.getCreatorProfile(user.id);

            // If no profile or no nickname, show modal
            if (!profile || !profile.nickname) {
                setInitialNickname(profile?.nickname || null);
                // @ts-ignore - profile_image_url might be missing in older cached types if not fully reloaded, but should be fine
                setInitialImage(profile?.profile_image_url || null);
                setShowIdentityModal(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C4526]"></div>
        </div>;
    }

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

            {currentUserId && (
                <CreatorIdentityModal
                    isOpen={showIdentityModal}
                    onClose={() => router.back()} // Go back if they refuse to set identity
                    onComplete={() => setShowIdentityModal(false)}
                    currentUserId={currentUserId}
                    initialNickname={initialNickname}
                    initialImage={initialImage}
                />
            )}
        </div>
    );
}
