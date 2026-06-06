import type { RequestHandler } from './$types.js';
import { createSSEStream } from '$lib/server/sse';
import { manualImportQueueService } from '$lib/server/library/ManualImportQueueService.js';
import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/authorization.js';

export const GET: RequestHandler = async (event) => {
	const authError = requireAdmin(event);
	if (authError) return authError;

	const { request } = event;
	const url = new URL(request.url);
	const jobId = url.searchParams.get('jobId');
	const acceptHeader = request.headers.get('accept');
	const wantsSSE = acceptHeader?.includes('text/event-stream');

	if (!jobId) {
		if (wantsSSE) {
			return createSSEStream((send) => {
				send('error', { message: 'jobId query parameter is required' });
				return () => {};
			});
		}
		return json({ success: false, error: 'jobId query parameter is required' }, { status: 400 });
	}

	if (wantsSSE) {
		return createSSEStream(async (send) => {
			const currentProgress = manualImportQueueService.getProgress(jobId);
			if (currentProgress) {
				send('progress', currentProgress);
			} else {
				const pendingMessage = {
					jobId,
					status: 'completed',
					total: 0,
					completed: 0,
					failed: 0,
					errors: []
				};
				send('progress', pendingMessage);
				send('batch:complete', pendingMessage);
				return () => {};
			}

			const onGroupStart = (data: unknown) => {
				if ((data as { jobId: string }).jobId !== jobId) return;
				send('group:start', data);
			};

			const onGroupComplete = (data: unknown) => {
				if ((data as { jobId: string }).jobId !== jobId) return;
				send('group:complete', data);
			};

			const onGroupError = (data: unknown) => {
				if ((data as { jobId: string }).jobId !== jobId) return;
				send('group:error', data);
			};

			const onBatchComplete = (data: unknown) => {
				if ((data as { jobId: string }).jobId !== jobId) return;
				send('batch:complete', data);
			};

			manualImportQueueService.on('group:start', onGroupStart);
			manualImportQueueService.on('group:complete', onGroupComplete);
			manualImportQueueService.on('group:error', onGroupError);
			manualImportQueueService.on('batch:complete', onBatchComplete);

			return () => {
				manualImportQueueService.off('group:start', onGroupStart);
				manualImportQueueService.off('group:complete', onGroupComplete);
				manualImportQueueService.off('group:error', onGroupError);
				manualImportQueueService.off('batch:complete', onBatchComplete);
			};
		});
	}

	const progress = manualImportQueueService.getProgress(jobId);
	if (!progress) {
		return json(
			{
				success: false,
				error: 'Import job not found'
			},
			{ status: 404 }
		);
	}
	return json({ success: true, data: progress });
};
