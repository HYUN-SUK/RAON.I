"use client";

export default function MyTimeline() {
    const activities = [
        { id: 1, type: "후기", title: "가을 캠핑의 추억", date: "2시간 전", image: true },
        { id: 2, type: "활동", title: "불멍 30분 달성!", date: "어제", image: false },
        { id: 3, type: "예약", title: "철수네 캠핑장 예약 완료", date: "3일 전", image: false },
    ];

    return (
        <div className="px-6 pb-6">
            <h3 className="text-lg font-bold text-text-1 mb-4">최근 활동</h3>
            <div className="flex flex-col gap-4">
                {activities.map((item) => (
                    <button
                        key={item.id}
                        className="w-full text-left flex gap-4 items-start bg-white p-4 rounded-2xl shadow-soft border border-surface-2 hover:bg-surface-1 active:scale-95 transition-all duration-200"
                    >
                        <div className="w-12 h-12 rounded-xl bg-surface-2 flex-shrink-0 flex items-center justify-center text-xs text-text-2 font-medium">
                            {item.image ? "IMG" : item.type}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-text-1">{item.title}</p>
                            <p className="text-xs text-text-2 mt-1">{item.date}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
