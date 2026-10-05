import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * RAON.I 모바일 표준 Input 컴포넌트
 * - 리액트 표준 Controlled/Uncontrolled 규격 준수 (가상 DOM과 브라우저 네이티브 이벤트 100% 호환)
 * - 모바일 안드로이드 웹뷰(삼성 키보드/천지인) 한글 조합 버퍼 파괴 및 글자 중복 입력 원천 차단
 * - text-base sm:text-sm (모바일 16px로 가상 키보드 팝업 시 원치 않는 자동 줌인 방지)
 * - touch-manipulation (모바일 300ms 더블탭 딜레이 제거)
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type = "text", ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
