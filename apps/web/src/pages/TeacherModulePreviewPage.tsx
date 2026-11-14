import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MockModuleRepository } from '../lib/mocks/moduleRepository';
import type { TeacherModule } from '../lib/types/teacher';

const repository = new MockModuleRepository();

export default function TeacherModulePreviewPage() {
    const { moduleId } = useParams<{ moduleId: string }>();
    const [module, setModule] = useState<TeacherModule | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        repository
            .getById(moduleId ?? '')
            .then((data) => {
                if (active) setModule(data);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [moduleId]);

    return (
        <main style={styles.page}>
            <div style={styles.container}>
                <Link to="/teacher/modules" style={styles.backLink}>
                    ← Kembali ke katalog
                </Link>

                {loading && <p>Memuat detail modul...</p>}

                {!loading && !module && (
                    <section style={styles.panel}>
                        <h1>Modul tidak ditemukan</h1>
                        <p>Modul yang kamu cari tidak tersedia di katalog.</p>
                        <Link to="/teacher/modules" style={styles.actionLink}>
                            Kembali ke katalog
                        </Link>
                    </section>
                )}

                {!loading && module && (
                    <>
                        <div role="note" style={styles.demoNotice}>
                            <strong>DEMO / DATA SIMULASI</strong>
                            <p>
                                Halaman preview ini masih menggunakan MockModuleRepository.
                                Informasi modul yang ditampilkan merupakan data demonstrasi,
                                bukan detail modul live dari Supabase Staging.
                            </p>
                        </div>

                        <span style={styles.eyebrow}>PRATINJAU MODUL</span>
                        <section style={styles.panel}>
                            <div style={styles.badges}>
                                <span style={styles.badge}>{module.subject}</span>
                                <span style={styles.badge}>Kelas {module.grade}</span>
                                <span style={styles.badge}>
                                    {module.format === 'builtin'
                                        ? 'Modul bawaan'
                                        : module.format.toUpperCase()}
                                </span>
                            </div>

                            <h1 style={styles.title}>{module.title}</h1>
                            <p style={styles.description}>{module.description}</p>

                            <div style={styles.metadata}>
                                <div>
                                    <span style={styles.metaLabel}>ID MODUL</span>
                                    <strong>{module.id}</strong>
                                </div>
                                <div>
                                    <span style={styles.metaLabel}>MATA PELAJARAN</span>
                                    <strong>{module.subject}</strong>
                                </div>
                                <div>
                                    <span style={styles.metaLabel}>TINGKAT</span>
                                    <strong>Kelas {module.grade}</strong>
                                </div>
                            </div>

                            <div style={styles.notice}>
                                <strong>Berikutnya: Analisis Learning Objectives</strong>
                                <p>
                                    Modul ini sudah dapat dipilih dan ditinjau. Tahap berikutnya
                                    adalah mengekstrak materi dan meninjau tujuan pembelajaran
                                    sebelum quest dibuat.
                                </p>
                            </div>

                            <Link to="/teacher/modules" style={styles.actionLink}>
                                Pilih modul lain
                            </Link>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}

const styles = {
    page: {
        minHeight: 'calc(100vh - 64px)',
        padding: '36px 24px 64px',
        background: '#f8fafc',
        color: '#172033',
    },
    container: {
        maxWidth: '900px',
        margin: '0 auto',
    },
    backLink: {
        display: 'block',
        marginBottom: '28px',
        color: '#475569',
        textDecoration: 'none',
        fontSize: '13px',
    },
    eyebrow: {
        color: '#64748b',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1.5px',
    },
    panel: {
        marginTop: '12px',
        padding: '30px',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        background: '#ffffff',
        boxShadow: '0 3px 12px rgba(15, 23, 42, 0.035)',
    },
    demoNotice: {
        padding: '14px 17px',
        marginBottom: '20px',
        border: '1px solid #fcd34d',
        borderRadius: '10px',
        background: '#fffbeb',
        color: '#92400e',
        fontSize: '12px',
        lineHeight: 1.7,
    },
    badges: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '8px',
    },
    badge: {
        padding: '7px 10px',
        borderRadius: '7px',
        background: '#e2e8f0',
        color: '#475569',
        fontSize: '11px',
        fontWeight: 600,
    },
    title: {
        margin: '22px 0 12px',
        fontSize: '28px',
        lineHeight: 1.35,
    },
    description: {
        color: '#64748b',
        lineHeight: 1.8,
        fontSize: '14px',
    },
    metadata: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '18px',
        padding: '22px 0',
        margin: '24px 0',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
    },
    metaLabel: {
        display: 'block',
        marginBottom: '8px',
        color: '#94a3b8',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '1px',
    },
    notice: {
        padding: '18px',
        marginBottom: '24px',
        borderRadius: '10px',
        background: '#f1f5f9',
        color: '#334155',
        fontSize: '13px',
        lineHeight: 1.7,
    },
    actionLink: {
        display: 'inline-block',
        padding: '11px 15px',
        borderRadius: '8px',
        background: '#1e293b',
        color: '#ffffff',
        textDecoration: 'none',
        fontSize: '13px',
        fontWeight: 600,
    },
};
