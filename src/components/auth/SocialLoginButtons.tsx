"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SocialLoginButtons() {
    const supabase = createClient();
    const [loading, setLoading] = useState<string | null>(null);

    const handleSocialLogin = async (provider: 'kakao' | 'google' | 'naver') => {
        setLoading(provider);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider as any,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
        } catch (error: any) {
            toast.error("로그인 실패", { description: error.message });
            setLoading(null);
        }
    };

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Kakao Login */}
            <Button
                variant="outline"
                className="w-full h-12 bg-[#FEE500] hover:bg-[#FDD835] text-[#3c1e1e] border-none font-semibold text-[15px] relative"
                onClick={() => handleSocialLogin('kakao')}
                disabled={!!loading}
            >
                {loading === 'kakao' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <svg className="w-5 h-5 absolute left-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3C5.925 3 1 6.925 1 11.775c0 2.925 1.775 5.525 4.525 7.125-.175.625-.65 2.375-.75 2.725-.1.35.125.35.25.225.85-.75 3.375-2.275 3.925-2.65.675.094 1.357.143 2.05.143 6.075 0 11-3.925 11-8.775C22 6.925 17.075 3 12 3z" />
                        </svg>
                        카카오로 3초만에 시작하기
                    </>
                )}
            </Button>



            {/* Google Login */}
            <Button
                variant="outline"
                className="w-full h-12 bg-white hover:bg-gray-50 text-stone-700 border border-stone-200 font-semibold text-[15px] relative"
                onClick={() => handleSocialLogin('google')}
                disabled={!!loading}
            >
                {loading === 'google' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <svg className="w-5 h-5 absolute left-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        구글로 계속하기
                    </>
                )}
            </Button>
        </div>
    );
}
