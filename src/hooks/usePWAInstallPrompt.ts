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
    const [isInstallable, setIsInstallable] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'pc' | 'mac'>('pc');

    useEffect(() => {
        // Detect if already installed (Standalone mode)
        const checkStandalone = () => {
            const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true;
            setIsStandalone(isStandaloneMode);
        };

        checkStandalone();
        window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

        // Detect Platform
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(userAgent)) {
            setPlatform('ios');
        } else if (/mac os/.test(userAgent) && !/iphone|ipad|ipod/.test(userAgent)) {
            setPlatform('mac');
        } else if (/android/.test(userAgent)) {
            setPlatform('android');
        } else {
            setPlatform('pc');
        }

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
        if (!isStandalone) {
            setIsInstallable(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
        };
    }, [isStandalone]);

    const promptInstall = async () => {
        // 1. Try Native Prompt first (if event captured)
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setIsInstallable(false);
                return 'accepted';
            }
            return 'dismissed';
        }

        // 2. Fallback to Manual Guide
        // Return platform so UI can show the correct modal
        return platform;
    };

    return { isInstallable: isInstallable && !isStandalone, promptInstall, platform };
}
