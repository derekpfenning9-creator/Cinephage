/**
 * Anime metadata enrichment helpers.
 *
 * Anime providers (AniList, Jikan) are supplementary to TMDB. They contribute:
 *   - adult/hentai flag (WP-Q)
 *   - alternate / romaji titles (feeds alternate-title store for search)
 *   - additive genre tags (merged onto TMDB genres, never replacing)
 *
 * TMDB is always the canonical identity/overview/display record.
 */

import { buildMetadataProviderRegistry } from './provider-registry.js';
import { resolveAnimeProviderRef } from './provider-ref-resolver.js';
import type { MetadataDetails, MetadataMediaType } from './providers/types.js';
import { createChildLogger } from '$lib/logging';

const logger = createChildLogger({ logDomain: 'system' as const });

export interface AnimeEnrichmentInput {
	tmdbTitle: string;
	aliases: string[];
	year?: number | null;
}

export interface AnimeEnrichmentResult {
	/** Refs keyed by provider id ('anilist', 'mal') for storage in providerRefs */
	refs: Record<string, string>;
	/** Provider details from each provider that resolved, for adult flag and alt-title extraction */
	details: Record<string, MetadataDetails>;
}

/**
 * Fetch supplementary anime enrichment from AniList and Jikan.
 * Returns empty if enrichment is disabled in config.
 * Always fails soft: a provider outage does not throw.
 */
export async function enrichAnimeMetadata(
	input: AnimeEnrichmentInput,
	mediaType: MetadataMediaType
): Promise<AnimeEnrichmentResult> {
	const result: AnimeEnrichmentResult = { refs: {}, details: {} };

	const registry = await buildMetadataProviderRegistry();
	if (!registry.enrichmentEnabled) return result;

	const providerIds = ['anilist', 'mal'] as const;

	await Promise.all(
		providerIds.map(async (providerId) => {
			const provider = registry.providers.get(providerId);
			if (!provider?.isConfigured()) return;

			try {
				const ref = await resolveAnimeProviderRef({
					providerId,
					title: input.tmdbTitle,
					aliases: input.aliases,
					year: input.year ?? undefined
				});
				if (!ref) return;

				const details = await provider.getDetails(ref, mediaType);
				if (!details) return;

				result.refs[providerId] = ref;
				result.details[providerId] = details;
			} catch (err) {
				logger.warn(
					{
						providerId,
						title: input.tmdbTitle,
						error: err instanceof Error ? err.message : String(err)
					},
					'[AnimeEnrichment] Provider failed - skipping'
				);
			}
		})
	);

	return result;
}
