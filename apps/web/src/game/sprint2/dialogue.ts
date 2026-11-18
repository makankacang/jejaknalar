/** Internal localization-friendly graph. Each choice terminates, so hints never trap the player. */
export type DialogueChoice = { id: 'library' | 'office' | 'deliver'; label: string; next: string; requires?: 'held_item'; effect: 'route_library' | 'route_office' | 'deliver_item' };
export type DialogueNode = { id: string; text: string; terminal: boolean; choices: DialogueChoice[] };
export const DIALOGUE: Record<string, DialogueNode> = {
  start: { id: 'start', text: 'Lampu masih menyala setelah kegiatan selesai. Mari periksa jejaknya sebelum menyebarkan tuduhan.', terminal: false, choices: [
    { id: 'library', label: 'Saya mulai dari buku pengamatan.', next: 'library_hint', effect: 'route_library' },
    { id: 'office', label: 'Di mana catatan petugas?', next: 'office_hint', effect: 'route_office' },
    { id: 'deliver', label: 'Serahkan titipan', next: 'thanks', effect: 'deliver_item', requires: 'held_item' },
  ] },
  library_hint: { id: 'library_hint', text: 'Mulailah dari buku pengamatan. Jangan menyimpulkan penyebab hanya dari jumlah pengunjung.', terminal: true, choices: [] },
  office_hint: { id: 'office_hint', text: 'Cari lokasi Bandingkan catatan melalui peta dan jurnal. Buka buku pengamatan dahulu untuk mengenali konteksnya.', terminal: true, choices: [] },
  thanks: { id: 'thanks', text: 'Terima kasih. Titipanmu sudah sampai.', terminal: true, choices: [] },
};
export function validateDialogue(graph: Record<string, DialogueNode>): boolean {
  if (!graph.start || Object.entries(graph).some(([id, n]) => n.id !== id || !n.text || n.terminal !== (n.choices.length === 0) || new Set(n.choices.map(c => c.id)).size !== n.choices.length)) return false;
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string): boolean { if (visiting.has(id) || !graph[id]) return false; if (visited.has(id)) return true; visiting.add(id); if (!graph[id].choices.every(c => visit(c.next))) return false; visiting.delete(id); visited.add(id); return true; }
  return visit('start') && visited.size === Object.keys(graph).length;
}
