import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaOccupancyStage } from './MediaOccupancyStage.js';
import type { GrabDecisionContext } from './types.js';

const mockCheck = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/acquisition/MediaOccupancyService.js', () => ({
	mediaOccupancyService: { check: mockCheck }
}));

function makeCtx(overrides: Partial<GrabDecisionContext> = {}): GrabDecisionContext {
	return {
		release: { title: 'Test.Series.S01E01.1080p.WEB-DL' },
		target: { type: 'episode', seriesId: 'series-1', episodeId: 'episode-1' },
		existingFiles: [],
		profile: { id: 'balanced', formatScores: {}, upgradesAllowed: true } as any,
		options: { force: false, skipBlocklist: false, allowSidegrade: false, isAutomatic: true },
		computed: {},
		...overrides
	};
}

describe('MediaOccupancyStage', () => {
	const stage = new MediaOccupancyStage();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('is disabled for forced grabs', () => {
		const ctx = makeCtx({
			options: { force: true, skipBlocklist: false, allowSidegrade: false, isAutomatic: true }
		});

		expect(stage.isEnabled(ctx)).toBe(false);
	});

	it('is disabled for manual grabs', () => {
		const ctx = makeCtx({
			options: { force: false, skipBlocklist: false, allowSidegrade: false, isAutomatic: false }
		});

		expect(stage.isEnabled(ctx)).toBe(false);
	});

	it('accepts when target is not occupied', async () => {
		mockCheck.mockResolvedValue({ occupied: false });

		const ctx = makeCtx();
		const result = await stage.evaluate(ctx);

		expect(result.accepted).toBe(true);
		expect(mockCheck).toHaveBeenCalledWith(ctx.target, { isUpgrade: undefined });
	});

	it('rejects automatic duplicate episode grabs when target is occupied', async () => {
		mockCheck.mockResolvedValue({
			occupied: true,
			reason: 'episode_already_downloading',
			details: { queueItemId: 'queue-1' }
		});

		const result = await stage.evaluate(makeCtx());

		expect(result.accepted).toBe(false);
		expect(result.reason).toBe('Media target is already occupied: episode_already_downloading');
		expect(result.details).toEqual({
			rejectionType: 'media_occupied',
			reason: 'episode_already_downloading',
			queueItemId: 'queue-1'
		});
	});

	it('passes upgrade intent to occupancy service', async () => {
		mockCheck.mockResolvedValue({ occupied: false });
		const ctx = makeCtx({
			options: {
				force: false,
				skipBlocklist: false,
				allowSidegrade: false,
				isAutomatic: true,
				isUpgrade: true
			}
		});

		await stage.evaluate(ctx);

		expect(mockCheck).toHaveBeenCalledWith(ctx.target, { isUpgrade: true });
	});
});
