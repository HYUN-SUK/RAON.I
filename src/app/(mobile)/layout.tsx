import BottomNav from "@/components/BottomNav";

export default function MobileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="w-full max-w-[430px] bg-surface-1 min-h-screen relative shadow-2xl flex flex-col mx-auto">
            <main className="flex-1 pb-[80px]">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}
