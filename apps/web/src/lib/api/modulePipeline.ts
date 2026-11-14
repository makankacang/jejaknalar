
import type { DocumentParseResult } from '../parser';
import { createTeacherModule, saveModuleSnapshot } from './moduleApi';
import {
    startModuleAnalysis,
    waitForAnalysisCompletion,
    type AnalysisJob,
} from './analysisApi';

export interface RunModulePipelineInput {
    title: string;
    document: DocumentParseResult;
}

export interface ModulePipelineResult {
    moduleId: string;
    textVersion: string;
    versionNo: number;
    analysisJob: AnalysisJob;
}

/**
 * Alur:
 * Create Module -> Save Snapshot -> Analyze -> Poll Job.
 *
 * Seluruh proses menggunakan Supabase Auth dan endpoint PIC B.
 */
export async function runModulePipeline(
    input: RunModulePipelineInput,
): Promise<ModulePipelineResult> {
    const module = await createTeacherModule({
        title: input.title,
        format: input.document.format,
    });

    const snapshot = await saveModuleSnapshot(
        module.moduleId,
        input.document,
    );

    const startedJob = await startModuleAnalysis(
        snapshot.moduleId,
        snapshot.textVersion,
    );

    const analysisJob = await waitForAnalysisCompletion(
        startedJob.analysis_job_id,
        {
            intervalMs: 2500,
            timeoutMs: 180000,
        },
    );

    return {
        moduleId: snapshot.moduleId,
        textVersion: snapshot.textVersion,
        versionNo: snapshot.versionNo,
        analysisJob,
    };
}
