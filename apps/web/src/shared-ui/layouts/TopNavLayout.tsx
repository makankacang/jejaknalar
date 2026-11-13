
import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthProvider';

export default function TopNavLayout(): React.JSX.Element {
  const { user, signOut, mode } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    setLoggingOut(true);
    setError('');

    try {
      await signOut();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Gagal keluar dari akun.',
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <nav style={styles.nav}>
          <Link to="/" style={styles.brand}>
            JejakNalar
          </Link>

          <div style={styles.rightSection}>
            <div style={styles.links}>
              <Link to="/teacher" style={styles.navLink}>
                Dashboard
              </Link>

              <Link to="/teacher/modules" style={styles.navLink}>
                Katalog Modul
              </Link>
            </div>

            <div style={styles.account}>
              <div style={styles.identity}>
                <strong>{user?.email ?? 'Guru'}</strong>
                <span style={styles.modeBadge}>
                  {mode === 'mock' ? 'DEMO' : 'LIVE'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                style={styles.logoutButton}
              >
                {loggingOut ? 'Keluar...' : 'Keluar'}
              </button>
            </div>
          </div>
        </nav>

        {error && (
          <div role="alert" style={styles.error}>
            {error}
          </div>
        )}
      </header>

      <div style={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
    background: '#ffffff',
  },
  header: {
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  nav: {
    maxWidth: 1120,
    minHeight: '64px',
    margin: '0 auto',
    padding: '10px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    flexWrap: 'wrap' as const,
  },
  brand: {
    fontWeight: 800,
    fontSize: '1.1rem',
    color: '#111827',
    textDecoration: 'none',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap' as const,
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  navLink: {
    color: '#374151',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '0.85rem',
  },
  account: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  identity: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '3px',
    fontSize: '11px',
    color: '#334155',
  },
  modeBadge: {
    width: 'fit-content',
    padding: '2px 5px',
    borderRadius: '4px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '9px',
    fontWeight: 700,
  },
  logoutButton: {
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    background: '#ffffff',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  content: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '32px 24px',
  },
  error: {
    padding: '10px 24px',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '12px',
  },
};
