import BottomNav from "@/components/BottomNav";
import NavReturnPromptModal from "@/components/moat/NavReturnPromptModal";
import VerificationPromptModal from "@/components/moat/VerificationPromptModal";
import NotificationPromptModal from "@/components/notification/NotificationPromptModal";

export default function MobileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="w-full max-w-[430px] bg-surface-1 min-h-screen relative shadow-2xl flex flex-col mx-auto">
            <main className="flex-1 pb-[calc(84px+var(--sab,20px))]">
                {children}
            </main>
            <BottomNav />
            <NavReturnPromptModal />
            <VerificationPromptModal />
            <NotificationPromptModal />
        </div>
    );
}


