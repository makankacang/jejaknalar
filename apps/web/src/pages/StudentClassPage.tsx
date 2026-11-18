import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { pollAssessmentResult } from '../game/sprint2/assessment/assessment-polling';
import { StudentAssessmentApi, type OfficialAssessmentResult } from '../game/sprint2/backend-b05/assessment';
import { StudentCheckpointApi } from '../game/sprint2/backend-b05/checkpoint';
import { StudentApiClient, StudentApiError } from '../game/sprint2/backend-b05/client';
import { StudentQuestApi, type PublishedQuest } from '../game/sprint2/backend-b05/quest';
import { InMemoryStudentCredential, StudentSessionApi, type StudentIdentity } from '../game/sprint2/backend-b05/session';
import './student-class.css';

function createServices(credential: InMemoryStudentCredential) {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publicApiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publicApiKey) return null;
  try {
    const api = new StudentApiClient({
      baseUrl: `${url.replace(/\/$/, '')}/functions/v1/student-api`,
      accessCode: credential.get, publicApiKey,
    });
    return {
      sessions: new StudentSessionApi(api), quests: new StudentQuestApi(api),
      checkpoints: new StudentCheckpointApi(api), assessments: new StudentAssessmentApi(api),
    };
  } catch {
    return null;
  }
}

export default function StudentClassPage() {
  const [credential] = useState(() => new InMemoryStudentCredential());
  const [services] = useState(() => createServices(credential));
  const [identity, setIdentity] = useState<StudentIdentity | null>(null);
  const [joined, setJoined] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [published, setPublished] = useState<PublishedQuest | null>(null);
  const [checkpoint, setCheckpoint] = useState('');
  const [result, setResult] = useState<OfficialAssessmentResult | null>(null);
  const [waiting, setWaiting] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);
  const poll = useRef<AbortController | null>(null);

  useEffect(() => () => {
    poll.current?.abort();
    credential.clear();
  }, [credential]);

  if (!services) return <main className="jn-student-class">
    <h1>Masuk kelas</h1>
    <p role="status">Layanan kelas belum dikonfigurasi pada situs ini.</p>
    <Link to="/demo">Coba demo publik</Link>
  </main>;

  const leave = () => {
    credential.clear();
    setIdentity(null);
    setJoined(false);
    setShowCode(false);
    setPublished(null);
    setCheckpoint('');
    setResult(null);
  };
  const run = async (label: string, action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setError('');
    setWaiting(label);
    try {
      await action();
    } catch (cause) {
      if (cause instanceof StudentApiError && cause.status === 401) leave();
      setError(cause instanceof Error ? cause.message : 'Permintaan gagal. Silakan coba lagi.');
    } finally {
      busy.current = false;
      setWaiting('');
    }
  };
  const enter = (event: FormEvent<HTMLFormElement>, join: boolean) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void run('Memeriksa sesi…', async () => {
      if (join) {
        const created = await services.sessions.join(String(fields.get('classId')), String(fields.get('classCode')), String(fields.get('name')));
        credential.set(created.access_code);
        setJoined(true);
      } else {
        credential.set(String(fields.get('accessCode')));
      }
      setIdentity(await services.sessions.session());
    });
  };
  const loadCheckpoint = async (version: string) => {
    setCheckpoint('');
    try {
      const progress = await services.checkpoints.load(version);
      setCheckpoint(progress ? `Checkpoint tersedia. Revisi ${progress.revision}.` : 'Belum ada checkpoint.');
    } catch (cause) {
      if (cause instanceof StudentApiError && cause.status === 401) throw cause;
      setCheckpoint('Checkpoint belum dapat dimuat. Coba lagi.');
    }
  };
  const loadQuest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const version = String(new FormData(event.currentTarget).get('questVersion')).trim().toUpperCase();
    void run('Memuat quest terbit…', async () => {
      setPublished(null);
      setResult(null);
      setCheckpoint('');
      setPublished(await services.quests.load(version));
      await loadCheckpoint(version);
    });
  };
  const checkResult = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!published) return;
    const attemptId = String(new FormData(event.currentTarget).get('attemptId')).trim();
    const version = published.quest.quest_version_id;
    void run('Memeriksa hasil assessment…', async () => {
      setResult(null);
      const controller = new AbortController();
      poll.current = controller;
      try {
        await pollAssessmentResult({
          getResult: async id => {
            const current = await services.assessments.getResult(id, controller.signal);
            if (current.quest_version_id !== version) throw new Error('Attempt ini berasal dari versi quest lain.');
            if (!controller.signal.aborted) setResult(current);
            return current;
          },
        }, attemptId, { signal: controller.signal });
      } finally {
        poll.current = null;
      }
    });
  };

  return <main className="jn-student-class">
    <nav aria-label="Navigasi siswa"><Link to="/">Beranda</Link><Link to="/demo">Demo publik</Link></nav>
    <h1>Masuk kelas</h1>
    {error && <p role="alert">{error}</p>}
    {waiting && <p role="status">{waiting}</p>}
    {!identity ? <>
      {!joined && <form onSubmit={event => enter(event, true)}>
        <fieldset disabled={Boolean(waiting)}>
          <legend>Buat sesi siswa</legend>
          <label>ID kelas <input name="classId" required /></label>
          <label>Kode kelas <input name="classCode" required maxLength={8} /></label>
          <label>Nama tampilan <input name="name" required maxLength={80} /></label>
          <button type="submit">Gabung kelas</button>
        </fieldset>
      </form>}
      {joined && <button type="button" disabled={Boolean(waiting)} onClick={() => void run('Memeriksa sesi…', async () => setIdentity(await services.sessions.session()))}>Periksa sesi yang baru dibuat</button>}
      <form onSubmit={event => enter(event, false)}>
        <fieldset disabled={Boolean(waiting)}>
          <legend>Lanjutkan sesi</legend>
          <label>Kode akses siswa <input name="accessCode" type="password" autoComplete="off" required /></label>
          <button type="submit">Masuk dengan kode akses</button>
        </fieldset>
      </form>
    </> : <>
      <p>Sesi aktif untuk {identity.display_name}.</p>
      <button type="button" disabled={Boolean(waiting)} onClick={() => { leave(); setError(''); }}>Keluar sesi</button>
      {joined && <div>
        <button type="button" onClick={() => setShowCode(value => !value)}>{showCode ? 'Sembunyikan' : 'Tampilkan'} kode akses sesi</button>
        {showCode && <p>Simpan untuk masuk kembali <code>{credential.get()}</code></p>}
      </div>}
      <form onSubmit={loadQuest}>
        <fieldset disabled={Boolean(waiting)}>
          <legend>Quest kelas</legend>
          <label>ID versi quest <input name="questVersion" required placeholder="QV-…" /></label>
          <button type="submit">Muat quest terbit</button>
        </fieldset>
      </form>
      {published && <section aria-label="Quest terbit">
        <h2>{published.quest.quest_version_id}</h2>
        <p>Quest terbit terverifikasi untuk sesi ini. Konten permainan resmi belum tersedia melalui layanan siswa.</p>
        <p role="status">{checkpoint}</p>
        <button type="button" disabled={Boolean(waiting)} onClick={() => void run('Memuat checkpoint…', () => loadCheckpoint(published.quest.quest_version_id))}>Muat ulang checkpoint</button>
        <form onSubmit={checkResult}>
          <fieldset disabled={Boolean(waiting)}>
            <legend>Periksa attempt yang sudah dikirim</legend>
            <label>ID attempt <input name="attemptId" required /></label>
            <button type="submit">Periksa hasil</button>
          </fieldset>
        </form>
        {result && <p role="status">{result.status === 'scored'
          ? `Skor resmi ${result.score}/100.`
          : result.status === 'insufficient_evidence'
            ? 'Bukti belum cukup. Skor belum diberikan.'
            : 'Jawaban sedang menunggu penilaian.'}</p>}
      </section>}
    </>}
  </main>;
}
