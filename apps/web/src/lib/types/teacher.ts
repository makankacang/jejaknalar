/**
 * Teacher UI shared types — PIC A
 * Aligned with teacher-ui-architecture.md and contracts/api.openapi.yaml
 */

export interface SourceReference {
  type: 'page' | 'paragraph';
  value: number;
  section?: string;
  excerpt?: string;
}

export interface TeacherClass {
  id: string;
  name: string;
  grade: 7 | 8 | 9;
  classCode: string;
  studentCount: number;
  createdAt: string;
}

export interface TeacherModule {
  id: string;
  title: string;
  subject: string;
  grade: 7 | 8 | 9;
  format: 'builtin' | 'pdf' | 'docx';
  description: string;
}

export interface QuestDraft {
  draftId: string;
  questId: string;
  title: string;
  moduleId: string;
  status: 'draft' | 'approved' | 'published';
  objectiveIds: string[];
}

export interface ReportObjective {
  code: string;
  description: string;
  evidenceCount: number;
  status: string;
}

export interface ReportStudent {
  displayName: string;
  attempts: number;
  lastPath: string;
}

export interface TeacherReport {
  classId: string;
  objectives: ReportObjective[];
  students: ReportStudent[];
}