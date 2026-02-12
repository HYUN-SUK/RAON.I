"use client";

import Image from "next/image";
import { Camera, Flag, Flame, Loader2 } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMySpaceStore } from "@/store/useMySpaceStore";
import { createClient } from "@/lib/supabase-client";
import { toast } from "sonner";

interface EmberStats {
    received_count: number;
    sent_count: number;
}

export default function HeroSection() {
    const router = useRouter();
    const { currentMission, fetchCurrentMission } = useMissionStore();
    const { heroImage, fetchProfile, setHeroImage } = useMySpaceStore();

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dynamic Import
    const ImageEditorModal = dynamic(() => import('@/components/record/ImageEditorModal'), { ssr: false });

    // Ember Stats State
    const [emberStats, setEmberStats] = useState<EmberStats | null>(null);

    useEffect(() => {
        fetchCurrentMission();
        fetchProfile(); // Load saved hero image
        fetchEmberStats();
    }, [fetchCurrentMission, fetchProfile]);

    const fetchEmberStats = async () => {
        const supabase = createClient();
        const { data } = await supabase.rpc('get_my_ember_stats');
        if (data?.success) {
            setEmberStats({
                received_count: data.received_count,
                sent_count: data.sent_count
            });
        }
    };

    const handleCameraClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (file.size > 5 * 1024 * 1024) {
            toast.error("이미지 크기는 5MB 이하여야 합니다.");
            return;
        }

        // Preview for Editor
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (result) {
                setSelectedImage(result);
                setIsEditorOpen(true);
            }
        };
        reader.readAsDataURL(file);

        // Reset input to allow re-selection
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditorSave = async (dataUrl: string) => {
        setIsUploading(true);
        const supabase = createClient();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("로그인이 필요합니다.");

            // Convert Data URL to File
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], "hero_image.png", { type: "image/png" });

            const fileExt = "png";
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `hero/${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('profile_images') // Using existing bucket, new folder
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile_images')
                .getPublicUrl(filePath);

            // 3. Update Profile DB
            const { error: dbError } = await supabase
                .from('profiles')
                .update({ hero_image_url: publicUrl })
                .eq('id', user.id);

            if (dbError) throw dbError;

            // 4. Update Local State
            setHeroImage(publicUrl);
            toast.success("배경 화면이 변경되었습니다! 📸");

        } catch (error: any) {
            console.error('Upload failed:', error);
            // Show detailed error message
            toast.error(`이미지 변경 실패: ${error.message || '알 수 없는 오류'}`);
        } finally {
            setIsUploading(false);
            setIsEditorOpen(false);
            setSelectedImage(null);
        }
    };

    return (
        <div className="relative w-full h-[55vh] min-h-[400px] rounded-b-[40px] shadow-medium z-10 bg-surface-2 group">
            <div className="absolute inset-0 rounded-b-[40px] overflow-hidden z-0">
                <Image
                    src={heroImage || "/images/tent_view_wide_scenic.png"}
                    alt="My Archive"
                    fill
                    className={`object-cover transition-opacity duration-500 ${isUploading ? 'opacity-50' : 'opacity-100'}`}
                    priority
                />

                {/* Cinematic Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50 pointer-events-none" />

                {/* Uploading Spinner */}
                {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center z-30">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                )}
            </div>

            {/* 2. UI Overlay Layer */}
            <div className="absolute inset-0 z-20 p-6 flex flex-col justify-between pointer-events-none">
                {/* Top Area: Badges */}
                <div className="flex justify-end items-start pt-8">
                    {/* Right: Badge Stack (세로 배치) */}
                    <div className="flex flex-col gap-2 items-end pointer-events-auto">
                        {/* Mission Badge */}
                        {currentMission && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/mission/${currentMission.id}`);
                                }}
                                className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 text-white/90 hover:bg-white/20 active:scale-95 transition-all shadow-lg animate-float"
                            >
                                <div className="p-1 bg-brand-1 rounded-full">
                                    <Flag size={12} className="text-white" fill="currentColor" />
                                </div>
                                <span className="text-xs font-medium">
                                    이번 주: {currentMission.title.length > 8 ? currentMission.title.substring(0, 8) + '...' : currentMission.title}
                                </span>
                            </button>
                        )}

                        {/* Ember Badge (항상 표시) */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push('/myspace/embers');
                            }}
                            className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 text-white/90 hover:bg-white/20 active:scale-95 transition-all shadow-lg"
                        >
                            <Flame size={16} className="text-orange-400" />
                            <span className="text-xs font-medium">
                                받은 불씨 {emberStats?.received_count ?? 0}개
                            </span>
                        </button>
                    </div>
                </div>

                {/* Bottom Area: Photo Controls */}
                <div className="flex justify-end items-end pb-2 pointer-events-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <button
                        onClick={handleCameraClick}
                        disabled={isUploading}
                        className="glass-button p-3 rounded-full text-white hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Camera size={20} strokeWidth={1.5} />
                        <span className="text-sm font-medium w-0 overflow-hidden group-hover:w-16 transition-all duration-300 whitespace-nowrap">
                            {isUploading ? '업로드...' : '사진 변경'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Image Editor Modal */}
            {
                selectedImage && isEditorOpen && (
                    <ImageEditorModal
                        isOpen={isEditorOpen}
                        onClose={() => setIsEditorOpen(false)}
                        imagePath={selectedImage}
                        onSave={handleEditorSave}
                    />
                )
            }
        </div >
    );
}
