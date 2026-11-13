
import {
    createClient,
    type SupabaseClient,
} from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseConfig() {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const publishableKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

    if (
        !url ||
        !publishableKey ||
        url === 'https://example.supabase.co' ||
        publishableKey === 'YOUR_PUBLIC_KEY'
    ) {
        throw new Error(
            'Supabase belum dikonfigurasi. Periksa VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.',
        );
    }

    return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
    try {
        getSupabaseConfig();
        return true;
    } catch {
        return false;
    }
}

export function getSupabaseClient(): SupabaseClient {
    if (supabaseClient) {
        return supabaseClient;
    }

    const { url, publishableKey } = getSupabaseConfig();

    supabaseClient = createClient(url, publishableKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });

    return supabaseClient;
}
