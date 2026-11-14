import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { DocumentParseResult, DocumentSourceReference } from '../lib/parser';
import type { AnalysisJob, AnalyzerObjective } from '../lib/api/analysisApi';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface PipelineResult {
    moduleId: string;
    textVersion: string;
    versionNo?: number;
    analysisJob: AnalysisJob;
}

interface ReviewState {
    title: string;
    subject: string;
    grade: 7 | 8 | 9;
    parseResult: DocumentParseResult;
    pipelineResult?: PipelineResult;
    dataMode?: 'mock' | 'live';
}

interface ReviewSource {
    id: string;
    label: string;
    text: string;
}

interface ReviewObjective {
    id: string;
    statement: string;
    basis: 'explicit' | 'inferred';
    sources: ReviewSource[];
    status: ReviewStatus;
}

function getSourceLabel(source: DocumentSourceReference): string {
    return source.kind === 'page'
        ? `Halaman ${source.page}`
        : `Paragraf ${source.paragraphIndex}`;
}

function mapAnalyzerObjective(
    objective: AnalyzerObjective,
    parseResult: DocumentParseResult,
): ReviewObjective {
    const sources = objective.source_references.map((reference) => {
        const mappedSource = parseResult.sourceMap.find(
            (source) => source.id === reference.source_map_id,
        );
        const label = mappedSource
            ? getSourceLabel(mappedSource)
            : reference.page !== undefined
                ? `Halaman ${reference.page}`
                : reference.paragraph_index !== undefined
                    ? `Paragraf ${reference.paragraph_index}`
                    : reference.source_type.toUpperCase();

        return {
            id: reference.source_map_id,
            label,
            text: reference.excerpt?.trim() || mappedSource?.text || 'Kutipan sumber tidak tersedia.',
        };
    });

    return {
        id: objective.id,
        statement: objective.statement,
        basis: objective.basis,
        sources,
        status: objective.review_status,
    };
}

function createDemoObjectives(parseResult: DocumentParseResult): ReviewObjective[] {
    const sources = parseResult.sourceMap.filter(
        (source) => source.text.trim().length > 0,
    );

    const toReviewSource = (source: DocumentSourceReference | undefined): ReviewSource | null =>
        source
            ? {
                id: source.id,
                label: getSourceLabel(source),
                text: source.text,
            }
            : null;

    return [
        {
            id: 'LO-DEMO-001',
            statement:
                'Siswa dapat mengidentifikasi informasi penting yang dinyatakan secara eksplisit dalam teks.',
            basis: 'explicit',
            sources: [toReviewSource(sources[0])].filter(
                (source): source is ReviewSource => source !== null,
            ),
            status: 'pending',
        },
        {
            id: 'LO-DEMO-002',
            statement:
                'Siswa dapat menyimpulkan makna tersirat berdasarkan konteks bacaan.',
            basis: 'inferred',
            sources: [toReviewSource(sources[1] ?? sources[0])].filter(
                (source): source is ReviewSource => source !== null,
            ),
            status: 'pending',
        },
    ];
}

export default function TeacherLearningObjectivesPage() {
    const location = useLocation();
    const reviewData = location.state as ReviewState | null;
    const parseResult = reviewData?.parseResult;
    const analysisJob = reviewData?.pipelineResult?.analysisJob;
    const isLiveResult = Boolean(analysisJob);

    const [objectives, setObjectives] = useState<ReviewObjective[]>(() => {
        if (!parseResult) return [];

        // Jangan mengganti hasil live yang kosong/gagal dengan objective contoh.
        if (analysisJob) {
            return analysisJob.status === 'completed'
                ? analysisJob.objectives.map((objective) =>
                    mapAnalyzerObjective(objective, parseResult),
                )
                : [];
        }

        return createDemoObjectives(parseResult);
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftText, setDraftText] = useState('');
    const [notice, setNotice] = useState('');

    const approvedCount = objectives.filter((item) => item.status === 'approved').length;
    const pendingCount = objectives.filter((item) => item.status === 'pending').length;
    const rejectedCount = objectives.filter((item) => item.status === 'rejected').length;

    function editObjective(objective: ReviewObjective) {
        setEditingId(objective.id);
        setDraftText(objective.statement);
        setNotice('');
    }

    function saveObjective(id: string) {
        if (!draftText.trim()) {
            setNotice('Pernyataan tujuan pembelajaran tidak boleh kosong.');
            return;
        }

        setObjectives((current) =>
            current.map((item) =>
                item.id === id
                    ? { ...item, statement: draftText.trim(), status: 'pending' }
                    : item,
            ),
        );
        setEditingId(null);
        setDraftText('');
        setNotice('Perubahan berhasil diterapkan pada sesi review ini.');
    }

    function updateStatus(id: string, status: ReviewStatus) {
        setObjectives((current) =>
            current.map((item) => (item.id === id ? { ...item, status } : item)),
        );
        setEditingId(null);
        setNotice(
            status === 'approved'
                ? 'Tujuan pembelajaran disetujui pada sesi review ini.'
                : status === 'rejected'
                    ? 'Tujuan pembelajaran ditolak pada sesi review ini.'
                    : 'Tujuan pembelajaran dikembalikan ke Pending.',
        );
    }

    if (!parseResult || !reviewData) {
        return (
            <main style={styles.page}>
                <div style={styles.container}>
                    <section style={styles.panel}>
                        <h1>Data pratinjau tidak tersedia</h1>
                        <p>
                            Silakan upload dan parsing dokumen terlebih dahulu. Hasil parsing
                            diteruskan melalui navigasi aplikasi.
                        </p>
                        <Link to="/teacher/modules/upload" style={styles.primaryLink}>
                            Kembali ke Upload Modul
                        </Link>
                    </section>
                </div>
            </main>
        );
    }

    const analyzerFailed = analysisJob?.status === 'failed';
    const insufficientEvidence = analysisJob?.result_status === 'insufficient_evidence';

    return (
        <main style={styles.page}>
            <div style={styles.container}>
                <Link to="/teacher/modules/upload" style={styles.backLink}>
                    &larr; Kembali ke Upload Modul
                </Link>

                <header style={styles.header}>
                    <span style={styles.eyebrow}>RUANG GURU / REVIEW</span>
                    <h1 style={styles.title}>Learning Objective Review</h1>
                    <p style={styles.description}>
                        Periksa dan tentukan tujuan pembelajaran yang akan menjadi dasar
                        pembuatan quest.
                    </p>
                </header>

                <section style={styles.documentCard}>
                    <div>
                        <span style={styles.metaLabel}>DOKUMEN</span>
                        <strong>{reviewData.title}</strong>
                        <p style={styles.muted}>
                            {reviewData.subject} · Kelas {reviewData.grade} ·{' '}
                            {parseResult.format.toUpperCase()}
                        </p>
                        <span style={styles.documentId}>{parseResult.documentId}</span>
                        {reviewData.pipelineResult && (
                            <p style={styles.pipelineMeta}>
                                Module ID: {reviewData.pipelineResult.moduleId}
                                <br />
                                Text version: {reviewData.pipelineResult.textVersion}
                                {reviewData.pipelineResult.versionNo !== undefined && (
                                    <> {' · '}Versi {reviewData.pipelineResult.versionNo}</>
                                )}
                            </p>
                        )}
                    </div>

                    <span style={isLiveResult ? styles.liveBadge : styles.demoBadge}>
                        {isLiveResult ? 'HASIL AI ANALYZER' : 'SIMULASI LO'}
                    </span>
                </section>

                <div style={isLiveResult ? styles.liveInfo : styles.disclaimer}>
                    <strong>{isLiveResult ? 'Hasil analisis live' : 'Mode demonstrasi'}</strong>
                    <p>
                        {isLiveResult
                            ? 'Objective di bawah berasal dari respons Learning Analyzer untuk snapshot dokumen ini. Perubahan review pada halaman ini masih bersifat lokal dan belum disimpan ke backend.'
                            : 'Pernyataan Learning Objective berikut merupakan data contoh untuk menguji antarmuka. Ini bukan hasil AI Analyzer. Referensi sumber diambil dari dokumen yang benar-benar diunggah.'}
                    </p>
                    {analysisJob && (
                        <p style={styles.jobMeta}>
                            Job: {analysisJob.analysis_job_id} · Status: {analysisJob.status}
                            {analysisJob.result_status
                                ? ` · Hasil: ${analysisJob.result_status}`
                                : ''}
                        </p>
                    )}
                </div>

                {analyzerFailed && (
                    <div role="alert" style={styles.errorNotice}>
                        <strong>Analisis gagal</strong>
                        <p>
                            {analysisJob?.failure?.message ??
                                'Analyzer tidak berhasil menyelesaikan proses.'}
                        </p>
                        {analysisJob?.failure && (
                            <small>
                                {analysisJob.failure.code}
                                {analysisJob.failure.retryable ? ' · Dapat dicoba ulang' : ''}
                            </small>
                        )}
                    </div>
                )}

                {insufficientEvidence && (
                    <div role="status" style={styles.warningNotice}>
                        <strong>Bukti belum mencukupi</strong>
                        <p>
                            Job Analyzer selesai, tetapi sistem menandai bukti yang tersedia
                            belum cukup untuk menghasilkan tujuan pembelajaran yang dapat
                            digunakan.
                        </p>
                    </div>
                )}

                {analysisJob?.warnings && analysisJob.warnings.length > 0 && (
                    <div style={styles.warningNotice}>
                        <strong>Catatan dari Analyzer</strong>
                        <ul style={styles.warningList}>
                            {analysisJob.warnings.map((warning, index) => {
                                const warningText =
                                    typeof warning === 'string'
                                        ? warning
                                        : `${warning.code}: ${warning.message}`;

                                return (
                                    <li key={`${index}-${warningText}`}>
                                        {warningText}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <section style={styles.summary}>
                    <div style={styles.summaryCard}>
                        <span>Total Objective</span>
                        <strong>{objectives.length}</strong>
                    </div>
                    <div style={styles.summaryCard}>
                        <span>Pending</span>
                        <strong>{pendingCount}</strong>
                    </div>
                    <div style={styles.summaryCard}>
                        <span>Approved</span>
                        <strong>{approvedCount}</strong>
                    </div>
                    <div style={styles.summaryCard}>
                        <span>Rejected</span>
                        <strong>{rejectedCount}</strong>
                    </div>
                </section>

                {notice && (
                    <div role="status" style={styles.notice}>
                        {notice}
                    </div>
                )}

                <div role="note" style={styles.reviewSimulationNotice}>
                    <strong>DEMO / SIMULASI — REVIEW BELUM TERSIMPAN</strong>
                    <p>
                        Edit, Approve, Reject, dan perubahan status di halaman ini hanya
                        mengubah tampilan pada sesi browser. Keputusan review belum dikirim
                        atau disimpan ke backend Supabase dan belum menjadi persetujuan resmi.
                    </p>
                </div>

                {objectives.length > 0 ? (
                    <section style={styles.objectiveList}>
                        {objectives.map((objective) => (
                            <article key={objective.id} style={styles.objectiveCard}>
                                <div style={styles.cardHeader}>
                                    <div>
                                        <strong style={styles.objectiveId}>{objective.id}</strong>
                                        <span style={styles.basisBadge}>
                                            {objective.basis === 'explicit' ? 'Eksplisit' : 'Inferensi'}
                                        </span>
                                    </div>
                                    <span
                                        style={{
                                            ...styles.statusBadge,
                                            ...(objective.status === 'approved'
                                                ? styles.approved
                                                : objective.status === 'rejected'
                                                    ? styles.rejected
                                                    : styles.pending),
                                        }}
                                    >
                                        {objective.status.toUpperCase()}
                                    </span>
                                </div>

                                {editingId === objective.id ? (
                                    <div style={styles.editor}>
                                        <label htmlFor={`edit-${objective.id}`}>
                                            Pernyataan tujuan pembelajaran
                                        </label>
                                        <textarea
                                            id={`edit-${objective.id}`}
                                            value={draftText}
                                            onChange={(event) => setDraftText(event.target.value)}
                                            rows={4}
                                            style={styles.textarea}
                                        />
                                        <div style={styles.actionRow}>
                                            <button
                                                type="button"
                                                style={styles.secondaryButton}
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setDraftText('');
                                                }}
                                            >
                                                Batal
                                            </button>
                                            <button
                                                type="button"
                                                style={styles.primaryButton}
                                                onClick={() => saveObjective(objective.id)}
                                            >
                                                Simpan Perubahan
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={styles.statement}>{objective.statement}</p>
                                )}

                                {objective.sources.length > 0 && (
                                    <div style={styles.sourceList}>
                                        {objective.sources.map((source, index) => (
                                            <div
                                                key={`${source.id}-${index}`}
                                                style={styles.sourceBox}
                                            >
                                                <div style={styles.sourceHeader}>
                                                    <strong>
                                                        Referensi Bukti {index + 1}
                                                    </strong>
                                                    <span>
                                                        {source.id} · {source.label}
                                                    </span>
                                                </div>
                                                <p style={styles.sourceText}>{source.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={styles.actionRow}>
                                    <button
                                        type="button"
                                        style={styles.secondaryButton}
                                        onClick={() => editObjective(objective)}
                                        disabled={editingId === objective.id}
                                    >
                                        Edit (DEMO)
                                    </button>
                                    {objective.status === 'rejected' ? (
                                        <button
                                            type="button"
                                            style={styles.secondaryButton}
                                            onClick={() => updateStatus(objective.id, 'pending')}
                                        >
                                            Kembalikan ke Pending (DEMO)
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                style={styles.rejectButton}
                                                onClick={() =>
                                                    updateStatus(objective.id, 'rejected')
                                                }
                                                disabled={editingId === objective.id}
                                            >
                                                Reject (DEMO)
                                            </button>
                                            <button
                                                type="button"
                                                style={styles.approveButton}
                                                onClick={() =>
                                                    updateStatus(objective.id, 'approved')
                                                }
                                                disabled={editingId === objective.id}
                                            >
                                                Approve (DEMO)
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        ))}
                    </section>
                ) : (
                    <section style={styles.emptyState}>
                        <h2>
                            {analyzerFailed
                                ? 'Objective belum dapat ditampilkan'
                                : isLiveResult
                                    ? 'Belum ada objective yang dapat direview'
                                    : 'Objective belum tersedia'}
                        </h2>
                        <p>
                            {analyzerFailed
                                ? 'Periksa detail kegagalan Analyzer di atas sebelum menjalankan proses analisis kembali.'
                                : isLiveResult
                                    ? 'Periksa catatan dan status hasil Analyzer. Halaman ini tidak membuat objective contoh untuk menggantikan hasil live yang kosong.'
                                    : 'Dokumen belum memiliki data objective untuk ditampilkan.'}
                        </p>
                    </section>
                )}

                <section style={styles.footer}>
                    <h2>Ringkasan Review</h2>
                    <p>
                        {approvedCount} dari {objectives.length} objective telah disetujui.
                    </p>
                    <button
                        type="button"
                        style={styles.primaryButton}
                        disabled={approvedCount === 0}
                        onClick={() =>
                            setNotice(
                                isLiveResult
                                    ? 'Review selesai untuk sesi ini. Status approval belum dikirim atau disimpan ke backend.'
                                    : 'Review demonstrasi selesai. Approval belum disimpan ke backend.',
                            )
                        }
                    >
                        Selesai Review
                    </button>
                </section>
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
    container: { maxWidth: '900px', margin: '0 auto' },
    backLink: {
        display: 'block',
        marginBottom: '25px',
        color: '#475569',
        textDecoration: 'none',
        fontSize: '13px',
    },
    header: { marginBottom: '24px' },
    eyebrow: {
        color: '#64748b',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1.5px',
    },
    title: { fontSize: '30px', margin: '9px 0' },
    description: { color: '#64748b', fontSize: '14px', lineHeight: 1.7 },
    panel: {
        padding: '26px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '13px',
    },
    documentCard: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap' as const,
        gap: '14px',
        padding: '18px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '11px',
    },
    metaLabel: {
        display: 'block',
        marginBottom: '7px',
        color: '#94a3b8',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '1px',
    },
    muted: { margin: '7px 0', color: '#64748b', fontSize: '12px' },
    documentId: { color: '#94a3b8', fontSize: '10px' },
    pipelineMeta: { color: '#64748b', fontSize: '10px', lineHeight: 1.7, marginBottom: 0 },
    demoBadge: {
        padding: '7px 10px',
        borderRadius: '7px',
        background: '#fef3c7',
        color: '#92400e',
        fontSize: '10px',
        fontWeight: 700,
    },
    liveBadge: {
        padding: '7px 10px',
        borderRadius: '7px',
        background: '#dcfce7',
        color: '#166534',
        fontSize: '10px',
        fontWeight: 700,
    },
    disclaimer: {
        padding: '15px 17px',
        marginTop: '16px',
        background: '#fffbeb',
        color: '#92400e',
        borderRadius: '9px',
        fontSize: '12px',
        lineHeight: 1.7,
    },
    liveInfo: {
        padding: '15px 17px',
        marginTop: '16px',
        background: '#eff6ff',
        color: '#1e40af',
        borderRadius: '9px',
        fontSize: '12px',
        lineHeight: 1.7,
    },
    reviewSimulationNotice: {
        padding: '14px 17px',
        marginTop: '16px',
        border: '1px solid #fcd34d',
        borderRadius: '9px',
        background: '#fffbeb',
        color: '#92400e',
        fontSize: '12px',
        lineHeight: 1.7,
    },
    jobMeta: { marginBottom: 0, fontSize: '10px', overflowWrap: 'anywhere' as const },
    errorNotice: {
        padding: '15px 17px',
        marginTop: '14px',
        background: '#fef2f2',
        color: '#991b1b',
        borderRadius: '9px',
        fontSize: '12px',
        lineHeight: 1.7,
    },
    warningNotice: {
        padding: '15px 17px',
        marginTop: '14px',
        background: '#fffbeb',
        color: '#92400e',
        borderRadius: '9px',
        fontSize: '12px',
        lineHeight: 1.7,
    },
    warningList: { marginBottom: 0, paddingLeft: '19px' },
    summary: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
        gap: '12px',
        margin: '20px 0',
    },
    summaryCard: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        padding: '16px',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        background: '#ffffff',
        color: '#64748b',
        fontSize: '12px',
    },
    notice: {
        padding: '13px 15px',
        marginBottom: '16px',
        borderRadius: '8px',
        background: '#f1f5f9',
        color: '#334155',
        fontSize: '13px',
    },
    objectiveList: { display: 'grid', gap: '15px' },
    objectiveCard: {
        padding: '21px',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        background: '#ffffff',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
        gap: '10px',
    },
    objectiveId: { marginRight: '9px', color: '#475569', fontSize: '12px' },
    basisBadge: {
        padding: '5px 8px',
        borderRadius: '6px',
        background: '#e2e8f0',
        color: '#475569',
        fontSize: '10px',
    },
    statusBadge: { padding: '6px 9px', borderRadius: '7px', fontSize: '10px', fontWeight: 700 },
    approved: { background: '#dcfce7', color: '#166534' },
    rejected: { background: '#fee2e2', color: '#991b1b' },
    pending: { background: '#fef3c7', color: '#92400e' },
    statement: { margin: '17px 0', fontSize: '15px', lineHeight: 1.7, fontWeight: 600 },
    sourceList: { display: 'grid', gap: '9px' },
    sourceBox: {
        padding: '14px',
        borderRadius: '8px',
        background: '#f8fafc',
        fontSize: '12px',
        lineHeight: 1.7,
    },
    sourceHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap' as const,
        gap: '10px',
        color: '#475569',
    },
    sourceText: { color: '#64748b', whiteSpace: 'pre-wrap' as const },
    editor: { marginTop: '17px' },
    textarea: {
        width: '100%',
        boxSizing: 'border-box' as const,
        marginTop: '8px',
        padding: '12px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        font: 'inherit',
        lineHeight: 1.6,
    },
    actionRow: {
        display: 'flex',
        justifyContent: 'flex-end',
        flexWrap: 'wrap' as const,
        gap: '9px',
        marginTop: '16px',
    },
    secondaryButton: {
        padding: '9px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        background: '#ffffff',
        color: '#334155',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    primaryButton: {
        padding: '10px 14px',
        border: 'none',
        borderRadius: '8px',
        background: '#1e293b',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    rejectButton: {
        padding: '9px 12px',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        background: '#fff7f7',
        color: '#b91c1c',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    approveButton: {
        padding: '9px 12px',
        border: 'none',
        borderRadius: '8px',
        background: '#166534',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    emptyState: {
        padding: '24px',
        border: '1px dashed #cbd5e1',
        borderRadius: '12px',
        background: '#ffffff',
        color: '#475569',
        lineHeight: 1.7,
    },
    footer: {
        padding: '23px',
        marginTop: '20px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
    },
    primaryLink: {
        display: 'inline-block',
        padding: '10px 14px',
        marginTop: '10px',
        borderRadius: '8px',
        background: '#1e293b',
        color: '#ffffff',
        textDecoration: 'none',
    },
};
