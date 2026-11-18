/** Data PRESENTASI sintetis untuk DEMO Sprint 1; bukan keluaran AI dan bukan jawaban/rubrik. */
import { parseQuestV1, type QuestV1 } from '../sprint0/contract-v1';

export interface ReadingParagraph { id: string; text: string }
export interface SceneContent {
  sceneId: string;
  title: string;
  npc: { id: string; name: string; message: string; x: number; y: number };
  document: { id: string; title: string; paragraphs: ReadingParagraph[]; x: number; y: number };
  challenge: { itemId: string; prompt: string };
}

/** Sengaja tidak mengandung answer key, correct:true, rubric, atau bobot nilai. */
export const libraryScene: SceneContent = {
  sceneId: 'school_library',
  title: 'Misteri Perpustakaan: Temukan Bukti yang Hilang',
  npc: {
    id: 'NPC-LIBRARIAN', name: 'Bu Rani — Pustakawan', x: 160, y: 175,
    message: 'Halo, Penjelajah! Perpustakaan sedang meneliti mengapa jumlah kunjungan meningkat. Baca laporannya dan pilih kutipan yang mendukung kesimpulanmu.',
  },
  document: {
    id: 'DOC-001', title: 'Laporan Perpustakaan SMP Nusantara', x: 610, y: 170,
    paragraphs: [
      { id: 'P-001', text: 'Pada bulan Agustus, perpustakaan membuka program membaca bersama setiap Rabu setelah pulang sekolah.' },
      { id: 'P-002', text: 'Catatan kunjungan menunjukkan 80 kunjungan pada Juli dan 125 kunjungan pada Agustus.' },
      { id: 'P-003', text: 'Pengunjung juga dapat meminjam buku cerita, ensiklopedia, dan majalah sains.' },
    ],
  },
  challenge: {
    itemId: 'ITEM-001',
    prompt: 'Pilih satu kutipan laporan yang dapat kamu gunakan sebagai bukti untuk mendukung kesimpulan bahwa kunjungan perpustakaan meningkat pada Agustus.',
  },
};

/** Katalog scene terkurasi; belum ada API scene/passage resmi dari PIC C. */
const scenes: Record<string, SceneContent> = { school_library: libraryScene };

export function prepareEvidenceHunt(input: unknown): { quest: QuestV1; content: SceneContent } {
  const quest = parseQuestV1(input);
  const content = scenes[quest.scene_id];
  if (!content) throw new Error(`Scene tidak tersedia untuk scene_id ${quest.scene_id}`);
  const docRefs = quest.steps.filter(s => s.type === 'read_document').map(s => s.ref);
  const itemRefs = quest.steps.filter(s => s.type === 'select_evidence').map(s => s.item_id);
  if (!docRefs.includes(content.document.id)) throw new Error('Referensi dokumen tidak tersedia di scene');
  if (!itemRefs.includes(content.challenge.itemId)) throw new Error('Referensi assessment tidak tersedia di scene');
  if (!quest.steps.some(s => s.type === 'read_document') || !quest.steps.some(s => s.type === 'select_evidence')) {
    throw new Error('Evidence Hunt memerlukan langkah baca dokumen dan pilih bukti');
  }
  return { quest, content };
}

export const reasoningQuestions = [
  { id: 'ITEM-002', prompt: 'Inferensi: kesimpulan mana yang paling didukung laporan?', options: [
    { id: 'I-A', text: 'Kunjungan bertambah 45; data ini belum membuktikan program membaca sebagai satu-satunya penyebab.' },
    { id: 'I-B', text: 'Program membaca pasti satu-satunya penyebab kenaikan kunjungan.' },
    { id: 'I-C', text: 'Jumlah buku yang dipinjam pasti naik sebanyak 125.' },
  ] },
  { id: 'ITEM-003', prompt: 'Kasus transfer: klub sains mencatat 20 peserta pada September dan 30 pada Oktober. Poster mengklaim “semua siswa kini menyukai sains”. Kesimpulan mana yang dapat dibuktikan?', options: [
    { id: 'T-A', text: 'Semua siswa pasti menyukai sains karena poster menyatakannya.' },
    { id: 'T-B', text: 'Peserta bertambah 10; catatan kehadiran belum mewakili kesukaan semua siswa.' },
    { id: 'T-C', text: 'Jumlah peserta turun karena minat siswa berbeda-beda.' },
  ] },
] as const;

/** Public practice material on the SAME LO; a draft for PIC C/teacher review. */
export const practiceByPath = {
  needs_support: { title: 'Penguatan dengan langkah kecil', passage: 'Juli: 80 kunjungan. Agustus: 125 kunjungan.', guidance: '1. Temukan dua angka. 2. Bandingkan 125 dengan 80. 3. Pisahkan perubahan jumlah dari dugaan penyebab.' },
  developing: { title: 'Hubungkan bukti dan inferensi', passage: 'Program membaca dimulai pada Agustus. Kunjungan berubah dari 80 menjadi 125.', guidance: 'Dua peristiwa yang terjadi bersamaan belum tentu memiliki hubungan sebab-akibat. Jelaskan apa yang benar-benar tercatat.' },
  ready_for_extension: { title: 'Bandingkan dua sumber', passage: 'Catatan: peserta klub sains 20 lalu 30. Poster: semua siswa menyukai sains.', guidance: 'Bandingkan cakupan catatan angka dan klaim poster. Bukti tambahan apa yang dibutuhkan untuk menguji klaim semua siswa?' },
  need_more_evidence: { title: 'Tambahkan bukti pemahaman', passage: 'Kunjungan perpustakaan: 80 lalu 125. Peserta klub: 20 lalu 30.', guidance: 'Kerjakan tiga aktivitas: memilih bukti, menarik inferensi, dan menguji klaim pada konteks baru.' },
};
