'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { getBounceLogs, clearBounceLogs, BounceLog } from '@/lib/diagnosticSensor';

export default function BounceDebugBanner() {
    const [logs, setLogs] = useState<BounceLog[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        // 세션 스토리지에 적재된 로그 스캔
        const storedLogs = getBounceLogs();
        if (storedLogs.length > 0) {
            setLogs(storedLogs);
            // 튕김 직후면 배너를 기본으로 펼침 처리
            setIsExpanded(true);
        }
    }, []);

    if (logs.length === 0) return null;

    const latest = logs[0];

    const copyLogText = () => {
        const text = logs.map((l, index) => 
            `[튕김 진단 로그 #${index + 1}]\n` +
            `- 발생 일시: ${l.timestamp}\n` +
            `- 원인 파트: ${l.source}\n` +
            `- 에러 정보: ${l.reason}\n` +
            `- 직전 주소: ${l.fromUrl}\n` +
            `- 복구 목적: ${l.toUrl}\n` +
            `- Call Stack:\n${l.stackTrace}\n`
        ).join('\n----------------------------------------\n');

        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(text);
            toast.success('진단 리포트가 클립보드에 복사되었습니다! 개발자에게 전달해 주세요.');
        } else {
            // Fallback for older browsers / webviews
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            toast.success('진단 리포트가 복사되었습니다!');
        }
    };

    const handleClear = () => {
        clearBounceLogs();
        setLogs([]);
        toast.info('진단 로그가 삭제되었습니다.');
    };

    return (
        <div className="w-full bg-red-600 text-white p-4 shadow-xl border-b-4 border-red-950 z-50 text-xs font-mono space-y-2 relative">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-300 animate-bounce" />
                    <span>🚨 [튕김 정밀 진단 리포트 - ${logs.length}건 포획됨]</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={copyLogText}
                        className="flex items-center gap-1 bg-white text-red-700 px-2.5 py-1 rounded font-bold hover:bg-stone-100 active:scale-95 transition-all text-[11px]"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        <span>리포트 복사</span>
                    </button>
                    <button
                        onClick={handleClear}
                        className="p-1.5 hover:bg-red-700 rounded text-white/80 hover:text-white"
                        title="로그 지우기"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 hover:bg-red-700 rounded text-white"
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
                    </div>
                    {latest.stackTrace && (
                        <div className="mt-2 text-[10px] opacity-70 whitespace-pre-wrap border-t border-red-500/30 pt-2 max-h-48 overflow-y-auto">
                            {latest.stackTrace}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
