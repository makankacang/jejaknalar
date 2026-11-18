
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';

import {
    getSupabaseClient,
    isSupabaseConfigured,
} from '../supabase/client';

export interface AuthUser {
    id: string;
    email: string | null;
}

type AuthMode = 'mock' | 'live';

interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    mode: AuthMode;
    configurationError: string | null;
    passwordRecoveryReady: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    requestPasswordReset: (email: string) => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const MOCK_SESSION_KEY = 'jejaknalar.mock.teacher-session';

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthMode(): AuthMode {
    return import.meta.env.VITE_DATA_MODE === 'live' ? 'live' : 'mock';
}

function mapSupabaseUser(user: User): AuthUser {
    return {
        id: user.id,
        email: user.email ?? null,
    };
}

function readMockSession(): AuthUser | null {
    try {
        const stored = sessionStorage.getItem(MOCK_SESSION_KEY);

        if (!stored) return null;

        const parsed: unknown = JSON.parse(stored);

        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'id' in parsed &&
            'email' in parsed &&
            typeof parsed.id === 'string' &&
            typeof parsed.email === 'string'
        ) {
            return {
                id: parsed.id,
                email: parsed.email,
            };
        }

        sessionStorage.removeItem(MOCK_SESSION_KEY);
        return null;
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const mode = getAuthMode();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [configurationError, setConfigurationError] =
        useState<string | null>(null);
    const [passwordRecoveryReady, setPasswordRecoveryReady] = useState(false);

    useEffect(() => {
        if (mode === 'mock') {
            setUser(readMockSession());
            setLoading(false);
            return;
        }

        if (!isSupabaseConfigured()) {
            setConfigurationError(
                'Supabase belum dikonfigurasi. Periksa environment aplikasi.',
            );
            setLoading(false);
            return;
        }

        let active = true;

        const supabase = getSupabaseClient();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (active) {
                if (event === 'PASSWORD_RECOVERY' && session) {
                    setPasswordRecoveryReady(true);
                }

                if (event === 'SIGNED_OUT') {
                    setPasswordRecoveryReady(false);
                }

                setUser(
                    session?.user ? mapSupabaseUser(session.user) : null,
                );
            }
        });

        void supabase.auth
            .getSession()
            .then(({ data, error }) => {
                if (!active) return;

                if (error) {
                    setConfigurationError(error.message);
                    return;
                }

                setUser(
                    data.session?.user
                        ? mapSupabaseUser(data.session.user)
                        : null,
                );
            })
            .catch(() => {
                if (active) {
                    setConfigurationError('Gagal memulihkan sesi autentikasi.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, [mode]);

    const signIn = useCallback(
        async (email: string, password: string) => {
            setConfigurationError(null);

            if (!email.trim() || !password) {
                throw new Error('Email dan password wajib diisi.');
            }

            if (mode === 'mock') {
                const demoUser: AuthUser = {
                    id: 'mock-teacher-demo',
                    email: email.trim(),
                };

                sessionStorage.setItem(
                    MOCK_SESSION_KEY,
                    JSON.stringify(demoUser),
                );

                setUser(demoUser);
                return;
            }

            if (!isSupabaseConfigured()) {
                throw new Error(
                    'Supabase belum dikonfigurasi untuk mode live.',
                );
            }

            const { data, error } = await getSupabaseClient().auth
                .signInWithPassword({
                    email: email.trim(),
                    password,
                });

            if (error) throw error;

            if (!data.user) {
                throw new Error('Pengguna tidak ditemukan setelah login.');
            }

            setUser(mapSupabaseUser(data.user));
        },
        [mode],
    );


    const requestPasswordReset = useCallback(
        async (email: string) => {
            const normalizedEmail = email.trim();

            if (!normalizedEmail) {
                throw new Error('Email wajib diisi.');
            }

            if (mode !== 'live') {
                throw new Error('Password recovery hanya tersedia pada mode LIVE.');
            }

            if (!isSupabaseConfigured()) {
                throw new Error('Supabase belum dikonfigurasi.');
            }

            const redirectTo = `${window.location.origin}/reset-password`;

            const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
                normalizedEmail,
                { redirectTo },
            );

            if (error) throw error;
        },
        [mode],
    );

    const updatePassword = useCallback(
        async (password: string) => {
            if (!password) {
                throw new Error('Password baru wajib diisi.');
            }

            if (mode !== 'live') {
                throw new Error('Penggantian password hanya tersedia pada mode LIVE.');
            }

            if (!isSupabaseConfigured()) {
                throw new Error('Supabase belum dikonfigurasi.');
            }

            const { error } = await getSupabaseClient().auth.updateUser({
                password,
            });

            if (error) throw error;
        },
        [mode],
    );
    const signOut = useCallback(async () => {
        if (mode === 'mock') {
            sessionStorage.removeItem(MOCK_SESSION_KEY);
            setUser(null);
            return;
        }

        const { error } = await getSupabaseClient().auth.signOut();

        if (error) throw error;

        setUser(null);
    }, [mode]);

    const value = useMemo(
        () => ({
            user,
            loading,
            mode,
            configurationError,
            passwordRecoveryReady,
            signIn,
            requestPasswordReset,
            updatePassword,
            signOut,
        }),
        [user, loading, mode, configurationError, passwordRecoveryReady, signIn, requestPasswordReset, updatePassword, signOut],
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth harus digunakan di dalam AuthProvider.');
    }

    return context;
}
