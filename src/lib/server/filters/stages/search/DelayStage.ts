import type { DecisionStage, StageResult } from '../../types.js';
import type { SearchEligibilityContext } from './types.js';

// NOTE: Full delay logic (protocol-based delays, pending release queue, bypass conditions)
// remains in DelaySpecification.ts. This stage is a placeholder that always accepts.
// Integration with the delay profile system will be added in a future iteration.

export class DelayStage implements DecisionStage<SearchEligibilityContext> {
	name = 'delay';

	isEnabled(ctx: SearchEligibilityContext): boolean {
		return !ctx.options.forceSearch;
	}

	async evaluate(_ctx: SearchEligibilityContext): Promise<StageResult> {
		return { accepted: true };
	}
}
