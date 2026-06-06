import { LibraryStage } from './stages/LibraryStage.js';
import { BlockedMediaStage } from './stages/BlockedMediaStage.js';
import { composeStages } from './stages/Compositor.js';
import type { FilterContext, StageRun } from './stages/types.js';

export interface ContentFilterResult<T> {
	results: T[];
	stages: StageRun[];
}

export class ContentFilterPipeline {
	private stages = [new LibraryStage(), new BlockedMediaStage()];

	async apply<T extends { id: number; media_type?: string }>(
		items: T[],
		ctx: FilterContext
	): Promise<ContentFilterResult<T>> {
		return composeStages(this.stages, items, ctx) as Promise<ContentFilterResult<T>>;
	}
}

export const contentFilterPipeline = new ContentFilterPipeline();
