import type { TeacherModule } from '../types/teacher';

const BUILTIN_MODULES: TeacherModule[] = [
  {
    id: 'MODULE-BJ-VII-01',
    title: 'Bahasa Indonesia: BacaJejak Kelas VII',
    subject: 'Bahasa Indonesia',
    grade: 7,
    format: 'builtin',
    description:
      'Modul bawaan: membaca intensif dan menemukan bukti dalam teks naratif. Mencakup teks fiksi dan nonfiksi pilihan untuk Kelas VII.',
  },
];

interface ModuleFilters {
  grade?: number;
  subject?: string;
}

export class MockModuleRepository {
  async list(filters?: ModuleFilters): Promise<TeacherModule[]> {
    let result = structuredClone(BUILTIN_MODULES);
    if (filters?.grade !== undefined) {
      result = result.filter((m) => m.grade === filters.grade);
    }
    if (filters?.subject) {
      const q = filters.subject.toLowerCase();
      result = result.filter((m) => m.subject.toLowerCase().includes(q));
    }
    return result;
  }

  async getById(id: string): Promise<TeacherModule | null> {
    return BUILTIN_MODULES.find((m) => m.id === id) ?? null;
  }
}
