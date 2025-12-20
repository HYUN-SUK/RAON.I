"use client";
import Link from 'next/link';
import { Home, Calendar, CreditCard, Settings, Users, ShoppingBag, Bell, Shield, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
            {/* Mobile/Desktop Sidebar/Navbar */}
            <aside className="bg-gray-900 text-white w-full md:w-64 flex-shrink-0 flex flex-col">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h1 className="text-xl font-bold">RAON Admin</h1>
                    <Link href="/" className="text-xs text-gray-400 hover:text-white">Exit</Link>
                </div>
                <nav className="p-2 space-y-1 overflow-x-auto md:overflow-visible flex md:block whitespace-nowrap md:whitespace-normal flex-1">
                    <NavLink href="/admin" icon={<Home size={18} />} label="대시보드" />
                    <NavLink href="/admin/reservations" icon={<Calendar size={18} />} label="예약 관리" />
                    <NavLink href="/admin/payments" icon={<CreditCard size={18} />} label="입금 확인" />
                    <NavLink href="/admin/rate" icon={<Settings size={18} />} label="가격/시즌" />
                    <NavLink href="/admin/block" icon={<Shield size={18} />} label="차단일" />
                    <NavLink href="/admin/mission" icon={<Users size={18} />} label="미션" />
                    <NavLink href="/admin/community" icon={<Users size={18} />} label="커뮤니티" />
                    <NavLink href="/admin/groups" icon={<Users size={18} />} label="소모임" />
                    <NavLink href="/admin/market" icon={<ShoppingBag size={18} />} label="마켓" />
                    <NavLink href="/admin/notice" icon={<Bell size={18} />} label="공지" />
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
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center space-x-2 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}
