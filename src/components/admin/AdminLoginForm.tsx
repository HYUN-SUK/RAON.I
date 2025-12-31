"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

const formSchema = z.object({
    email: z.string().email({
        message: "유효한 이메일 주소를 입력해주세요.",
    }),
    password: z.string().min(6, {
        message: "비밀번호는 최소 6자 이상이어야 합니다.",
    }),
})

export function AdminLoginForm() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        setError(null)

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password,
            })

            if (signInError) {
                throw new Error(signInError.message)
            }

            // Check for Admin metadata logic implementation
            // For now, we allow login if Auth succeeds, Middleware/RLS will handle permissions

            router.push("/admin")
            router.refresh()

        } catch (err: any) {
            console.error("Login failed:", err)
            setError(err.message === "Invalid login credentials"
                ? "이메일 또는 비밀번호가 올바르지 않습니다."
                : "로그인 중 오류가 발생했습니다. 다시 시도해주세요.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-md mx-auto shadow-lg border-brand-1/10">
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-center text-brand-1">관리자 로그인</CardTitle>
                <CardDescription className="text-center">
                    라온아이 운영진 계정으로 접속하세요.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>이메일</FormLabel>
                                    <FormControl>
                                        <Input placeholder="admin@raon.ai" {...field} disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>비밀번호</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button type="submit" className="w-full bg-brand-1 hover:bg-brand-2" disabled={isLoading}>
                            {isLoading ? "로그인 중..." : "로그인"}
                        </Button>


                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
