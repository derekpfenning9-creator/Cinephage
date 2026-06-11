import { composeDecisionStages } from './compositor.js';
import type { DecisionAudit } from './types.js';
import type {
	GrabDecisionContext,
	GrabDecision,
	RejectionType,
	UpgradeStats
} from './stages/grab/types.js';
import { BlocklistStage } from './stages/grab/BlocklistStage.js';
import { ScoringStage } from './stages/grab/ScoringStage.js';
import { BannedFormatStage } from './stages/grab/BannedFormatStage.js';
import { SizeValidationStage } from './stages/grab/SizeValidationStage.js';
import { ProtocolStage } from './stages/grab/ProtocolStage.js';
import { MinimumScoreStage } from './stages/grab/MinimumScoreStage.js';
import { DuplicateHashStage } from './stages/grab/DuplicateHashStage.js';
import { BlockedExtensionStage } from './stages/grab/BlockedExtensionStage.js';
import { UpgradeStage } from './stages/grab/UpgradeStage.js';

export class GrabDecisionPipeline {
	private stages = [
		new BlocklistStage(),
		new ScoringStage(),
		new BannedFormatStage(),
		new SizeValidationStage(),
		new ProtocolStage(),
		new MinimumScoreStage(),
		new DuplicateHashStage(),
		new BlockedExtensionStage(),
		new UpgradeStage()
	];

	async evaluate(ctx: GrabDecisionContext, options?: { runAll?: boolean }): Promise<GrabDecision> {
		const audit = await composeDecisionStages(this.stages, ctx, options);

		const upgradeStageResult = audit.stages.find((s) => s.name === 'upgrade');
		const upgradeStats = upgradeStageResult?.result?.details?.upgradeStats as
			| UpgradeStats
			| undefined;

		const rejectionType = !audit.finalResult.accepted ? this.mapRejectionType(audit) : undefined;

		return {
			accepted: audit.finalResult.accepted,
			reason: audit.finalResult.reason ?? (audit.finalResult.accepted ? 'Accepted' : 'Rejected'),
			rejectionType,
			upgradeStatus:
				ctx.computed.upgradeStatus ?? (ctx.existingFiles.length === 0 ? 'new' : 'rejected'),
			scores: {
				candidate: ctx.computed.candidateScore ?? 0,
				existing: ctx.computed.existingScore,
				improvement:
					ctx.computed.existingScore !== undefined
						? (ctx.computed.candidateScore ?? 0) - ctx.computed.existingScore
						: undefined
			},
			upgradeStats,
			audit
		};
	}

	private mapRejectionType(audit: DecisionAudit): RejectionType | undefined {
		const rejectingStage = audit.stages.find((s) => !s.skipped && s.result && !s.result.accepted);
		if (!rejectingStage) return undefined;

		const map: Record<string, RejectionType> = {
			blocklist: 'blocklisted',
			bannedFormat: 'banned',
			sizeValidation: 'size_rejected',
			protocol: 'protocol_rejected',
			minimumScore: 'below_minimum',
			duplicateHash: 'duplicate_hash',
			blockedExtension: 'blocked_extension',
			upgrade: 'not_upgrade'
		};

		return map[rejectingStage.name];
	}
}

export const grabDecisionPipeline = new GrabDecisionPipeline();
