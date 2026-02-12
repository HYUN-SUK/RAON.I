"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Line as KonvaLine, Transformer, Group, Label, Tag } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import {
    X, Crop as CropIcon, Type, Wand2, Check, RotateCcw, ZoomIn, Plus, Minus,
    Palette, Pencil, Eraser, Undo, Redo, Trash2, Maximize, Save,
    AlignLeft, AlignCenter, AlignRight, Bold, Type as FontIcon
} from 'lucide-react';
import getCroppedImg from '@/utils/canvasUtils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // V3.5
import { cn } from '@/lib/utils';



// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface TextNode {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fill: string;
    rotation: number;
    scaleX: number;
    scaleY: number;
    background: 'none' | 'black' | 'white';
    align: 'left' | 'center' | 'right';
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
}

interface LineNode {
    id: string;
    tool: 'pen' | 'eraser';
    points: number[];
    stroke: string;
    strokeWidth: number;
}

interface ImageEditorProps {
    imageFile: File;
    onSave: (file: File) => void;
    onClose: () => void;
}

const FILTER_PRESETS = [
    { name: 'Normal', type: 'normal' },
    { name: 'Gray', type: 'grayscale' },
    { name: 'Sepia', type: 'sepia' },
    { name: 'Invert', type: 'invert' },
    { name: 'Blur', type: 'blur' },
    { name: 'Bright', type: 'brighten' },
    { name: 'Contrast', type: 'contrast' },
    { name: 'Solar', type: 'solarize' },
    { name: 'Poster', type: 'posterize' },
    { name: 'Noise', type: 'noise' },
    { name: 'Pixel', type: 'pixelate' },
];

const PALETTE_COLORS = [
    '#ffffff', '#000000', '#df4b26', '#facc15', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899',
    '#9ca3af', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#818cf8', '#a78bfa', '#f472b6'
];

const FONT_OPTIONS = [
    { name: '기본 (고딕)', value: 'Pretendard' },
    { name: '나눔명조', value: 'Nanum Myeongjo' },
    { name: '나눔손글씨', value: 'Nanum Pen Script' },
];

// ----------------------------------------------------------------------
// Sub Component: CanvasImage
// ----------------------------------------------------------------------

const CanvasImage = ({ src, filterType, width, height }: { src: string, filterType: string, width: number, height: number }) => {
    // IMPORTANT: Enable CORS to prevent tainted canvas issues
    const [image] = useImage(src, 'anonymous');
    const imageRef = useRef<Konva.Image>(null);

    useEffect(() => {
        if (image && imageRef.current && width > 0 && height > 0) {
            imageRef.current.cache();
        }
    }, [image, width, height]);

    useEffect(() => {
        if (imageRef.current) {
            const node = imageRef.current;
            node.filters([]);

            switch (filterType) {
                case 'grayscale': node.filters([Konva.Filters.Grayscale]); break;
                case 'sepia': node.filters([Konva.Filters.Sepia]); break;
                case 'invert': node.filters([Konva.Filters.Invert]); break;
                case 'blur':
                    node.filters([Konva.Filters.Blur]);
                    node.blurRadius(4);
                    break;
                case 'brighten':
                    node.filters([Konva.Filters.Brighten]);
                    node.brightness(0.3);
                    break;
                case 'contrast':
                    node.filters([Konva.Filters.Contrast]);
                    node.contrast(20);
                    break;
                case 'solarize': node.filters([Konva.Filters.Solarize]); break;
                case 'posterize':
                    node.filters([Konva.Filters.Posterize]);
                    node.levels(0.5);
                    break;
                case 'noise':
                    node.filters([Konva.Filters.Noise]);
                    node.noise(0.8);
                    break;
                case 'pixelate':
                    node.filters([Konva.Filters.Pixelate]);
                    node.pixelSize(8);
                    break;
                default: node.filters([]);
            }
            node.cache();
            node.getLayer()?.batchDraw();
        }
    }, [filterType, image]);

    // Force image to scale to canvas size
    return <KonvaImage ref={imageRef} image={image} x={0} y={0} width={width} height={height} />;
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function ImageEditor({ imageFile, onSave, onClose }: ImageEditorProps) {
    const [mode, setMode] = useState<'crop' | 'filter' | 'text' | 'draw' | 'none'>('none');

    // Core State
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [filterType, setFilterType] = useState<string>('normal');

    // Crop State
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [aspect, setAspect] = useState<number | undefined>(undefined);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [forceResetKey, setForceResetKey] = useState(0); // Force re-render key

    // Text State
    const [texts, setTexts] = useState<TextNode[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [inputText, setInputText] = useState(""); // 실시간 텍스트 입력

    // Drawing State
    const [lines, setLines] = useState<LineNode[]>([]);
    const isDrawing = useRef(false);
    const [strokeColor, setStrokeColor] = useState('#df4b26');
    const [strokeWidth, setStrokeWidth] = useState(5);

    // Refs
    const stageRef = useRef<Konva.Stage>(null);
    const transformerRef = useRef<Konva.Transformer>(null);

    // Init Logic
    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            setImageUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [imageFile]);

    // Update Canvas Size when Image Loads
    useEffect(() => {
        if (imageUrl) {
            const img = new Image();
            img.src = imageUrl;
            // IMPORTANT: CrossOrigin here for the initial load check too
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const maxWidth = window.innerWidth;
                const maxHeight = window.innerHeight * 0.55;
                const scale = Math.min(maxWidth / img.width, maxHeight / img.height);

                setCanvasSize({
                    width: img.width * scale,
                    height: img.height * scale
                });

                // Force reset crop state just in case
                setCrop({ x: 0, y: 0 });
                setZoom(1);
            };
            img.onerror = (e) => {
                console.error('[ImageEditor] Failed to load image:', e);
            }
        }
    }, [imageUrl]);

    // Sync Input Text with Selected Text Node
    useEffect(() => {
        if (selectedId) {
            const selectedText = texts.find(t => t.id === selectedId);
            if (selectedText) {
                setInputText(selectedText.text);
            }
        } else {
            setInputText("");
        }
    }, [selectedId, texts]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setInputText(newVal);
        if (selectedId) {
            setTexts(texts.map(t => t.id === selectedId ? { ...t, text: newVal } : t));
        }
    };

    const handleTextColorChange = (color: string) => {
        if (selectedId) {
            setTexts(texts.map(t => t.id === selectedId ? { ...t, fill: color } : t));
        }
    };

    const handleCropConfirm = async () => {
        if (!imageUrl || !croppedAreaPixels) return;
        try {
            const croppedImageBlobUrl = await getCroppedImg(imageUrl, croppedAreaPixels, rotation);
            if (croppedImageBlobUrl) {
                setMode('none');
                setZoom(1);
                setRotation(0);
                setAspect(undefined);
                setImageUrl(croppedImageBlobUrl); // This triggers useEffect to resize canvas
                setForceResetKey(prev => prev + 1); // Force re-mount of cropper if needed
            }
        } catch (e) {
            console.error('Crop error:', e);
            alert('자르기에 실패했습니다.');
        }
    };

    const handleApplyMode = () => {
        setMode('none');
        setSelectedId(null);
    };

    const handleSave = async () => {
        if (!stageRef.current) return;

        try {
            setSelectedId(null);
            setTimeout(async () => {
                if (!stageRef.current) return;
                try {
                    // Safe pixelRatio to avoid memory issues on mobile
                    // Reduced from 2 to 1.5 for better stability
                    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1.5 });
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();
                    const file = new File([blob], `edited_${Date.now()}.png`, { type: "image/png" });
                    onSave(file);
                } catch (saveErr) {
                    console.error("Canvas export failed:", saveErr);
                    alert("이미지 저장에 실패했습니다. (Canvas Error)");
                }
            }, 100);
        } catch (e) {
            console.error("Save handler error:", e);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    // Text Handlers
    const addText = () => {
        const newText: TextNode = {
            id: `text-${Date.now()}`,
            text: '', // V3.2: Start empty
            x: canvasSize.width / 2,
            y: canvasSize.height / 2,
            fontSize: 24,
            fill: '#ffffff',
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            background: 'none',
            align: 'center', // V3.4 Init
            fontFamily: 'Pretendard', // V3.4 Init
            fontWeight: 'normal' // V3.4 Init
        };
        setTexts([...texts, newText]);
        setSelectedId(newText.id);
    };

    const toggleTextBackground = () => {
        if (!selectedId) return;
        setTexts(texts.map(t => {
            if (t.id === selectedId) {
                // V3.2: Cycle None -> Black -> White -> None
                const nextBg = t.background === 'none' ? 'black' : t.background === 'black' ? 'white' : 'none';
                return { ...t, background: nextBg };
            }
            return t;
        }));
    };

    // V3.4 Text Feature Handlers
    const handleTextAlign = (align: 'left' | 'center' | 'right') => {
        if (!selectedId) return;
        setTexts(texts.map(t => t.id === selectedId ? { ...t, align } : t));
    };

    const handleFontFamily = (fontFamily: string) => {
        if (!selectedId) return;
        setTexts(texts.map(t => t.id === selectedId ? { ...t, fontFamily } : t));
    };

    const toggleBold = () => {
        if (!selectedId) return;
        setTexts(texts.map(t => {
            if (t.id === selectedId) {
                return { ...t, fontWeight: t.fontWeight === 'bold' ? 'normal' : 'bold' };
            }
            return t;
        }));
    };

    const deleteSelected = () => {
        if (!selectedId) return;
        setTexts(texts.filter(t => t.id !== selectedId));
        setSelectedId(null);
    };

    // Drawing Handlers
    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (mode === 'text' || mode === 'none') {
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) setSelectedId(null);
            return;
        }

        if (mode !== 'draw') return;

        isDrawing.current = true;
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;

        setLines([...lines, {
            id: `line-${Date.now()}`,
            tool: 'pen',
            points: [pos.x, pos.y],
            stroke: strokeColor,
            strokeWidth: strokeWidth
        }]);
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (mode !== 'draw' || !isDrawing.current) return;

        const stage = e.target.getStage();
        const point = stage?.getPointerPosition();
        if (!point) return;

        const lastLine = lines[lines.length - 1];
        lastLine.points = lastLine.points.concat([point.x, point.y]);
        lines.splice(lines.length - 1, 1, lastLine);
        setLines(lines.concat());
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    // Transformer Update
    useEffect(() => {
        if (selectedId && transformerRef.current && stageRef.current && mode === 'text') {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) {
                transformerRef.current.nodes([node]);
                transformerRef.current.getLayer()?.batchDraw();
            }
        }
    }, [selectedId, texts, mode]);

    if (!imageUrl) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-between text-white safe-area-padding">
            {/* Top Bar */}
            <header className="w-full flex justify-between items-center px-4 py-4 z-50 bg-black/50 backdrop-blur-sm">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-300">
                    <X className="w-6 h-6" />
                </button>

                <span className="font-semibold text-sm text-gray-200">
                    {mode === 'crop' ? '자르기 & 회전' : mode === 'filter' ? '필터 효과' : mode === 'text' ? '텍스트 추가' : mode === 'draw' ? '그리기' : '이미지 편집'}
                </span>

                <div className="flex gap-2">
                    {/* Top Save Button is ONLY for final file save */}
                    <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1 active:scale-95 transition-transform">
                        <Save className="w-4 h-4" /> 저장
                    </button>
                </div>
            </header>

            {/* Main Canvas Area */}
            <div className={`relative w-full flex-1 bg-black flex items-center justify-center overflow-hidden p-4`}>
                {/* V3.3: Vertical Text Size Slider Overlay */}
                {mode === 'text' && selectedId && (
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 h-44 bg-black/60 backdrop-blur-md rounded-full py-4 w-10 flex flex-col items-center justify-between animate-in fade-in zoom-in duration-300 z-[70] border border-white/10 shadow-xl">
                        <Plus className="w-4 h-4 text-white/80" />

                        {/* Wrapper for rotation to ensure layout stability */}
                        <div className="h-24 w-40 flex items-center justify-center -my-6">
                            <Slider
                                defaultValue={[24]}
                                min={12}
                                max={100}
                                step={1}
                                value={[texts.find(t => t.id === selectedId)?.fontSize || 24]}
                                onValueChange={(v) => {
                                    if (selectedId) {
                                        setTexts(texts.map(t => t.id === selectedId ? { ...t, fontSize: v[0] } : t));
                                    }
                                }}
                                className="w-32 -rotate-90 hover:cursor-ns-resize m-0"
                            />
                        </div>

                        <Minus className="w-4 h-4 text-white/80" />
                    </div>
                )}

                {mode === 'crop' ? (
                    <div className="relative w-full h-full bg-black" key={forceResetKey}>
                        <Cropper
                            image={imageUrl}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={aspect}
                            onCropChange={setCrop}
                            onCropComplete={(area, pixels) => setCroppedAreaPixels(pixels)}
                            onZoomChange={setZoom}
                            onRotationChange={setRotation}
                            showGrid={true}
                            classes={{ containerClassName: 'bg-black' }}
                        />
                    </div>
                ) : (
                    <div className="relative shadow-2xl overflow-hidden" style={{ width: canvasSize.width, height: canvasSize.height }}>
                        <Stage
                            width={canvasSize.width}
                            height={canvasSize.height}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                            ref={stageRef}
                        >
                            <Layer>
                                {/* Pass width/height to CanvasImage to force fit */}
                                <CanvasImage src={imageUrl} filterType={filterType} width={canvasSize.width} height={canvasSize.height} />

                                {lines.map((line, i) => (
                                    <KonvaLine
                                        key={line.id}
                                        points={line.points}
                                        stroke={line.stroke}
                                        strokeWidth={line.strokeWidth}
                                        tension={0.5}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                ))}

                                {/* Texts with Label/Tag for background */}
                                {texts.map((text, i) => (
                                    <Label
                                        key={text.id}
                                        id={text.id}
                                        x={text.x}
                                        y={text.y}
                                        draggable={mode === 'text'}
                                        rotation={text.rotation}
                                        scaleX={text.scaleX}
                                        scaleY={text.scaleY}
                                        onClick={() => mode === 'text' && setSelectedId(text.id)}
                                        onTap={() => mode === 'text' && setSelectedId(text.id)}
                                        onDragEnd={(e) => {
                                            const newTexts = [...texts];
                                            const idx = texts.findIndex(t => t.id === text.id);
                                            if (idx >= 0) {
                                                newTexts[idx] = { ...newTexts[idx], x: e.target.x(), y: e.target.y() };
                                                setTexts(newTexts);
                                            }
                                        }}
                                        onTransformEnd={(e) => {
                                            const node = e.target;
                                            const newTexts = [...texts];
                                            const idx = texts.findIndex(t => t.id === text.id);
                                            if (idx >= 0) {
                                                newTexts[idx] = {
                                                    ...newTexts[idx],
                                                    x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY(),
                                                };
                                                setTexts(newTexts);
                                            }
                                        }}
                                    >
                                        {/* Tag must be first child of Label for background */}
                                        {text.background !== 'none' && (
                                            <Tag
                                                fill={text.background === 'black' ? '#000000' : '#ffffff'}
                                                opacity={0.6}
                                                cornerRadius={4}
                                            />
                                        )}
                                        <KonvaText
                                            text={text.text || "텍스트 입력"} // Placeholder on canvas
                                            fontSize={text.fontSize}
                                            fill={text.text ? text.fill : 'rgba(255,255,255,0.5)'} // Dim if placeholder
                                            padding={10}
                                            align={text.align} // V3.4
                                            fontFamily={text.fontFamily}
                                            // Actual CSS var logic needs to be solved.Konva reads Font Family name from available/loaded fonts.
                                            // Since we use CSS variable for font, we need to map variable to font family name if possible.
                                            // Actually, next/font creates a classname usually, but we exposed it as variable.
                                            // We need to use the actual font family name string that the browser sees.
                                            // For Google Fonts with next/font, the font family is usually constructed from the import function.
                                            // But for Konva, it needs a valid CSS Font Family string.
                                            // To make it simple: We use the CSS variable in a style prop and hope valid name? 
                                            // No, Konva needs direct name.
                                            // WORKAROUND: For 'Pretendard', it's standard. For Nanum, we might need to rely on the fact they are loaded
                                            // via the CSS variable injection into BODY. The font-family name is usually 'Nanum Pen Script' if imported correctly.
                                            // Let's assume the names are 'Nanum Pen Script' and 'Nanum Myeongjo' as they are standard web font names.
                                            // The next/font injects them. 

                                            fontStyle={text.fontWeight} // V3.4 Bold
                                        />
                                    </Label>
                                ))}

                                {selectedId && mode === 'text' && (
                                    <Transformer
                                        ref={transformerRef}
                                        boundBoxFunc={(oldBox, newBox) => {
                                            if (newBox.width < 5 || newBox.height < 5) return oldBox;
                                            return newBox;
                                        }}
                                    />
                                )}
                            </Layer>
                        </Stage>
                    </div>
                )}
            </div>

            {/* Bottom Toolbar */}
            <footer className="w-full bg-black/90 backdrop-blur-xl border-t border-white/10 z-50 pb-safe">
                {mode === 'none' && (
                    <div className="flex justify-around items-center p-6 pb-10">
                        <MenuButton icon={CropIcon} label="자르기" onClick={() => setMode('crop')} />
                        <MenuButton icon={Wand2} label="필터" onClick={() => setMode('filter')} />
                        <MenuButton icon={Type} label="텍스트" onClick={() => setMode('text')} />
                        <MenuButton icon={Pencil} label="그리기" onClick={() => setMode('draw')} />
                    </div>
                )}

                {/* --- CROP MODE --- */}
                {mode === 'crop' && (
                    <div className="flex flex-col gap-4 p-4 pb-8 animate-in slide-in-from-bottom duration-200">
                        <div className="flex items-center justify-between px-2">
                            <span className="text-xs text-gray-400">회전</span>
                            <Slider defaultValue={[0]} min={0} max={360} step={1} value={[rotation]} onValueChange={(val) => setRotation(val[0])} className="w-3/4" />
                        </div>
                        <div className="flex justify-between items-center overflow-x-auto gap-2 no-scrollbar py-2">
                            <RatioBtn label="자유형" active={!aspect} onClick={() => setAspect(undefined)} />
                            <RatioBtn label="1:1" active={aspect === 1} onClick={() => setAspect(1)} />
                            <RatioBtn label="4:3" active={aspect === 4 / 3} onClick={() => setAspect(4 / 3)} />
                            <RatioBtn label="16:9" active={aspect === 16 / 9} onClick={() => setAspect(16 / 9)} />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <Button variant="secondary" onClick={() => setMode('none')} className="flex-1">취소</Button>
                            <Button onClick={handleCropConfirm} className="flex-1 bg-white text-black font-bold">적용</Button>
                        </div>
                    </div>
                )}

                {/* --- FILTER MODE --- */}
                {mode === 'filter' && (
                    <div className="flex flex-col gap-2 p-4 pb-8 animate-in slide-in-from-bottom duration-200">
                        <div className="flex overflow-x-auto gap-3 py-2 no-scrollbar">
                            {FILTER_PRESETS.map((f) => (
                                <FilterBtn
                                    key={f.type} name={f.name} active={filterType === f.type}
                                    onClick={() => setFilterType(f.type)} imageUrl={imageUrl!} type={f.type}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <Button variant="secondary" onClick={() => setMode('none')} className="flex-1">취소</Button>
                            <Button onClick={handleApplyMode} className="flex-1 bg-white text-black font-bold">적용</Button>
                        </div>
                    </div>
                )}

                {/* --- TEXT MODE v3.2 & v3.4 Implemented --- */}
                {mode === 'text' && (
                    <div className="flex flex-col gap-4 p-4 pb-8 items-center animate-in slide-in-from-bottom duration-200">
                        {selectedId ? (
                            <div className="w-full space-y-3">
                                <div className="flex gap-2 items-center">
                                    <Textarea
                                        value={inputText}
                                        onChange={handleTextChange}
                                        placeholder="텍스트 입력 (엔터로 줄바꿈)"
                                        className="bg-gray-800 border-gray-700 text-white flex-1 min-h-[60px] text-sm resize-none"
                                        autoFocus
                                    />
                                    {/* Bold Toggle V3.4 */}
                                    <Button onClick={toggleBold}
                                        variant="secondary" size="icon" className={`h-9 w-9 ${texts.find(t => t.id === selectedId)?.fontWeight === 'bold' ? 'bg-white text-black' : 'bg-gray-800 text-white'}`}
                                    >
                                        <Bold className="w-4 h-4" />
                                    </Button>

                                    {/* Background Toggle */}
                                    <Button onClick={toggleTextBackground}
                                        variant="secondary" size="icon" className={`h-9 w-9 ${texts.find(t => t.id === selectedId)?.background !== 'none' ? "bg-white text-black relative" : "bg-gray-800 text-white relative"}`}
                                    >
                                        <Maximize className="w-4 h-4" />
                                        {texts.find(t => t.id === selectedId)?.background === 'white' && (
                                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-black border border-white" />
                                        )}
                                    </Button>

                                    <Button onClick={deleteSelected} variant="destructive" size="icon" className="h-9 w-9">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Row 2: Alignment & Font Family V3.4 */}
                                <div className="flex gap-2 items-center justify-between w-full">
                                    {/* Alignment Group */}
                                    <div className="flex bg-gray-900 rounded-lg p-1 border border-white/10">
                                        <button onClick={() => handleTextAlign('left')} className={`p-1.5 rounded ${texts.find(t => t.id === selectedId)?.align === 'left' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
                                            <AlignLeft className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleTextAlign('center')} className={`p-1.5 rounded ${texts.find(t => t.id === selectedId)?.align === 'center' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
                                            <AlignCenter className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleTextAlign('right')} className={`p-1.5 rounded ${texts.find(t => t.id === selectedId)?.align === 'right' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
                                            <AlignRight className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Font Selector - Horizontal List V3.5 */}
                                    <div className="flex-1 overflow-x-auto no-scrollbar mx-2">
                                        <div className="flex gap-2">
                                            {FONT_OPTIONS.map(f => (
                                                <button
                                                    key={f.value}
                                                    onClick={() => handleFontFamily(f.value)}
                                                    className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all ${texts.find(t => t.id === selectedId)?.fontFamily === f.value
                                                        ? 'bg-white text-black border-white font-bold'
                                                        : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                                                        }`}
                                                    style={{ fontFamily: f.value.replace('var(', '').replace(')', '') }}
                                                >
                                                    {f.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Color Picker */}
                                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 w-full px-1">
                                    {PALETTE_COLORS.map(c => (
                                        <button key={c} onClick={() => handleTextColorChange(c)}
                                            className={`w-7 h-7 rounded-full border border-white/20 shadow-sm shrink-0 ${texts.find(t => t.id === selectedId)?.fill === c ? 'scale-110 border-2 border-white' : ''}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <Button onClick={addText} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 py-6">
                                <Plus className="w-4 h-4 mr-2" /> 텍스트 추가
                            </Button>
                        )}
                        <div className="flex gap-2 w-full mt-2">
                            <Button variant="secondary" onClick={() => setMode('none')} className="flex-1">취소</Button>
                            <Button onClick={handleApplyMode} className="flex-1 bg-white text-black font-bold">적용</Button>
                        </div>
                    </div>
                )}

                {/* --- DRAW MODE --- */}
                {mode === 'draw' && (
                    <div className="flex flex-col gap-4 p-4 pb-8 items-center animate-in slide-in-from-bottom duration-200">
                        {/* V3.2: Expanded Drawing Palette */}
                        <div className="flex items-center gap-4 w-full px-2 overflow-x-auto no-scrollbar">
                            {PALETTE_COLORS.map(c => (
                                <button key={c} onClick={() => setStrokeColor(c)}
                                    className={`w-8 h-8 rounded-full border-2 shrink-0 ${strokeColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }} />
                            ))}
                        </div>
                        <div className="flex items-center gap-2 w-full px-4">
                            <div className="w-2 h-2 rounded-full bg-white" />
                            <Slider min={1} max={20} step={1} value={[strokeWidth]} onValueChange={(v) => setStrokeWidth(v[0])} className="flex-1" />
                            <div className="w-6 h-6 rounded-full bg-white" />
                        </div>
                        <div className="flex gap-2 w-full mt-2">
                            <Button variant="secondary" onClick={() => setMode('none')} className="flex-1">취소</Button>
                            <Button onClick={handleApplyMode} className="flex-1 bg-white text-black font-bold">적용</Button>
                        </div>
                    </div>
                )}
            </footer>
        </div>
    );
}

// --- Helpers ---
const MenuButton = ({ icon: Icon, label, onClick }: any) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-all active:scale-95 group">
        <div className="p-3.5 rounded-full bg-gray-900 group-hover:bg-gray-800 border border-white/5 transition-colors">
            <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium">{label}</span>
    </button>
);

const RatioBtn = ({ label, active, onClick }: any) => (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${active ? 'bg-white text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
        {label}
    </button>
);

const FilterBtn = ({ name, active, onClick, imageUrl, type }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 min-w-[60px] cursor-pointer transition-transform active:scale-95`}>
        <div className={`w-14 h-14 rounded-lg border-2 ${active ? 'border-primary' : 'border-gray-700'} bg-gray-900 overflow-hidden relative`}>
            <div className={`w-full h-full bg-cover bg-center absolute inset-0 
                ${type === 'grayscale' ? 'grayscale' : type === 'sepia' ? 'sepia' : type === 'invert' ? 'invert' : type === 'blur' ? 'blur-[2px]' : ''}`}
                style={{ backgroundImage: `url(${imageUrl})` }} />
        </div>
        <span className={`text-[10px] uppercase font-bold tracking-wider ${active ? 'text-white' : 'text-gray-500'}`}>{name}</span>
    </button>
);
