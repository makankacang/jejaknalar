import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthProvider';

export default function TeacherResetPasswordPage(): React.JSX.Element {
    const {
        loading: authLoading,
        mode,
        passwordRecoveryReady,
        updatePassword,
    } = useAuth();

    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');

        if (password !== confirmation) {
            setError('Konfirmasi password tidak cocok.');
            return;
        }

        setSubmitting(true);

        try {
            await updatePassword(password);
            setSuccess(true);
            setPassword('');
            setConfirmation('');
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Password gagal diperbarui. Silakan coba kembali.',
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

                <h1 className="teacher-auth-title">Atur password baru</h1>

                {authLoading ? (
                    <p className="teacher-auth-copy" role="status">
                        Memverifikasi sesi pemulihan...
                    </p>
                ) : mode !== 'live' ? (
                    <div className="teacher-feedback teacher-feedback--error" role="alert">
                        Penggantian password hanya tersedia pada mode LIVE.
                    </div>
                ) : success ? (
                    <>
                        <div className="teacher-feedback teacher-feedback--success" role="status">
                            Password berhasil diperbarui. Password baru sudah dapat digunakan
                            untuk akun JejakNalar.
                        </div>

                        <Link
                            to="/teacher"
                            className="teacher-button teacher-button--primary"
                            style={{ marginTop: '20px' }}
                        >
                            Lanjut ke Dashboard
                        </Link>
                    </>
                ) : !passwordRecoveryReady ? (
                    <>
                        <div className="teacher-feedback teacher-feedback--error" role="alert">
                            Sesi pemulihan tidak ditemukan atau tautannya sudah kedaluwarsa.
                            Silakan minta tautan pemulihan baru.
                        </div>

                        <Link to="/forgot-password" className="teacher-button teacher-button--primary"
                            style={{ marginTop: '20px' }}>
                            Minta Tautan Baru
                        </Link>
                    </>
                ) : (
                    <>
                        <p className="teacher-auth-copy">
                            Masukkan password baru untuk akun guru JejakNalar.
                        </p>

                        <form className="teacher-form" onSubmit={handleSubmit}>
                            <div className="teacher-field">
                                <label className="teacher-label" htmlFor="new-password">
                                    Password baru
                                </label>

                                <input
                                    id="new-password"
                                    className="teacher-input"
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="new-password"
                                    required
                                    disabled={submitting}
                                />
                            </div>

                            <div className="teacher-field">
                                <label className="teacher-label" htmlFor="confirm-password">
                                    Konfirmasi password baru
                                </label>

                                <input
                                    id="confirm-password"
                                    className="teacher-input"
                                    type="password"
                                    value={confirmation}
                                    onChange={(event) => setConfirmation(event.target.value)}
                                    autoComplete="new-password"
                                    required
                                    disabled={submitting}
                                />
                            </div>

                            {error && (
                                <div className="teacher-feedback teacher-feedback--error" role="alert">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="teacher-button teacher-button--primary"
                                disabled={submitting}
                            >
                                {submitting ? 'Memperbarui...' : 'Simpan Password Baru'}
                            </button>
                        </form>
                    </>
                )}

                <Link to="/login" className="teacher-auth-footer">
                    Kembali ke Login
                </Link>
            </section>
        </main>
    );
}
