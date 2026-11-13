import { Link } from 'react-router-dom';

/**
 * StudentPlaceholderPage
 *
 * Route: /student/join
 *
 * OWNERSHIP: PIC D
 * This component is a route-skeleton placeholder only.
 * PIC D owns the actual Student UI, game implementation,
 * and session logic. Do not add business logic here.
 */
export default function StudentPlaceholderPage(): React.JSX.Element {
  return (
    <main style={styles.container}>
      <h1 style={styles.heading}>Student — Segera Hadir</h1>
      <p style={styles.notice}>
        Implementasi halaman ini dimiliki oleh <strong>PIC D</strong>.
        Route skeleton ini disediakan oleh PIC A sesuai acceptance criteria A-01.
      </p>
      <Link to="/" style={styles.back}>
        ← Kembali ke Landing
      </Link>
    </main>
  );
}

const styles = {
  container: {
    maxWidth: 640,
    margin: '80px auto',
    padding: '0 24px',
    fontFamily: 'system-ui, sans-serif',
  },
  heading: {
    fontSize: '2rem',
    fontWeight: 700,
    marginBottom: '1rem',
  },
  notice: {
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    background: '#f0fdf4',
    border: '1px solid #86efac',
    color: '#14532d',
    marginBottom: '2rem',
    fontSize: '0.95rem',
  },
  back: {
    color: '#1a56db',
    textDecoration: 'none',
    fontWeight: 500,
  },
} as const;
