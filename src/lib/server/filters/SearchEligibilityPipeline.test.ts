import { describe, expect, it, vi, afterEach } from 'vitest';
import { SearchEligibilityPipeline } from './SearchEligibilityPipeline.js';
import { makeSearchEligibilityContext } from '../../../test/fixtures/filters.js';

vi.mock('$lib/server/db/index.js', () => ({
	db: {
		query: {
			seasons: { findFirst: vi.fn() }
		},
		select: () => ({ from: () => ({ where: () => ({ get: () => null }) }) })
	}
}));

vi.mock('$lib/server/db/schema.js', () => ({
	seasons: { id: 'id' },
	rootFolders: { id: 'id', readOnly: 'readOnly' }
}));

vi.mock('drizzle-orm', () => ({
	eq: (col: string, val: string) => ({ col, val })
}));

vi.mock('$lib/utils/movieAvailability', () => ({
	isMovieAvailableForSearch: () => true,
	getMovieAvailabilityLevel: () => 'released'
}));

vi.mock('$lib/server/tmdb.js', () => ({
	tmdb: { getMovieReleaseInfo: vi.fn() }
}));

describe('SearchEligibilityPipeline', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('rejects unmonitored movie at MonitoredStage', async () => {
		const pipeline = new SearchEligibilityPipeline();
		const ctx = makeSearchEligibilityContext({
			media: { id: 'movie-1', monitored: false, tmdbId: 12345, minimumAvailability: 'announced' }
		});

		const audit = await pipeline.evaluate(ctx);

		expect(audit.finalResult.accepted).toBe(false);
		expect(audit.finalResult.reason).toBe('Movie is not monitored');

		const monitoredEntry = audit.stages.find((s) => s.name === 'monitored');
		expect(monitoredEntry?.result?.accepted).toBe(false);
	});

	it('accepts with forceSearch (all stages skipped)', async () => {
		const pipeline = new SearchEligibilityPipeline();
		const ctx = makeSearchEligibilityContext({ options: { forceSearch: true } });

		const audit = await pipeline.evaluate(ctx);

		expect(audit.finalResult.accepted).toBe(true);
		expect(audit.stages.every((s) => s.skipped)).toBe(true);
	});

	it('rejects recently searched movie at CooldownStage', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));

		const pipeline = new SearchEligibilityPipeline();
		const ctx = makeSearchEligibilityContext({
			media: {
				id: 'movie-1',
				monitored: true,
				tmdbId: 12345,
				minimumAvailability: 'announced',
				lastSearchTime: '2024-06-01T10:00:00Z'
			}
		});

		const audit = await pipeline.evaluate(ctx);

		expect(audit.finalResult.accepted).toBe(false);
		expect(audit.finalResult.reason).toContain('cooldown');

		const cooldownEntry = audit.stages.find((s) => s.name === 'cooldown');
		expect(cooldownEntry?.result?.accepted).toBe(false);
	});
});
