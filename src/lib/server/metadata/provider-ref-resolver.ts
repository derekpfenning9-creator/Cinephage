import { buildMetadataProviderRegistry } from './provider-registry.js';
import type { MetadataProviderId, MetadataSearchResult } from './providers/types.js';

type AnimeProviderId = Extract<MetadataProviderId, 'anilist' | 'mal'>;

export interface ResolveProviderRefsInput {
	title: string;
	aliases?: string[];
	year?: number | null;
	isAnime: boolean;
	configured: Record<AnimeProviderId, boolean>;
	existingRefs?: Partial<Record<MetadataProviderId, string>> | null;
}

function normalize(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokens(value: string): string[] {
	return normalize(value)
		.split(/[^a-z0-9]+/g)
		.filter(Boolean);
}

function tokenOverlapScore(a: string, b: string): number {
	const aTokens = new Set(tokens(a));
	const bTokens = new Set(tokens(b));
	if (aTokens.size === 0 || bTokens.size === 0) return 0;
	let shared = 0;
	for (const token of aTokens) {
		if (bTokens.has(token)) shared += 1;
	}
	return shared / Math.max(aTokens.size, bTokens.size);
}

const INCLUDES_MIN_LEN = 4;

function pickBestMatch(
	results: MetadataSearchResult[],
	titles: string[],
	year?: number | null
): { result: MetadataSearchResult; confidence: 'high' | 'low' } | null {
	if (results.length === 0) return null;
	const normalizedTargets = titles.map((title) => normalize(title)).filter(Boolean);
	const plainTargets = titles.filter((title) => title.trim().length > 0);
	if (normalizedTargets.length === 0) return null;

	const candidates = results.map((result) => {
		const normalizedTitle = normalize(result.title);
		const yearDelta =
			typeof year === 'number' && typeof result.year === 'number'
				? Math.abs(year - result.year)
				: null;
		const exact = normalizedTargets.some((target) => normalizedTitle === target);
		// Bidirectional includes: both sides must meet minimum length to avoid trivial matches
		const includes = normalizedTargets.some((target) => {
			if (!target || target.length < INCLUDES_MIN_LEN || normalizedTitle.length < INCLUDES_MIN_LEN)
				return false;
			return normalizedTitle.includes(target) || target.includes(normalizedTitle);
		});
		const overlap = plainTargets.length
			? Math.max(...plainTargets.map((target) => tokenOverlapScore(result.title, target)))
			: 0;
		// Heavier year penalty when delta > 1 to push mismatched years down rankings
		const yearPenalty = yearDelta !== null ? (yearDelta > 1 ? yearDelta * 50 : yearDelta) : 0;
		const score =
			(exact ? 1000 : 0) + (includes ? 200 : 0) + Math.round(overlap * 100) - yearPenalty;
		return { result, score, yearDelta, exact, includes, overlap };
	});
	candidates.sort((a, b) => b.score - a.score);

	const best = candidates[0];
	if (!best) return null;
	const withinYear = typeof best.yearDelta !== 'number' || best.yearDelta <= 1;
	const strongTextMatch = best.exact || best.includes || best.overlap >= 0.7;
	if (!strongTextMatch || !withinYear) return null;

	// Runner-up margin: if the second candidate is close and we have no exact match, downgrade confidence
	const runnerUp = candidates[1];
	const ambiguous = !best.exact && runnerUp !== undefined && best.score - runnerUp.score < 150;
	const confidence: 'high' | 'low' =
		best.exact || (best.overlap >= 0.8 && !ambiguous && withinYear) ? 'high' : 'low';

	return { result: best.result, confidence };
}

export async function resolveAnimeProviderRef(input: {
	providerId: AnimeProviderId;
	title: string;
	aliases?: string[];
	year?: number | null;
}): Promise<string | undefined> {
	const queryVariants = [...new Set([input.title, ...(input.aliases ?? [])])]
		.map((value) => value.trim())
		.filter(Boolean);
	if (queryVariants.length === 0) return undefined;

	const { providers } = await buildMetadataProviderRegistry();
	const provider = providers.get(input.providerId);
	if (!provider?.isConfigured()) return undefined;

	for (const query of queryVariants) {
		try {
			const results = await provider.searchTitle(query, 'anime');
			const best = pickBestMatch(results, queryVariants, input.year);
			if (best?.confidence === 'high' && best.result.id) return String(best.result.id);
		} catch {
			// continue trying other variants
		}
	}

	return undefined;
}

export async function resolveMissingAnimeProviderRefs(
	input: ResolveProviderRefsInput
): Promise<Partial<Record<MetadataProviderId, string>>> {
	const baseRefs: Partial<Record<MetadataProviderId, string>> = { ...(input.existingRefs ?? {}) };
	if (!input.isAnime || !input.title?.trim()) return baseRefs;

	const wantedProviders: AnimeProviderId[] = (['anilist', 'mal'] as const).filter(
		(providerId) => input.configured[providerId] && !baseRefs[providerId]
	);
	if (wantedProviders.length === 0) return baseRefs;
	const queryVariants = [...new Set([input.title, ...(input.aliases ?? [])])]
		.map((value) => value.trim())
		.filter(Boolean);
	if (queryVariants.length === 0) return baseRefs;

	await Promise.all(
		wantedProviders.map(async (providerId) => {
			const ref = await resolveAnimeProviderRef({
				providerId,
				title: input.title,
				aliases: input.aliases,
				year: input.year
			});
			if (ref) baseRefs[providerId] = ref;
		})
	);

	return baseRefs;
}
