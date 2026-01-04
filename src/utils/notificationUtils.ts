import { createClient } from '@supabase/supabase-js';

// This utility is intended to be used on the Server Side (API Routes or Server Actions)
// or Client Side with proper RLS (though usually Push sending is privileged).
// For MVP Phase 4, we will write to the 'notifications' table which acts as a log/queue.
// Actual FCM sending would happen via a Supabase Edge Function triggered by this insert.

export interface SendPushParams {
    userId: string;
    category: 'reservation' | 'community' | 'mission' | 'market' | 'system';
    title: string;
    body: string;
    link?: string;
}

export async function sendPushNotification(params: SendPushParams) {
    // We use a separate admin client or the caller's client?
    // If client-side, the user can only insert if RLS allows.
    // Let's assume this is called from Server Actions with Admin privileges usually.
    // For now, let's just log it to the 'notifications' table.

    // Note: In a real app, this should be an Admin Client. 
    // Since we are in an app, we'll rely on the caller passing a supbase client or use a singleton if server-side.
    // Here we will just define the shape.

    // Implementation will be done inside specific Service methods or API routes.
    // This file acts as a type definition or helper if needed.
    return params;
}

// Helper to calculate "Quiet Hours" suppression (SSOT 10.9.4)
export function shouldSuppressNotification(category: string): boolean {
    const now = new Date();
    const hours = now.getHours();

    // Quiet Hours: 22:00 ~ 08:00
    // Urgent categories bypass this (but SSOT logic says: if quiet_hours and category != "urgent")
    // Let's assume 'reservation' (urgent types like check-in) might bypass, but general ones don't.
    // For simplicity of MVP, we just return false for now.

    // if (hours >= 22 || hours < 8) return true;
    return false;
}
