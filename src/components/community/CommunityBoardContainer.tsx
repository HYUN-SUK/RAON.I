'use client';

import React from 'react';
import { BoardType, useCommunityStore } from '@/store/useCommunityStore';
import PostCard from './PostCard';
import { motion, AnimatePresence } from 'framer-motion';

interface CommunityBoardContainerProps {
    activeTab: BoardType;
}

export default function CommunityBoardContainer({ activeTab }: CommunityBoardContainerProps) {
    const { getPostsByType } = useCommunityStore();
    const posts = getPostsByType(activeTab);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="pb-20"
            >
                {posts.length > 0 ? (
                    posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))
                ) : (
                    <div className="py-20 text-center text-[#999]">
                        <p>아직 게시글이 없습니다. 🍂</p>
                        <p className="text-sm mt-1">첫 번째 이야기를 남겨보세요.</p>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
