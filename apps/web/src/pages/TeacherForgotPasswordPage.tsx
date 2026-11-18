import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthProvider';

export default function TeacherForgotPasswordPage(): React.JSX.Element {
    const { mode, requestPasswordReset } = useAuth();

    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setSuccess('');
        setSubmitting(true);

        try {
            await requestPasswordReset(email);
            setSuccess(
                'Jika alamat email terdaftar, tautan pemulihan akan dikirim. Periksa inbox dan folder spam.',
            );
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Permintaan pemulihan gagal. Silakan coba kembali.',
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="teacher-auth-page">
            <section className="teacher-auth-card">
                <Link to="/" className="teacher-auth-brand">
                    JejakNalar
                </Link>

                <span className="teacher-eyebrow">PEMULIHAN AKUN</span>

                <h1 className="teacher-auth-title">Lupa password?</h1>

                <p className="teacher-auth-copy">
                    Masukkan email akun guru. Kami akan mengirimkan tautan
                    untuk mengatur password baru.
                </p>

                {mode === 'mock' && (
                    <div className="teacher-feedback teacher-feedback--error" role="note">
                        Password recovery hanya tersedia pada mode LIVE.
                    </div>
                )}

                <form className="teacher-form" onSubmit={handleSubmit}>
                    <div className="teacher-field">
                        <label className="teacher-label" htmlFor="recovery-email">
                            Email akun
                        </label>

                        <input
                            id="recovery-email"
                            className="teacher-input"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="nama@email.com"
                            autoComplete="email"
                            required
                            disabled={submitting}
                        />
                    </div>

                    {error && (
                        <div className="teacher-feedback teacher-feedback--error" role="alert">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="teacher-feedback teacher-feedback--success" role="status">
                            {success}
                        </div>
                    )}

                    <button
                        className="teacher-button teacher-button--primary"
                        type="submit"
                        disabled={submitting || mode !== 'live'}
                    >
                        {submitting ? 'Mengirim...' : 'Kirim Tautan Pemulihan'}
                    </button>
                </form>

                <Link to="/login" className="teacher-auth-footer">
                    Kembali ke Login
                </Link>
            </section>
        </main>
    );
}
