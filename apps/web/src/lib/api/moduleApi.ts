
import { getSupabaseClient } from '../supabase/client';
import type { DocumentParseResult } from '../parser';

export interface CreateTeacherModuleInput {
    title: string;
    format: DocumentParseResult['format'];
}

export interface CreateTeacherModuleResult {
    moduleId: string;
}

export interface SaveModuleSnapshotResult {
    moduleId: string;
    textVersion: string;
    versionNo: number;
}

/**
 * Membuat modul milik guru yang sedang login.
 *
 * Mengikuti kontrak PIC B:
 * public.modules (owner_uid, title, source_type).
 */
export async function createTeacherModule(
    input: CreateTeacherModuleInput,
): Promise<CreateTeacherModuleResult> {
    const title = input.title.trim();

    if (!title) {
        throw new Error('Judul modul wajib diisi.');
    }

    const supabase = getSupabaseClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
        throw new Error(`Gagal memverifikasi sesi guru: ${userError.message}`);
    }

    if (!user) {
        throw new Error('Sesi guru tidak ditemukan. Silakan login kembali.');
    }

    const { data, error } = await supabase
        .from('modules')
        .insert({
            owner_uid: user.id,
            title,
            source_type: input.format,
        })
        .select('id')
        .single();

    if (error) {
        throw new Error(`Gagal membuat modul: ${error.message}`);
    }

    if (!data?.id) {
        throw new Error('Backend tidak mengembalikan module_id.');
    }

    return {
        moduleId: data.id,
    };
}

/**
 * Menyimpan DocumentParseResult sebagai satu snapshot.
 *
 * Backend menetapkan text_version dan version_no.
 * Frontend tidak membuat identitas versi sendiri.
 */
export async function saveModuleSnapshot(
    moduleId: string,
    document: DocumentParseResult,
): Promise<SaveModuleSnapshotResult> {
    if (!moduleId.trim()) {
        throw new Error('module_id wajib diisi.');
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.functions.invoke(
        `api/modules/${encodeURIComponent(moduleId)}/text-versions`,
        {
            body: {
                document,
            },
        },
    );

    if (error) {
        throw new Error(`Gagal menyimpan snapshot: ${error.message}`);
    }

    const response = data as {
        ok?: boolean;
        data?: {
            module_id?: string;
            text_version?: string;
            version_no?: number;
        };
    } | null;

    if (!response?.ok || !response.data) {
        throw new Error('Respons penyimpanan snapshot tidak valid.');
    }

    const result = response.data;

    if (
        !result.module_id ||
        !result.text_version ||
        typeof result.version_no !== 'number'
    ) {
        throw new Error(
            'Respons backend tidak memiliki identitas snapshot yang lengkap.',
        );
    }

    if (result.module_id !== moduleId) {
        throw new Error('module_id pada respons tidak sesuai dengan permintaan.');
    }

    return {
        moduleId: result.module_id,
        textVersion: result.text_version,
        versionNo: result.version_no,
    };
}
