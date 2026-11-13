export type LearningAnalyzerErrorCode =
  | "INVALID_INPUT"
  | "NO_ANALYZABLE_TEXT"
  | "MODEL_CONFIGURATION_ERROR"
  | "MODEL_UNAVAILABLE"
  | "MODEL_TIMEOUT"
  | "MODEL_REQUEST_FAILED"
  | "MODEL_INVALID_RESPONSE";

export class LearningAnalyzerError extends Error {
  readonly code: LearningAnalyzerErrorCode;
  readonly retryable: boolean;
  readonly causeValue?: unknown;

  constructor(
    code: LearningAnalyzerErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "LearningAnalyzerError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.causeValue = options.cause;
  }
}

export function isLearningAnalyzerError(error: unknown): error is LearningAnalyzerError {
  return error instanceof LearningAnalyzerError;
}
