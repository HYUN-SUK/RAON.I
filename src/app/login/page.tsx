"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import { Loader2, Mail, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [emailMode, setEmailMode] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`
                    }
                });
                if (error) throw error;
                toast.success("가입 확인 메일을 발송했습니다.", { duration: 4000 });
                setIsSignUp(false); // Switch to login mode
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                toast.success("로그인 성공", { description: "라온아이에 오신 것을 환영합니다." });
                router.push("/");
                router.refresh();
            }
        } catch (error: any) {
            toast.error(isSignUp ? "가입 실패" : "로그인 실패", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="https://images.unsplash.com/photo-1516939884455-1445c8652f83?q=80&w=2000&auto=format&fit=crop"
                    alt="Forest Background"
                    fill
                    className="object-cover brightness-[0.4]"
                    priority
                />
            </div>

            {/* Content Card */}
            <div className="relative z-10 w-full max-w-sm bg-white/10 backdrop-blur-md border border-white/20 p-6 sm:p-8 rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-500 mx-4 sm:mx-0">
                {/* Logo & Header */}
                <div className="text-center mb-6 sm:mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">RAON.I</h1>
                    <p className="text-white/70 text-sm font-medium">
                        즐거운 나를 찾는 숲 속의 여정
                    </p>
                </div>

                {!emailMode ? (
                    <div className="space-y-4 sm:space-y-6">
                        <SocialLoginButtons />

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/20" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-transparent px-2 text-white/50">또는</span>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            className="w-full text-white/90 hover:text-white hover:bg-white/10 h-12 sm:h-10"
                            onClick={() => setEmailMode(true)}
                        >
                            <Mail className="w-4 h-4 mr-2" />
                            이메일로 계속하기
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div className="space-y-4">
                            <Input
                                type="email"
                                placeholder="이메일 주소"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 sm:h-11 focus:bg-white/20 transition-all text-base"
                                required
                            />
                            <Input
                                type="password"
                                placeholder="비밀번호"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 sm:h-11 focus:bg-white/20 transition-all text-base"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-[#1C4526] hover:bg-[#224732] text-white h-12 sm:h-11 mt-2 text-base font-medium"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? "회원가입" : "로그인")}
                        </Button>

                        <div className="flex flex-col gap-3 mt-6 sm:mt-4">
                            <button
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="text-xs sm:text-sm text-white/80 hover:text-white transition-colors py-1"
                            >
                                {isSignUp ? "이미 계정이 있으신가요? 로그인하기" : "계정이 없으신가요? 이메일로 가입하기"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setEmailMode(false)}
                                className="w-full text-center text-xs text-white/60 hover:text-white flex items-center justify-center gap-1 transition-colors py-1"
                            >
                                <ArrowRight className="w-3 h-3 rotate-180" /> 이전으로 돌아가기
                            </button>
                        </div>
                    </form>
                )}

                {/* Footer */}
                <div className="mt-8 text-center px-2">
                    <p className="text-[10px] text-white/40 leading-relaxed">
                        계속 진행하면 라온아이의 <span className="underline cursor-pointer hover:text-white/60">이용약관</span> 및 <span className="underline cursor-pointer hover:text-white/60">개인정보처리방침</span>에 동의하게 됩니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
