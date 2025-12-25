import React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export interface HomeDetailData {
    title: string;
    description: string;
    icon: React.ReactNode;
    actionLabel?: string;
    actionLink?: string;
    bgColorClass?: string; // Optional branding color
    buttons?: {
        label: string;
        onClick: () => void;
        variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
        icon?: React.ReactNode;
    }[];
}

interface HomeDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    data: HomeDetailData | null;
}

export default function HomeDetailSheet({ isOpen, onClose, data }: HomeDetailSheetProps) {
    const router = useRouter();

    if (!data) return null;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-[32px] pt-10 pb-10 px-6 border-none min-h-[40vh]">
                <div className="flex flex-col items-center text-center">
                    {/* Icon Circle */}
                    <div className={`
                        w-20 h-20 rounded-full flex items-center justify-center text-5xl mb-6 shadow-sm
                        ${data.bgColorClass || 'bg-stone-100 dark:bg-zinc-800'}
                    `}>
                        {data.icon}
                    </div>

                    <SheetHeader className="mb-6 space-y-4">
                        <SheetTitle className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                            {data.title}
                        </SheetTitle>
                        <SheetDescription className="text-base text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-wrap">
                            {data.description}
                        </SheetDescription>
                    </SheetHeader>

                    {/* Action Buttons */}
                    <div className="w-full space-y-3 mt-4">
                        {/* Primary Action (Legacy Support) */}
                        {data.actionLabel && !data.buttons && (
                            <Button
                                className="w-full h-14 text-lg rounded-2xl bg-[#1C4526] hover:bg-[#14331C] text-white"
                                onClick={() => {
                                    if (data.actionLink) {
                                        if (data.actionLink.startsWith('http') || data.actionLink.startsWith('tel:') || data.actionLink.startsWith('sms:')) {
                                            window.location.href = data.actionLink;
                                        } else {
                                            router.push(data.actionLink);
                                        }
                                        onClose();
                                    }
                                }}
                            >
                                {data.actionLabel}
                                <ArrowRight className="w-5 h-5 ml-2 opacity-80" />
                            </Button>
                        )}

                        {/* Multiple Buttons */}
                        {data.buttons?.map((btn, idx) => (
                            <Button
                                key={idx}
                                variant={btn.variant || 'default'}
                                className={`w-full h-14 text-lg rounded-2xl ${(!btn.variant || btn.variant === 'default')
                                    ? 'bg-[#1C4526] hover:bg-[#14331C] text-white'
                                    : 'border-stone-200 dark:border-zinc-700'
                                    }`}
                                onClick={() => {
                                    btn.onClick();
                                    onClose();
                                }}
                            >
                                {btn.icon && <span className="mr-2">{btn.icon}</span>}
                                {btn.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
