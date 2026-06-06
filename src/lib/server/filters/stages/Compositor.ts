import type { FilterStage, FilterContext, StageRun } from './types.js';

export async function composeStages<T>(
	stages: FilterStage<T>[],
	items: T[],
	ctx: FilterContext
): Promise<{ results: T[]; stages: StageRun[] }> {
	const stageRuns: StageRun[] = [];
	let current = items;

	for (const stage of stages) {
		if (!stage.isEnabled(ctx)) {
			stageRuns.push({
				stageName: stage.name,
				before: current.length,
				after: current.length,
				removed: 0,
				skipped: true
			});
			continue;
		}

		const before = current.length;
		current = await stage.apply(current, ctx);
		const after = current.length;

		stageRuns.push({
			stageName: stage.name,
			before,
			after,
			removed: before - after,
			skipped: false
		});
	}

	return { results: current, stages: stageRuns };
}
