
import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DocumentParseResult } from '../lib/parser';
import { runModulePipeline } from '../lib/api/modulePipeline';
import { getAnalysisJob } from '../lib/api/analysisApi';

type Grade = 7 | 8 | 9;

const SUBJECTS = [
    'Bahasa Indonesia',
    'Bahasa Inggris',
    'Matematika',
    'IPA',
];

function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function TeacherModuleUploadPage() {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const requestId = useRef(0);

    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState(SUBJECTS[0]);
    const [grade, setGrade] = useState<Grade>(7);

    const [result, setResult] = useState<DocumentParseResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const [pipelineLoading, setPipelineLoading] = useState(false);
    const [pipelineError, setPipelineError] = useState('');
    const [recoveryJobId, setRecoveryJobId] = useState('');
    const [recoveryLoading, setRecoveryLoading] = useState(false);

    async function processFile(selectedFile?: File) {
        if (!selectedFile) return;

        const currentRequest = ++requestId.current;

        setFile(selectedFile);
        setResult(null);
        setError('');
        setPipelineError('');
        setLoading(true);

        if (!title.trim()) {
            setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
        }

        let parserApi: typeof import('../lib/parser') | undefined;

        try {
            // Parser dimuat hanya ketika guru memilih dokumen.
            parserApi = await import('../lib/parser');

            const parsed = await parserApi.parseDocument(selectedFile);

            if (currentRequest !== requestId.current) return;

            setResult(parsed);
        } catch (cause) {
            if (currentRequest !== requestId.current) return;

            if (
                parserApi &&
                parserApi.isDocumentParseError(cause)
            ) {
                setError(cause.message);
            } else {
                setError(
                    'Terjadi kesalahan ketika memproses dokumen. Silakan coba kembali.',
                );
            }
        } finally {
            if (currentRequest === requestId.current) {
                setLoading(false);
            }
        }
    }

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        void processFile(event.target.files?.[0]);
        event.target.value = '';
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setDragging(false);

        if (pipelineLoading || recoveryLoading) return;
        void processFile(event.dataTransfer.files?.[0]);
    }

    function removeFile() {
        requestId.current += 1;
        setFile(null);
        setResult(null);
        setError('');
        setPipelineError('');
        setLoading(false);
        setTitle('');
    }

    async function handleRecoverAnalysis() {
        const jobId = recoveryJobId.trim();

        if (!result || !jobId || recoveryLoading || pipelineLoading) return;

        setRecoveryLoading(true);
        setPipelineError('');

        try {
            // Recovery hanya mengambil analysis job yang sudah ada.
            // Fungsi ini tidak membuat module, snapshot, atau analysis job baru.
            const analysisJob = await getAnalysisJob(jobId);

            if (analysisJob.analysis_job_id !== jobId) {
                throw new Error('ID analysis job pada respons tidak sesuai.');
            }

            if (analysisJob.status !== 'completed') {
                const failureMessage = analysisJob.failure?.message;
                throw new Error(
                    analysisJob.status === 'failed'
                        ? `Analysis job gagal: ${failureMessage ?? analysisJob.failure?.code ?? 'Penyebab tidak tersedia.'}`
                        : `Analysis job belum selesai. Status saat ini: ${analysisJob.status}.`,
                );
            }

            if (!analysisJob.module_id || !analysisJob.text_version) {
                throw new Error(
                    'Respons analysis job tidak memiliki module_id atau text_version.',
                );
            }

            navigate('/teacher/modules/review', {
                state: {
                    title: title.trim() || result.filename,
                    subject,
                    grade,
                    parseResult: result,
                    pipelineResult: {
                        moduleId: analysisJob.module_id,
                        textVersion: analysisJob.text_version,
                        analysisJob,
                    },
                    dataMode: 'live',
                },
            });
        } catch (cause) {
            setPipelineError(
                cause instanceof Error
                    ? cause.message
                    : 'Gagal mengambil hasil Analyzer dari analysis job yang sudah ada.',
            );
        } finally {
            setRecoveryLoading(false);
        }
    }

    async function handleFinishReview() {
        if (!result || pipelineLoading || recoveryLoading) return;

        const reviewState = {
            title: title.trim() || result.filename,
            subject,
            grade,
            parseResult: result,
        };

        // Local demo keeps the existing review flow without calling Supabase.
        if (import.meta.env.VITE_DATA_MODE !== 'live') {
            navigate('/teacher/modules/review', {
                state: {
                    ...reviewState,
                    dataMode: 'mock',
                },
            });
            return;
        }

        setPipelineLoading(true);
        setPipelineError('');

        try {
            const pipelineResult = await runModulePipeline({
                title: reviewState.title,
                document: result,
            });

            navigate('/teacher/modules/review', {
                state: {
                    ...reviewState,
                    pipelineResult,
                    dataMode: 'live',
                },
            });
        } catch (cause) {
            setPipelineError(
                cause instanceof Error
                    ? cause.message
                    : 'Proses penyimpanan dan analisis gagal. Silakan coba kembali.',
            );
        } finally {
            setPipelineLoading(false);
        }
    }

    const referenceCount = result?.sourceMap.length ?? 0;

    return (
        <main style={styles.page}>
            <div style={styles.container}>
                <Link to="/teacher/modules" style={styles.backLink}>
                    ← Kembali ke katalog
                </Link>

                <header style={styles.header}>
                    <span style={styles.eyebrow}>RUANG GURU / MODUL</span>

                    <h1 style={styles.title}>Upload Modul Pembelajaran</h1>

                    <p style={styles.description}>
                        Unggah materi pembelajaran untuk diekstrak menjadi teks
                        dan dipersiapkan sebagai dasar analisis tujuan pembelajaran.
                    </p>
                </header>

                <section style={styles.panel}>
                    <h2 style={styles.sectionTitle}>
                        Informasi Modul
                    </h2>

                    <div style={styles.field}>
                        <label htmlFor="module-title" style={styles.label}>
                            Judul modul
                        </label>

                        <input
                            id="module-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Contoh: Teks Naratif Kelas VII"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.twoColumns}>
                        <div style={styles.field}>
                            <label htmlFor="module-subject" style={styles.label}>
                                Mata pelajaran
                            </label>

                            <select
                                id="module-subject"
                                value={subject}
                                onChange={(event) => setSubject(event.target.value)}
                                style={styles.input}
                            >
                                {SUBJECTS.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={styles.field}>
                            <label htmlFor="module-grade" style={styles.label}>
                                Tingkat kelas
                            </label>

                            <select
                                id="module-grade"
                                value={grade}
                                onChange={(event) =>
                                    setGrade(Number(event.target.value) as Grade)
                                }
                                style={styles.input}
                            >
                                <option value={7}>Kelas VII</option>
                                <option value={8}>Kelas VIII</option>
                                <option value={9}>Kelas IX</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section style={styles.panel}>
                    <h2 style={styles.sectionTitle}>
                        Dokumen Pembelajaran
                    </h2>

                    <div
                        style={{
                            ...styles.dropzone,
                            borderColor: dragging ? '#334155' : '#cbd5e1',
                            background: dragging ? '#f1f5f9' : '#ffffff',
                        }}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                    >
                        <div style={styles.uploadIcon}>↑</div>

                        <strong>Tarik dokumen ke sini</strong>

                        <p style={styles.muted}>
                            atau pilih dari perangkat
                        </p>

                        <button
                            type="button"
                            disabled={loading || pipelineLoading || recoveryLoading}
                            onClick={() => inputRef.current?.click()}
                            style={styles.secondaryButton}
                        >
                            Pilih Dokumen
                        </button>

                        <input
                            ref={inputRef}
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={handleFileChange}
                            disabled={loading || pipelineLoading || recoveryLoading}
                            style={{ display: 'none' }}
                        />

                        <p style={styles.fileHint}>
                            PDF maksimal 5 MB dan 20 halaman.
                            DOCX maksimal 5 MB.
                        </p>
                    </div>

                    {file && (
                        <div style={styles.fileCard}>
                            <div style={styles.fileIcon}>
                                {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX'}
                            </div>

                            <div style={styles.fileInfo}>
                                <strong>{file.name}</strong>
                                <span>{formatBytes(file.size)}</span>
                            </div>

                            <button
                                type="button"
                                onClick={removeFile}
                                style={styles.removeButton}
                                disabled={loading || pipelineLoading || recoveryLoading}
                            >
                                Hapus
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div role="status" style={styles.loading}>
                            <span style={styles.spinner}>◌</span>
                            <div>
                                <strong>Sedang memproses dokumen...</strong>
                                <p>Menjalankan parser PDF/DOCX di browser.</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div role="alert" style={styles.error}>
                            <strong>Dokumen tidak dapat diproses</strong>
                            <p>{error}</p>
                        </div>
                    )}
                </section>

                {result && (
                    <>
                        <section style={styles.resultPanel}>
                            <div style={styles.resultHeader}>
                                <div>
                                    <span style={styles.successLabel}>
                                        PARSING BERHASIL
                                    </span>
                                    <h2 style={styles.sectionTitle}>
                                        Hasil Ekstraksi Dokumen
                                    </h2>
                                </div>

                                <span style={styles.formatBadge}>
                                    {result.format.toUpperCase()}
                                </span>
                            </div>

                            <div style={styles.stats}>
                                <div style={styles.stat}>
                                    <span>Ukuran file</span>
                                    <strong>{formatBytes(result.sizeBytes)}</strong>
                                </div>

                                <div style={styles.stat}>
                                    <span>Referensi sumber</span>
                                    <strong>{referenceCount}</strong>
                                </div>

                                <div style={styles.stat}>
                                    <span>Panjang teks</span>
                                    <strong>
                                        {result.extractedText.length.toLocaleString('id-ID')} karakter
                                    </strong>
                                </div>
                            </div>

                            {result.metadata.pageCount !== undefined && (
                                <p style={styles.metadataText}>
                                    Jumlah halaman: {result.metadata.pageCount}
                                </p>
                            )}

                            {result.metadata.paragraphCount !== undefined && (
                                <p style={styles.metadataText}>
                                    Jumlah paragraf: {result.metadata.paragraphCount}
                                </p>
                            )}

                            {result.warnings.length > 0 && (
                                <div style={styles.warning}>
                                    <strong>Catatan parser</strong>

                                    {result.warnings.map((warning, index) => (
                                        <p key={`${index}-${warning}`}>{warning}</p>
                                    ))}
                                </div>
                            )}

                            <h3 style={styles.subheading}>Pratinjau teks</h3>

                            <pre style={styles.textPreview}>
                                {result.extractedText}
                            </pre>

                            <h3 style={styles.subheading}>
                                Referensi sumber ({referenceCount})
                            </h3>

                            <div style={styles.references}>
                                {result.sourceMap.slice(0, 20).map((reference) => (
                                    <article key={reference.id} style={styles.reference}>
                                        <div style={styles.referenceHeader}>
                                            <strong>{reference.id}</strong>

                                            <span>
                                                {reference.kind === 'page'
                                                    ? `Halaman ${reference.page}`
                                                    : `Paragraf ${reference.paragraphIndex}`}
                                            </span>
                                        </div>

                                        {reference.kind === 'paragraph' && reference.section && (
                                            <p style={styles.sectionName}>
                                                Bagian: {reference.section}
                                            </p>
                                        )}

                                        <p style={styles.referenceText}>
                                            {reference.text || '(Tidak ada teks pada bagian ini)'}
                                        </p>
                                    </article>
                                ))}
                            </div>

                            {referenceCount > 20 && (
                                <p style={styles.muted}>
                                    Menampilkan 20 dari {referenceCount} referensi sumber.
                                </p>
                            )}
                        </section>

                        <section style={styles.nextStep}>
                            <span style={styles.successLabel}>
                                TAHAP PARSING SELESAI
                            </span>

                            <h2>Dokumen siap ditinjau</h2>

                            <p>
                                Dokumen berhasil diekstrak. Hasil parsing dan peta sumber
                                tersedia di browser untuk disiapkan ke proses Learning
                                Objective Analyzer.
                            </p>

                            <p style={styles.metadataText}>
                                Document ID: {result.documentId}
                            </p>

                            <p style={styles.metadataText}>
                                Modul: {title || file?.name} | {subject} | Kelas {grade}
                            </p>

                            {pipelineError && (
                                <div role="alert" style={styles.error}>
                                    <strong>Proses analisis gagal</strong>
                                    <p>{pipelineError}</p>
                                </div>
                            )}

                            <button
                                type="button"
                                style={{
                                    ...styles.primaryButton,
                                    opacity: pipelineLoading || recoveryLoading ? 0.65 : 1,
                                    cursor: pipelineLoading || recoveryLoading ? 'wait' : 'pointer',
                                }}
                                disabled={pipelineLoading || recoveryLoading}
                                onClick={handleFinishReview}
                            >
                                {pipelineLoading ? 'Memproses Modul...' : 'Selesai Meninjau'}
                            </button>

                            {import.meta.env.DEV && import.meta.env.VITE_DATA_MODE === 'live' && (
                                <div style={styles.recoveryPanel}>
                                    <strong>Pulihkan hasil Analyzer yang sudah ada</strong>
                                    <p style={styles.recoveryDescription}>
                                        Gunakan ID analysis job yang sudah selesai dari PIC B.
                                        Fitur ini hanya mengambil hasil melalui GET dan tidak
                                        membuat modul, snapshot, atau job baru.
                                    </p>
                                    <label htmlFor="recovery-analysis-job-id" style={styles.label}>
                                        Analysis Job ID
                                    </label>
                                    <input
                                        id="recovery-analysis-job-id"
                                        type="text"
                                        value={recoveryJobId}
                                        onChange={(event) => setRecoveryJobId(event.target.value)}
                                        placeholder="Masukkan ID analysis job"
                                        autoComplete="off"
                                        spellCheck={false}
                                        style={styles.recoveryInput}
                                        disabled={recoveryLoading || pipelineLoading}
                                    />
                                    <button
                                        type="button"
                                        style={{
                                            ...styles.secondaryButton,
                                            opacity: recoveryLoading ? 0.65 : 1,
                                            cursor: recoveryLoading ? 'wait' : 'pointer',
                                        }}
                                        disabled={!recoveryJobId.trim() || recoveryLoading || pipelineLoading}
                                        onClick={handleRecoverAnalysis}
                                    >
                                        {recoveryLoading ? 'Mengambil hasil Analyzer...' : 'Ambil Hasil Analyzer'}
                                    </button>
                                </div>
                            )}
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
    header: {
        marginBottom: '28px',
    },
    eyebrow: {
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1.5px',
        color: '#64748b',
    },
    title: {
        fontSize: '30px',
        margin: '9px 0',
    },
    description: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: 1.7,
    },
    panel: {
        padding: '25px',
        marginBottom: '20px',
        border: '1px solid #e2e8f0',
        borderRadius: '13px',
        background: '#ffffff',
    },
    sectionTitle: {
        fontSize: '18px',
        margin: '0 0 20px',
    },
    field: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        marginBottom: '18px',
        flex: 1,
    },
    label: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#334155',
    },
    input: {
        width: '100%',
        boxSizing: 'border-box' as const,
        padding: '12px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        background: '#ffffff',
        fontSize: '14px',
    },
    twoColumns: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '18px',
    },
    dropzone: {
        padding: '36px 20px',
        border: '2px dashed #cbd5e1',
        borderRadius: '12px',
        textAlign: 'center' as const,
    },
    uploadIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '42px',
        height: '42px',
        margin: '0 auto 14px',
        borderRadius: '50%',
        background: '#e2e8f0',
        fontSize: '23px',
    },
    muted: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: 1.6,
    },
    secondaryButton: {
        padding: '10px 16px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        background: '#ffffff',
        cursor: 'pointer',
        fontWeight: 600,
    },
    fileHint: {
        color: '#94a3b8',
        fontSize: '11px',
        marginTop: '15px',
    },
    fileCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px',
        marginTop: '16px',
        border: '1px solid #e2e8f0',
        borderRadius: '9px',
    },
    fileIcon: {
        padding: '10px',
        borderRadius: '7px',
        background: '#e2e8f0',
        fontSize: '10px',
        fontWeight: 700,
    },
    fileInfo: {
        display: 'flex',
        flex: 1,
        flexDirection: 'column' as const,
        gap: '4px',
        minWidth: 0,
        overflowWrap: 'anywhere' as const,
        fontSize: '12px',
    },
    removeButton: {
        border: 'none',
        background: 'transparent',
        color: '#b91c1c',
        cursor: 'pointer',
        fontSize: '12px',
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '18px',
        marginTop: '16px',
        background: '#f1f5f9',
        borderRadius: '9px',
        fontSize: '13px',
    },
    spinner: {
        fontSize: '26px',
    },
    error: {
        padding: '15px',
        marginTop: '16px',
        borderRadius: '9px',
        background: '#fef2f2',
        color: '#b91c1c',
        fontSize: '13px',
    },
    resultPanel: {
        padding: '25px',
        marginBottom: '20px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '13px',
    },
    resultHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
    },
    successLabel: {
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1px',
        color: '#15803d',
    },
    formatBadge: {
        padding: '7px 11px',
        borderRadius: '7px',
        background: '#e2e8f0',
        fontWeight: 700,
        fontSize: '11px',
    },
    stats: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        margin: '18px 0',
    },
    stat: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '7px',
        padding: '15px',
        borderRadius: '9px',
        background: '#f8fafc',
        fontSize: '12px',
        color: '#64748b',
    },
    metadataText: {
        color: '#64748b',
        fontSize: '12px',
        overflowWrap: 'anywhere' as const,
    },
    warning: {
        padding: '15px',
        margin: '18px 0',
        borderRadius: '9px',
        background: '#fffbeb',
        color: '#92400e',
        fontSize: '12px',
    },
    subheading: {
        fontSize: '14px',
        margin: '25px 0 12px',
    },
    textPreview: {
        maxHeight: '400px',
        overflow: 'auto',
        padding: '17px',
        border: '1px solid #e2e8f0',
        borderRadius: '9px',
        background: '#f8fafc',
        fontFamily: 'inherit',
        fontSize: '13px',
        lineHeight: 1.8,
        whiteSpace: 'pre-wrap' as const,
        overflowWrap: 'anywhere' as const,
    },
    references: {
        display: 'grid',
        gap: '10px',
    },
    reference: {
        padding: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '9px',
    },
    referenceHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap' as const,
        gap: '8px',
        fontSize: '12px',
    },
    sectionName: {
        fontSize: '11px',
        color: '#64748b',
    },
    referenceText: {
        color: '#475569',
        fontSize: '12px',
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap' as const,
    },
    nextStep: {
        padding: '24px',
        marginTop: '20px',
        border: '1px solid #e2e8f0',
        borderRadius: '13px',
        background: '#ffffff',
    },
    primaryButton: {
        padding: '12px 18px',
        marginTop: '12px',
        border: 'none',
        borderRadius: '8px',
        background: '#1e293b',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    recoveryPanel: {
        marginTop: '22px',
        padding: '17px',
        border: '1px dashed #94a3b8',
        borderRadius: '9px',
        background: '#f8fafc',
    },
    recoveryDescription: {
        color: '#64748b',
        fontSize: '12px',
        lineHeight: 1.6,
    },
    recoveryInput: {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box' as const,
        marginTop: '8px',
        padding: '10px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        background: '#ffffff',
        color: '#172033',
        fontSize: '12px',
    },
};
