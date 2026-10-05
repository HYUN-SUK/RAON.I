import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            type = "text",
            value,
            defaultValue,
            onChange,
            onInput,
            onCompositionStart,
            onCompositionEnd,
            onFocus,
            onBlur,
            onKeyDown,
            ...props
        },
        forwardedRef
    ) => {
        const innerRef = React.useRef<HTMLInputElement | null>(null);
        const isComposingRef = React.useRef(false);
        const isFocusedRef = React.useRef(false);
        const lastEmittedValueRef = React.useRef<string>(
            value !== undefined && value !== null ? String(value) : (defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : "")
        );

        // Expose ref to parent
        React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

        // 부모 컴포넌트의 value prop 변경 시 DOM 동기화
        // 핵심 원칙:
        // 1. 한글 자모 조합 중(isComposing)일 때는 React가 DOM의 value를 절대 덮어쓰지 않아
        //    삼성 키보드/Gboard의 IME 버퍼가 파괴되어 앞글자가 사라지거나 씹히는 현상을 100% 방지함.
        // 2. 사용자가 포커스하여 타이핑 중이고 DOM에 이미 최신 글자가 반영되어 있다면 재할당하지 않음.
        // 3. 외부 상태 변경(폼 초기화, API 응답 채우기, 외부 선택 등) 시에는 안전하게 DOM을 갱신함.
        React.useEffect(() => {
            const input = innerRef.current;
            if (!input || value === undefined || value === null) return;

            const strVal = String(value);

            // 포커스 중이 아닐 때 (외부 데이터 로드, 초기화 버튼, 시트 오픈 등)
            if (!isFocusedRef.current) {
                if (input.value !== strVal) {
                    input.value = strVal;
                    lastEmittedValueRef.current = strVal;
                }
                return;
            }

            // 포커스 중일 때:
            // 한글 조합 중이면 키보드 조합 버퍼 보호를 위해 DOM 조작 차단
            if (isComposingRef.current) return;

            // 이미 DOM 값이 부모 state와 일치하거나, 방금 사용자가 타이핑하여 방출한 값인 경우 재할당 금지
            if (input.value === strVal || lastEmittedValueRef.current === strVal) {
                return;
            }

            // 부모가 의도적으로 값을 변환/초기화한 경우 (예: 글자수 제한, 자동 하이픈 포맷, 입력값 필터링 등)
            input.value = strVal;
            lastEmittedValueRef.current = strVal;
        }, [value]);

        const handleCompositionStart = (e: React.CompositionEvent<HTMLInputElement>) => {
            isComposingRef.current = true;
            onCompositionStart?.(e);
        };

        const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
            isComposingRef.current = false;
            const targetVal = e.currentTarget.value;
            lastEmittedValueRef.current = targetVal;
            onCompositionEnd?.(e);
            // 조합 완료 시 최종 텍스트를 확실하게 부모 onChange로 전달
            if (onChange) {
                onChange(e as unknown as React.ChangeEvent<HTMLInputElement>);
            }
        };

        const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
            const targetVal = (e.target as HTMLInputElement).value;
            lastEmittedValueRef.current = targetVal;
            onInput?.(e);
            // 안드로이드 삼성 키보드/웹뷰: 조합 중에도 매 음절마다 부모 상태를 즉각 동기화하여
            // '취소 요청하기' 등의 버튼 활성화(0ms)가 지연 없이 즉각 반응하도록 보장
            if (onChange) {
                onChange(e as unknown as React.ChangeEvent<HTMLInputElement>);
            }
        };

        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
            isFocusedRef.current = true;
            onFocus?.(e);
        };

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            isFocusedRef.current = false;
            isComposingRef.current = false;
            const targetVal = e.target.value;
            lastEmittedValueRef.current = targetVal;
            onBlur?.(e);
            // 포커스를 잃을 때(외부 취소사유 버튼 터치 등) 최종 DOM 값을 부모에 확실히 동기화
            if (onChange) {
                onChange(e as unknown as React.ChangeEvent<HTMLInputElement>);
            }
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const targetVal = e.target.value;
            // handleInput에서 이미 부모에게 동일한 값을 전달했다면 중복 호출 방지
            if (lastEmittedValueRef.current === targetVal) {
                return;
            }
            lastEmittedValueRef.current = targetVal;
            onChange?.(e);
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            onKeyDown?.(e);
        };

        return (
            <input
                ref={innerRef}
                type={type}
                defaultValue={defaultValue ?? (value !== undefined && value !== null ? String(value) : undefined)}
                onChange={handleChange}
                onInput={handleInput}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
                    className
                )}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
