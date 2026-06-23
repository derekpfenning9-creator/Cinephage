import { mediaOccupancyService } from '$lib/server/acquisition/MediaOccupancyService.js';
import type { DecisionStage, StageResult } from '../../types.js';
import type { GrabDecisionContext } from './types.js';

export class MediaOccupancyStage implements DecisionStage<GrabDecisionContext> {
	name = 'mediaOccupancy';

	isEnabled(ctx: GrabDecisionContext): boolean {
		return !ctx.options.force && ctx.options.isAutomatic;
	}

	async evaluate(ctx: GrabDecisionContext): Promise<StageResult> {
		const result = await mediaOccupancyService.check(ctx.target, {
			isUpgrade: ctx.options.isUpgrade
		});

		if (!result.occupied) {
			return { accepted: true };
		}

		return {
			accepted: false,
			reason: `Media target is already occupied: ${result.reason}`,
			details: {
				rejectionType: 'media_occupied',
				reason: result.reason,
				...result.details
			}
		};
	}
}
