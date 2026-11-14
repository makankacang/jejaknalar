
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({
    children,
}: ProtectedRouteProps): React.JSX.Element {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <main
                style={{
                    minHeight: '100vh',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#64748b',
                    fontFamily: 'system-ui, sans-serif',
                }}
            >
                Memeriksa sesi pengguna...
            </main>
        );
    }

    if (!user) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location }}
            />
        );
    }

    return <>{children}</>;
}
