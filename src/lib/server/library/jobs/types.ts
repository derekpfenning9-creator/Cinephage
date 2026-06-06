export const LIBRARY_JOB_TYPES = [
	'scan_root_folder',
	'scan_all_root_folders',
	'match_unmatched',
	'manual_import',
	'manual_bulk_import',
	'watcher_path_change'
] as const;

export type LibraryJobType = (typeof LIBRARY_JOB_TYPES)[number];

export const LIBRARY_JOB_STATUSES = [
	'queued',
	'running',
	'completed',
	'failed',
	'cancelled'
] as const;

export type LibraryJobStatus = (typeof LIBRARY_JOB_STATUSES)[number];

export interface EnqueueLibraryJobInput {
	type: LibraryJobType;
	rootFolderId?: string | null;
	parentJobId?: string | null;
	dedupeKey?: string | null;
	metadata?: Record<string, unknown>;
}
