'use client';

import { useRef, useImperativeHandle, forwardRef, useEffect, useState, createElement } from 'react';
import dynamic from 'next/dynamic';

// TOAST UI Image Editor 동적 import (SSR 비활성화)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ToastImageEditor: any = dynamic(
    () => import('@toast-ui/react-image-editor').then(mod => mod.default),
    { ssr: false, loading: () => <div className="h-[500px] bg-gray-100 animate-pulse rounded-xl" /> }
);

// 커스텀 테마 (캠핑 감성)
const campingTheme = {
    'common.bi.image': '',
    'common.bisize.width': '0px',
    'common.bisize.height': '0px',
    'common.backgroundImage': 'none',
    'common.backgroundColor': '#f8f8f8',
    'common.border': '1px solid #c1c1c1',

    // 헤더
    'header.backgroundImage': 'none',
    'header.backgroundColor': '#224732',
    'header.border': '0px',

    // 메뉴 (하단)
    'menu.normalIcon.color': '#8a8a8a',
    'menu.activeIcon.color': '#224732',
    'menu.disabledIcon.color': '#ccc',
    'menu.hoverIcon.color': '#1a3626',

    // 서브메뉴
    'submenu.backgroundColor': '#fff',
    'submenu.partition.color': '#e5e5e5',

    // 버튼
    'submenu.normalIcon.color': '#8a8a8a',
    'submenu.activeIcon.color': '#224732',

    // 범위 슬라이더
    'range.pointer.color': '#224732',
    'range.bar.color': '#d4d4d4',
    'range.subbar.color': '#224732',

    // 색상 선택기
    'colorpicker.button.border': '1px solid #224732',
    'colorpicker.title.color': '#333',
};

// 한국어 로케일
const locale = {
    Crop: '자르기',
    Draw: '그리기',
    Shape: '도형',
    Text: '텍스트',
    Filter: '필터',
    Bold: '굵게',
    Italic: '기울임',
    Apply: '적용',
    Cancel: '취소',
    Custom: '사용자 정의',
    Square: '사각형',
    Circle: '원',
    Triangle: '삼각형',
    Rectangle: '직사각형',
    Free: '자유형',
    Straight: '직선',
    Color: '색상',
    Range: '범위',
    Grayscale: '흑백',
    Blur: '블러',
    Sharpen: '선명하게',
    Emboss: '엠보싱',
    Sepia: '세피아',
    Invert: '반전',
    'Load Mask Image': '마스크 이미지 불러오기',
    'Delete-all': '모두 삭제',
    'Delete': '삭제',
    'Undo': '실행취소',
    'Redo': '다시실행',
    'Reset': '초기화',
    'Flip': '뒤집기',
    'Flip X': '좌우 뒤집기',
    'Flip Y': '상하 뒤집기',
    'Rotate': '회전',
};

export interface ImageEditorRef {
    getEditedImage: () => Promise<string | null>;
    reset: () => void;
}

interface CampingImageEditorProps {
    imagePath: string;
    width?: number;
    height?: number;
    onSave?: (dataUrl: string) => void;
}

const CampingImageEditor = forwardRef<ImageEditorRef, CampingImageEditorProps>(
    ({ imagePath, width = 400, height = 500 }, ref) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editorRef = useRef<any>(null);
        const [isMounted, setIsMounted] = useState(false);

        useEffect(() => {
            setIsMounted(true);
        }, []);

        useImperativeHandle(ref, () => ({
            getEditedImage: async () => {
                if (!editorRef.current) return null;
                try {
                    const editor = editorRef.current.getInstance();
                    return editor.toDataURL();
                } catch {
                    return null;
                }
            },
            reset: () => {
                if (editorRef.current) {
                    try {
                        editorRef.current.getInstance().clearObjects();
                    } catch {
                        // ignore
                    }
                }
            },
        }));

        if (!isMounted) {
            return <div className="h-[500px] bg-gray-100 animate-pulse rounded-xl" />;
        }

        return (
            <div className="relative">
                <link
                    rel="stylesheet"
                    href="https://uicdn.toast.com/tui-image-editor/v3.15.3/tui-image-editor.min.css"
                />
                <ToastImageEditor
                    ref={editorRef}
                    includeUI={{
                        loadImage: {
                            path: imagePath,
                            name: 'CampingImage',
                        },
                        theme: campingTheme,
                        menu: ['crop', 'draw', 'shape', 'text', 'filter'],
                        initMenu: 'text',
                        uiSize: {
                            width: `${width}px`,
                            height: `${height}px`,
                        },
                        menuBarPosition: 'bottom',
                        locale,
                    }}
                    cssMaxHeight={height}
                    cssMaxWidth={width}
                    selectionStyle={{
                        cornerSize: 10,
                        rotatingPointOffset: 50,
                    }}
                    usageStatistics={false}
                />
            </div>
        );
    }
);

CampingImageEditor.displayName = 'CampingImageEditor';

export default CampingImageEditor;

