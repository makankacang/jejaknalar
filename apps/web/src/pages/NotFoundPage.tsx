import { Link } from 'react-router-dom';

export default function NotFoundPage(): React.JSX.Element {
  return (
    <main style={styles.container}>
      <p style={styles.code}>404</p>
      <h1 style={styles.heading}>Halaman Tidak Ditemukan</h1>
      <p style={styles.body}>
        URL yang Anda minta tidak tersedia. Periksa kembali alamat atau kembali ke halaman utama.
      </p>
      <Link to="/" style={styles.back}>
        ← Kembali ke Beranda
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
    textAlign: 'center' as const,
  },
  code: {
    fontSize: '5rem',
    fontWeight: 800,
    color: '#e5e7eb',
    margin: 0,
    lineHeight: 1,
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    margin: '0.5rem 0 1rem',
  },
  body: {
    color: '#555',
    marginBottom: '2rem',
  },
  back: {
    color: '#1a56db',
    textDecoration: 'none',
    fontWeight: 500,
  },
} as const;
