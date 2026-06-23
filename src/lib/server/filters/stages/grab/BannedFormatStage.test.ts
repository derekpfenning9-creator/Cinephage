import { describe, expect, it } from 'vitest';
import { BannedFormatStage } from './BannedFormatStage.js';
import { makeGrabDecisionContext } from '../../../../../test/fixtures/filters.js';

const stage = new BannedFormatStage();

describe('BannedFormatStage', () => {
	describe('isEnabled', () => {
		it('returns true by default', () => {
			expect(stage.isEnabled(makeGrabDecisionContext())).toBe(true);
		});

		it('returns false when force is true', () => {
			const ctx = makeGrabDecisionContext({
				options: { force: true, skipBlocklist: false, allowSidegrade: false, isAutomatic: true }
			});
			expect(stage.isEnabled(ctx)).toBe(false);
		});
	});

	describe('evaluate', () => {
		it('accepts when not banned', async () => {
			const ctx = makeGrabDecisionContext({ computed: { isBanned: false, bannedReasons: [] } });
			const result = await stage.evaluate(ctx);
			expect(result.accepted).toBe(true);
		});

		it('accepts when isBanned is undefined', async () => {
			const ctx = makeGrabDecisionContext({ computed: {} });
			const result = await stage.evaluate(ctx);
			expect(result.accepted).toBe(true);
		});

		it('rejects when banned', async () => {
			const ctx = makeGrabDecisionContext({
				computed: { isBanned: true, bannedReasons: ['YIFY', 'Fake HDR'] }
			});
			const result = await stage.evaluate(ctx);
			expect(result.accepted).toBe(false);
			expect(result.reason).toBe('Banned format: YIFY, Fake HDR');
		});

		it('shows unknown when no reasons', async () => {
			const ctx = makeGrabDecisionContext({ computed: { isBanned: true, bannedReasons: [] } });
			const result = await stage.evaluate(ctx);
			expect(result.accepted).toBe(false);
			expect(result.reason).toContain('Banned format');
		});
	});
});
