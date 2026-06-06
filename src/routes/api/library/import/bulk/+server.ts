import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { z } from 'zod';
import { manualImportSchema } from '$lib/validation/schemas.js';
import { manualImportQueueService } from '$lib/server/library/ManualImportQueueService.js';
import { isPathAllowed, isPathInsideManagedRoot } from '$lib/server/filesystem/path-guard.js';
import { logger } from '$lib/logging';
import { requireAdmin } from '$lib/server/auth/authorization.js';

const bulkSchema = z.object({
	jobs: z
		.array(
			z.object({
				request: manualImportSchema,
				groupName: z.string().optional()
			})
		)
		.min(1)
		.max(500)
});

export const POST: RequestHandler = async (event) => {
	const authError = requireAdmin(event);
	if (authError) return authError;

	const { request } = event;
	try {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
		}

		const parsed = bulkSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{
					success: false,
					error: 'Validation failed',
					details: parsed.error.flatten()
				},
				{ status: 400 }
			);
		}

		for (const job of parsed.data.jobs) {
			const importPath = job.request.sourcePath ?? job.request.selectedFilePath;
			if (!importPath) continue;

			if (!(await isPathAllowed(importPath))) {
				return json(
					{
						success: false,
						error: `Access denied: Path ${importPath} is outside allowed directories`
					},
					{ status: 403 }
				);
			}

			if (await isPathInsideManagedRoot(importPath)) {
				return json(
					{
						success: false,
						error: `Import source ${importPath} cannot be inside a managed root folder`
					},
					{ status: 400 }
				);
			}
		}

		const jobId = manualImportQueueService.submit(parsed.data.jobs);

		logger.info({ jobId, count: parsed.data.jobs.length }, '[API] Manual import bulk submitted');

		return json({
			success: true,
			data: {
				jobId,
				totalGroups: parsed.data.jobs.length
			}
		});
	} catch (error) {
		logger.error('[API] Manual import bulk failed', error instanceof Error ? error : undefined);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to submit import jobs'
			},
			{ status: 500 }
		);
	}
};
