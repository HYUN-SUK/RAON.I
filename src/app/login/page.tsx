"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleLogin = async () => {
        setLoading(true);
        setMessage("");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setMessage("로그인 실패: " + error.message);
        } else {
            setMessage("로그인 성공! 이동중...");
            router.push("/"); // Go to home
            router.refresh();
        }
        setLoading(false);
    };

    const handleSignUp = async () => {
        setLoading(true);
        setMessage("");
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: 'Tester'
                }
            }
        });
        if (error) {
            setMessage("가입 실패: " + error.message);
        } else {
            if (data.session) {
                setMessage("가입 & 로그인 성공!");
                router.push("/");
                router.refresh();
            } else {
                setMessage("가입 확인 메일을 전송했습니다. 이메일을 확인해주세요. (로컬 개발 환경이면 Inbucket 확인)");
            }
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4">
                <h1 className="text-2xl font-bold text-center text-gray-800">테스트 계정 로그인/가입</h1>
                <p className="text-center text-gray-500 text-sm">구독 기능 테스트를 위해 새로운 계정으로 로그인하세요.</p>

                <div className="space-y-2">
                    <label className="text-sm font-medium">이메일</label>
                    <input
                        className="w-full border p-2 rounded"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="test@example.com"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">비밀번호</label>
                    <input
                        className="w-full border p-2 rounded"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="6자 이상"
                    />
                </div>

                {message && <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded">{message}</div>}

                <div className="flex gap-2 pt-2">
                    <button
                        className="flex-1 bg-gray-800 text-white py-2 rounded hover:bg-gray-900 disabled:opacity-50"
                        onClick={handleLogin}
                        disabled={loading}
                    >
                        로그인
                    </button>
                    <button
                        className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
                        onClick={handleSignUp}
                        disabled={loading}
                    >
                        회원가입
                    </button>
                </div>

                <div className="text-xs text-gray-400 text-center mt-4">
                    * 회원가입 버튼을 누르면 즉시 가입 처리됩니다. <br />
                    (로컬 Supabase 설정에 따라 이메일 인증이 필요할 수 있습니다)
                </div>
            </div>
        </div>
    );
}
