'use client';

import { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';

// 모바일 친화적 커스텀 테마 (캠핑 감성)
const campingTheme = {
    // 브랜드 이미지 숨김
    'common.bi.image': '',
    'common.bisize.width': '0px',
    'common.bisize.height': '0px',
    'common.backgroundImage': 'none',
    'common.backgroundColor': '#f5f5f5',
    'common.border': '0px',

    // 헤더 숨김 (우리가 직접 관리)
    'header.backgroundImage': 'none',
    'header.backgroundColor': 'transparent',
    'header.border': '0px',
    'header.display': 'none',

    // 하단 메뉴 - 더 크고 터치 친화적으로
    'menu.normalIcon.color': '#666',
    'menu.activeIcon.color': '#224732',
    'menu.disabledIcon.color': '#ccc',
    'menu.hoverIcon.color': '#1a3626',
    'menu.iconSize.width': '28px',
    'menu.iconSize.height': '28px',
    'menu.backgroundColor': '#ffffff',

    // 서브메뉴 - 깔끔하게
    'submenu.backgroundColor': '#ffffff',
    'submenu.partition.color': '#e5e5e5',
    'submenu.normalIcon.color': '#666',
    'submenu.activeIcon.color': '#224732',
    'submenu.normalLabel.color': '#666',
    'submenu.activeLabel.color': '#224732',

    // 범위 슬라이더 - 브랜드 색상
    'range.pointer.color': '#224732',
    'range.bar.color': '#e0e0e0',
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
    Square: '정사각형',
    Circle: '원',
    Triangle: '삼각형',
    Rectangle: '직사각형',
    Free: '자유형',
    Straight: '직선',
    Color: '색상',
    Range: '범위',
    Grayscale: '흑백',
    Blur: '흐리게',
    Sharpen: '선명하게',
    Emboss: '엠보싱',
    Sepia: '세피아',
    Invert: '반전',
    'Load Mask Image': '마스크 불러오기',
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

// TUI 에디터 스타일 오버라이드 (불필요한 UI 숨기고 터치 친화적으로)
const editorStyleOverride = `
    /* === 헤더 영역 완전 숨김 (로드/다운로드/로고) === */
    .tui-image-editor-header-buttons,
    .tui-image-editor-header-logo,
    .tui-image-editor-header {
        display: none !important;
        height: 0 !important;
        overflow: hidden !important;
    }

    /* === 상단 헬퍼 메뉴 숨김 (줌/손/되돌리기 등 - controls는 숨기지 않음) === */
    .tui-image-editor-controls-logo,
    .tui-image-editor-controls-buttons,
    .tui-image-editor-help-menu {
        display: none !important;
        height: 0 !important;
        visibility: hidden !important;
    }

    /* === 전체 컨테이너 레이아웃 === */
    .tui-image-editor-container {
        height: 100% !important;
        position: relative !important;
        display: flex !important;
        flex-direction: column !important;
    }

    /* 메인 컨테이너 - 이미지 영역 (서브메뉴 + 메뉴 공간 제외) */
    .tui-image-editor-main-container {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 220px !important; /* 서브메뉴(150px) + 메뉴(70px) 공간 */
        overflow: hidden !important;
    }

    .tui-image-editor-main {
        top: 0 !important;
        bottom: 0 !important;
        height: 100% !important;
    }

    /* === 핵심: controls 컨테이너 강제 표시 (메뉴의 부모 요소) === */
    .tui-image-editor-controls {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 70px !important;
        min-height: 70px !important;
        z-index: 100 !important;
        background: #ffffff !important;
        border-top: 1px solid #e0e0e0 !important;
    }

    /* === 하단 메뉴 - 절대적 강제 표시 === */
    .tui-image-editor-menu,
    ul.tui-image-editor-menu {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 70px !important;
        min-height: 70px !important;
        max-height: 70px !important;
        background: #ffffff !important;
        padding: 10px 16px !important;
        border-top: 1px solid #e0e0e0 !important;
        justify-content: center !important;
        align-items: center !important;
        gap: 8px !important;
        box-sizing: border-box !important;
        z-index: 100 !important;
        list-style: none !important;
        margin: 0 !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
    }

    /* === 메뉴 아이템 - 강제 표시 === */
    .tui-image-editor-menu > li,
    .tui-image-editor-menu > .tui-image-editor-item,
    .tui-image-editor-menu > li.tui-image-editor-item {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        width: 48px !important;
        height: 48px !important;
        min-width: 48px !important;
        min-height: 48px !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 12px !important;
        align-items: center !important;
        justify-content: center !important;
        background: #f0f0f0 !important;
        border: 1px solid transparent !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        list-style: none !important;
    }

    .tui-image-editor-menu > li:hover,
    .tui-image-editor-menu > .tui-image-editor-item:hover {
        background: rgba(34, 71, 50, 0.12) !important;
        border-color: rgba(34, 71, 50, 0.3) !important;
    }

    .tui-image-editor-menu > li.active,
    .tui-image-editor-menu > .tui-image-editor-item.active {
        background: rgba(34, 71, 50, 0.2) !important;
        border-color: #224732 !important;
    }

    /* === 메뉴 아이콘 색상 강제 === */
    .tui-image-editor-menu svg,
    .tui-image-editor-menu .svg_ic-menu,
    .tui-image-editor-menu use,
    .tui-image-editor-item svg,
    .tui-image-editor-item use {
        display: block !important;
        visibility: visible !important;
        pointer-events: none !important;
        width: 22px !important;
        height: 22px !important;
        fill: #555 !important;
        stroke: #555 !important;
    }

    .tui-image-editor-menu li.active svg,
    .tui-image-editor-menu li.active use,
    .tui-image-editor-item.active svg,
    .tui-image-editor-item.active use {
        fill: #224732 !important;
        stroke: #224732 !important;
    }

    /* === 서브메뉴 영역 - 가로 스크롤, 높이 충분히 === */
    .tui-image-editor-submenu {
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 12px !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        background: #ffffff !important;
        border-top: 1px solid #e5e5e5 !important;
        padding: 12px 16px !important;
        position: fixed !important;
        bottom: 70px !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 100 !important;
        height: 80px !important;
        max-height: 80px !important;
        min-height: 80px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        box-sizing: border-box !important;
        -webkit-overflow-scrolling: touch !important;
    }

    .tui-image-editor-submenu-item {
        display: flex !important;
        flex-wrap: nowrap !important;
        flex-shrink: 0 !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 6px !important;
        pointer-events: auto !important;
        height: 100% !important;
    }

    /* === 서브메뉴 버튼 스타일 - 모두 가로로 정렬 === */
    .tui-image-editor-submenu .tui-image-editor-button {
        padding: 6px 10px !important;
        border-radius: 6px !important;
        min-height: 36px !important;
        min-width: 50px !important;
        font-size: 11px !important;
        pointer-events: auto !important;
        cursor: pointer !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 4px !important;
        flex-shrink: 0 !important;
        white-space: nowrap !important;
    }

    .tui-image-editor-submenu .tui-image-editor-button label {
        font-size: 11px !important;
        margin: 0 !important;
        white-space: nowrap !important;
    }

    .tui-image-editor-submenu .tui-image-editor-button svg {
        width: 16px !important;
        height: 16px !important;
        flex-shrink: 0 !important;
    }

    /* === 서브메뉴 내부 버튼 그룹 - 반드시 가로 배치 === */
    .tui-image-editor-submenu-item > div,
    .tui-image-editor-submenu-item > ul,
    .tui-image-editor-submenu-item > .tui-image-editor-button-group,
    .tui-image-editor-submenu-item > *:not(label):not(input) {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 8px !important;
    }

    /* === 체크박스/라벨 가독성 === */
    .tui-image-editor-submenu-item label {
        font-size: 11px !important;
        color: #333 !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
    }

    /* === 레인지 슬라이더 스타일링 (TUI 기본 슬라이더 유지) === */
    .tui-image-editor-range-wrap {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        flex-shrink: 0 !important;
    }

    .tui-image-editor-range {
        position: relative !important;
        width: 80px !important;
        height: 16px !important;
        cursor: pointer !important;
        background: #e5e5e5 !important;
        border-radius: 3px !important;
    }

    /* 슬라이더 핸들/포인터 스타일 */
    .tui-image-editor-virtual-range-pointer {
        display: block !important;
        visibility: visible !important;
        width: 12px !important;
        height: 12px !important;
        background: #224732 !important;
        border-radius: 50% !important;
        cursor: grab !important;
        position: absolute !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        z-index: 10 !important;
    }

    .tui-image-editor-virtual-range-bar {
        display: block !important;
        visibility: visible !important;
        height: 4px !important;
        background: #224732 !important;
        border-radius: 2px !important;
    }

    .tui-image-editor-virtual-range-subbar {
        display: block !important;
        visibility: visible !important;
        height: 4px !important;
        background: #e5e5e5 !important;
        border-radius: 2px !important;
    }

    .tui-image-editor-range-value {
        display: inline-block !important;
        min-width: 30px !important;
        text-align: center !important;
        font-size: 12px !important;
    }

    /* === 캔버스 영역 === */
    .tui-image-editor-canvas-container {
        margin: 0 auto !important;
    }

    .tui-image-editor-wrap {
        height: 100% !important;
        overflow: hidden !important;
    }

    /* === 색상 선택기 개선 === */
    .tui-colorpicker-palette-button {
        width: 24px !important;
        height: 24px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
    }
`;

export interface ImageEditorRef {
    getEditedImage: () => Promise<string | null>;
    reset: () => void;
}

interface CampingImageEditorProps {
    imagePath: string;
    width?: number;
    height?: number;
}

const CampingImageEditor = forwardRef<ImageEditorRef, CampingImageEditorProps>(
    ({ imagePath, width = 400, height = 500 }, ref) => {
        const containerRef = useRef<HTMLDivElement>(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instanceRef = useRef<any>(null);
        const styleRef = useRef<HTMLStyleElement | null>(null);

        useImperativeHandle(ref, () => ({
            getEditedImage: async () => {
                if (!instanceRef.current) return null;
                try {
                    return instanceRef.current.toDataURL();
                } catch {
                    return null;
                }
            },
            reset: () => {
                if (instanceRef.current) {
                    try {
                        instanceRef.current.clearObjects();
                    } catch {
                        // ignore
                    }
                }
            },
        }));

        useEffect(() => {
            let destroyed = false;

            // 커스텀 스타일 삽입
            if (!styleRef.current && typeof document !== 'undefined') {
                styleRef.current = document.createElement('style');
                styleRef.current.textContent = editorStyleOverride;
                document.head.appendChild(styleRef.current);
            }

            const initEditor = async () => {
                if (!containerRef.current) return;

                // Vanilla JS Library Dynamic Import
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const TuiImageEditor = (await import('tui-image-editor')).default;

                if (destroyed) return;

                // 에디터 영역 높이 계산
                const editorHeight = height;

                instanceRef.current = new TuiImageEditor(containerRef.current, {
                    includeUI: {
                        loadImage: {
                            path: imagePath,
                            name: 'CampingImage',
                        },
                        theme: campingTheme,
                        menu: ['crop', 'draw', 'shape', 'text', 'filter'],
                        initMenu: 'crop', // 초기 메뉴 설정하여 도구 표시
                        uiSize: {
                            width: `${width}px`,
                            height: `${editorHeight}px`,
                        },
                        menuBarPosition: 'bottom',
                    },
                    cssMaxHeight: editorHeight - 150, // 메뉴바 + 서브메뉴 공간
                    cssMaxWidth: width - 20,
                    selectionStyle: {
                        cornerSize: 12,
                        rotatingPointOffset: 50,
                    },
                    usageStatistics: false,
                });

                // 메뉴 강제 표시 (TUI 에디터 초기화 후)
                setTimeout(() => {
                    if (destroyed) return;
                    const menu = containerRef.current?.querySelector('.tui-image-editor-menu') as HTMLElement;
                    if (menu) {
                        menu.style.height = '70px';
                        menu.style.minHeight = '70px';
                        menu.style.display = 'flex';
                        menu.style.visibility = 'visible';
                        menu.style.opacity = '1';

                        // 메뉴 아이템들도 강제 표시
                        const items = menu.querySelectorAll('li');
                        items.forEach((item) => {
                            (item as HTMLElement).style.display = 'flex';
                            (item as HTMLElement).style.visibility = 'visible';
                            (item as HTMLElement).style.width = '48px';
                            (item as HTMLElement).style.height = '48px';
                        });
                    }

                    // 서브메뉴 위치 강제 조정 (이미지 아래, 메뉴 위에 고정)
                    const fixSubmenuPosition = () => {
                        const submenu = containerRef.current?.querySelector('.tui-image-editor-submenu') as HTMLElement;
                        const controls = containerRef.current?.querySelector('.tui-image-editor-controls') as HTMLElement;
                        const mainContainer = containerRef.current?.querySelector('.tui-image-editor-main-container') as HTMLElement;

                        if (submenu) {
                            // 서브메뉴를 하단에 고정 (가로 스크롤, 높이 80px)
                            submenu.style.cssText = `
                                position: fixed !important;
                                bottom: 70px !important;
                                left: 0 !important;
                                right: 0 !important;
                                top: auto !important;
                                z-index: 100 !important;
                                background: #ffffff !important;
                                height: 80px !important;
                                max-height: 80px !important;
                                min-height: 80px !important;
                                overflow-x: auto !important;
                                overflow-y: hidden !important;
                                border-top: 1px solid #e5e5e5 !important;
                                pointer-events: auto !important;
                                display: flex !important;
                                align-items: center !important;
                                flex-wrap: nowrap !important;
                                gap: 12px !important;
                                padding: 12px 16px !important;
                                -webkit-overflow-scrolling: touch !important;
                            `;
                        }

                        if (mainContainer) {
                            // 이미지 영역을 서브메뉴 위까지만 표시 (서브메뉴 80px + 메뉴 70px = 150px)
                            mainContainer.style.cssText = `
                                position: absolute !important;
                                top: 0 !important;
                                left: 0 !important;
                                right: 0 !important;
                                bottom: 150px !important;
                                overflow: hidden !important;
                                pointer-events: auto !important;
                            `;
                        }
                    };

                    // 초기 실행만 (MutationObserver 제거 - 무한 루프 방지)
                    fixSubmenuPosition();

                    // 메뉴 클릭 시에만 위치 재조정
                    const menuItems = containerRef.current?.querySelectorAll('.tui-image-editor-menu li');
                    menuItems?.forEach((item) => {
                        item.addEventListener('click', () => {
                            setTimeout(fixSubmenuPosition, 50);
                        });
                    });

                    // 주의: TUI 에디터의 기본 이벤트 핸들링을 방해하지 않음
                    // TUI 에디터가 자체 이벤트 시스템으로 정상 작동하도록 함
                    // (커스텀 핸들러 없이 TUI 기본 동작 사용)
                }, 500);
            };

            initEditor();

            return () => {
                destroyed = true;
                if (instanceRef.current) {
                    instanceRef.current.destroy();
                    instanceRef.current = null;
                }
                // 스타일 정리
                if (styleRef.current && styleRef.current.parentNode) {
                    styleRef.current.parentNode.removeChild(styleRef.current);
                    styleRef.current = null;
                }
            };
        }, [imagePath, width, height]);

        return (
            <div className="relative w-full h-full">
                <link
                    rel="stylesheet"
                    href="https://uicdn.toast.com/tui-image-editor/v3.15.3/tui-image-editor.min.css"
                />
                <div
                    ref={containerRef}
                    className="w-full h-full overflow-hidden rounded-lg"
                />
            </div>
        );
    }
);

CampingImageEditor.displayName = 'CampingImageEditor';

export default CampingImageEditor;
