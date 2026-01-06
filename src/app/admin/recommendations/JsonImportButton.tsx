import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileJson, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface JsonImportButtonProps {
    onImport: (items: any[]) => Promise<void>;
    isLoading?: boolean;
}

export function JsonImportButton({ onImport, isLoading }: JsonImportButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string>('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            toast.error('JSON 파일만 업로드 가능합니다.');
            return;
        }

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const json = JSON.parse(text);

                if (!Array.isArray(json)) {
                    throw new Error('데이터는 배열([]) 형식이어야 합니다.');
                }

                // Basic Schema Validation
                const invalidItems = json.filter(item => !item.title || !item.category);
                if (invalidItems.length > 0) {
                    throw new Error(`${invalidItems.length}개의 아이템에 필수 항목(title, category)이 누락되었습니다.`);
                }

                await onImport(json);
                // Reset after success
                if (fileInputRef.current) fileInputRef.current.value = '';
                setFileName('');
            } catch (error) {
                console.error(error);
                const msg = error instanceof Error ? error.message : "JSON 파싱 오류";
                toast.error(msg);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
                disabled={isLoading}
            />
            <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="gap-2"
            >
                {isLoading ? (
                    <span className="w-4 h-4 border-2 border-stone-400 border-t-stone-600 rounded-full animate-spin" />
                ) : (
                    <FileJson className="w-4 h-4 text-green-700" />
                )}
                {isLoading ? '업로드 중...' : 'JSON 파일 업로드'}
            </Button>
            {fileName && <span className="text-xs text-stone-500">{fileName}</span>}
        </div>
    );
}
