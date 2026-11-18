import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MockModuleRepository } from '../lib/mocks/moduleRepository';
import type { TeacherModule } from '../lib/types/teacher';

const repository = new MockModuleRepository();

const formatLabels: Record<TeacherModule['format'], string> = {
    builtin: 'Modul bawaan',
    pdf: 'Dokumen PDF',
    docx: 'Dokumen DOCX',
};

export default function TeacherModulesPage() {
    const [modules, setModules] = useState<TeacherModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [grade, setGrade] = useState('all');

    useEffect(() => {
        let active = true;

        repository
            .list()
            .then((data) => {
                if (active) setModules(data);
            })
            .catch(() => {
                if (active) setError('Gagal memuat katalog modul.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const filteredModules = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return modules.filter((module) => {
            const matchesGrade =
                grade === 'all' || module.grade === Number(grade);

            const matchesSearch =
                !keyword ||
                module.title.toLowerCase().includes(keyword) ||
                module.subject.toLowerCase().includes(keyword) ||
                module.description.toLowerCase().includes(keyword);

            return matchesGrade && matchesSearch;
        });
    }, [modules, search, grade]);

    return (
        <main style={styles.page}>
            <div style={styles.container}>
                <div style={styles.breadcrumb}>
                    <Link to="/teacher" style={styles.breadcrumbLink}>
                        Dashboard
                    </Link>
                    <span>/</span>
                    <span>Katalog Modul</span>
                </div>

                <header style={styles.header}>
                    <div>
                        <span style={styles.eyebrow}>RUANG GURU</span>
                        <h1 style={styles.title}>Katalog Modul</h1>
                        <p style={styles.subtitle}>
                            Pilih materi pembelajaran yang ingin kamu kembangkan menjadi
                            pengalaman belajar berbasis quest.
                        </p>
                    </div>

                    <div style={styles.headerActions}>
                        <Link
                            to="/teacher/modules/upload"
                            style={styles.uploadLink}
                        >
                            + Upload Modul
                        </Link>
                        <span style={styles.moduleCount}>
                            {modules.length} modul tersedia
                        </span>
                    </div>
                </header>

                <div role="note" style={styles.demoNotice}>
                    <strong>DEMO / DATA SIMULASI</strong>
                    <p>
                        Katalog ini masih menggunakan MockModuleRepository.
                        Modul yang ditampilkan merupakan data demonstrasi,
                        bukan daftar modul live dari Supabase Staging.
                    </p>
                </div>

                <section style={styles.toolbar}>
                    <div style={styles.searchWrapper}>
                        <label htmlFor="module-search" style={styles.srOnly}>
                            Cari modul
                        </label>
                        <input
                            id="module-search"
                            type="search"
                            placeholder="Cari judul, mata pelajaran, atau materi..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            style={styles.searchInput}
                        />
                    </div>

                    <div style={styles.filterWrapper}>
                        <label htmlFor="grade-filter" style={styles.filterLabel}>
                            Kelas
                        </label>
                        <select
                            id="grade-filter"
                            value={grade}
                            onChange={(event) => setGrade(event.target.value)}
                            style={styles.select}
                        >
                            <option value="all">Semua kelas</option>
                            <option value="7">Kelas VII</option>
                            <option value="8">Kelas VIII</option>
                            <option value="9">Kelas IX</option>
                        </select>
                    </div>
                </section>

                {loading && (
                    <div style={styles.message}>Memuat katalog modul...</div>
                )}

                {!loading && error && (
                    <div role="alert" style={styles.error}>
                        {error}
                    </div>
                )}

                {!loading && !error && filteredModules.length > 0 && (
                    <section style={styles.grid}>
                        {filteredModules.map((module) => (
                            <article key={module.id} style={styles.card}>
                                <div style={styles.cardTop}>
                                    <span style={styles.subjectBadge}>{module.subject}</span>
                                    <span style={styles.formatBadge}>
                                        {formatLabels[module.format]}
                                    </span>
                                </div>

                                <div>
                                    <p style={styles.gradeText}>KELAS {module.grade}</p>
                                    <h2 style={styles.cardTitle}>{module.title}</h2>
                                    <p style={styles.cardDescription}>
                                        {module.description}
                                    </p>
                                </div>

                                <div style={styles.cardFooter}>
                                    <span style={styles.cardId}>{module.id}</span>
                                    <Link
                                        to={`/teacher/modules/${encodeURIComponent(module.id)}/preview`}
                                        style={styles.primaryLink}
                                    >
                                        Lihat modul <span aria-hidden="true">→</span>
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </section>
                )}

                {!loading && !error && filteredModules.length === 0 && (
                    <div style={styles.emptyState}>
                        <h2 style={styles.emptyTitle}>Modul tidak ditemukan</h2>
                        <p style={styles.subtitle}>
                            Coba ubah kata kunci pencarian atau filter kelas.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setGrade('all');
                            }}
                            style={styles.secondaryButton}
                        >
                            Reset filter
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}

const styles = {
    page: {
        minHeight: 'calc(100vh - 64px)',
        padding: '36px 24px 64px',
        background: 'var(--jn-color-cream)',
        color: 'var(--jn-text-primary)',
    },
    container: {
        maxWidth: '1120px',
        margin: '0 auto',
    },
    breadcrumb: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: 'var(--jn-color-muted)',
        fontSize: '13px',
        marginBottom: '28px',
    },
    breadcrumbLink: {
        color: 'var(--jn-text-secondary)',
        textDecoration: 'none',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '20px',
        flexWrap: 'wrap' as const,
        marginBottom: '28px',
    },
    eyebrow: {
        color: 'var(--jn-text-secondary)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1.5px',
    },
    title: {
        fontSize: '32px',
        lineHeight: 1.2,
        margin: '8px 0',
        fontWeight: 750,
    },
    subtitle: {
        color: 'var(--jn-text-secondary)',
        lineHeight: 1.7,
        margin: 0,
        maxWidth: '620px',
        fontSize: '14px',
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
    },
    moduleCount: {
        padding: '8px 12px',
        borderRadius: '999px',
        background: 'var(--jn-border-default)',
        color: 'var(--jn-text-secondary)',
        fontSize: '12px',
        fontWeight: 600,
    },
    demoNotice: {
        padding: '14px 17px',
        marginBottom: '20px',
        border: '1px solid var(--jn-border-accent)',
        borderRadius: '10px',
        background: 'var(--jn-status-warning-bg)',
        color: 'var(--jn-status-warning-text)',
        fontSize: '12px',
        lineHeight: 1.7,
    },
    toolbar: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap' as const,
        marginBottom: '24px',
    },
    searchWrapper: {
        flex: '1 1 300px',
    },
    searchInput: {
        width: '100%',
        boxSizing: 'border-box' as const,
        padding: '12px 14px',
        border: '1px solid var(--jn-border-default)',
        borderRadius: '10px',
        background: 'var(--jn-surface-card)',
        fontSize: '14px',
        outlineColor: 'var(--jn-text-secondary)',
    },
    filterWrapper: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    filterLabel: {
        color: 'var(--jn-text-secondary)',
        fontSize: '13px',
    },
    select: {
        padding: '12px 14px',
        border: '1px solid var(--jn-border-default)',
        borderRadius: '10px',
        background: 'var(--jn-surface-card)',
        color: 'var(--jn-text-primary)',
        fontSize: '14px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '18px',
    },
    card: {
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        gap: '22px',
        padding: '22px',
        border: '1px solid var(--jn-border-default)',
        borderRadius: '14px',
        background: 'var(--jn-surface-card)',
        boxShadow: '0 3px 12px rgba(15, 23, 42, 0.035)',
    },
    cardTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap' as const,
    },
    subjectBadge: {
        color: 'var(--jn-color-primary-medium)',
        background: 'var(--jn-border-default)',
        padding: '6px 9px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
    },
    formatBadge: {
        color: 'var(--jn-text-secondary)',
        fontSize: '11px',
    },
    gradeText: {
        color: 'var(--jn-text-secondary)',
        fontWeight: 700,
        letterSpacing: '1px',
        fontSize: '10px',
        margin: '0 0 8px',
    },
    cardTitle: {
        fontSize: '18px',
        lineHeight: 1.45,
        margin: '0 0 10px',
    },
    cardDescription: {
        color: 'var(--jn-text-secondary)',
        fontSize: '13px',
        lineHeight: 1.7,
        margin: 0,
    },
    cardFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap' as const,
        paddingTop: '16px',
        borderTop: '1px solid var(--jn-color-cream)',
    },
    cardId: {
        color: 'var(--jn-color-muted)',
        fontSize: '10px',
    },
    primaryLink: {
        color: 'var(--jn-surface-card)',
        background: 'var(--jn-color-primary-dark)',
        borderRadius: '8px',
        padding: '9px 12px',
        textDecoration: 'none',
        fontSize: '12px',
        fontWeight: 600,
    },
    message: {
        padding: '36px',
        textAlign: 'center' as const,
        color: 'var(--jn-text-secondary)',
    },
    error: {
        padding: '16px',
        borderRadius: '10px',
        background: 'var(--jn-status-error-bg)',
        color: 'var(--jn-status-error-text)',
    },
    emptyState: {
        padding: '56px 20px',
        border: '1px dashed var(--jn-border-default)',
        borderRadius: '14px',
        background: 'var(--jn-surface-card)',
        textAlign: 'center' as const,
    },
    emptyTitle: {
        fontSize: '18px',
        margin: '0 0 8px',
    },
    secondaryButton: {
        marginTop: '18px',
        padding: '10px 14px',
        border: '1px solid var(--jn-border-default)',
        borderRadius: '8px',
        background: 'var(--jn-surface-card)',
        cursor: 'pointer',
        fontWeight: 600,
    },
    srOnly: {
        position: 'absolute' as const,
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden' as const,
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap' as const,
        border: 0,
    },
    uploadLink: {
        padding: '9px 13px',
        borderRadius: '8px',
        background: 'var(--jn-color-primary-dark)',
        color: 'var(--jn-surface-card)',
        textDecoration: 'none',
        fontSize: '12px',
        fontWeight: 600,
    },
};