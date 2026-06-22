export type ReleaseStageKind =
	| 'availableDigital'
	| 'availablePhysical'
	| 'digitalUpcoming'
	| 'physicalUpcoming'
	| 'inTheaters'
	| 'comingToTheaters'
	| 'announced';

export interface ReleaseStage {
	kind: ReleaseStageKind;
	days?: number;
}

export interface ReleaseStageFacts {
	theatricalMs: number | null;
	digitalMs: number | null;
	physicalMs: number | null;
}

function isValid(ms: number | null): ms is number {
	return ms !== null && !Number.isNaN(ms);
}

function daysUntil(ms: number, nowMs: number): number {
	return Math.ceil((ms - nowMs) / (1000 * 60 * 60 * 24));
}

function earliestFutureHome(
	digitalMs: number | null,
	physicalMs: number | null,
	nowMs: number
): { ms: number; type: 'digital' | 'physical' } | null {
	const candidates: { ms: number; type: 'digital' | 'physical' }[] = [];
	if (isValid(digitalMs) && digitalMs > nowMs) candidates.push({ ms: digitalMs, type: 'digital' });
	if (isValid(physicalMs) && physicalMs > nowMs)
		candidates.push({ ms: physicalMs, type: 'physical' });

	if (candidates.length === 0) return null;
	candidates.sort((a, b) => a.ms - b.ms);
	return candidates[0];
}

/**
 * The single source of truth for "what release stage is a movie in?".
 *
 * Classification is driven purely by the release DATES, never by TMDB's
 * `status` field. TMDB reports `status: "Released"` as soon as a film opens in
 * theaters, which says nothing about home/digital availability — so a movie is
 * only "Available" when it has a past digital or physical release date. A movie
 * whose theatrical date is past but has no home-release date is "In Theaters"
 * (real catalog titles carry their own past digital/physical dates and resolve
 * to "Available" on their own).
 *
 * Both the display layer (`getSmartReleaseLine`) and the availability layer
 * (`getMovieAvailabilityLevel`) derive from this so they can never contradict.
 */
export function resolveReleaseStage(
	facts: ReleaseStageFacts,
	now: Date = new Date()
): ReleaseStage {
	const nowMs = now.getTime();
	const { theatricalMs, digitalMs, physicalMs } = facts;

	const digitalPast = isValid(digitalMs) && digitalMs <= nowMs;
	const physicalPast = isValid(physicalMs) && physicalMs <= nowMs;

	if (digitalPast) return { kind: 'availableDigital' };
	if (physicalPast) return { kind: 'availablePhysical' };

	const theatricalPast = isValid(theatricalMs) && theatricalMs <= nowMs;

	if (theatricalPast) {
		const next = earliestFutureHome(digitalMs, physicalMs, nowMs);
		if (next) {
			return {
				kind: next.type === 'digital' ? 'digitalUpcoming' : 'physicalUpcoming',
				days: daysUntil(next.ms, nowMs)
			};
		}
		return { kind: 'inTheaters' };
	}

	if (isValid(theatricalMs)) {
		return { kind: 'comingToTheaters', days: daysUntil(theatricalMs, nowMs) };
	}

	return { kind: 'announced' };
}
