export interface FilterStage<T> {
	name: string;
	apply(items: T[], ctx: FilterContext): Promise<T[]>;
	isEnabled(ctx: FilterContext): boolean;
}

export interface FilterContext {
	mediaType: 'movie' | 'tv' | 'all';
	excludeInLibrary?: boolean;
	skipBlockedMedia?: boolean;
}

export interface StageRun {
	stageName: string;
	before: number;
	after: number;
	removed: number;
	skipped: boolean;
}
