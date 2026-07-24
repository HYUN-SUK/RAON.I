'use client';

import { useState, useEffect } from 'react';
import { getBounceLogs, clearBounceLogs, BounceLog } from '@/lib/diagnosticSensor';
import { AlertTriangle, Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 🚨 [임시 진단 센서 UI v2] 튕김 디버그 리포트 배너
 * localStorage 및 스토리지 변경 이벤트를 실시간 포획하여 하드 새로고침 후에도 100% 팝업 노출.
 */
export default function BounceDebugBanner() {
    const [logs, setLogs] = useState<BounceLog[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);

    const refreshLogs = () => {
        const list = getBounceLogs();
        setLogs(list);
    };

    useEffect(() => {
        refreshLogs();
        const timer = setInterval(refreshLogs, 1000); // 1초 간격 런타임 갱신
        window.addEventListener('pageshow', refreshLogs);
        window.addEventListener('storage', refreshLogs);
        return () => {
            clearInterval(timer);
            window.removeEventListener('pageshow', refreshLogs);
            window.removeEventListener('storage', refreshLogs);
        };
    }, []);

    if (logs.length === 0) return null;

    const latest = logs[0];

    const copyLogText = () => {
        const text = logs.map((l, idx) => 
            `[Log #${idx + 1} - ${l.timestamp}]\n` +
            `- 원인 위치: ${l.source}\n` +
            `- 원인 설명: ${l.reason}\n` +
            `- 출발 주소: ${l.fromUrl}\n` +
            `- 도착 주소: ${l.toUrl}\n` +
            `- 세션 유무: ${l.sessionExists ? 'YES' : 'NO (null)'}\n` +
            `- 유저 이메일: ${l.userEmail || '없음'}\n` +
            `- Call Stack:\n${l.stackTrace}\n`
        ).join('\n----------------------------------------\n');

        navigator.clipboard.writeText(text);
        toast.success('진단 리포트가 클립보드에 복사되었습니다! 개발자에게 전달해 주세요.');
    };

    const handleClear = () => {
        clearBounceLogs();
        setLogs([]);
        toast.info('진단 로그가 삭제되었습니다');
    };

    return (
        <div className="w-full bg-red-600 text-white p-4 shadow-2xl border-b-4 border-red-900 z-50 text-xs font-mono space-y-2 animate-pulse">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-300 animate-bounce" />
                    <span>🚨 [튕김 정밀 진단 리포트 - ${logs.length}건 포획됨]</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={copyLogText}
                        className="flex items-center gap-1 bg-white text-red-700 px-2.5 py-1 rounded font-bold hover:bg-stone-100 active:scale-95 transition-all"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        <span>리포트 복사</span>
                    </button>
                    <button
                        onClick={handleClear}
                        className="p-1 hover:bg-red-700 rounded text-white/80 hover:text-white"
                        title="로그 지우기"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 hover:bg-red-700 rounded text-white"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="bg-black/40 p-3 rounded-lg border border-red-400/30 space-y-2 overflow-x-auto">
                    <div className="text-amber-200 font-bold">
                        최근 튕김 발생 시간: {latest.timestamp}
                    </div>
                    <div className="grid grid-cols-1 gap-1 leading-relaxed">
                        <div>📍 <strong className="text-yellow-300">원인 파일/라인:</strong> {latest.source}</div>
                        <div>🔍 <strong className="text-yellow-300">발생 이유:</strong> {latest.reason}</div>
                        <div>🛫 <strong className="text-yellow-300">출발 URL:</strong> {latest.fromUrl}</div>
                        <div>🛬 <strong className="text-yellow-300">이동 목적지:</strong> {latest.toUrl}</div>
                        <div>🔑 <strong className="text-yellow-300">세션 상태:</strong> {latest.sessionExists ? '✅ 유효함' : '❌ NULL (세션 끊김)'}</div>
                    </div>
                    {latest.stackTrace && (
                        <div className="mt-2 text-[10px] opacity-70 whitespace-pre-wrap border-t border-red-500/30 pt-1 max-h-32 overflow-y-auto">
                            {latest.stackTrace}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
