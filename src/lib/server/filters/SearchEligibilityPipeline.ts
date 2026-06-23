import { composeDecisionStages } from './compositor.js';
import type { DecisionAudit } from './types.js';
import type { SearchEligibilityContext } from './stages/search/types.js';
import { MonitoredStage } from './stages/search/MonitoredStage.js';
import { AvailabilityStage } from './stages/search/AvailabilityStage.js';
import { DelayStage } from './stages/search/DelayStage.js';
import { WritableStage } from './stages/search/WritableStage.js';
import { UpgradeEligibleStage } from './stages/search/UpgradeEligibleStage.js';
import { CooldownStage } from './stages/search/CooldownStage.js';

export type { SearchEligibilityContext };

export class SearchEligibilityPipeline {
	private stages = [
		new MonitoredStage(),
		new AvailabilityStage(),
		new DelayStage(),
		new WritableStage(),
		new UpgradeEligibleStage(),
		new CooldownStage()
	];

	async evaluate(ctx: SearchEligibilityContext): Promise<DecisionAudit> {
		return composeDecisionStages(this.stages, ctx);
	}
}

export const searchEligibilityPipeline = new SearchEligibilityPipeline();
