import React from 'react';
import { Moon, Sun, Flame, Star, Coffee } from 'lucide-react';
import { useMySpaceStore } from '@/store/useMySpaceStore';

export default function ActionWidgets() {
    const { isNightMode, isFireOn, isStarOn, toggleNightMode, toggleFire, toggleStar } = useMySpaceStore();

    const widgets = [
        {
            id: 'theme',
            icon: isNightMode ? Sun : Moon,
            label: isNightMode ? '아침' : '밤',
            action: toggleNightMode,
            isActive: isNightMode,
            color: 'bg-amber-100 text-amber-800',
        },
        {
            id: 'fire',
            icon: Flame,
            label: '불멍',
            action: toggleFire,
            isActive: isFireOn,
            color: isFireOn ? 'bg-orange-500 text-white' : 'bg-white/80 text-gray-700',
        },
        {
            id: 'star',
            icon: Star,
            label: '별보기',
            action: toggleStar,
            isActive: isStarOn,
            color: isStarOn ? 'bg-indigo-900 text-yellow-300' : 'bg-white/80 text-gray-700',
        },
        {
            id: 'coffee',
            icon: Coffee,
            label: '휴식',
            action: () => alert('따뜻한 커피 한 잔 어떠세요? (준비 중)'),
            isActive: false,
            color: 'bg-white/80 text-gray-700',
        },
    ];

    return (
        <div className="flex gap-4 justify-center items-center py-4">
            {widgets.map((widget) => (
                <button
                    key={widget.id}
                    onClick={widget.action}
                    className={`flex flex-col items-center gap-2 transition-all duration-300 ${widget.isActive ? 'scale-110' : 'hover:scale-105'
                        }`}
                >
                    <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm ${widget.color}`}
                    >
                        <widget.icon size={24} />
                    </div>
                    <span className={`text-xs font-medium ${isNightMode ? 'text-white/90' : 'text-gray-700'}`}>
                        {widget.label}
                    </span>
                </button>
            ))}
        </div>
    );
}
