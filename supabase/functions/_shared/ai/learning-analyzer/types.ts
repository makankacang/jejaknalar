import type {
  DocumentParseResult,
  DocumentSourceReference,
} from "./document-types.ts";
import type { AIModel, AIModelRequest } from "../core/model.ts";
export type {
  DocumentFormat,
  DocumentParseResult,
  DocumentSourceReference,
} from "./document-types.ts";

export interface LearningAnalysisContext {
  grade?: 7 | 8 | 9;
  subject?: string;
  topic?: string;
  curriculum?: string;
}

/** Input internal PIC C. The API request envelope remains owned by PIC B. */
export interface LearningAnalysisInput {
  module_id: string;
  text_version: string;
  document: DocumentParseResult;
  context?: LearningAnalysisContext;
}

export type LearningObjectiveBasis = "explicit" | "inferred";
export type LearningAnalysisStatus = "completed" | "insufficient_evidence";

export type LearningObjectiveSourceReference =
  | {
    source_type: "pdf";
    source_map_id: string;
    page: number;
    excerpt: string;
  }
  | {
    source_type: "docx";
    source_map_id: string;
    paragraph_index: number;
    section?: string;
    excerpt: string;
  };

/** Draft objective only. PIC B assigns the persistent objective ID after saving. */
export interface LearningObjective {
  statement: string;
  basis: LearningObjectiveBasis;
  source_references: LearningObjectiveSourceReference[];
}

export type LearningAnalysisWarningCode =
  | "MODEL_WARNING"
  | "UNVERIFIED_EVIDENCE_REMOVED"
  | "DUPLICATE_OBJECTIVE_REMOVED"
  | "NO_SUPPORTED_OBJECTIVES";

export interface LearningAnalysisWarning {
  code: LearningAnalysisWarningCode;
  message: string;
}

export interface LearningAnalysisResult {
  analysis_schema_version: "1.0";
  module_id: string;
  document_id: string;
  text_version: string;
  status: LearningAnalysisStatus;
  objectives: LearningObjective[];
  warnings: LearningAnalysisWarning[];
}

/** Raw shape requested from the model. IDs and source metadata are resolved by application code. */
export interface RawLearningAnalyzerResponse {
  objectives: Array<{
    statement: string;
    basis: LearningObjectiveBasis;
    evidence: Array<{
      source_id: string;
      quote: string;
    }>;
  }>;
  warnings: string[];
}

/** Backwards-compatible C-02 names; new AI tasks should use AIModel directly. */
export type LearningAnalyzerModelRequest = AIModelRequest;
export type LearningAnalyzerModel = AIModel;

export type LearningAnalyzerSource = DocumentSourceReference;
