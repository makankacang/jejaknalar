import type { TeacherClass } from '../types/teacher';

const DEMO_CLASSES: TeacherClass[] = [
  {
    id: '00000000-0000-4000-8000-000000000010',
    name: 'Kelas VII A - Demo',
    grade: 7,
    classCode: 'DEMO01',
    studentCount: 1,
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Kelas VII B',
    grade: 7,
    classCode: 'CLSB02',
    studentCount: 0,
    createdAt: '2026-11-02T00:00:00Z',
  },
];

const MOCK_CLASSES: TeacherClass[] = structuredClone(DEMO_CLASSES);
function createMockUuid(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === 'x' ? random : (random & 0x3) | 0x8;

      return value.toString(16);
    },
  );
}

function createClassCode(existingClasses: TeacherClass[]): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let code: string;

  do {
    code = Array.from(
      { length: 6 },
      () => characters[Math.floor(Math.random() * characters.length)],
    ).join('');
  } while (existingClasses.some((item) => item.classCode === code));

  return code;
}

export class MockClassRepository {
  async list(): Promise<TeacherClass[]> {
    return structuredClone(MOCK_CLASSES);
  }

  async getById(id: string): Promise<TeacherClass | null> {
    const found = MOCK_CLASSES.find((item) => item.id === id);

    return found ? structuredClone(found) : null;
  }

  async create(
    name: string,
    grade: 7 | 8 | 9,
  ): Promise<TeacherClass> {
    const newClass: TeacherClass = {
      id: createMockUuid(),
      name: name.trim(),
      grade,
      classCode: createClassCode(MOCK_CLASSES),
      studentCount: 0,
      createdAt: new Date().toISOString(),
    };

    MOCK_CLASSES.push(newClass);

    return structuredClone(newClass);
  }
}