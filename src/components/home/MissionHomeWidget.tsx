import React, { useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useMissionStore } from '@/store/useMissionStore';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function MissionHomeWidget() {
    const router = useRouter();
    const { currentMission, userMission, fetchCurrentMission } = useMissionStore();
    const { withAuth } = useRequireAuth();

    useEffect(() => {
        fetchCurrentMission();
    }, [fetchCurrentMission]);

    if (!currentMission) {
        // Fallback or Empty State (Hidden if no mission)
        return null;
    }

    const isCompleted = userMission?.status === 'COMPLETED' || userMission?.status === 'CLAIMED';

    return (
        <Card className="w-full bg-gradient-to-br from-[#1C4526] to-[#0d2112] border-none shadow-lg rounded-2xl p-5 mb-4 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10" />

            <div className="flex justify-between items-start relative z-10">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-white/10 text-white border-white/20 px-2 py-0.5 text-[10px]">
                            WEEKLY MISSION
                        </Badge>
                        {isCompleted && (
                            <Badge className="bg-[#C3A675] text-black hover:bg-[#C3A675] px-2 py-0.5 text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3" /> 완료
                            </Badge>
                        )}
                    </div>
                    <h3 className="text-lg font-bold mb-1">{currentMission.title}</h3>
                    <p className="text-white/70 text-xs mb-3 line-clamp-1">{currentMission.description}</p>

                    <div className="flex gap-2">
                        <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-none text-[10px]">
                            XP {currentMission.reward_xp}
                        </Badge>
                        <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-none text-[10px]">
                            Raon Token {currentMission.reward_point}
                        </Badge>
                    </div>
                </div>

                <div className="bg-white/10 p-3 rounded-full">
                    <Flag className="w-6 h-6 text-[#C3A675]" />
                </div>
            </div>

            <Button
                variant="ghost"
                className={`w-full mt-4 text-xs h-9 justify-between px-3 transition-colors ${isCompleted
                    ? 'bg-white/10 text-white/50 hover:bg-white/20'
                    : userMission
                        ? 'bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 ring-1 ring-blue-400/30'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                onClick={() => withAuth(() => router.push(`/mission/${currentMission.id}`))}
            >
                <span className="font-semibold">
                    {isCompleted
                        ? '참여 완료'
                        : userMission
                            ? '미션 인증하기'
                            : '미션 참여하기'}
                </span>
                <ChevronRight className={`w-4 h-4 ml-1 ${userMission && !isCompleted ? 'text-blue-200' : 'opacity-70'}`} />
            </Button>
        </Card>
    );
}
