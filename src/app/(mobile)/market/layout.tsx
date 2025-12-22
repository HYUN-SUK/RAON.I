'use client';

import { CartDrawer } from "@/components/market/CartDrawer";

export default function MarketLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
            <CartDrawer />
        </>
    );
}
