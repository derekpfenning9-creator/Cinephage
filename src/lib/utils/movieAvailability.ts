import { resolveReleaseStage, type ReleaseStage } from './releaseStage.js';

export type MovieAvailabilityLevel = 'announced' | 'inCinemas' | 'released';

export interface ReleaseStageInfo {
	/** Human-readable stage name: 'digital', 'physical', 'tv' */
	type: 'digital' | 'physical' | 'tv';
	/** ISO date string of the earliest past release */
	date: string;
	/** Whether this date is in the past (release is available now) */
	isPast: boolean;
}

interface MovieAvailabilityInput {
	year: number | null | undefined;
	added: string | null | undefined;
	tmdbStatus?: string | null | undefined;
	releaseDate?: string | null | undefined;
	/** Flattened release dates from TMDB release_dates response */
	releaseDates?: Array<{ type: number; release_date: string }> | null | undefined;
	digitalReleaseDate?: string | null | undefined;
	physicalReleaseDate?: string | null | undefined;
	availabilityDelay?: number;
}

const DOWNLOADABLE_TYPES = new Set([4, 5, 6]);

const TYPE_NAME: Record<number, 'digital' | 'physical' | 'tv'> = {
	4: 'digital',
	5: 'physical',
	6: 'tv'
};

/**
 * Extract the earliest downloadable release stage from TMDB release_dates data.
 * Returns the earliest Digital (4), Physical (5), or TV (6) release.
 * If multiple types exist, returns the one with the earliest date.
 */
export function getReleaseStageInfo(
	releaseDates?: Array<{ type: number; release_date: string }> | null,
	now: Date = new Date()
): ReleaseStageInfo | null {
	if (!releaseDates || releaseDates.length === 0) return null;

	let earliest: ReleaseStageInfo | null = null;

	for (const rd of releaseDates) {
		if (!DOWNLOADABLE_TYPES.has(rd.type)) continue;

		const dateStr = rd.release_date?.substring(0, 10);
		if (!dateStr) continue;

		const ts = new Date(dateStr).getTime();
		if (Number.isNaN(ts)) continue;

		if (!earliest || ts < new Date(earliest.date).getTime()) {
			earliest = {
				type: TYPE_NAME[rd.type] ?? 'digital',
				date: dateStr,
				isPast: ts <= now.getTime()
			};
		}
	}

	return earliest;
}

function toMs(date: string | null | undefined): number | null {
	return date ? new Date(date).getTime() : null;
}

function isValidMs(ms: number | null): ms is number {
	return ms !== null && !Number.isNaN(ms);
}

function stageToLevel(stage: ReleaseStage): MovieAvailabilityLevel {
	switch (stage.kind) {
		case 'availableDigital':
		case 'availablePhysical':
			return 'released';
		case 'digitalUpcoming':
		case 'physicalUpcoming':
		case 'inTheaters':
			return 'inCinemas';
		case 'comingToTheaters':
		case 'announced':
			return 'announced';
	}
}

function earliestFutureByType(
	releaseDates: Array<{ type: number; release_date: string }>,
	type: number,
	nowMs: number
): number | null {
	let earliest: number | null = null;
	for (const rd of releaseDates) {
		if (rd.type !== type) continue;
		const ms = new Date(rd.release_date).getTime();
		if (Number.isNaN(ms) || ms <= nowMs) continue;
		if (earliest === null || ms < earliest) earliest = ms;
	}
	return earliest;
}

/**
 * Determine movie availability using TMDB status/date when available.
 * Falls back to year/added heuristics when TMDB metadata is unavailable.
 *
 * The "in theaters vs coming soon vs released" decision is delegated to
 * {@link resolveReleaseStage} so this matches the user-facing release line.
 * In particular, a movie whose theatrical date is still in the future is
 * 'announced' (not yet in cinemas), never 'inCinemas'.
 */
export function getMovieAvailabilityLevel(
	movie: MovieAvailabilityInput,
	now: Date = new Date()
): MovieAvailabilityLevel {
	const nowMs = now.getTime();
	const releaseDates = movie.releaseDates;
	const theatricalMs = toMs(movie.releaseDate);

	// Mode A: explicit digital/physical dates available.
	if (movie.digitalReleaseDate || movie.physicalReleaseDate) {
		return stageToLevel(
			resolveReleaseStage(
				{
					theatricalMs,
					digitalMs: toMs(movie.digitalReleaseDate),
					physicalMs: toMs(movie.physicalReleaseDate)
				},
				now
			)
		);
	}

	// Mode B: typed TMDB release_dates available.
	if (releaseDates && releaseDates.length > 0) {
		// Any past Digital/Physical/TV release means it is downloadable.
		const hasPastDownloadable = releaseDates.some((rd) => {
			if (!DOWNLOADABLE_TYPES.has(rd.type)) return false;
			const dateStr = rd.release_date?.substring(0, 10);
			if (!dateStr) return false;
			const ts = new Date(dateStr).getTime();
			return !Number.isNaN(ts) && ts <= nowMs;
		});

		if (hasPastDownloadable) return 'released';

		const status = movie.tmdbStatus?.trim().toLowerCase();
		if (
			status === 'in production' ||
			status === 'planned' ||
			status === 'rumored' ||
			status === 'canceled'
		) {
			return 'announced';
		}

		const stage = resolveReleaseStage(
			{
				theatricalMs,
				digitalMs: earliestFutureByType(releaseDates, 4, nowMs),
				physicalMs: earliestFutureByType(releaseDates, 5, nowMs)
			},
			now
		);

		if (status === 'released' || status === 'post production') {
			// A theatrically-released movie with no granular dates is still "in cinemas".
			if (stage.kind === 'announced') return 'inCinemas';
			return stageToLevel(stage);
		}

		// Unknown status: decide from a known theatrical date, else fall back to heuristics.
		if (isValidMs(theatricalMs)) {
			return stageToLevel(stage);
		}
	}

	// === Legacy heuristics (no usable TMDB metadata) ===

	const status = movie.tmdbStatus?.trim().toLowerCase();

	if (status === 'released') return 'released';
	if (status === 'post production') {
		// A known theatrical date wins: past → released, future → not yet in cinemas.
		if (isValidMs(theatricalMs)) return theatricalMs <= nowMs ? 'released' : 'announced';
		return 'inCinemas';
	}
	if (status === 'in production' || status === 'planned' || status === 'rumored') {
		return 'announced';
	}
	if (status === 'canceled') {
		return 'announced';
	}

	// Use explicit TMDB release date when status is unavailable/unknown.
	if (isValidMs(theatricalMs)) {
		return theatricalMs <= nowMs ? 'released' : 'announced';
	}

	const currentYear = now.getFullYear();
	const movieYear = movie.year;

	if (!movieYear) return 'announced';
	if (movieYear > currentYear) return 'announced';
	if (movieYear < currentYear) return 'released';

	// Current-year movies are unreleased by default and only considered released
	// after they have been in-library for a sustained period.
	const addedTimestamp = movie.added ? new Date(movie.added).getTime() : Number.NaN;
	if (Number.isNaN(addedTimestamp)) return 'inCinemas';

	const daysSinceAdded = (nowMs - addedTimestamp) / (1000 * 60 * 60 * 24);
	if (daysSinceAdded > 120) return 'released';
	return 'inCinemas';
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function isMovieAvailableForSearch(
	movie: {
		minimumAvailability: string | null | undefined;
		releaseDate?: string | null;
		digitalReleaseDate?: string | null;
		physicalReleaseDate?: string | null;
		availabilityDelay?: number;
	},
	now: Date = new Date()
): boolean {
	const minimum = movie.minimumAvailability || 'released';
	const delay = (movie.availabilityDelay ?? 0) * 24 * 60 * 60 * 1000;
	const nowMs = now.getTime();

	if (minimum === 'announced') return true;

	const theatricalMs = movie.releaseDate ? new Date(movie.releaseDate).getTime() : null;

	if (minimum === 'inCinemas') {
		if (theatricalMs !== null && !Number.isNaN(theatricalMs)) {
			return theatricalMs + delay <= nowMs;
		}
		return false;
	}

	const digitalMs = movie.digitalReleaseDate ? new Date(movie.digitalReleaseDate).getTime() : null;
	const physicalMs = movie.physicalReleaseDate
		? new Date(movie.physicalReleaseDate).getTime()
		: null;

	const candidates: number[] = [];
	if (digitalMs !== null && !Number.isNaN(digitalMs)) candidates.push(digitalMs);
	if (physicalMs !== null && !Number.isNaN(physicalMs)) candidates.push(physicalMs);

	if (candidates.length > 0) {
		const earliest = Math.min(...candidates);
		return earliest + delay <= nowMs;
	}

	if (theatricalMs !== null && !Number.isNaN(theatricalMs)) {
		return theatricalMs + NINETY_DAYS_MS + delay <= nowMs;
	}

	return false;
}
