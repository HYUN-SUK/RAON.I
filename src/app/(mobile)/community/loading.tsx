export default function CommunityLoading() {
    return (
        <div className="min-h-screen bg-[#F7F5EF] pb-24 animate-pulse">
            {/* 1. Header 스켈레톤 */}
            <header className="px-5 py-4 bg-[#F7F5EF] border-b border-stone-200/50 flex items-center justify-between">
                <div className="w-28 h-6 bg-stone-300 dark:bg-stone-700 rounded-md" />
                <div className="w-8 h-8 bg-stone-300 dark:bg-stone-700 rounded-full" />
            </header>

            {/* 2. Hero 스켈레톤 */}
            <div className="px-5 py-6 bg-white dark:bg-zinc-900 border-b border-stone-200/40">
                <div className="w-48 h-7 bg-stone-200 dark:bg-stone-800 rounded-md mb-2" />
                <div className="w-32 h-4 bg-stone-100 dark:bg-stone-800/60 rounded-md" />
            </div>

            {/* 3. Tabs 스켈레톤 */}
            <div className="sticky top-[56px] z-40 bg-[#F7F5EF]/95 backdrop-blur-sm pt-3 pb-3 px-5">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
                    <div className="w-16 h-8 bg-stone-300 dark:bg-stone-700 rounded-full shrink-0" />
                    <div className="w-16 h-8 bg-stone-200 dark:bg-stone-800 rounded-full shrink-0" />
                    <div className="w-16 h-8 bg-stone-200 dark:bg-stone-800 rounded-full shrink-0" />
                    <div className="w-16 h-8 bg-stone-200 dark:bg-stone-800 rounded-full shrink-0" />
                    <div className="w-16 h-8 bg-stone-200 dark:bg-stone-800 rounded-full shrink-0" />
                    <div className="w-16 h-8 bg-stone-200 dark:bg-stone-800 rounded-full shrink-0" />
                </div>
            </div>

            {/* 4. 피드 스켈레톤 목록 */}
            <main className="px-5 mt-4 space-y-4">
                {[1, 2, 3].map((idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-stone-100 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-20 h-5 bg-stone-200 dark:bg-stone-800 rounded-md" />
                            <div className="w-12 h-4 bg-stone-100 dark:bg-stone-800/60 rounded" />
                        </div>
                        <div className="w-3/4 h-6 bg-stone-300 dark:bg-stone-700 rounded-md" />
                        <div className="w-full h-4 bg-stone-100 dark:bg-stone-800/60 rounded" />
                        <div className="w-1/2 h-4 bg-stone-100 dark:bg-stone-800/60 rounded" />
                        <div className="flex gap-4 pt-2">
                            <div className="w-10 h-4 bg-stone-100 dark:bg-stone-800/60 rounded" />
                            <div className="w-10 h-4 bg-stone-100 dark:bg-stone-800/60 rounded" />
                        </div>
                    </div>
                ))}
            </main>
        </div>
    );
}
