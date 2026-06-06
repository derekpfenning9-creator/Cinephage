import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/auth/authorization.js';
import { libraryJobService } from '$lib/server/library/jobs/LibraryJobService.js';

export const GET: RequestHandler = async (event) => {
	const authError = requireAdmin(event);
	if (authError) return authError;

	const url = new URL(event.request.url);
	const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20)));
	const jobs = await libraryJobService.listRecentJobs(limit);
	return json({ success: true, jobs });
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAdmin(event);
	if (authError) return authError;
	const body = await event.request.json().catch(() => ({}));
	if (body.type === 'scan_root_folder' && typeof body.rootFolderId === 'string') {
		const job = await libraryJobService.enqueueRootFolderScan(body.rootFolderId);
		return json({ success: true, job });
	}
	if (body.type === 'scan_all_root_folders') {
		const job = await libraryJobService.enqueueFullScan();
		return json({ success: true, job });
	}
	return json({ success: false, error: 'Unsupported job type' }, { status: 400 });
};
