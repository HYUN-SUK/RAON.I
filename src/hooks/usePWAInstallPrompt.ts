import { useState, useEffect } from 'react';

interface IBeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function usePWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<IBeforeInstallPromptEvent | null>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        // Detect if already installed (Standalone mode)
        const checkStandalone = () => {
            const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true;
            setIsStandalone(isStandaloneMode);
        };

        checkStandalone();
        window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // Capture the event for Android/Desktop
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as IBeforeInstallPromptEvent);
            setIsInstallable(true);
            console.log("PWA Install Event captured!");
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // FOR DEBUGGING/USER UX:
        // Always show button if not standalone (to debug, or allow manual guide)
        // In production, we usually wait for event. But for this user issue, let's force it visible
        // and if no event, we can show a manual guide similar to iOS or just alert.
        if (!isStandalone) {
            setIsInstallable(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
        };
    }, [isStandalone]);

    const promptInstall = async () => {
        if (isIOS) {
            // iOS requires manual modal
            return 'IOS_manual';
        }

        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setIsInstallable(false);
            }
        } else {
            // No event captured yet (Desktop/Android manual fallback)
            // Maybe show a tooltip or just return null?
            // For now, let's treat it as iOS manual so at least they see "Add to Home" instructions?
            // Or just alert?
            alert("브라우저 메뉴(⋮)에서 '앱 설치' 또는 '홈 화면에 추가'를 선택해주세요.");
        }
    };

    return { isInstallable: isInstallable && !isStandalone, promptInstall, isIOS };
}
