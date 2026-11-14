import { Link } from 'react-router-dom';

export default function PublicDemoPage(): React.JSX.Element {
  return (
    <main style={styles.container}>
      <h1 style={styles.heading}>Demo Publik</h1>
      <p style={styles.notice}>
        Halaman ini menggunakan data sintetis. Tidak diperlukan login untuk mengakses demo.
      </p>
      <p style={styles.body}>
        Fitur demo akan tersedia setelah integrasi backend dan quest publik selesai.
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
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    color: '#92400e',
    marginBottom: '1rem',
    fontSize: '0.95rem',
  },
  body: {
    color: '#444',
    marginBottom: '2rem',
  },
  back: {
    color: '#1a56db',
    textDecoration: 'none',
    fontWeight: 500,
  },
} as const;
