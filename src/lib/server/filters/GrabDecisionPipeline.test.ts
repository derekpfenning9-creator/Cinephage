import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrabDecisionContext } from './stages/grab/types.js';

const mockIsBlocklisted = vi.hoisted(() => vi.fn());
const mockCalculateEnhancedScore = vi.hoisted(() => vi.fn());
const mockParse = vi.hoisted(() => vi.fn());
const mockIsUpgrade = vi.hoisted(() => vi.fn());
const mockBuildExistingAttrs = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/blocklist/BlocklistService.js', () => ({
	blocklistService: { isBlocklisted: mockIsBlocklisted }
}));

vi.mock('$lib/server/quality/QualityFilter.js', () => ({
	qualityFilter: { calculateEnhancedScore: mockCalculateEnhancedScore }
}));

vi.mock('$lib/server/indexers/parser/ReleaseParser.js', () => ({
	ReleaseParser: class {
		parse = mockParse;
	}
}));

vi.mock('$lib/server/db/index.js', () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => Object.assign([], { limit: () => [] })
			})
		})
	}
}));

vi.mock('$lib/server/settings/blocked-extensions.js', () => ({
	resolveBlockedExtensionsForQueueItem: vi.fn().mockReturnValue([])
}));

vi.mock('$lib/server/scoring/scorer.js', () => ({
	isUpgrade: mockIsUpgrade
}));

vi.mock('$lib/server/monitoring/specifications/utils.js', () => ({
	buildExistingAttrs: mockBuildExistingAttrs
}));

vi.mock('drizzle-orm', () => ({
	and: vi.fn(),
	eq: vi.fn(),
	inArray: vi.fn()
}));

vi.mock('$lib/server/db/schema.js', () => ({
	downloadQueue: {
		id: 'id',
		infoHash: 'infoHash',
		movieId: 'movieId',
		status: 'status',
		importedAt: 'importedAt'
	},
	movieFiles: { id: 'id', movieId: 'movieId' },
	movies: { id: 'id', hasFile: 'hasFile' }
}));

const { GrabDecisionPipeline } = await import('./GrabDecisionPipeline.js');

function makeCtx(overrides: Partial<GrabDecisionContext> = {}): GrabDecisionContext {
	return {
		release: {
			title: 'Movie.2024.1080p.BluRay.x264-GROUP',
			size: 8_000_000_000,
			indexerName: 'nzbgeek',
			protocol: 'usenet'
		},
		target: { type: 'movie', movieId: 'movie-1' },
		existingFiles: [],
		profile: {
			id: 'balanced',
			formatScores: {},
			minScore: 0,
			upgradesAllowed: true,
			minScoreIncrement: 10
		} as any,
		options: { force: false, skipBlocklist: false, allowSidegrade: false, isAutomatic: true },
		computed: {},
		...overrides
	};
}

function setupPassingScoring() {
	mockParse.mockReturnValue({ originalTitle: 'Movie.2024.1080p.BluRay.x264-GROUP' });
	mockCalculateEnhancedScore.mockReturnValue({
		scoringResult: {
			totalScore: 150,
			isBanned: false,
			bannedReasons: [],
			sizeRejected: false,
			sizeRejectionReason: undefined,
			protocolRejected: false,
			protocolRejectionReason: undefined,
			meetsMinimum: true
		},
		score: 150
	});
}

describe('GrabDecisionPipeline', () => {
	const pipeline = new GrabDecisionPipeline();

	beforeEach(() => {
		vi.clearAllMocks();
		mockIsBlocklisted.mockResolvedValue({ blocked: false });
		mockBuildExistingAttrs.mockReturnValue({});
		setupPassingScoring();
	});

	it('accepts a new release with no existing files', async () => {
		const ctx = makeCtx();
		const decision = await pipeline.evaluate(ctx);

		expect(decision.accepted).toBe(true);
		expect(decision.upgradeStatus).toBe('new');
		expect(decision.scores.candidate).toBe(150);
		expect(decision.scores.existing).toBeUndefined();
		expect(decision.rejectionType).toBeUndefined();
	});

	it('skips most stages when force is true', async () => {
		const ctx = makeCtx({
			options: { force: true, skipBlocklist: false, allowSidegrade: false, isAutomatic: false },
			existingFiles: [
				{
					id: 'f1',
					relativePath: '/movies/existing.mkv',
					sceneName: 'Movie.2024.720p.WEB-DL'
				}
			]
		});

		const decision = await pipeline.evaluate(ctx);

		expect(decision.accepted).toBe(true);
		const skippedStages = decision.audit.stages.filter((s) => s.skipped);
		expect(skippedStages.length).toBeGreaterThanOrEqual(5);
	});

	it('produces correct stage names and timing in audit trail', async () => {
		const ctx = makeCtx();
		const decision = await pipeline.evaluate(ctx);

		const stageNames = decision.audit.stages.map((s) => s.name);
		expect(stageNames).toEqual([
			'blocklist',
			'scoring',
			'bannedFormat',
			'sizeValidation',
			'protocol',
			'minimumScore',
			'duplicateHash',
			'mediaOccupancy',
			'blockedExtension',
			'upgrade'
		]);
		expect(decision.audit.totalDurationMs).toBeGreaterThanOrEqual(0);
		for (const stage of decision.audit.stages) {
			expect(stage.durationMs).toBeGreaterThanOrEqual(0);
		}
	});

	it('rejects a blocklisted release with correct rejectionType', async () => {
		mockIsBlocklisted.mockResolvedValue({ blocked: true, reason: 'Manually blocklisted' });

		const ctx = makeCtx();
		const decision = await pipeline.evaluate(ctx);

		expect(decision.accepted).toBe(false);
		expect(decision.rejectionType).toBe('blocklisted');
		expect(decision.reason).toBe('Manually blocklisted');
	});

	it('rejects a banned format release with correct rejectionType', async () => {
		mockParse.mockReturnValue({ originalTitle: 'Bad.Movie.YIFY' });
		mockCalculateEnhancedScore.mockReturnValue({
			scoringResult: {
				totalScore: -999999,
				isBanned: true,
				bannedReasons: ['YIFY'],
				sizeRejected: false,
				sizeRejectionReason: undefined,
				protocolRejected: false,
				protocolRejectionReason: undefined,
				meetsMinimum: false
			},
			score: -999999
		});

		const ctx = makeCtx();
		const decision = await pipeline.evaluate(ctx);

		expect(decision.accepted).toBe(false);
		expect(decision.rejectionType).toBe('banned');
		expect(decision.reason).toContain('Banned format');
	});
});
