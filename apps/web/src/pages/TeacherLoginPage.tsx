
import { useState, type FormEvent } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthProvider';

interface RedirectState {
  from?: {
    pathname?: string;
  };
}

export default function TeacherLoginPage(): React.JSX.Element {
  const { user, loading, mode, configurationError, signIn } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const redirectState = location.state as RedirectState | null;
  const requestedPath = redirectState?.from?.pathname;

  const destination =
    requestedPath?.startsWith('/') &&
      !requestedPath.startsWith('//') &&
      requestedPath !== '/login'
      ? requestedPath
      : '/teacher';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSubmitting(true);

    try {
      await signIn(email, password);
      navigate(destination, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Login gagal. Silakan coba kembali.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.centered}>
        Memeriksa sesi pengguna...
      </main>
    );
  }

  if (user) {
    return <Navigate to="/teacher" replace />;
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link to="/" style={styles.brand}>
          JejakNalar
        </Link>

        <span style={styles.eyebrow}>RUANG GURU</span>

        <h1 style={styles.title}>Selamat datang kembali</h1>

        <p style={styles.description}>
          Masuk untuk mengelola kelas dan mengembangkan pengalaman
          belajar berbasis quest.
        </p>

        {mode === 'mock' && (
          <div style={styles.mockNotice}>
            <strong>Mode demonstrasi lokal</strong>
            <p>
              Gunakan email dan password apa saja yang tidak kosong.
              Login ini tidak memverifikasi identitas melalui Supabase.
            </p>
          </div>
        )}

        {configurationError && mode === 'live' && (
          <div role="alert" style={styles.error}>
            {configurationError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label htmlFor="teacher-email" style={styles.label}>
              Email
            </label>

            <input
              id="teacher-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@email.com"
              autoComplete="username"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="teacher-password" style={styles.label}>
              Password
            </label>

            <input
              id="teacher-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan password"
              autoComplete="current-password"
              required
              style={styles.input}
            />
          </div>

          {error && (
            <div role="alert" style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.submitButton,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? 'Memproses...' : 'Masuk ke JejakNalar'}
          </button>
        </form>

        <Link to="/forgot-password" style={styles.backLink}>Lupa password?</Link>
        <p style={styles.footer}>
          Dengan masuk, Anda dapat mengakses ruang pengelolaan
          pembelajaran JejakNalar.
        </p>

        <Link to="/" style={styles.backLink}>
          ← Kembali ke Beranda
        </Link>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    boxSizing: 'border-box' as const,
    background: 'var(--jn-color-cream)',
    color: 'var(--jn-text-primary)',
    fontFamily: 'system-ui, sans-serif',
  },
  centered: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--jn-text-secondary)',
  },
  card: {
    width: '100%',
    maxWidth: '430px',
    padding: '34px',
    boxSizing: 'border-box' as const,
    border: '1px solid var(--jn-border-default)',
    borderRadius: '15px',
    background: 'var(--jn-surface-card)',
    boxShadow: '0 8px 30px rgba(15,23,42,0.05)',
  },
  brand: {
    display: 'block',
    marginBottom: '34px',
    color: 'var(--jn-text-primary)',
    fontWeight: 800,
    fontSize: '20px',
    textDecoration: 'none',
  },
  eyebrow: {
    color: 'var(--jn-text-secondary)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1.5px',
  },
  title: {
    margin: '10px 0',
    fontSize: '27px',
    lineHeight: 1.3,
  },
  description: {
    color: 'var(--jn-text-secondary)',
    fontSize: '13px',
    lineHeight: 1.7,
    marginBottom: '25px',
  },
  mockNotice: {
    padding: '13px',
    marginBottom: '20px',
    borderRadius: '8px',
    background: 'var(--jn-status-warning-bg)',
    color: 'var(--jn-status-warning-text)',
    fontSize: '12px',
    lineHeight: 1.6,
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '7px',
    marginBottom: '17px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--jn-color-primary-medium)',
  },
  input: {
    padding: '12px',
    border: '1px solid var(--jn-border-default)',
    borderRadius: '8px',
    fontSize: '14px',
    outlineColor: 'var(--jn-text-secondary)',
  },
  error: {
    padding: '12px',
    marginBottom: '15px',
    borderRadius: '8px',
    background: 'var(--jn-status-error-bg)',
    color: 'var(--jn-status-error-text)',
    fontSize: '12px',
    lineHeight: 1.6,
  },
  submitButton: {
    width: '100%',
    padding: '13px',
    marginTop: '7px',
    border: 'none',
    borderRadius: '8px',
    background: 'var(--jn-color-primary-dark)',
    color: 'var(--jn-surface-card)',
    fontSize: '13px',
    fontWeight: 700,
  },
  footer: {
    marginTop: '21px',
    color: 'var(--jn-color-muted)',
    fontSize: '11px',
    lineHeight: 1.6,
    textAlign: 'center' as const,
  },
  backLink: {
    display: 'block',
    marginTop: '20px',
    color: 'var(--jn-text-secondary)',
    fontSize: '12px',
    textAlign: 'center' as const,
    textDecoration: 'none',
  },
};
