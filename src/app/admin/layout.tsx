"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Home, Calendar, CreditCard, Settings, Users, ShoppingBag, Bell, Shield, LogOut, Star, Wrench, Tent, Send, Activity, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const supabase = createClient();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        document.body.classList.add('admin-body');
        return () => {
            document.body.classList.remove('admin-body');
        };
    }, []);

    const handleSignOut = async () => {
        try {
            setIsOpen(false);
            await supabase.auth.signOut();
        } catch (e) {
            console.error('[AdminLayout] SignOut error:', e);
        } finally {
            window.location.href = '/admin/login';
        }
    };

    const handleLinkClick = () => {
        setIsOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row relative">
            {/* Mobile Header Bar */}
            <div className="bg-gray-900 text-white p-4 flex justify-between items-center md:hidden border-b border-gray-800 z-50 sticky top-0">
                <h1 className="text-lg font-bold">RAON Admin</h1>
                <button 
                    onClick={() => setIsOpen(!isOpen)} 
                    className="text-gray-300 hover:text-white focus:outline-none p-1 rounded hover:bg-gray-800 transition-colors"
                    aria-label="Toggle Menu"
                >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar Panel */}
            <aside className={`bg-gray-900 text-white w-full md:w-64 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out z-40
                ${isOpen ? 'block fixed inset-y-0 left-0 top-[57px] md:top-0 md:relative' : 'hidden md:flex'}`}>
                
                {/* Desktop Logo (hidden on mobile, since we have sticky header) */}
                <div className="p-4 border-b border-gray-800 hidden md:flex items-center justify-between">
                    <h1 className="text-xl font-bold">RAON Admin</h1>
                    <Link href="/" className="text-xs text-gray-400 hover:text-white">Exit</Link>
                </div>

                <nav className="p-2 space-y-1 overflow-y-auto md:overflow-visible flex-1 max-h-[calc(100vh-120px)] md:max-h-none scrollbar-hide">
                    <NavLink href="/admin" icon={<Home size={18} />} label="대시보드" onClick={handleLinkClick} />
                    <NavLink href="/admin/operations" icon={<Shield size={18} />} label="시스템 운영" onClick={handleLinkClick} />
                    <NavLink href="/admin/sites" icon={<Tent size={18} />} label="사이트 관리" onClick={handleLinkClick} />
                    <NavLink href="/admin/reservations" icon={<Calendar size={18} />} label="예약 관리" onClick={handleLinkClick} />
                    <NavLink href="/admin/payments" icon={<CreditCard size={18} />} label="입금 확인" onClick={handleLinkClick} />
                    <NavLink href="/admin/rate" icon={<Settings size={18} />} label="가격/시즌" onClick={handleLinkClick} />
                    <NavLink href="/admin/block" icon={<Shield size={18} />} label="통합 예약칼렌더" onClick={handleLinkClick} />
                    <NavLink href="/admin/mission" icon={<Users size={18} />} label="미션" onClick={handleLinkClick} />
                    <NavLink href="/admin/community" icon={<Users size={18} />} label="커뮤니티" onClick={handleLinkClick} />
                    <NavLink href="/admin/groups" icon={<Users size={18} />} label="소모임" onClick={handleLinkClick} />
                    <NavLink href="/admin/market" icon={<ShoppingBag size={18} />} label="마켓" onClick={handleLinkClick} />
                    <NavLink href="/admin/notice" icon={<Bell size={18} />} label="공지" onClick={handleLinkClick} />
                    <NavLink href="/admin/push" icon={<Send size={18} />} label="알림 발송" onClick={handleLinkClick} />
                    <NavLink href="/admin/automation/logs" icon={<Activity size={18} />} label="자동화 현황" onClick={handleLinkClick} />
                    <NavLink href="/admin/recommendations" icon={<Star size={18} />} label="추천/행사" onClick={handleLinkClick} />
                    <NavLink href="/admin/settings" icon={<Wrench size={18} />} label="기본정보" onClick={handleLinkClick} />
                </nav>
                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center space-x-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 w-full rounded-md transition-colors"
                    >
                        <LogOut size={18} />
                        <span>로그아웃</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-full min-w-0">
                {children}
            </main>
        </div>
    );
}

function NavLink({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="flex items-center space-x-2 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors w-full"
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}
