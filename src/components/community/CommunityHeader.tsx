'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function CommunityHeader() {
    return (
        <header className="pt-6 pb-2 px-5 bg-[#F7F5EF]">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex justify-between items-center"
            >
                <div>
                    <h1 className="text-2xl font-bold text-[#1C4526] mb-1">
                        캠퍼들의 이야기
                    </h1>
                    <p className="text-sm text-[#4D4D4D] font-light">
                        함께 나누는 따뜻한 캠핑의 기억 ⛺
                    </p>
                </div>

                <Link href="/community/write">
                    <Button
                        size="icon"
                        className="bg-[#1C4526] hover:bg-[#1C4526]/90 text-white rounded-full w-10 h-10 shadow-md"
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                </Link>
            </motion.div>
        </header>
    );
}
