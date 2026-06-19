'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PlayTimer() {
    const [timerSeconds, setTimerSeconds] = useState<number>(0);
    const [timerActive, setTimerActive] = useState<boolean>(false);
    const timerIntervalRef = useRef<any>(null);

    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, []);

    const startTimer = (seconds: number) => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
        setTimerSeconds(seconds);
        setTimerActive(true);

        timerIntervalRef.current = setInterval(() => {
            setTimerSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                    setTimerActive(false);
                    triggerTimerAlert();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const toggleTimerActive = () => {
        if (timerActive) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
            setTimerActive(false);
        } else if (timerSeconds > 0) {
            setTimerActive(true);
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(timerIntervalRef.current);
                        timerIntervalRef.current = null;
                        setTimerActive(false);
                        triggerTimerAlert();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    const resetTimer = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setTimerSeconds(0);
        setTimerActive(false);
    };

    const triggerTimerAlert = () => {
        toast("🧘 명상 및 휴식 시간이 끝났습니다.", {
            description: "마음이 조금 더 편안해지셨기를 바랍니다.",
            action: {
                label: "닫기",
                onClick: () => {}
            }
        });
        
        // 브라우저 런타임 가드 (SSR 및 미지원 기기 우회)
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            try {
                window.navigator.vibrate([200, 100, 200]);
            } catch (e) {}
        }

        // Web Audio synthetic notification beep
        if (typeof window !== 'undefined') {
            try {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    const ctx = new AudioContextClass();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, ctx.currentTime);
                    osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.15);
                    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.3);
                    gain.gain.setValueAtTime(0.2, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.65);
                }
            } catch(e) {}
        }
    };

    const formatTimerText = (sec: number) => {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-2">
            <span className="text-[10px] font-bold text-stone-400">⏱️ 명상 및 사색 카운트다운 타이머</span>
            <div className="bg-white dark:bg-stone-950 rounded-2xl p-3 border border-stone-200/40 dark:border-stone-900 flex flex-col items-center space-y-3">
                {/* Timer Text */}
                <div className="text-2xl font-black font-mono text-stone-800 dark:text-stone-100 tracking-wider">
                    {formatTimerText(timerSeconds)}
                </div>
                
                {/* Preset Buttons */}
                <div className="flex gap-1.5 justify-center w-full">
                    {[180, 300, 600, 900].map((t) => (
                        <button
                            key={t}
                            onClick={() => startTimer(t)}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 active:scale-95 transition-all"
                        >
                            {t / 60}분
                        </button>
                    ))}
                </div>

                {/* Timer Controls */}
                <div className="flex items-center gap-2 w-full pt-1.5 border-t border-stone-100 dark:border-stone-900/50 justify-center">
                    <Button
                        onClick={toggleTimerActive}
                        disabled={timerSeconds === 0}
                        className={`flex-1 gap-1.5 py-2.5 rounded-xl font-bold text-xs h-auto bg-stone-800 dark:bg-stone-800 hover:bg-stone-700 text-white`}
                    >
                        {timerActive ? (
                            <>
                                <Pause className="w-3.5 h-3.5" />
                                일시정지
                            </>
                        ) : (
                            <>
                                <Play className="w-3.5 h-3.5" />
                                타이머 시작
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={resetTimer}
                        disabled={timerSeconds === 0 && !timerActive}
                        className="bg-stone-200 hover:bg-stone-300 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 p-2.5 rounded-xl h-auto"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
