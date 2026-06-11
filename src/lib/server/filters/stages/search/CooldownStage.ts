import type { DecisionStage, StageResult } from '../../types.js';
import type { SearchEligibilityContext } from './types.js';

const DEFAULT_COOLDOWN_HOURS = 12;
const MIN_COOLDOWN_HOURS = 1;
const MAX_COOLDOWN_HOURS = 24;

export class CooldownStage implements DecisionStage<SearchEligibilityContext> {
	name = 'cooldown';

	private cooldownHours: number;

	constructor(cooldownHours: number = DEFAULT_COOLDOWN_HOURS) {
		this.cooldownHours = Math.min(MAX_COOLDOWN_HOURS, Math.max(cooldownHours, MIN_COOLDOWN_HOURS));
	}

	isEnabled(ctx: SearchEligibilityContext): boolean {
		return !ctx.options.forceSearch;
	}

	async evaluate(ctx: SearchEligibilityContext): Promise<StageResult> {
		const lastSearchTime = ctx.episode?.lastSearchTime ?? ctx.media.lastSearchTime;

		if (!lastSearchTime) {
			return { accepted: true };
		}

		const lastSearch = new Date(lastSearchTime);
		const now = new Date();
		const hoursSinceSearch = (now.getTime() - lastSearch.getTime()) / (1000 * 60 * 60);

		if (hoursSinceSearch < this.cooldownHours) {
			const hoursRemaining = Math.round((this.cooldownHours - hoursSinceSearch) * 10) / 10;
			return {
				accepted: false,
				reason: `Recently searched, cooldown: ${hoursRemaining}h remaining`
			};
		}

		return { accepted: true };
	}
}
