import { AdminLoginForm } from "@/components/admin/AdminLoginForm"

export default function AdminLoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-1 px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-brand-1 tracking-tight">RAON.I</h1>
                    <p className="mt-2 text-sm text-text-2">Camp & Stay Administration</p>
                </div>
                <AdminLoginForm />
            </div>
        </div>
    )
}
