import { describe, expect, it, vi, afterEach } from 'vitest';
import { CooldownStage } from './CooldownStage.js';
import { makeSearchEligibilityContext } from '../../../../../test/fixtures/filters.js';

const stage = new CooldownStage();

describe('CooldownStage', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	describe('isEnabled', () => {
		it('returns true by default', () => {
			expect(stage.isEnabled(makeSearchEligibilityContext())).toBe(true);
		});

		it('returns false when forceSearch is true', () => {
			const ctx = makeSearchEligibilityContext({ options: { forceSearch: true } });
			expect(stage.isEnabled(ctx)).toBe(false);
		});
	});

	describe('evaluate', () => {
		it('accepts when never searched', async () => {
			const ctx = makeSearchEligibilityContext({
				media: { id: 'movie-1', monitored: true, tmdbId: 12345 }
			});
			const result = await stage.evaluate(ctx);
			expect(result.accepted).toBe(true);
		});

		it('accepts when searched more than 12 hours ago', async () => {
			vi.useFakeTimers();
			const now = new Date('2024-06-01T12:00:00Z');
			vi.setSystemTime(now);

			const ctx = makeSearchEligibilityContext({
				media: {
					id: 'movie-1',
					monitored: true,
					tmdbId: 12345,
					lastSearchTime: '2024-05-31T22:00:00Z'
				}
			});
			const result = await stage.evaluate(ctx);
			expect(result.accepted).toBe(true);
		});

		it('rejects when searched less than 12 hours ago', async () => {
			vi.useFakeTimers();
			const now = new Date('2024-06-01T12:00:00Z');
			vi.setSystemTime(now);

			const ctx = makeSearchEligibilityContext({
				media: {
					id: 'movie-1',
					monitored: true,
					tmdbId: 12345,
					lastSearchTime: '2024-06-01T06:00:00Z'
				}
			});
			const result = await stage.evaluate(ctx);
			expect(result.accepted).toBe(false);
			expect(result.reason).toContain('cooldown');
		});

		it('uses episode lastSearchTime when episode context is present', async () => {
			vi.useFakeTimers();
			const now = new Date('2024-06-01T12:00:00Z');
			vi.setSystemTime(now);

			const ctx = makeSearchEligibilityContext({
				media: { id: 'movie-1', monitored: true, tmdbId: 12345 },
				episode: {
					id: 'ep-1',
					monitored: true,
					lastSearchTime: '2024-06-01T06:00:00Z'
				},
				series: { id: 'series-1', monitored: true }
			});
			const result = await stage.evaluate(ctx);
			expect(result.accepted).toBe(false);
		});
	});
});
