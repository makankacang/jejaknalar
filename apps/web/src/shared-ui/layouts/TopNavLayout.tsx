import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
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
    <div className="teacher-ui">
      <header className="teacher-topbar">
        <nav className="teacher-nav" aria-label="Navigasi utama">
          <Link to="/" className="teacher-brand">
            JejakNalar
          </Link>

          <div className="teacher-nav-right">
            <div className="teacher-nav-links">
              <NavLink
                to="/teacher"
                end
                className={({ isActive }) =>
                  `teacher-nav-link${isActive ? ' is-active' : ''}`
                }
              >
                Dashboard
              </NavLink>

              <NavLink
                to="/teacher/modules"
                className={({ isActive }) =>
                  `teacher-nav-link${isActive ? ' is-active' : ''}`
                }
              >
                Katalog Modul
              </NavLink>
            </div>

            <div className="teacher-account">
              <div className="teacher-identity">
                <strong title={user?.email ?? 'Guru'}>
                  {user?.email ?? 'Guru'}
                </strong>

                <span
                  className={`teacher-badge ${
                    mode === 'mock'
                      ? 'teacher-badge--demo'
                      : 'teacher-badge--live'
                  }`}
                >
                  {mode === 'mock' ? 'DEMO' : 'LIVE'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="teacher-logout"
              >
                {loggingOut ? 'Keluar...' : 'Keluar'}
              </button>
            </div>
          </div>
        </nav>

        {error && (
          <div role="alert" className="teacher-nav-error">
            {error}
          </div>
        )}
      </header>

      <div className="teacher-layout-content">
        <Outlet />
      </div>
    </div>
  );
}
