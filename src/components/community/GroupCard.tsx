'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users } from 'lucide-react';

interface GroupProps {
    group: {
        id: string;
        name: string;
        description?: string;
        image_url?: string;
        member_count?: number;
    }
}

export default function GroupCard({ group }: GroupProps) {
    return (
        <Link href={`/community/groups/${group.id}`}>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E5E5] flex flex-col h-full active:scale-[0.98] transition-transform duration-200">
                {/* Image */}
                <div className="relative h-32 w-full bg-gray-100">
                    {group.image_url ? (
                        <Image
                            src={group.image_url}
                            alt={group.name}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Users className="w-8 h-8" />
                        </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                        <Users className="w-3 h-3" />
                        <span>{group.member_count || 1}명</span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-[17px] font-bold text-[#1C4526] mb-1 line-clamp-1">
                        {group.name}
                    </h3>
                    <p className="text-sm text-[#666] line-clamp-2 mt-1">
                        {group.description || '새로운 소모임입니다.'}
                    </p>
                </div>
            </div>
        </Link>
    );
}
