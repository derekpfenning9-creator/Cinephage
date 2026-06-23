/**
 * MissingContentSpecification
 *
 * Checks if content is missing (no file yet) and ready to be searched for.
 * For episodes, also checks if the episode has aired.
 */

import type {
	IMonitoringSpecification,
	MovieContext,
	EpisodeContext,
	SpecificationResult,
	ReleaseCandidate
} from './types.js';
import { reject, accept, RejectionReason } from './types.js';

/**
 * Check if a movie is missing and ready to search
 */
export class MovieMissingContentSpecification implements IMonitoringSpecification<MovieContext> {
	async isSatisfied(
		context: MovieContext,
		_release?: ReleaseCandidate
	): Promise<SpecificationResult> {
		// Check if already has file
		if (context.movie.hasFile) {
			return reject(RejectionReason.ALREADY_HAS_FILE);
		}

		// If it doesn't have a file, it's missing
		return accept();
	}
}

/**
 * Check if an episode is missing and ready to search
 */
export class EpisodeMissingContentSpecification implements IMonitoringSpecification<EpisodeContext> {
	async isSatisfied(
		context: EpisodeContext,
		_release?: ReleaseCandidate
	): Promise<SpecificationResult> {
		// Check if already has file
		if (context.episode.hasFile) {
			return reject(RejectionReason.ALREADY_HAS_FILE);
		}

		// Check if episode has aired
		if (context.episode.airDate) {
			const airDate = new Date(context.episode.airDate + 'T00:00:00');
			const now = new Date();

			if (airDate > now) {
				return reject(RejectionReason.NOT_YET_AIRED);
			}
		}

		// Missing and aired (or no air date known)
		return accept();
	}
}

/**
 * Convenience function to check if a movie is missing
 */
export async function isMovieMissing(context: MovieContext): Promise<boolean> {
	const spec = new MovieMissingContentSpecification();
	const result = await spec.isSatisfied(context);
	return result.accepted;
}

/**
 * Convenience function to check if an episode is missing
 */
export async function isEpisodeMissing(context: EpisodeContext): Promise<boolean> {
	const spec = new EpisodeMissingContentSpecification();
	const result = await spec.isSatisfied(context);
	return result.accepted;
}
