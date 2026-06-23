import type { DecisionStage, StageResult } from '../../types.js';
import type { SearchEligibilityContext } from './types.js';

export class UpgradeEligibleStage implements DecisionStage<SearchEligibilityContext> {
	name = 'upgradeEligible';

	isEnabled(ctx: SearchEligibilityContext): boolean {
		return !ctx.options.forceSearch;
	}

	async evaluate(ctx: SearchEligibilityContext): Promise<StageResult> {
		if (!ctx.existingFile) {
			return { accepted: true };
		}

		if (!ctx.profile.upgradesAllowed) {
			return { accepted: false, reason: 'Upgrades are not allowed by profile' };
		}

		return { accepted: true };
	}
}
