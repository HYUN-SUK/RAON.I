'use client';

import { useState } from 'react';
import { Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { motion, AnimatePresence } from 'framer-motion';

interface EmberButtonProps {
    receiverId: string;
    targetId: string;
    targetType?: 'mission' | 'post' | 'comment';
    receiverName?: string;
    disabled?: boolean;
    size?: 'sm' | 'icon';
    showLabel?: boolean;
    onSuccess?: () => void;
}

const EMBER_COST = 10;

export function EmberButton({
    receiverId,
    targetId,
    targetType = 'mission',
    receiverName = '이 캠퍼',
    disabled = false,
    size = 'sm',
    showLabel = true,
    onSuccess
}: EmberButtonProps) {
    const supabase = createClient();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showAnimation, setShowAnimation] = useState(false);

    const handleSendEmber = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('send_ember', {
                p_receiver_id: receiverId,
                p_target_id: targetId,
                p_target_type: targetType,
                p_message: null
            });

            if (error) throw error;

            if (data?.success) {
                setIsOpen(false);
                setShowAnimation(true);

                toast.success(`🔥 ${receiverName}님에게 불씨를 남겼습니다!`, {
                    description: `${EMBER_COST} 토큰이 사용되었습니다.`
                });

                // 애니메이션 종료 후 콜백
                setTimeout(() => {
                    setShowAnimation(false);
                    onSuccess?.();
                }, 2000);
            } else {
                toast.error(data?.error || '불씨 전송에 실패했습니다.');
            }
        } catch (error) {
            console.error('Ember send error:', error);
            toast.error('불씨 전송 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size={size}
                className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 gap-1"
                onClick={() => setIsOpen(true)}
                disabled={disabled || isLoading}
            >
                <Flame className="w-4 h-4" />
                {showLabel && <span className="text-xs">불씨</span>}
            </Button>

            {/* Confirmation Dialog */}
            <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Flame className="w-5 h-5 text-orange-500" />
                            불씨 남기기
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                <strong>{receiverName}</strong>님에게 따뜻한 불씨를 남길까요?
                            </p>
                            <p className="text-orange-600 font-medium">
                                🔥 {EMBER_COST} 토큰이 사용됩니다.
                            </p>
                            <p className="text-xs text-gray-500">
                                불씨는 순위에 반영되지 않으며, 조용한 응원의 표시입니다.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSendEmber}
                            disabled={isLoading}
                            className="bg-orange-500 hover:bg-orange-600"
                        >
                            {isLoading ? '전송 중...' : `불씨 남기기 (${EMBER_COST} 토큰)`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Fire Animation */}
            <AnimatePresence>
                {showAnimation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
                    >
                        {/* Multiple fire emojis floating up */}
                        {[...Array(8)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{
                                    y: 100,
                                    x: (Math.random() - 0.5) * 200,
                                    opacity: 0,
                                    scale: 0.5
                                }}
                                animate={{
                                    y: -300,
                                    opacity: [0, 1, 1, 0],
                                    scale: [0.5, 1.5, 1.2, 0.8]
                                }}
                                transition={{
                                    duration: 2,
                                    delay: i * 0.1,
                                    ease: "easeOut"
                                }}
                                className="absolute text-4xl"
                            >
                                🔥
                            </motion.div>
                        ))}

                        {/* Center message */}
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ delay: 0.3, type: "spring" }}
                            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-full text-lg font-bold shadow-lg"
                        >
                            🔥 따뜻한 불씨를 남겼습니다!
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
