import { assessmentItem } from './assessment';
import type { WorldId } from './world';
export type TaskKind = 'observe' | 'operate' | 'investigate' | 'decide';
export type SourceRef = { document_id: string; text_version: string; source_map_id: string; excerpt: string; locator: { kind: 'docx_paragraph'; paragraph_index: number } | { kind: 'pdf_page'; page: number } };
export type MissionKind = 'main' | 'side' | 'support' | 'extension';
export type Task = { mission_kind: MissionKind; task_id: string; activity_id: string; objective_id: string; kind: TaskKind; title: string; prompt: string; source_refs: SourceRef[]; prerequisite: string[]; evidence_id: string; sections: string[]; options?: string[] };
export type Episode = { id: string; quest_version_id: string; world: WorldId; title: string; tasks: Record<string, Task>; fixture: true; intro?: { role: string; context: string; reason: string; first_step: string } };
const source = (world: WorldId, n: number, excerpt: string): SourceRef => ({ document_id: `D-FIXTURE-${world}`, text_version: '1', source_map_id: `P-${n}`, excerpt, locator: { kind: 'docx_paragraph', paragraph_index: n } });
export function fixture(world: WorldId): Episode {
  const school = world === 'school';
  const sections = school ? ['Juli: 80 kunjungan; Agustus: 125 kunjungan.', 'Klub baca berakhir 15.30.', 'Pendataan buku berlangsung 16.00–17.00.'] : ['Sabtu: 80 pengunjung pasar; Minggu: 125.', 'Kegiatan pedagang berakhir 15.30.', 'Pembersihan pasar berlangsung 16.00–17.00.'];
  const sources = sections.map((s, i) => source(world, i + 1, s));
  const task = (id: string, kind: TaskKind, title: string, prompt: string, prerequisite: string[], text = sections, options?: string[]): Task => ({ mission_kind: id === 'side' ? 'side' : id === 'support' ? 'support' : id === 'transfer' ? 'extension' : 'main', task_id: id, activity_id: `ACT-${world}-${id}`, objective_id: 'LO-BUKTI-DEMO', kind, title, prompt, prerequisite, source_refs: text === sections ? sources : text.map((s, i) => source(world, i + (id === 'operate' ? 10 : id === 'transfer' ? 20 : 30), s)), evidence_id: `EV-${world}-${id}`, sections: text, options });
  const episode: Episode = { id: `D-SPRINT2-EP01-${world}`, quest_version_id: `QV-D-SPRINT2-${world.toUpperCase()}-${world === 'city' ? '2' : '1'}`, world, fixture: true, title: school ? 'Misteri Lampu Sekolah' : 'Jejak Lampu Pasar', intro: school ? {
    role: 'Siswa yang diminta membantu Bu Rani memeriksa informasi sebelum disampaikan kepada warga sekolah.',
    context: 'Lampu perpustakaan dilaporkan menyala setelah kegiatan siswa berakhir. Beberapa orang langsung mengaitkannya dengan pengunjung perpustakaan.',
    reason: 'Kabar tersebut belum didukung kronologi lengkap. Keterangan buku tamu, jadwal petugas, dan simulasi energi harus diperiksa terlebih dahulu.',
    first_step: 'Mulai dari halaman sekolah. Temui Bu Rani, kemudian masuk ke koridor dan periksa buku tamu perpustakaan.'
  } : {
    role: 'Penjelajah kota yang membantu warga membaca informasi publik.',
    context: 'Ada laporan berbeda mengenai kegiatan pasar dan penggunaan fasilitas kota.',
    reason: 'Catatan perlu dibandingkan sebelum membuat pengumuman.',
    first_step: 'Temui pengurus di pusat kota dan periksa catatan kegiatan pasar.'
  }, tasks: {
    observe: task('observe', 'observe', 'Jejak dalam buku', 'Sorot ketiga bagian catatan. Perhatikan jumlah dan waktu.', []),
    operate: task('operate', 'operate', 'Panel lampu simulasi', 'Ubah sakelar dan durasi. Perhatikan perubahan konsumsi pada model contoh.', ['observe'], ['Model contoh: satu lampu 10 watt. Energi model = daya × waktu; hasil watt-jam dibagi 1000 untuk kWh. Ini simulasi, bukan pengukuran lokasi nyata.']),
    investigate: task('investigate', 'investigate', 'Periksa sumber', 'Buka kedua sumber, lalu pilih catatan yang paling langsung menguji siapa memakai lampu pukul 16.00.', ['observe'], sections, ['Jumlah pengunjung', 'Waktu selesai dan catatan petugas']),
    decide: task('decide', 'decide', 'Perbaiki pengumuman', 'Pilih klaim yang akan dipasang. Pertimbangkan batas bukti.', ['observe', 'operate', 'investigate'], sections, ['Pengunjung naik, maka mereka pasti boros listrik.', 'Catatan menunjukkan kegiatan petugas; kenaikan pengunjung belum membuktikan pemborosan.']),
    support: task('support', 'investigate', 'Meninjau bersama', 'Pisahkan jumlah pengunjung dari waktu kegiatan. Buka sumber lalu bandingkan kembali.', ['decide'], sections, ['Jumlah saja membuktikan pelaku', 'Waktu dan jenis kegiatan perlu dicocokkan']),
    transfer: task('transfer', 'decide', 'Kasus baru: lampu aula', 'Drama berakhir 17.00, petugas membersihkan aula 17.30–18.30, lampu terlihat 18.00. Apa langkah yang layak?', ['decide'], ['Catatan contoh baru: klub drama selesai 17.00; kebersihan 17.30–18.30; lampu terlihat menyala 18.00.'], ['Langsung menuduh klub drama', 'Periksa catatan kebersihan sebelum menuduh']),
    side: task('side', 'observe', 'Mengantar catatan', 'Periksa label titipan. Catatan menjadi item fisik; bawa kepada NPC mana pun.', [], ['Titipan contoh: lembar pengingat petugas. Bukan bukti penilaian.']),
  } };
  for (const id of ['decide', 'transfer'] as const) { const item = assessmentItem(id); episode.tasks[id].prompt=item.prompt;episode.tasks[id].options=item.options.map(o=>o.text);episode.tasks[id].objective_id=item.objectiveId; }
  // Entire episode's demo LO is the same as the reused existing public assessment fixture.
  for (const task of Object.values(episode.tasks)) task.objective_id='LO-BUKTI-01';
  return episode;
}
export const ENDINGS = { needs_support: 'Dibantu — Bersama petugas, kamu memperbaiki pengumuman dan menyusun langkah pemeriksaan berikutnya.', developing: 'Berkembang — Kamu merevisi keputusan setelah meninjau jejak baru. Warga menerima pengumuman yang lebih hati-hati.', ready_for_extension: 'Meluas — Kamu membawa kebiasaan memeriksa bukti ke kasus baru dan membantu lingkunganmu menghindari tuduhan tergesa-gesa.' };
