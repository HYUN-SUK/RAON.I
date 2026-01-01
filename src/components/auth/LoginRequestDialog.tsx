"use client";

import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthModalStore } from "@/store/useAuthModalStore";

export default function LoginRequestDialog() {
    const { isOpen, close } = useAuthModalStore();
    const router = useRouter();

    const handleLogin = () => {
        close();
        router.push('/login');
    };

    return (
        <Dialog open={isOpen} onOpenChange={close}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="space-y-3">
                    <DialogTitle className="text-xl font-bold text-center mt-2">
                        로그인이 필요한 서비스입니다 🔒
                    </DialogTitle>
                    <DialogDescription className="text-center text-base text-stone-600">
                        로그인을 하셔야 서비스 이용이 가능합니다.<br />
                        라온아이의 모든 혜택을 누리세요!
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 sm:justify-center">
                    <Button
                        onClick={handleLogin}
                        className="w-full h-12 text-lg font-semibold bg-[#1C4526] hover:bg-[#224732]"
                    >
                        로그인 하러 가기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
